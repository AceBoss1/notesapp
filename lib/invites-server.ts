import type { Firestore } from "firebase-admin/firestore";
import { canAcceptCoAuthor, type CoAuthorInvite } from "./coauthors";
import { respondCoAuthor } from "./coauthors-server";
import { CourseError, respondTutor } from "./courses-server";
import { canPublish, type UserProfile } from "./users";
import { InviteTermsError, termsOnOffer, type InviteAnswer } from "./invite-agreements-server";
import { INVITE_TERMS_VERSION, accessOf, type AgreedTerms, type EffectiveAccess, type InviteKind, type PendingChange } from "./invite-terms";
import type { TutorInvite } from "./courses";

// Server-only. One invitation as the accept screen (/invites/<kind>/<id>) shows it, to the member it's for or the lead who sent it,
// and the member's answer. Journal invites: coAuthorInvites/{noteId}_{uid}; course invites: courseTutorInvites/{courseId}_{uid}.
export type InviteView = {
  kind: InviteKind; id: string; viewer: "invitee" | "lead";
  status: string; title: string; cover: string; published: boolean;
  lead: { name: string; username: string; avatar: string };
  invitee: { name: string; username: string };
  access: EffectiveAccess; percent: number; // the terms in force (or offered, while pending)
  change: PendingChange | null; // a change the lead proposed to an accepted invite
  offer: { access: EffectiveAccess; percent: number } | null; // what Accept and agree would agree to now
  agreedAt: string | null; agreedTerms: AgreedTerms | null; termsVersion: string;
  openHref: string; // where the member reads (or edits) the journal or course
  canAccept: boolean; // a share is paid to a publishing account: Free Basic or above
};

const safeId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(id);

export async function inviteView(db: Firestore, uid: string, kind: InviteKind, id: string): Promise<InviteView> {
  if (!safeId(id)) throw new InviteTermsError("Which invite?");
  const me = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (kind === "journal") {
    const inv = (await db.doc(`coAuthorInvites/${id}`).get()).data() as CoAuthorInvite | undefined;
    if (!inv || (inv.inviteeUid !== uid && inv.leadUid !== uid)) throw new InviteTermsError("Invite not found.", 404);
    const [note, lead] = await Promise.all([db.doc(`notes/${inv.noteId}`).get(), db.doc(`users/${inv.leadUid}`).get()]);
    const n = note.data() ?? {};
    const published = n.status === "published";
    return {
      kind, id, viewer: inv.inviteeUid === uid ? "invitee" : "lead", status: inv.status,
      title: String(n.title || inv.noteTitle), cover: String(n.featured_image || ""), published,
      lead: { name: inv.leadName, username: inv.leadUsername, avatar: String(lead.data()?.avatar ?? "") },
      invitee: { name: inv.inviteeName, username: inv.inviteeUsername },
      access: accessOf("journal", inv), percent: inv.percent, change: inv.change ?? null,
      offer: published ? null : termsOnOffer("journal", inv),
      agreedAt: inv.agreedAt ?? null, agreedTerms: inv.agreedTerms ?? null, termsVersion: INVITE_TERMS_VERSION,
      openHref: published && n.slug ? `/notes/${n.slug}` : `/write/${inv.noteId}/shared`,
      canAccept: canAcceptCoAuthor(me),
    };
  }
  const inv = (await db.doc(`courseTutorInvites/${id}`).get()).data() as TutorInvite | undefined;
  if (!inv) throw new InviteTermsError("Invite not found.", 404);
  const cs = await db.doc(`courses/${inv.courseId}`).get();
  const c = cs.data() ?? {};
  const isLead = inv.invitedByUid === uid || c.ownerUid === uid;
  if (inv.uid !== uid && !isLead) throw new InviteTermsError("Invite not found.", 404);
  const owner = (await db.doc(`users/${inv.ownerUid}`).get()).data();
  return {
    kind, id, viewer: inv.uid === uid ? "invitee" : "lead", status: inv.status,
    title: String(c.title || inv.courseTitle), cover: String(c.cover || ""), published: c.status === "published",
    lead: { name: String(c.ownerName || inv.ownerName), username: String(c.ownerUsername || owner?.username || ""), avatar: String(c.ownerAvatar || owner?.avatar || "") },
    invitee: { name: inv.name, username: inv.username },
    access: accessOf("course", inv), percent: inv.percent, change: inv.change ?? null,
    offer: cs.exists ? termsOnOffer("course", inv) : null,
    agreedAt: inv.agreedAt ?? null, agreedTerms: inv.agreedTerms ?? null, termsVersion: INVITE_TERMS_VERSION,
    openHref: `/academy/${String(c.slug || inv.courseSlug)}`,
    canAccept: !!me && me.suspended !== true && canPublish(me),
  };
}

export async function answerInvite(db: Firestore, uid: string, kind: InviteKind, id: string, answer: InviteAnswer): Promise<void> {
  if (!safeId(id)) throw new InviteTermsError("Which invite?");
  if (kind === "journal") { await respondCoAuthor(db, uid, id, answer); return; }
  const inv = (await db.doc(`courseTutorInvites/${id}`).get()).data() as TutorInvite | undefined;
  if (!inv || inv.uid !== uid) throw new InviteTermsError("Invite not found.", 404);
  try { await respondTutor(db, uid, inv.courseId, answer); }
  catch (e) { if (e instanceof CourseError) throw new InviteTermsError(e.message, e.status); throw e; }
}
