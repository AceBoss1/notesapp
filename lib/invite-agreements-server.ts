import type { Firestore, Transaction } from "firebase-admin/firestore";
import { getUserEmail } from "./firebase-admin";
import { sendEmail } from "./email";
import { SITE_URL } from "./host";
import {
  INVITE_TERMS_VERSION, accessOf, isInviteAccess, termsLines,
  type AgreedTerms, type EffectiveAccess, type InviteAgreementFields, type InviteKind,
} from "./invite-terms";

// Server-only. What co-author and co-tutor invitations share: checking that the member agreed to the terms they were shown, recording
// the agreement, and telling people (the bell and an email). Journal invites are in lib/coauthors-server.ts, course invites in
// lib/courses-server.ts.

export class InviteTermsError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

// The answer from the accept screen. Accepting needs agree: true, the terms version the screen showed, and the access and share the
// member saw: if the lead changed them in the meantime, the member must look again.
export type InviteAnswer = { accept: boolean; agree?: boolean; termsVersion?: unknown; seen?: { access?: unknown; percent?: unknown }; userAgent?: string };

// The terms an answer would agree to: a fresh invite's, or the change the lead proposed to an accepted one.
export function termsOnOffer(kind: InviteKind, inv: InviteAgreementFields & { percent: number; status: string }): { access: EffectiveAccess; percent: number } | null {
  if (inv.status === "pending") return { access: accessOf(kind, inv), percent: Number(inv.percent) || 0 };
  if (inv.status === "accepted" && inv.change) return { access: inv.change.access, percent: inv.change.percent };
  return null;
}

export function checkAgreement(answer: InviteAnswer, offer: { access: EffectiveAccess; percent: number }): void {
  if (!answer.accept) return;
  if (answer.agree !== true) throw new InviteTermsError("Read the terms and tap Accept and agree.", 400, "needs_agreement");
  if (answer.termsVersion !== INVITE_TERMS_VERSION) throw new InviteTermsError("The terms were updated. Reload the page to read them again.", 409, "terms_changed");
  const seenAccess = answer.seen?.access, seenPercent = Number(answer.seen?.percent);
  const accessSame = seenAccess === offer.access || (offer.access === "credit" && !isInviteAccess(seenAccess));
  if (!accessSame || seenPercent !== offer.percent) throw new InviteTermsError("The lead changed the terms while you were reading. Look at them again.", 409, "terms_changed");
}

// Records the agreement: the snapshot on the invite (agreedAt, agreedTerms; shown to the lead as "Accepted on …"), and the full record
// with the wording and the browser in inviteAgreements (server-only: firestore.rules lets no one read it from a browser).
export function recordAgreement(
  db: Firestore, t: Transaction, kind: InviteKind, inviteId: string, uid: string,
  terms: Omit<AgreedTerms, "kind" | "termsVersion">, userAgent: string | undefined, now: Date,
): { agreedAt: string; agreedTerms: AgreedTerms } {
  const agreedTerms: AgreedTerms = { kind, ...terms, termsVersion: INVITE_TERMS_VERSION };
  const agreedAt = now.toISOString();
  t.set(db.collection("inviteAgreements").doc(), {
    kind, inviteId, uid, agreedAt, terms: agreedTerms, wording: termsLines(kind, terms),
    ...(userAgent ? { userAgent: String(userAgent).slice(0, 300) } : {}),
  });
  return { agreedAt, agreedTerms };
}

// The bell, and an email when the member has an address. Tests swap the email part out (setInviteMailer) and read the bell.
type Mail = (uid: string, m: { subject: string; text: string; linkHref: string }) => Promise<void>;
let mailer: Mail = async (uid, m) => {
  const to = await getUserEmail(uid);
  if (to) await sendEmail({ to, subject: m.subject, text: m.text, action: { label: "Open", url: `${SITE_URL}${m.linkHref}` } });
};
export function setInviteMailer(m: Mail) { mailer = m; }

export async function tellMember(db: Firestore, n: {
  uid: string; kind: InviteKind; message: string; linkHref: string; subject?: string;
  actor?: { username?: string; displayName?: string; avatar?: string };
}): Promise<void> {
  if (!n.uid) return;
  await db.collection("notifications").add({
    recipientUid: n.uid, type: n.kind === "journal" ? "coauthor" : "course", message: n.message.slice(0, 280), read: false,
    createdAt: new Date().toISOString(), linkHref: n.linkHref,
    ...(n.actor?.username ? { actorUsername: n.actor.username, actorDisplayName: n.actor.displayName ?? n.actor.username } : {}),
    ...(n.actor?.avatar ? { actorAvatar: n.actor.avatar } : {}),
  }).catch((e) => console.error("[invites] bell failed", e));
  await mailer(n.uid, { subject: n.subject ?? n.message.slice(0, 90), text: `${n.message}\n\n#NotesApp`, linkHref: n.linkHref }).catch(() => {});
}
