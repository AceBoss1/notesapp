import { createHash } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  MAX_CO_AUTHORS, MIN_LEAD_PERCENT, canAcceptCoAuthor, canLeadCoAuthors, inviteId as makeInviteId, leadPercent, minPercentFor,
  type CoAuthorInvite,
} from "./coauthors";
import { accessLabel, accessOf, accessRank, invitePath, isInviteAccess, type EffectiveAccess, type InviteAccess } from "./invite-terms";
import { InviteTermsError, checkAgreement, recordAgreement, tellMember, termsOnOffer, type InviteAnswer } from "./invite-agreements-server";

// Server-only. Every change to a journal's co-authors (coAuthorInvites/{noteId}_{inviteeUid}) and every co-author's read or edit of
// the draft happens here, called by /api/coauthors and /api/coauthors/draft. The rules (lib/invite-terms.ts):
//   - the lead (a Pro, Business or Enterprise publisher, or an admin) invites on a DRAFT with an access level and a share;
//   - "view" may be 0% (credited without a share), "edit" at least MIN_CO_PERCENT; the lead keeps at least MIN_LEAD_PERCENT;
//   - the member accepts on /invites/journal/<id>, agreeing to the terms shown (recorded as agreedAt + agreedTerms);
//   - the lead may change access or share while it's a draft: less access applies at once; more access or a different share waits
//     for the member to agree (the agreed terms stay until then);
//   - once the post is published nothing changes: no invites, no changes, no draft edits.
export { InviteTermsError as CoAuthorError };

type Me = { uid: string; username: string; displayName: string; avatar?: string; role?: string; accountTier?: string; suspended?: boolean };
const iso = (now: Date) => now.toISOString();
const safeId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(id);
const live = (i: CoAuthorInvite) => i.status === "pending" || i.status === "accepted";
const actorOf = (me: Me) => ({ username: me.username, displayName: me.displayName, avatar: me.avatar });

async function member(db: Firestore, uid: string): Promise<Me> {
  const d = (await db.doc(`users/${uid}`).get()).data();
  if (!d || d.suspended === true) throw new InviteTermsError("This account can't do that.", 403);
  return { uid, ...(d as Omit<Me, "uid">) };
}
async function draftOf(db: Firestore, noteId: string) {
  const snap = await db.doc(`notes/${noteId}`).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}
async function invitesOf(db: Firestore, noteId: string) {
  return (await db.collection("coAuthorInvites").where("noteId", "==", noteId).get()).docs.map((d) => d.data() as CoAuthorInvite);
}

// Rebuild the note's public co-author list from the ACCEPTED invites.
async function syncNote(db: Firestore, noteId: string) {
  const snap = await db.collection("coAuthorInvites").where("noteId", "==", noteId).where("status", "==", "accepted").get();
  const accepted = snap.docs.map((d) => d.data() as CoAuthorInvite).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  await db.doc(`notes/${noteId}`).update(
    accepted.length
      ? { coAuthorUids: accepted.map((i) => i.inviteeUid), coAuthors: accepted.map((i) => i.inviteeName) }
      : { coAuthorUids: FieldValue.delete(), coAuthors: FieldValue.delete() }
  );
}

function checkShare(access: InviteAccess, percent: number) {
  const min = minPercentFor(access);
  if (!Number.isInteger(percent) || percent < min || percent > 100 - MIN_LEAD_PERCENT) {
    throw new InviteTermsError(access === "view"
      ? `A share must be a whole number from 0 to ${100 - MIN_LEAD_PERCENT}%.`
      : `A co-author who can edit gets at least ${min}%: a whole number from ${min} to ${100 - MIN_LEAD_PERCENT}%.`);
  }
}
function checkLeadKeeps(others: CoAuthorInvite[], percent: number) {
  const left = leadPercent(others);
  if (left - percent < MIN_LEAD_PERCENT) throw new InviteTermsError(`You must keep at least ${MIN_LEAD_PERCENT}%. You have ${Math.max(0, left - MIN_LEAD_PERCENT)}% left to give.`);
}

// ---------------------------------------------------------------- invite
export async function inviteCoAuthor(db: Firestore, uid: string, body: { noteId?: unknown; username?: unknown; percent?: unknown; access?: unknown }, now = new Date()): Promise<CoAuthorInvite> {
  const me = await member(db, uid);
  if (!canLeadCoAuthors(me)) throw new InviteTermsError("Inviting co-authors is a Pro and Business feature.", 403, "needs_pro");
  if (!safeId(body.noteId)) throw new InviteTermsError("Which post?");
  const noteId = body.noteId;
  const note = await draftOf(db, noteId);
  if (!note || note.authorUid !== uid) throw new InviteTermsError("You can only add co-authors to your own post.", 403);
  if (note.status !== "draft") throw new InviteTermsError("Co-authors can only be added while the post is a draft.", 409);
  // Older clients sent no access: they invited co-authors who could edit nothing, so "edit" would be a surprise. "view" is the least.
  const access: InviteAccess = isInviteAccess(body.access) ? body.access : "view";
  const percent = Number(body.percent);
  checkShare(access, percent);

  const username = String(body.username || "").trim().toLowerCase().replace(/^@/, "");
  const inviteeUid = username ? ((await db.doc(`usernames/${username}`).get()).data()?.uid as string | undefined) : undefined;
  const invitee = inviteeUid ? (await db.doc(`users/${inviteeUid}`).get()).data() : null;
  if (!inviteeUid || !invitee) throw new InviteTermsError("No member with that username.", 404);
  if (inviteeUid === uid) throw new InviteTermsError("You're already the lead author.");
  if (invitee.suspended) throw new InviteTermsError("That member can't be invited right now.", 409);

  const others = (await invitesOf(db, noteId)).filter(live);
  if (others.some((i) => i.inviteeUid === inviteeUid)) throw new InviteTermsError("They're already invited.", 409);
  if (others.length >= MAX_CO_AUTHORS) throw new InviteTermsError(`A post can have at most ${MAX_CO_AUTHORS} co-authors.`, 409);
  checkLeadKeeps(others, percent);

  const invite: CoAuthorInvite = {
    noteId, noteTitle: String(note.title || "Untitled"), leadUid: uid, leadName: me.displayName, leadUsername: me.username,
    inviteeUid, inviteeUsername: String(invitee.username), inviteeName: String(invitee.displayName || invitee.username),
    percent, access, status: "pending", createdAt: iso(now),
  };
  const id = makeInviteId(noteId, inviteeUid);
  await db.doc(`coAuthorInvites/${id}`).set(invite);
  await tellMember(db, {
    uid: inviteeUid, kind: "journal", linkHref: invitePath("journal", id), actor: actorOf(me),
    subject: `${me.displayName} invited you to co-author "${invite.noteTitle}"`,
    message: `${me.displayName} invited you to co-author "${invite.noteTitle}" (${accessLabel(access).toLowerCase()}${percent ? `, ${percent}% of its earnings` : ", no share"}). Read the terms, then accept or decline.`,
  });
  return invite;
}

// ---------------------------------------------------------------- change (lead)
// The lead changes an invite's access or share while the post is a draft. On a pending invite the new terms replace the old ones
// (and the member is told). On an accepted one: less access applies at once; more access, or any change to the share, is proposed
// and waits for the member to agree on the accept screen.
export async function changeCoAuthor(db: Firestore, uid: string, body: { inviteId?: unknown; access?: unknown; percent?: unknown }, now = new Date()): Promise<{ applied: boolean; proposed: boolean }> {
  const me = await member(db, uid);
  if (!safeId(body.inviteId)) throw new InviteTermsError("Which invite?");
  const id = body.inviteId;
  const ref = db.doc(`coAuthorInvites/${id}`);
  const inv = (await ref.get()).data() as CoAuthorInvite | undefined;
  if (!inv || inv.leadUid !== uid) throw new InviteTermsError("Invite not found.", 404);
  if (!live(inv)) throw new InviteTermsError(`This invite is already ${inv.status}.`, 409);
  const note = await draftOf(db, inv.noteId);
  if (!note || note.status !== "draft") throw new InviteTermsError("The split is locked once the post is published.", 409);
  if (!isInviteAccess(body.access)) throw new InviteTermsError("Choose Can view or Can view and edit.");
  const access = body.access, percent = Number(body.percent);
  checkShare(access, percent);
  checkLeadKeeps((await invitesOf(db, inv.noteId)).filter((i) => live(i) && i.inviteeUid !== inv.inviteeUid), percent);

  const was: EffectiveAccess = accessOf("journal", inv);
  const title = inv.noteTitle;
  if (inv.status === "pending") {
    if (access === inv.access && percent === inv.percent) return { applied: false, proposed: false };
    await ref.update({ access, percent, change: FieldValue.delete() });
    await tellMember(db, {
      uid: inv.inviteeUid, kind: "journal", linkHref: invitePath("journal", id), actor: actorOf(me),
      message: `${me.displayName} changed your invite to co-author "${title}": ${accessLabel(access).toLowerCase()}${percent ? `, ${percent}% of its earnings` : ", no share"}. Read the new terms before you answer.`,
    });
    return { applied: true, proposed: false };
  }
  // Accepted: what applies now, and what waits for them.
  const lower = accessRank(access) < accessRank(was);
  const needsYes = accessRank(access) > accessRank(was) || percent !== inv.percent;
  const patch: Record<string, unknown> = {};
  if (lower) patch.access = access;
  patch.change = needsYes ? { access, percent, proposedAt: iso(now) } : FieldValue.delete();
  if (!lower && !needsYes) {
    if (inv.change) await ref.update({ change: FieldValue.delete() }); // the lead took back a proposal
    return { applied: false, proposed: false };
  }
  await ref.update(patch);
  if (lower) {
    await tellMember(db, {
      uid: inv.inviteeUid, kind: "journal", linkHref: `/write/${inv.noteId}/shared`, actor: actorOf(me),
      message: `${me.displayName} changed your access to the draft of "${title}" to ${accessLabel(access).toLowerCase()}. This applies now; your share is unchanged.`,
    });
  }
  if (needsYes) {
    await tellMember(db, {
      uid: inv.inviteeUid, kind: "journal", linkHref: invitePath("journal", id), actor: actorOf(me),
      subject: `${me.displayName} asks you to agree to new terms for "${title}"`,
      message: `${me.displayName} proposes new terms for "${title}": ${accessLabel(access).toLowerCase()}, ${percent ? `${percent}% of its earnings` : "no share"}. Your current terms stay until you agree.`,
    });
  }
  return { applied: lower, proposed: needsYes };
}

// ---------------------------------------------------------------- revoke (lead) and leave (co-author)
export async function revokeCoAuthor(db: Firestore, uid: string, inviteId: unknown, now = new Date()): Promise<void> {
  const me = await member(db, uid);
  if (!safeId(inviteId)) throw new InviteTermsError("Which invite?");
  const ref = db.doc(`coAuthorInvites/${inviteId}`);
  const inv = (await ref.get()).data() as CoAuthorInvite | undefined;
  if (!inv || inv.leadUid !== uid) throw new InviteTermsError("Invite not found.", 404);
  const note = await draftOf(db, inv.noteId);
  if (!note || note.status !== "draft") throw new InviteTermsError("The split is locked once the post is published.", 409);
  if (!live(inv)) throw new InviteTermsError(`This invite is already ${inv.status}.`, 409);
  await ref.update({ status: "revoked", respondedAt: iso(now), change: FieldValue.delete() });
  await syncNote(db, inv.noteId);
  await tellMember(db, {
    uid: inv.inviteeUid, kind: "journal", linkHref: "/invites", actor: actorOf(me),
    message: inv.status === "accepted"
      ? `${me.displayName} removed you as a co-author of "${inv.noteTitle}". You no longer see the draft, and you won't be credited or share its earnings.`
      : `${me.displayName} withdrew the invite to co-author "${inv.noteTitle}".`,
  });
}

export async function leaveCoAuthor(db: Firestore, uid: string, inviteId: unknown, now = new Date()): Promise<void> {
  const me = await member(db, uid);
  if (!safeId(inviteId)) throw new InviteTermsError("Which invite?");
  const ref = db.doc(`coAuthorInvites/${inviteId}`);
  const inv = (await ref.get()).data() as CoAuthorInvite | undefined;
  if (!inv || inv.inviteeUid !== uid) throw new InviteTermsError("Invite not found.", 404);
  if (inv.status !== "accepted") throw new InviteTermsError("You're not a co-author of this post.", 409);
  const note = await draftOf(db, inv.noteId);
  if (!note || note.status !== "draft") throw new InviteTermsError("The post is published, so the co-authors are locked. Ask the lead if you need to be removed.", 409);
  await ref.update({ status: "revoked", respondedAt: iso(now), leftAt: iso(now), change: FieldValue.delete() });
  await syncNote(db, inv.noteId);
  await tellMember(db, {
    uid: inv.leadUid, kind: "journal", linkHref: `/write/${inv.noteId}/edit`, actor: actorOf(me),
    message: `${me.displayName} left as a co-author of "${inv.noteTitle}". Their share is yours again.`,
  });
}

// ---------------------------------------------------------------- respond (invitee)
// Accepting needs the agreement (lib/invite-agreements-server.ts). The same answer covers a fresh invite and a change the lead proposed
// to an accepted one; declining a change keeps the terms already agreed.
export async function respondCoAuthor(db: Firestore, uid: string, inviteId: unknown, answer: InviteAnswer, now = new Date()): Promise<{ status: string }> {
  const me = await member(db, uid);
  if (!safeId(inviteId)) throw new InviteTermsError("Which invite?");
  const ref = db.doc(`coAuthorInvites/${inviteId}`);
  const inv = (await ref.get()).data() as CoAuthorInvite | undefined;
  if (!inv || inv.inviteeUid !== uid) throw new InviteTermsError("Invite not found.", 404);
  const offer = termsOnOffer("journal", inv);
  if (!offer) throw new InviteTermsError(`This invite is already ${inv.status}.`, 409);
  const isChange = inv.status === "accepted";
  const note = await draftOf(db, inv.noteId);
  if (!note || note.status !== "draft") {
    await ref.update(isChange ? { change: FieldValue.delete() } : { status: "expired", respondedAt: iso(now) });
    throw new InviteTermsError(isChange ? "The post was published, so the split is locked and the change lapsed." : "This post was already published or removed, so the invite expired.", 409);
  }
  if (answer.accept && !canAcceptCoAuthor(me)) throw new InviteTermsError("To accept, you need a publishing account — apply for Free Basic first.", 403, "needs_basic");
  checkAgreement(answer, offer);

  const title = String(note.title || inv.noteTitle);
  await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as CoAuthorInvite | undefined;
    const again = cur ? termsOnOffer("journal", cur) : null;
    if (!cur || !again || again.access !== offer.access || again.percent !== offer.percent) throw new InviteTermsError("The lead changed the terms while you were reading. Look at them again.", 409, "terms_changed");
    if (!answer.accept) {
      t.update(ref, isChange ? { change: FieldValue.delete() } : { status: "declined", respondedAt: iso(now) });
      return;
    }
    const agreed = recordAgreement(db, t, "journal", String(inviteId), uid, { title, leadName: inv.leadName, access: offer.access, percent: offer.percent }, answer.userAgent, now);
    t.update(ref, {
      status: "accepted", respondedAt: iso(now), percent: offer.percent, noteTitle: title,
      ...(offer.access !== "credit" ? { access: offer.access } : {}), change: FieldValue.delete(), ...agreed,
    });
  });
  if (answer.accept && !isChange) await syncNote(db, inv.noteId);
  const what = isChange ? `the new terms for "${title}"` : `your co-author invite for "${title}"`;
  await tellMember(db, {
    uid: inv.leadUid, kind: "journal", linkHref: `/write/${inv.noteId}/edit`, actor: actorOf(me),
    message: answer.accept
      ? `${me.displayName} accepted and agreed to ${what} (${accessLabel(offer.access).toLowerCase()}, ${offer.percent}%).`
      : `${me.displayName} declined ${what}.${isChange ? " Their earlier terms still apply." : ""}`,
  });
  return { status: answer.accept ? "accepted" : isChange ? "accepted" : "declined" };
}

// ---------------------------------------------------------------- the draft, for co-authors
export type SharedDraft = {
  note: { id: string; title: string; content: string; featured_image: string; status: string; slug: string; author: string; authorUsername: string; coEditedAt?: string; coEditedByName?: string };
  access: EffectiveAccess | "lead"; version: string; leadName: string; inviteId: string | null;
};
export const draftVersion = (n: { title?: unknown; content?: unknown }) => createHash("sha256").update(`${String(n.title ?? "")}\u0000${String(n.content ?? "")}`).digest("hex").slice(0, 24);

async function coAuthorAccess(db: Firestore, uid: string, noteId: string): Promise<{ note: Record<string, unknown>; access: EffectiveAccess | "lead"; inv: CoAuthorInvite | null }> {
  if (!safeId(noteId)) throw new InviteTermsError("Which post?");
  const note = await draftOf(db, noteId);
  if (!note) throw new InviteTermsError("That post doesn't exist (any more).", 404);
  if (note.authorUid === uid) return { note, access: "lead", inv: null };
  const inv = (await db.doc(`coAuthorInvites/${makeInviteId(noteId, uid)}`).get()).data() as CoAuthorInvite | undefined;
  if (!inv || inv.status !== "accepted") throw new InviteTermsError("Only the post's co-authors can open its draft.", 403);
  return { note, access: accessOf("journal", inv), inv };
}

// A co-author with "view" or "edit" reads the draft (a published post is public anyway: the page sends them there).
export async function sharedDraft(db: Firestore, uid: string, noteId: string): Promise<SharedDraft> {
  const { note, access, inv } = await coAuthorAccess(db, uid, noteId);
  if (access === "credit") throw new InviteTermsError("Your invite was for credit and a share only, without seeing the draft. Ask the lead for access.", 403, "no_access");
  return {
    note: {
      id: noteId, title: String(note.title ?? ""), content: String(note.content ?? ""), featured_image: String(note.featured_image ?? ""),
      status: String(note.status ?? "draft"), slug: String(note.slug ?? ""), author: String(note.author ?? ""), authorUsername: String(note.authorUsername ?? ""),
      ...(note.coEditedAt ? { coEditedAt: String(note.coEditedAt), coEditedByName: String(note.coEditedByName ?? "") } : {}),
    },
    access, version: draftVersion(note), leadName: inv?.leadName ?? String(note.author ?? ""), inviteId: inv ? makeInviteId(noteId, uid) : null,
  };
}

export const DRAFT_TITLE_MAX = 200;
export const DRAFT_CONTENT_MAX = 200_000;
// A co-author with "edit" saves the draft's title and text. Nothing else on the post changes (its address, topics, picture, video,
// status and authors stay the lead's), and nothing changes once it's published. `version` is what they loaded: if the lead or
// another co-author saved in between, the save is refused so nobody's words are lost.
export async function saveSharedDraft(db: Firestore, uid: string, body: { noteId?: unknown; title?: unknown; content?: unknown; version?: unknown }, now = new Date()): Promise<{ version: string }> {
  const me = await member(db, uid);
  const noteId = String(body.noteId ?? "");
  const { access, inv } = await coAuthorAccess(db, uid, noteId);
  if (access !== "edit") throw new InviteTermsError(access === "lead" ? "Edit your own post in the editor." : "You can read this draft, but not edit it.", 403);
  const title = String(body.title ?? "").trim(), content = String(body.content ?? "");
  if (!title) throw new InviteTermsError("The post needs a title.");
  if (title.length > DRAFT_TITLE_MAX || content.length > DRAFT_CONTENT_MAX) throw new InviteTermsError("That's longer than a post can be.");
  const ref = db.doc(`notes/${noteId}`);
  const version = await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data();
    if (!cur) throw new InviteTermsError("That post doesn't exist (any more).", 404);
    if (cur.status !== "draft") throw new InviteTermsError("The post is published now, so the draft is locked.", 409);
    if (body.version !== draftVersion(cur)) throw new InviteTermsError("Someone else saved this draft since you opened it. Copy your changes, reload, and add them again.", 409, "stale");
    t.update(ref, { title, content, coEditedAt: iso(now), coEditedBy: uid, coEditedByName: me.displayName });
    return draftVersion({ title, content });
  });
  if (inv) {
    // At most one bell an hour per co-author and post, so a busy writing session doesn't flood the lead.
    const key = db.doc(`coAuthorEditPings/${makeInviteId(noteId, uid)}`);
    const last = (await key.get()).data()?.at as string | undefined;
    if (!last || now.getTime() - new Date(last).getTime() > 3600_000) {
      await key.set({ at: iso(now) });
      await tellMember(db, { uid: inv.leadUid, kind: "journal", linkHref: `/write/${noteId}/edit`, actor: actorOf(me), message: `${me.displayName} edited the draft of "${title}".` });
    }
  }
  return { version };
}
