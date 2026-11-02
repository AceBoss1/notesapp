import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "crypto";
import { getAdminApp } from "./firebase-admin";
import { notifyBell, sendEmail } from "./email";
import { PREP_URL, SITE_URL } from "./host";
import { checkFeedback, feedbackMessage } from "./feedback";
import { BOOKS_PATH, checkWaitlist, waitlistMessage } from "./books-waitlist";
import { REVIEWERS_COMMUNITY, REVIEWERS_COMMUNITY_ID, REVIEWERS_COMMUNITY_SEED, checkVolunteer, examsLabel, subjectKeysFor, subjectName, volunteerMessage } from "./prep-reviewers";
import { allSubjects, createInvite, ensureCatalog, type Reviewer } from "./exam-prep-server";
import { PREP_NAME } from "./exam-prep";
import { DEFAULT_PUBLIC, type Community } from "./community";
import type { Lead } from "./leads";

// Server-only. Leads that come in through their own forms (rate-limited in their routes): the one-month feedback (/api/feedback) and
// the Naija Exam Prep reviewer sign-up (/api/exam-prep/reviewers). Both land in leads/{id} (server-only, firestore.rules) and are
// read on Admin → Leads through /api/admin/leads, emails and phones masked. Also: approving a volunteer, and the reviewers'
// community seed.

export class LeadError extends Error { constructor(public status: number, message: string) { super(message); } }
const iso = (d = new Date()) => d.toISOString();
export type Who = { uid: string | null; name?: string; email?: string | null };
type Send = typeof sendEmail;

// ---- the one-month feedback ----
export async function submitFeedback(db: Firestore, raw: unknown, who: Who, now = new Date()): Promise<{ id: string }> {
  const c = checkFeedback(raw);
  if (!c.ok) throw new LeadError(400, c.error);
  const { name, email, ...answers } = c.value;
  const r = db.collection("leads").doc();
  await r.set({
    name, email, category: "feedback", message: feedbackMessage(answers), feedback: answers, status: "new", createdAt: iso(now),
    ...(who.uid ? { uid: who.uid } : {}),
  });
  return { id: r.id };
}

// ---- the Business books waitlist (/books) ----
// One sign-up per email: signing up again updates the first (and keeps its place, createdAt) instead of adding another. A thank-you
// email always (members and visitors), and a bell for a signed-in member.
export async function submitBooksWaitlist(db: Firestore, raw: unknown, who: Who, send: Send = sendEmail, now = new Date()): Promise<{ id: string; again: boolean }> {
  const c = checkWaitlist(raw);
  if (!c.ok) throw new LeadError(400, c.error);
  const { name, email, ...answers } = c.value;
  const open = await db.collection("leads").where("email", "==", email).where("category", "==", "books-waitlist").limit(1).get();
  const first = open.docs[0];
  const doc = { name, email, category: "books-waitlist", message: waitlistMessage(answers), booksWaitlist: answers, status: "new", ...(who.uid ? { uid: who.uid } : {}) };
  const r = first ? first.ref : db.collection("leads").doc();
  await r.set({ ...doc, createdAt: first ? String(first.data().createdAt) : iso(now), ...(first ? { updatedAt: iso(now) } : {}) }, { merge: !!first });
  await send({
    to: email,
    subject: "You're on the Business books waitlist",
    text: `Hello ${name.split(/\s+/)[0]},\n\nThank you for joining the waitlist for Business books on #NotesApp: walk-in sales, expenses, stock, money owed to you and profit, beside your online store.\n\nIt isn't open yet, and we're not promising a date. We're building it with what sellers like you tell us, so your answers help.${answers.notify ? " We'll email you when it opens." : ""}\n\nWhat it will do: ${SITE_URL}${BOOKS_PATH}\n\n#NotesApp`,
    action: { label: "See what Business books will do", url: `${SITE_URL}${BOOKS_PATH}` },
  }).catch(() => false);
  if (who.uid) await notifyBell({ uid: who.uid, type: "books", linkHref: BOOKS_PATH, message: `You're on the Business books waitlist.${answers.notify ? " We'll let you know when it opens." : ""}` });
  return { id: r.id, again: !!first };
}

// ---- the reviewer sign-up ----
export async function submitVolunteer(db: Firestore, raw: unknown, who: Who, send: Send = sendEmail, now = new Date()): Promise<{ id: string; again: boolean }> {
  const c = checkVolunteer(raw);
  if (!c.ok) throw new LeadError(400, c.error);
  const { name, email, ...answers } = c.value;
  // The same email signing up again while the first one waits updates it instead of adding another.
  const open = await db.collection("leads").where("email", "==", email).where("category", "==", "volunteer").limit(5).get();
  const waiting = open.docs.find((d) => !d.data().approval);
  const doc = { name, email, category: "volunteer", message: volunteerMessage(answers), volunteer: answers, status: "new", ...(who.uid ? { uid: who.uid } : {}) };
  const r = waiting ? waiting.ref : db.collection("leads").doc();
  await r.set({ ...doc, createdAt: waiting ? String(waiting.data().createdAt) : iso(now), ...(waiting ? { updatedAt: iso(now) } : {}) }, { merge: !!waiting });
  const subjects = answers.subjects.map(subjectName).join(", ");
  await send({
    to: email,
    subject: `Thank you for volunteering to review ${PREP_NAME} questions`,
    text: `Hello ${name.split(/\s+/)[0]},\n\nThank you for offering to review ${PREP_NAME} questions in ${subjects} (${examsLabel(answers.exams)}).\n\nWe look at every sign-up ourselves. Once we've approved yours, we'll email you again with how to start: if you already have a #NotesApp account with this email, your reviewer access is switched on and you'll see the review queue at ${PREP_URL}/review; if not, you'll get an invite link to create one.${answers.joinCommunity ? "\n\nYou asked to join the Naija Exam Prep Reviewers community. Its invite link comes with your approval, so it stays a place for reviewers only." : ""}\n\nThank you for helping students get questions they can trust.\n\n#NotesApp`,
  }).catch(() => false);
  if (who.uid) await notifyBell({ uid: who.uid, type: "volunteer", linkHref: "/exam-prep/reviewers", message: `Thanks for volunteering to review ${PREP_NAME} questions. We'll let you know once you're approved.` });
  return { id: r.id, again: !!waiting };
}

// ---- approving a volunteer (Admin → Leads → Volunteers) ----
// With a #NotesApp account (signed in when they signed up, or an account with their email): reviewer access for their subjects
// straight away, in prepReviewers/{uid} (what an invite link writes; subjects are added to any they already review). Without one:
// a one-person invite link for those subjects (14 days), emailed to them. Either way, the reviewers' community invite link too if
// they asked to join and the community is set up. Approving twice changes nothing.
export async function approveVolunteer(db: Firestore, leadId: unknown, admin: { uid: string; name: string }, deps: { send?: Send; findUid?: (email: string) => Promise<string | null> } = {}, now = new Date()) {
  const send = deps.send ?? sendEmail;
  const findUid = deps.findUid ?? ((email: string) => getAuth(getAdminApp()).getUserByEmail(email).then((u) => u.uid).catch(() => null));
  const id = String(leadId ?? "");
  if (!/^[\w-]{1,64}$/.test(id)) throw new LeadError(400, "Which sign-up?");
  const leadRef = db.doc(`leads/${id}`);
  const lead = (await leadRef.get()).data() as Lead | undefined;
  if (!lead || lead.category !== "volunteer" || !lead.volunteer) throw new LeadError(404, "That volunteer sign-up wasn't found.");
  if (lead.approval) return { already: true, approval: lead.approval };

  await ensureCatalog(db);
  const known = new Set((await allSubjects(db)).map((s) => `${s.exam}_${s.id}`));
  const subjects = subjectKeysFor(lead.volunteer.subjects, lead.volunteer.exams).filter((k) => known.has(k));
  if (!subjects.length) throw new LeadError(409, "None of their subjects is in the catalogue any more. Grant access by hand under Admin → Naija Exam Prep → Reviewers.");
  const uid = lead.uid || (await findUid(lead.email));
  let how: "granted" | "invited", inviteUrl = "";
  if (uid) {
    const revRef = db.doc(`prepReviewers/${uid}`);
    await db.runTransaction(async (t) => {
      const cur = (await t.get(revRef)).data() as Reviewer | undefined;
      t.set(revRef, { uid, name: lead.name, active: true, subjects: Array.from(new Set([...(cur?.subjects ?? []), ...subjects])), invitedBy: `volunteer:${id}`, at: cur?.at ?? iso(now) }, { merge: true });
    });
    how = "granted";
  } else {
    const inv = await createInvite(db, admin, { subjects, kind: "single", note: `Volunteer sign-up: ${lead.name}` }, now);
    inviteUrl = `${PREP_URL}/review/invite?t=${encodeURIComponent(inv.token)}`;
    how = "invited";
  }
  const community = lead.volunteer.joinCommunity ? await reviewersCommunityLink(db) : null;
  const approval = { status: "approved" as const, at: iso(now), byUid: admin.uid, byName: admin.name, how, subjects };
  await leadRef.update({ approval, status: "read" });

  const first = lead.name.split(/\s+/)[0];
  const start = how === "granted"
    ? `Your reviewer access is on. Open the review queue: ${PREP_URL}/review (sign in with this email). You'll see questions in your subjects only.`
    : `Create your #NotesApp account (or sign in) and accept your invite here: ${inviteUrl}\nThe link is for you alone and works for 14 days. After that, the review queue is at ${PREP_URL}/review.`;
  await send({
    to: lead.email,
    subject: `You're a ${PREP_NAME} reviewer`,
    text: `Hello ${first},\n\nThank you for volunteering. You're approved to review ${PREP_NAME} questions in ${lead.volunteer.subjects.map(subjectName).join(", ")} (${examsLabel(lead.volunteer.exams)}).\n\n${start}\n\nFor each question, check that the marked answer is right, the explanation is clear and correct, and the question is fair. Approve it, or ask for changes with a note.${community ? `\n\nYou asked to join the Naija Exam Prep Reviewers community. Here's your invite link: ${community}\nJoining is optional.` : ""}\n\nHow reviewing works: ${SITE_URL}/help/naija-exam-prep-reviewers\n\n#NotesApp`,
    action: how === "granted" ? { label: "Open the review queue", url: `${PREP_URL}/review` } : { label: "Accept your invite", url: inviteUrl },
  }).catch(() => false);
  if (uid) await notifyBell({ uid, type: "volunteer", linkHref: how === "granted" ? `${PREP_URL}/review` : inviteUrl, message: `You're a ${PREP_NAME} reviewer now. Thank you!${community ? " Your invite to the reviewers' community is in your email and your bell." : " Open the review queue to start."}` });
  if (uid && community) await notifyBell({ uid, type: "community", linkHref: community.replace(SITE_URL, ""), message: "Join the Naija Exam Prep Reviewers community (optional): tap to open your invite." });
  return { already: false, approval, inviteUrl: inviteUrl || null, community };
}
export async function declineVolunteer(db: Firestore, leadId: unknown, admin: { uid: string; name: string }, note: unknown, now = new Date()) {
  const id = String(leadId ?? "");
  if (!/^[\w-]{1,64}$/.test(id)) throw new LeadError(400, "Which sign-up?");
  const r = db.doc(`leads/${id}`);
  const lead = (await r.get()).data() as Lead | undefined;
  if (!lead || lead.category !== "volunteer") throw new LeadError(404, "That volunteer sign-up wasn't found.");
  if (lead.approval) return { already: true };
  await r.update({ approval: { status: "declined", at: iso(now), byUid: admin.uid, byName: admin.name, how: "declined", subjects: [], note: String(note ?? "").slice(0, 300) }, status: "read" });
  return { already: false };
}

// ---- the Naija Exam Prep Reviewers community ----
export async function reviewersCommunityLink(db: Firestore): Promise<string | null> {
  const c = (await db.doc(`communities/${REVIEWERS_COMMUNITY_ID}`).get()).data() as Community | undefined;
  return c?.inviteCode ? `${SITE_URL}/c/${REVIEWERS_COMMUNITY_ID}?invite=${encodeURIComponent(c.inviteCode)}` : null;
}
// One tap from Admin → Leads → Volunteers (owner and super admins). Private (by invite link only, so it isn't listed in the
// directory), members see everything, non-members only the name and tagline; Spaces: Start here (admins post, with a pinned
// welcome), Sciences, Arts and humanities, Commercial, Questions to discuss. Run by the person who taps it, as its owner (the
// official @na-notesapp is a channel without an account of its own, so it can't run a community), and marked verified. Tapping
// again does nothing: it only ever makes it once.
export async function seedReviewersCommunity(db: Firestore, ownerUid: string, now = new Date()) {
  const cref = db.doc(`communities/${REVIEWERS_COMMUNITY_ID}`);
  const mark = db.doc(`teamSeeds/${REVIEWERS_COMMUNITY_SEED}`);
  const owner = (await db.doc(`users/${ownerUid}`).get()).data();
  if (!owner) throw new LeadError(404, "Your profile wasn't found. Open your profile once, then try again.");
  const at = iso(now);
  const created = await db.runTransaction(async (t) => {
    const [c, m] = await Promise.all([t.get(cref), t.get(mark)]);
    if (m.exists || c.exists) {
      if (c.exists && (c.data() as { seedKey?: string }).seedKey !== REVIEWERS_COMMUNITY_SEED) throw new LeadError(409, `The address /c/${REVIEWERS_COMMUNITY_ID} is taken by another community.`);
      return false;
    }
    const community: Community & { seedKey: string; official: boolean } = {
      id: REVIEWERS_COMMUNITY_ID, name: REVIEWERS_COMMUNITY.name, ownerUid, tagline: REVIEWERS_COMMUNITY.tagline, about: REVIEWERS_COMMUNITY.about,
      contact: REVIEWERS_COMMUNITY.contact, avatar: "/images/exam-prep/icon-512.png", cover: "", joinMode: "invite", questions: [],
      publicView: { ...DEFAULT_PUBLIC, general: false, about: true, contact: false, events: false, members: false, join: true },
      slowModeSec: 0, spaces: REVIEWERS_COMMUNITY.spaces.map((s) => ({ ...s })), inviteCode: randomBytes(6).toString("base64url"),
      memberCount: 1, verified: true, createdAt: at, seedKey: REVIEWERS_COMMUNITY_SEED, official: true,
    };
    t.set(cref, community);
    t.set(db.doc(`communityMembers/${REVIEWERS_COMMUNITY_ID}_${ownerUid}`), { cid: REVIEWERS_COMMUNITY_ID, uid: ownerUid, username: owner.username ?? "", displayName: owner.displayName ?? "", avatar: owner.avatar ?? "", role: "owner", status: "active", joinedAt: at });
    const post = db.collection("communityPosts").doc();
    t.set(post, { id: post.id, cid: REVIEWERS_COMMUNITY_ID, channel: "start-here", authorUid: ownerUid, authorName: owner.displayName ?? "", authorUsername: owner.username ?? "", authorAvatar: owner.avatar ?? "", text: REVIEWERS_COMMUNITY.welcome, image: "", pinned: true, likes: 0, comments: 0, public: false, createdAt: at });
    t.set(mark, { at, byUid: ownerUid, count: 1 });
    return true;
  });
  return { created, id: REVIEWERS_COMMUNITY_ID, invite: await reviewersCommunityLink(db) };
}
