// The one-month anniversary on the Firestore and Auth emulators: feedback lands in Leads with its scores, a reviewer sign-up becomes
// a lead and approval gives reviewer access (or an invite link without an account) and the community link, the reviewers'
// community is seeded once, and an announcement goes out once per member, bell to all and email only to those whose choices
// allow it. Run: npm run test:anniversary-server → "ANNIVERSARY SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { LeadError, approveVolunteer, declineVolunteer, reviewersCommunityLink, seedReviewersCommunity, submitFeedback, submitVolunteer } from "../../lib/leads-server";
import {
  AnnouncementError, announcementsWanted, continueAnnouncements, renderAnnouncementEmail, saveAnnouncement, seedAnniversaryDraft, sendBatch, sendTest, startSending,
  validAnnouncementsToken, announcementsToken,
} from "../../lib/announcements-server";
import { ANNIVERSARY_DRAFT, ANNIVERSARY_SEED, bodyHtml, checkAnnouncement } from "../../lib/announcements";
import { REVIEWERS_COMMUNITY_ID, subjectKeysFor, checkVolunteer } from "../../lib/prep-reviewers";
import { checkFeedback, nps } from "../../lib/feedback";
import { join, viewCommunity, readCommunity } from "../../lib/community-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
type Mail = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string> };
const outbox: Mail[] = [];
const send = async (m: Mail) => { outbox.push(m); return true; };
const rejects = (p: Promise<unknown>, status: number, re?: RegExp) => assert.rejects(p, (e: unknown) => (e instanceof LeadError || e instanceof AnnouncementError) && e.status === status && (!re || re.test(e.message)));

async function member(uid: string, extra: Record<string, unknown> = {}, auth: { email?: string; verified?: boolean } = {}) {
  await getAuth().createUser({ uid, email: auth.email ?? `${uid}@x.ng`, emailVerified: auth.verified ?? true }).catch(() => {});
  await db.doc(`users/${uid}`).set({ uid, username: uid, displayName: `${uid[0].toUpperCase()}${uid.slice(1)} Okafor`, role: "reader", accountTier: "standard", createdAt: new Date().toISOString(), ...extra });
}

(async () => {
  // ---------------------------------------------------------------- pure checks
  assert.equal(checkFeedback({ name: "A", email: "a@x.ng", mood: 6, recommend: 5, contactOk: true }).ok, false);
  assert.equal(checkFeedback({ name: "A", email: "a@x.ng", mood: 4, recommend: 11, contactOk: true }).ok, false);
  assert.equal(checkFeedback({ name: "A", email: "a@x.ng", mood: 4, recommend: 9 }).ok, false, "yes or no to contact is required");
  assert.equal(nps([10, 9, 8, 3]), 25);
  assert.equal(checkVolunteer({ name: "A", email: "a@x.ng", subjects: ["history"], exams: ["jamb"], background: ["teacher"], years: 3 }).ok, false, "History isn't a JAMB subject here");
  assert.deepEqual(subjectKeysFor(["english", "physics"], ["jamb", "waec"]).sort(), ["jamb_physics", "jamb_use-of-english", "waec_english-language", "waec_physics"]);
  assert.ok(checkAnnouncement(ANNIVERSARY_DRAFT).ok, "the anniversary draft passes its own checks");
  assert.ok(ANNIVERSARY_DRAFT.bell.length <= 280);
  assert.match(bodyHtml("## Hi\n\n- one **two**\n- https://x.ng/a."), /<h2[^>]*>Hi<\/h2>[\s\S]*<li[^>]*>one <strong>two<\/strong><\/li>[\s\S]*href="https:\/\/x.ng\/a"[^>]*>x.ng\/a<\/a>\./);
  assert.equal(announcementsWanted(undefined), true);
  assert.equal(announcementsWanted({ weeklyDigest: false }), false, "switched the digest off and never chose: no");
  assert.equal(announcementsWanted({ weeklyDigest: false, announcements: true }), true);
  assert.equal(announcementsWanted({ announcements: false }), false);

  // ---------------------------------------------------------------- feedback → Leads
  await member("ada");
  const fb = await submitFeedback(db, { name: "Ada Okafor", email: "ADA@x.ng", mood: 5, love: "The store", missing: "Dark mode on Life", recommend: 9, contactOk: true }, { uid: "ada" });
  const f = (await db.doc(`leads/${fb.id}`).get()).data()!;
  assert.equal(f.category, "feedback"); assert.equal(f.status, "new"); assert.equal(f.uid, "ada"); assert.equal(f.email, "ada@x.ng");
  assert.deepEqual(f.feedback, { mood: 5, love: "The store", missing: "Dark mode on Life", recommend: 9, contactOk: true });
  assert.match(f.message, /First month: 5\/5[\s\S]*Would recommend: 9\/10/);
  const visitor = await submitFeedback(db, { name: "Visitor", email: "v@x.ng", mood: "2", recommend: "4", contactOk: false }, { uid: null });
  assert.equal((await db.doc(`leads/${visitor.id}`).get()).data()!.uid, undefined, "a visitor's feedback works without an account");
  await rejects(submitFeedback(db, { name: "x", email: "nope", mood: 3, recommend: 3, contactOk: true }, { uid: null }), 400, /email/);

  // ---------------------------------------------------------------- the reviewers' community: seeded once
  await member("boss", { displayName: "Emmanuel Adams" });
  const s1 = await seedReviewersCommunity(db, "boss");
  assert.equal(s1.created, true);
  const s2 = await seedReviewersCommunity(db, "boss");
  assert.equal(s2.created, false, "a second tap changes nothing");
  assert.equal(s1.invite, s2.invite);
  const c = await readCommunity(db, REVIEWERS_COMMUNITY_ID);
  assert.equal(c.joinMode, "invite"); assert.equal(c.verified, true); assert.equal(c.ownerUid, "boss"); assert.equal(c.memberCount, 1);
  assert.deepEqual(c.spaces.map((s) => s.id), ["start-here", "sciences", "arts", "commercial", "questions-to-discuss"]);
  assert.ok(c.spaces.every((s) => s.visibility === "members"));
  assert.equal((await db.collection("communityPosts").where("cid", "==", REVIEWERS_COMMUNITY_ID).get()).size, 1, "one pinned welcome");
  const outsider = await viewCommunity(db, REVIEWERS_COMMUNITY_ID, null);
  assert.equal(outsider.channels.length, 0, "non-members see no posts");
  await member("stranger");
  await assert.rejects(join(db, "stranger", REVIEWERS_COMMUNITY_ID, {}), /invitation/);

  // ---------------------------------------------------------------- volunteer sign-up → approval
  await member("tunde");
  const v1 = await submitVolunteer(db, { name: "Tunde Bello", email: "tunde@x.ng", subjects: ["physics", "mathematics"], exams: ["waec", "jamb"], background: ["teacher"], years: 8, phone: "0803 123 4567", joinCommunity: true }, { uid: "tunde" }, send);
  assert.equal(v1.again, false);
  assert.match(outbox.at(-1)!.subject, /Thank you for volunteering/);
  const again = await submitVolunteer(db, { name: "Tunde Bello", email: "tunde@x.ng", subjects: ["physics", "mathematics", "chemistry"], exams: ["waec", "jamb"], background: ["teacher", "examiner"], years: 9, joinCommunity: true }, { uid: "tunde" }, send);
  assert.equal(again.again, true); assert.equal(again.id, v1.id, "signing up again while waiting updates the same sign-up");
  const lead = (await db.doc(`leads/${v1.id}`).get()).data()!;
  assert.equal(lead.category, "volunteer"); assert.deepEqual(lead.volunteer.subjects, ["physics", "mathematics", "chemistry"]);
  const admin = { uid: "boss", name: "Emmanuel Adams" };
  const ap = await approveVolunteer(db, v1.id, admin, { send, findUid: async () => null });
  assert.equal(ap.already, false); assert.equal(ap.approval!.how, "granted"); assert.ok(ap.community?.includes(`/c/${REVIEWERS_COMMUNITY_ID}?invite=`));
  const rev = (await db.doc("prepReviewers/tunde").get()).data()!;
  assert.equal(rev.active, true);
  assert.deepEqual([...rev.subjects].sort(), ["jamb_chemistry", "jamb_mathematics", "jamb_physics", "waec_chemistry", "waec_mathematics", "waec_physics"]);
  const mail = outbox.at(-1)!;
  assert.match(mail.subject, /You're a Naija Exam Prep reviewer/); assert.ok(mail.text.includes(ap.community!), "the community link is in the email");
  const bells = (await db.collection("notifications").where("recipientUid", "==", "tunde").get()).docs.map((d) => d.data());
  assert.ok(bells.some((b) => b.type === "volunteer" && /reviewer now/.test(b.message)));
  assert.ok(bells.some((b) => b.type === "community" && b.linkHref.startsWith(`/c/${REVIEWERS_COMMUNITY_ID}?invite=`)));
  // The link works: Tunde can join the private community with it.
  const code = new URL(ap.community!).searchParams.get("invite");
  assert.equal((await join(db, "tunde", REVIEWERS_COMMUNITY_ID, { invite: code })).status, "active");
  const before = outbox.length;
  assert.equal((await approveVolunteer(db, v1.id, admin, { send })).already, true, "approving twice changes nothing");
  assert.equal(outbox.length, before);

  // No account yet: an invite link for their subjects, emailed; no community link unless asked.
  const v2 = await submitVolunteer(db, { name: "Ngozi Eze", email: "ngozi@school.ng", subjects: ["literature-in-english"], exams: ["waec", "neco"], background: ["graduate"], years: 2, joinCommunity: false }, { uid: null }, send);
  const ap2 = await approveVolunteer(db, v2.id, admin, { send, findUid: async () => null });
  assert.equal(ap2.approval!.how, "invited"); assert.equal(ap2.community, null);
  assert.ok(ap2.inviteUrl && /\/review\/invite\?t=/.test(ap2.inviteUrl));
  const inv = (await db.collection("prepInvites").where("note", "==", "Volunteer sign-up: Ngozi Eze").get()).docs[0].data();
  assert.deepEqual(inv.subjects.sort(), ["neco_literature-in-english", "waec_literature-in-english"]); assert.equal(inv.kind, "single");
  assert.ok(outbox.at(-1)!.text.includes(ap2.inviteUrl!));
  // Declining records it.
  const v3 = await submitVolunteer(db, { name: "Spam", email: "s@x.ng", subjects: ["history"], exams: ["waec"], background: ["student"], years: 0, joinCommunity: true }, { uid: null }, send);
  await declineVolunteer(db, v3.id, admin, "Not enough experience yet");
  assert.equal((await db.doc(`leads/${v3.id}`).get()).data()!.approval.status, "declined");
  await rejects(approveVolunteer(db, fb.id, admin, { send }), 404, /volunteer/);

  // ---------------------------------------------------------------- the announcement
  process.env.EMAIL_LINK_SECRET = "test-secret";
  assert.equal(await seedAnniversaryDraft(db, "boss"), true);
  assert.equal(await seedAnniversaryDraft(db, "boss"), false, "seeded once");
  let a = (await db.doc(`announcements/${ANNIVERSARY_SEED}`).get()).data()!;
  assert.equal(a.status, "draft"); assert.equal(a.subject, ANNIVERSARY_DRAFT.subject);
  const e = renderAnnouncementEmail(a as never, { uid: "ada", name: "Ada Okafor" });
  assert.match(e.text, /^Hello Ada,/); assert.match(e.html, /<strong>Business books<\/strong> for sellers/); assert.match(e.html, /50 of you joined/); assert.match(e.html, /display:none[^>]*>50 members in our first month/, "the preheader");
  assert.match(e.html, /<h2[^>]*>Our new home: naapp\.tech<\/h2>/); assert.match(e.text, /Special Recognition at the Build With NKENNEAi Hackathon/);
  assert.match(e.text, /Free on Free Basic: https:\/\/www\.naapp\.tech\/books/); assert.match(e.text, /https:\/\/prep\.naapp\.tech\/reviewers/);
  assert.match(e.text, /https:\/\/www\.naapp\.tech\/affiliates/); assert.match(e.text, /https:\/\/www\.naapp\.tech\/contact\?topic=feedback/);
  assert.ok(!/notesapp\.name\.ng\//.test(ANNIVERSARY_DRAFT.body), "every link in the draft is on naapp.tech");
  assert.match(e.headers["List-Unsubscribe"], /\/api\/announcements\/unsubscribe\?u=ada&t=/); assert.match(e.html, /Unsubscribe from announcements/);
  assert.ok(validAnnouncementsToken("ada", announcementsToken("ada"))); assert.ok(!validAnnouncementsToken("tunde", announcementsToken("ada")));

  // Members: ada (on), tunde (digest off, never chose → no email), chi (announcements off), dee (unconfirmed email), teen, kid,
  // suspended. boss and stranger are members too (on).
  await db.doc("emailPrefs/tunde").set({ weeklyDigest: false });
  await member("chi"); await db.doc("emailPrefs/chi").set({ announcements: false });
  await member("dee", {}, { verified: false });
  await member("teeny", { teen: true }); await member("kiddo", { kid: true }); await member("susan", { suspended: true });

  await rejects(startSending(db, ANNIVERSARY_SEED, "boss"), 409, /test first/);
  const tests: Mail[] = [];
  await sendTest(db, ANNIVERSARY_SEED, { uid: "boss", email: "boss@x.ng", name: "Emmanuel Adams" }, async (m) => { tests.push(m); return true; });
  assert.match(tests[0].subject, /^\[Test\] #NotesApp is one month old/); assert.match(tests[0].text, /^Hello Emmanuel,/);
  // A change after the test needs another test.
  await saveAnnouncement(db, "boss", ANNIVERSARY_SEED, { ...ANNIVERSARY_DRAFT, preheader: `${ANNIVERSARY_DRAFT.preheader} ` + "x" }, new Date(Date.now() + 1000));
  await rejects(startSending(db, ANNIVERSARY_SEED, "boss"), 409, /test first/);
  await saveAnnouncement(db, "boss", ANNIVERSARY_SEED, ANNIVERSARY_DRAFT, new Date(Date.now() + 2000));
  await sendTest(db, ANNIVERSARY_SEED, { uid: "boss", email: "boss@x.ng", name: "Emmanuel Adams" }, async () => true, new Date(Date.now() + 3000));
  assert.equal((await startSending(db, ANNIVERSARY_SEED, "boss")).status, "sending");
  assert.equal((await startSending(db, ANNIVERSARY_SEED, "boss")).status, "sending", "pressing it twice changes nothing");
  await rejects(saveAnnouncement(db, "boss", ANNIVERSARY_SEED, ANNIVERSARY_DRAFT), 409, /already been sent/);

  const sent: Mail[] = [];
  const mailer = async (m: Mail) => { sent.push(m); return true; };
  // Small batches, one run twice over the same members (as if the page and the cron ran at once): nobody is reached twice.
  const users = (await db.collection("users").get()).size;
  const b1 = await sendBatch(db, ANNIVERSARY_SEED, { send: mailer, size: 3 });
  assert.equal(b1.done, false);
  await db.doc(`announcements/${ANNIVERSARY_SEED}`).update({ cursor: null }); // rewind: the same members again
  let r = await sendBatch(db, ANNIVERSARY_SEED, { send: mailer, size: 3 });
  assert.equal(r.batch!.bells, 0, "the first three were reached already");
  while (!r.done) r = await sendBatch(db, ANNIVERSARY_SEED, { send: mailer, size: 3 });
  assert.equal(await continueAnnouncements(db, mailer), 0, "nothing left for the cron");
  a = (await db.doc(`announcements/${ANNIVERSARY_SEED}`).get()).data()!;
  assert.equal(a.status, "sent"); assert.ok(a.sentAt);
  const reachable = users - 2; // not the suspended account or the child profile
  assert.equal(a.counts.bells, reachable); assert.equal(a.counts.skipped, 2 + 0);
  const to = sent.map((m) => m.to).sort();
  assert.deepEqual(to, ["ada@x.ng", "boss@x.ng", "stranger@x.ng"], "email only where allowed: not digest-off, switched off, unconfirmed, teen, kid or suspended");
  assert.equal(new Set(to).size, to.length, "one email each");
  const annBells = (await db.collection("notifications").where("type", "==", "announcement").get()).docs.map((d) => d.data());
  assert.equal(annBells.length, reachable, "one bell each");
  assert.ok(annBells.every((b) => b.linkHref === `/announcements/${ANNIVERSARY_SEED}`));
  assert.ok(annBells.some((b) => b.recipientUid === "teeny") && annBells.some((b) => b.recipientUid === "chi"), "the bell reaches members who get no email");
  assert.ok(!annBells.some((b) => b.recipientUid === "susan" || b.recipientUid === "kiddo"));
  const marks = (await db.collection("announcementSends").where("announcementId", "==", ANNIVERSARY_SEED).get()).docs.map((d) => d.data());
  assert.equal(marks.find((m) => m.uid === "chi")!.noEmail, "switched off");
  assert.equal(marks.find((m) => m.uid === "teeny")!.noEmail, "teen mode");
  assert.equal(marks.find((m) => m.uid === "dee")!.noEmail, "no confirmed email");
  // Sending again after it's done does nothing.
  const after = await sendBatch(db, ANNIVERSARY_SEED, { send: mailer });
  assert.equal(after.done, true); assert.equal(sent.length, 3);
  assert.ok(await reviewersCommunityLink(db));

  console.log("ANNIVERSARY SERVER OK");
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
