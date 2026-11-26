// Admin → #Nana-HR inbox (lib/hr-inbox-server.ts) on the Firestore emulator. Owner, 26 Nov 2026: "Admin → #Nana-HR inbox: HR reads
// and answers replies there." Only #NotesApp's own roles show (never a firm's Notes Jobs conversation), unread counts the applicant's
// replies after the team last read it, "needs reply" is the applicant writing last, opening (here or in the team hub) marks it read,
// answering as HR or as yourself reaches the applicant with the right sender and a bell, Nana-HR only drafts, and only the people who
// review applications get in: canReviewHiring (owner, 26 Nov 2026: "whoever already reviews ... probably owner or admin they appoint
// with hr privilege"): super admins, the Chief of Staff and admins in People & HR, never another Executive office admin. An applicant's
// reply bells everyone with that privilege (read from the accounts' claims on the Auth emulator), nobody else.
// Run: npm run test:hr-inbox → "HR INBOX OK" (then tests/hr/firm-hr-inbox.emulator.ts, the firms' own inboxes).
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Access } from "../../lib/admin-access";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const H = await import("../../lib/hr-inbox-server");
  const R = await import("../../lib/app-replies-server");
  const { myCareerApplications } = await import("../../lib/careers-server");
  const refused = async (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof R.RepliesError && e.status === status);
  const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => d.data() as { message: string; linkHref?: string });
  const at = (m: number) => new Date(Date.parse("2026-11-26T09:00:00Z") + m * 60_000);

  const sup = { uid: "sup", access: { role: "super", depts: [] } as Access };
  const cos = { uid: "cos", access: { role: "admin", depts: ["executive"], cos: true } as Access };
  const exec = { uid: "exe", access: { role: "admin", depts: ["executive"] } as Access };
  const care = { uid: "care", access: { role: "admin", depts: ["support"] } as Access };
  const hra = { uid: "hra", access: { role: "admin", depts: ["hr"] } as Access }; // People & HR
  for (const [u, n] of [["sup", "ngozi"], ["cos", "chioma"], ["exe", "emeka"], ["care", "kemi"], ["hra", "halima"], ["bola", "bola"], ["tola", "tola"]]) {
    await db.doc(`users/${u}`).set({ username: n, displayName: n[0].toUpperCase() + n.slice(1), avatar: "" });
  }
  // The same people as staff accounts, with the claims Team access gives them (lib/admin-access.ts accessFromClaims).
  const auth = getAuth();
  const claims: Record<string, Record<string, unknown>> = {
    sup: { admin: true, adminRole: "super" }, cos: { admin: true, adminRole: "admin", depts: ["executive"], cos: true },
    exe: { admin: true, adminRole: "admin", depts: ["executive"] }, care: { admin: true, adminRole: "admin", depts: ["support"] },
    hra: { admin: true, adminRole: "admin", depts: ["hr"] },
  };
  for (const [uid, c] of Object.entries(claims)) {
    await auth.createUser({ uid, email: `${uid}@x.test` }).catch(() => {});
    await auth.setCustomUserClaims(uid, c);
  }
  const app = (roleId: string, roleTitle: string, uid: string, name: string, extra = {}) =>
    db.doc(`careerApplications/${roleId}_${uid}`).set({ roleId, roleTitle, uid, name, email: `${uid}@x.test`, status: "reviewing", createdAt: at(-600).toISOString(), ...extra });
  await app("r1", "Campus Ambassador", "bola", "Bola Ade", { decidedBy: "sup" });
  await app("r1", "Campus Ambassador", "tola", "Tola Ige");
  await app("r2", "Community Strategist", "bola", "Bola Ade"); // no conversation: not in the inbox
  // A firm's Notes Jobs conversation: it belongs on the firm's job page, never here.
  await db.doc("jobApplications/j1_bola").set({ jobId: "j1", jobTitle: "Driver", uid: "bola", name: "Bola Ade", orgUid: "org", status: "new" });
  await db.collection("appReplies").add({ kind: "job", applicationId: "j1_bola", applicantUid: "bola", orgUid: "org", from: "applicant", text: "Firm thread", label: "Bola", createdAt: at(50).toISOString() });

  // The team writes first (as HR), the applicant replies: the applicant's bell is as before, and the reviewer's bell opens the inbox.
  const hr = await H.hrReply(db, sup, { id: "r1_bola", as: "hr", text: "Thanks Bola, we're reading your application." }, at(0));
  assert.equal(hr.label, "HR, #NotesApp");
  assert.ok((await bells("bola")).some((b) => b.message === "HR, #NotesApp replied about your application for Campus Ambassador." && b.linkHref === "/profile/applications"));
  await R.sendReply(db, { uid: "bola" }, { kind: "career", id: "r1_bola", text: "Thank you! When will I hear?" }, at(5));
  // Everyone with the hiring privilege hears, not only whoever decided on it (sup); nobody without it.
  for (const u of ["sup", "cos", "hra"]) assert.ok((await bells(u)).some((b) => b.message === "Bola Ade replied about Campus Ambassador." && b.linkHref === "/admin/hr-inbox?id=r1_bola"), `${u} hears`);
  for (const u of ["exe", "care"]) assert.ok(!(await bells(u)).some((b) => b.message.includes("Bola Ade replied")), `${u} doesn't`);
  // Tola writes twice after the Chief of Staff wrote as herself.
  const cm = await H.hrReply(db, cos, { id: "r1_tola", as: "me", text: "Hi Tola, Chioma here." }, at(1));
  assert.equal(cm.label, "@chioma, #NotesApp");
  await R.sendReply(db, { uid: "tola" }, { kind: "career", id: "r1_tola", text: "Hello!" }, at(10));
  await R.sendReply(db, { uid: "tola" }, { kind: "career", id: "r1_tola", text: "Is Tuesday good?" }, at(11));

  // The list: career threads only, newest activity first, with the applicant, role, status, last line and unread.
  let inbox = await H.hrInbox(db, sup);
  assert.deepEqual(inbox.rows.map((r) => r.id), ["r1_tola", "r1_bola"], "no firm thread, no application without a conversation");
  const [tola, bola] = inbox.rows;
  assert.deepEqual([tola.applicant.name, tola.applicant.username, tola.roleTitle, tola.statusLabel, tola.lastText, tola.lastFrom, tola.unread, tola.needsReply],
    ["Tola Ige", "tola", "Campus Ambassador", "Reviewing", "Is Tuesday good?", "applicant", 2, true]);
  assert.equal(bola.unread, 1, "only the applicant's reply after the team last read it (answering as HR stamped it read)");
  assert.deepEqual([inbox.unread, inbox.counts.all, inbox.counts.unread, inbox.counts["needs-reply"]], [3, 2, 2, 2]);

  // Opening a thread marks it read; it still needs a reply until someone answers.
  const t = await H.hrThread(db, sup, "r1_bola", { now: at(20) });
  assert.deepEqual(t.replies.map((r) => r.from), ["hr", "applicant"]);
  assert.equal(t.replies[0].byUsername, "ngozi", "the team sees who sent an HR reply");
  assert.deepEqual([t.application.roleTitle, t.application.applicant.username, t.hubHref, t.reviewer], ["Campus Ambassador", "bola", "/admin/team/hr?app=r1_bola", true]);
  inbox = await H.hrInbox(db, sup, "unread");
  assert.deepEqual(inbox.rows.map((r) => r.id), ["r1_tola"]);
  assert.deepEqual((await H.hrInbox(db, sup, "needs-reply")).rows.map((r) => r.id), ["r1_tola", "r1_bola"]);

  // Answering as yourself: the applicant sees @username; on an HR reply they never see who pressed send.
  await H.hrReply(db, cos, { id: "r1_bola", as: "me", text: "Within a week, Bola." }, at(25));
  assert.deepEqual((await H.hrInbox(db, sup, "needs-reply")).rows.map((r) => r.id), ["r1_tola"]);
  const seen = await R.listReplies(db, { uid: "bola" }, "career", "r1_bola");
  assert.deepEqual(seen.replies.map((r) => [r.label, r.byUsername ?? null]), [["HR, #NotesApp", null], ["Bola Ade", null], ["@chioma, #NotesApp", "chioma"]]);
  assert.ok((await bells("bola")).some((b) => b.message.startsWith("@chioma, #NotesApp replied")));
  await refused(H.hrReply(db, sup, { id: "r1_bola", as: "boss", text: "x" }), 400);
  await refused(H.hrReply(db, sup, { id: "r1_bola", as: "hr", text: "  " }), 400);
  await refused(H.hrReply(db, sup, { id: "j1_bola", as: "hr", text: "x" }), 404); // a firm's application isn't one of ours
  await refused(H.hrReply(db, sup, { id: "r1_bola", as: "owner", text: "x" }), 400); // "owner" is a firm's sender, never ours

  // People & HR: an admin given the hr department reviews and answers like the Chief of Staff, in the inbox and the team hub.
  assert.deepEqual((await H.hrInbox(db, hra)).rows.map((r) => r.id), ["r1_bola", "r1_tola"]);
  const hm = await H.hrReply(db, hra, { id: "r1_bola", as: "me", text: "Hi Bola, Halima from People & HR." }, at(26));
  assert.equal(hm.label, "@halima, #NotesApp");
  assert.equal((await R.listReplies(db, hra, "career", "r1_bola", { markRead: false })).reviewer, true);

  // Nana-HR drafts from the person's instruction; nothing is sent until they send it.
  const before = (await db.collection("appReplies").get()).size;
  const deps = { now: () => at(30), complete: async () => ({ text: "Hello Tola, Tuesday at 10am works for us.", refused: false }) };
  const { draft } = await H.hrDraft(db, sup, { id: "r1_tola", intent: "say Tuesday at 10am is fine" }, deps as never);
  assert.ok(draft.includes("Tuesday"));
  assert.equal((await db.collection("appReplies").get()).size, before, "a draft is never sent or saved");
  const nana = await H.hrReply(db, sup, { id: "r1_tola", as: "nana", text: draft }, at(31));
  assert.equal(nana.label, "Nana-HR for #NotesApp");
  assert.equal((await H.hrInbox(db, sup)).unread, 0, "answering means it's been read");

  // Reading in the team hub counts too, and "read" without opening.
  await R.sendReply(db, { uid: "tola" }, { kind: "career", id: "r1_tola", text: "See you then." }, at(40));
  assert.equal((await H.hrInbox(db, cos)).rows[0].unread, 1);
  await R.listReplies(db, cos, "career", "r1_tola", { now: at(41) });
  assert.equal((await H.hrInbox(db, cos)).rows[0].unread, 0);
  await R.sendReply(db, { uid: "tola" }, { kind: "career", id: "r1_tola", text: "Thanks again." }, at(45));
  await H.hrMarkRead(db, cos, "r1_tola", at(46));
  assert.equal((await H.hrInbox(db, cos)).unread, 0);
  // The applicant's list (and anything else they read) never carries the team's read stamp.
  assert.ok((await myCareerApplications(db, "tola")).every((a) => !("hrReadAt" in a) && !("hrReadBy" in a)));

  // Only the people who review applications: not an Executive office admin who isn't Chief of Staff, not Customer care, not applicants.
  for (const v of [exec, care, { uid: "bola" }, { uid: "bola", access: null }]) {
    await refused(R.listReplies(db, { ...v, uid: v.uid === "bola" ? "tola" : v.uid }, "career", "r1_bola"), 403);
    await refused(H.hrInbox(db, v), 403);
    await refused(H.hrThread(db, v, "r1_bola"), 403);
    await refused(H.hrReply(db, v, { id: "r1_bola", as: "hr", text: "x" }), 403);
    await refused(H.hrDraft(db, v, { id: "r1_bola", intent: "x" }, deps as never), 403);
    await refused(H.hrMarkRead(db, v, "r1_bola"), 403);
  }

  console.log("HR INBOX OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
