// A firm's #Nana-HR inbox (lib/hr-inbox-server.ts with an org) on the Firestore emulator. Owner, 26 Nov 2026: "Notes Jobs: applications
// to other firms' jobs stay with those firms. Who sees it: whoever already reviews firms' job applications, probably owner or admin they
// appoint with hr privilege. Answering: you can reply as HR, as yourself, or ask Nana-HR for a draft that you edit and then send.
// Nana-HR never sends on her own, as now." And for firms, "as yourself" is the firm itself (as owner, its name), never a member's
// @username. Checks: the firm's list holds only its own Notes Jobs threads (not another firm's, not #NotesApp's); the organisation and
// its HR members get in, a member without HR, another firm and a #NotesApp super admin don't; unread / needs reply / read; the labels
// the applicant sees for HR, owner and Nana-HR; "me" refused; bells to the firm's hiring team only (never a teen), linking to the inbox.
// Run: npm run test:hr-inbox → "FIRM HR INBOX OK" (after tests/hr/hr-inbox.emulator.ts on the same emulators, so its ids start with f).
import assert from "node:assert/strict";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Access } from "../../lib/admin-access";
if (!getApps().length) initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const H = await import("../../lib/hr-inbox-server");
  const R = await import("../../lib/app-replies-server");
  const { myApplications } = await import("../../lib/jobs-server");
  const refused = async (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof R.RepliesError && e.status === status);
  const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => d.data() as { message: string; linkHref?: string });
  const at = (m: number) => new Date(Date.parse("2026-11-26T12:00:00Z") + m * 60_000);

  const firm = { accountKind: "organisation", org: { rcStatus: "verified" }, accountTier: "business" };
  await db.doc("users/acme").set({ username: "acme", displayName: "Acme Ltd", ...firm });
  await db.doc("users/beta").set({ username: "beta", displayName: "Beta Foods", ...firm });
  for (const [u, n, extra] of [["hrm", "ada", { accountTier: "pro" }], ["nohr", "wole", {}], ["teen", "tobi", { teen: true }], ["fbola", "bola", {}], ["fkemi", "kemi", {}], ["staff", "ngozi", {}]] as [string, string, object][]) {
    await db.doc(`users/${u}`).set({ username: n, displayName: n[0].toUpperCase() + n.slice(1), avatar: "", ...extra });
  }
  // Acme's team: Ada in HR; Wole on the team without HR; a teen account wrongly marked HR (a hiring team is adults only; never belled).
  await db.doc("orgMembers/acme_hrm").set({ orgUid: "acme", memberUid: "hrm", role: "writer", hr: true });
  await db.doc("orgMembers/acme_nohr").set({ orgUid: "acme", memberUid: "nohr", role: "admin" });
  await db.doc("orgMembers/acme_teen").set({ orgUid: "acme", memberUid: "teen", role: "writer", hr: true });
  const app = (id: string, orgUid: string, jobTitle: string, uid: string, name: string) =>
    db.doc(`jobApplications/${id}`).set({ jobId: id.split("_")[0], jobTitle, uid, name, orgUid, status: "reviewing", createdAt: at(-600).toISOString(), coverNote: "x", links: [] });
  await app("fj1_bola", "acme", "Community manager", "fbola", "Bola Ade");
  await app("fj1_kemi", "acme", "Community manager", "fkemi", "Kemi Lawal");
  await app("fj2_bola", "acme", "Driver", "fbola", "Bola Ade"); // no conversation: not in the inbox
  await app("fb1_bola", "beta", "Baker", "fbola", "Bola Ade"); // Beta's: never in Acme's inbox
  // #NotesApp's own role: never in a firm's inbox.
  await db.doc("careerApplications/fr1_bola").set({ roleId: "r1", roleTitle: "Campus Ambassador", uid: "fbola", name: "Bola Ade", status: "new", createdAt: at(-600).toISOString() });
  await db.collection("appReplies").add({ kind: "career", applicationId: "fr1_bola", applicantUid: "fbola", orgUid: null, from: "applicant", text: "Career thread", label: "Bola", createdAt: at(90).toISOString() });

  const acme = { uid: "acme" }, ada = { uid: "hrm" }, wole = { uid: "nohr" }, betaOwner = { uid: "beta" };
  const sup = { uid: "staff", access: { role: "super", depts: [] } as Access };

  // Replies from the inbox: as HR (the applicant never sees who pressed send), as the firm itself, and a Nana-HR draft a person sent.
  const hr = await H.hrReply(db, ada, { org: "acme", id: "fj1_bola", as: "hr", text: "Thanks Bola, we're reading it." }, at(0));
  assert.equal(hr.label, "HR, Acme Ltd");
  const own = await H.hrReply(db, ada, { org: "acme", id: "fj1_bola", as: "owner", text: "Hello from Acme." }, at(1));
  assert.equal(own.label, "Acme Ltd", "as owner: the firm's name, never the member's @username");
  const before = (await db.collection("appReplies").get()).size;
  const deps = { now: () => at(2), complete: async () => ({ text: "Hello Kemi, could you do a call on Tuesday?", refused: false }) };
  const { draft } = await H.hrDraft(db, ada, { org: "acme", id: "fj1_kemi", intent: "ask for a call on Tuesday" }, deps as never);
  assert.equal((await db.collection("appReplies").get()).size, before, "Nana-HR only drafts: nothing is sent or saved");
  const nana = await H.hrReply(db, acme, { org: "acme", id: "fj1_kemi", as: "nana", text: draft }, at(3));
  assert.equal(nana.label, "Nana-HR for Acme Ltd");
  // A firm never answers as an individual; "me" is refused here and on the firm's job page alike.
  await refused(H.hrReply(db, ada, { org: "acme", id: "fj1_bola", as: "me", text: "Ada here" }), 400);
  await refused(R.sendReply(db, ada, { kind: "job", id: "fj1_bola", as: "me", text: "Ada here" }), 400);
  await refused(H.hrReply(db, ada, { org: "acme", id: "fj1_bola", as: "boss", text: "x" }), 400);
  // What the applicant sees: the labels, and no @username on an HR or owner reply; the team sees who sent each.
  const seen = await R.listReplies(db, { uid: "fbola" }, "job", "fj1_bola");
  assert.deepEqual(seen.replies.map((r) => [r.label, r.byUsername ?? null]), [["HR, Acme Ltd", null], ["Acme Ltd", null]]);
  assert.ok((await bells("fbola")).some((b) => b.message === "Acme Ltd replied about your application for Community manager."));
  assert.deepEqual((await R.listReplies(db, acme, "job", "fj1_bola", { markRead: false })).replies.map((r) => r.byUsername), ["ada", "ada"]);

  // The applicants reply: the firm's hiring team (the organisation account and its HR members) hears, with a link to the inbox thread;
  // not a team member without HR, not a teen, not another firm, not #NotesApp's staff.
  await R.sendReply(db, { uid: "fbola" }, { kind: "job", id: "fj1_bola", text: "Thank you! When can we talk?" }, at(10));
  await R.sendReply(db, { uid: "fkemi" }, { kind: "job", id: "fj1_kemi", text: "Tuesday works." }, at(11));
  await R.sendReply(db, { uid: "fkemi" }, { kind: "job", id: "fj1_kemi", text: "Any time after 10am." }, at(12));
  for (const u of ["acme", "hrm"]) {
    assert.ok((await bells(u)).some((b) => b.message === "Bola Ade replied about Community manager at Acme Ltd." && b.linkHref === "/profile/jobs/hr-inbox?org=acme&id=fj1_bola"), `${u} hears`);
  }
  for (const u of ["nohr", "teen", "beta", "staff"]) assert.ok(!(await bells(u)).some((b) => b.message.includes("replied about Community manager")), `${u} doesn't`);
  // Beta's own thread, to show it stays with Beta.
  await H.hrReply(db, betaOwner, { org: "beta", id: "fb1_bola", as: "owner", text: "Hi Bola, Beta here." }, at(20));
  await R.sendReply(db, { uid: "fbola" }, { kind: "job", id: "fb1_bola", text: "Hello Beta" }, at(21));
  assert.ok((await bells("beta")).some((b) => b.linkHref === "/profile/jobs/hr-inbox?org=beta&id=fb1_bola"));
  assert.ok(!(await bells("hrm")).some((b) => b.message.includes("Baker")));

  // Acme's list: its own threads only, newest activity first, with unread (the applicant's replies after the team last read it).
  let inbox = await H.hrInbox(db, ada, "all", "acme");
  assert.deepEqual(inbox.rows.map((r) => r.id), ["fj1_kemi", "fj1_bola"], "not Beta's, not #NotesApp's, not an application without a conversation");
  const [kemi, bola] = inbox.rows;
  assert.deepEqual([kemi.applicant.name, kemi.applicant.username, kemi.roleTitle, kemi.statusLabel, kemi.lastText, kemi.unread, kemi.needsReply],
    ["Kemi Lawal", "kemi", "Community manager", "Reviewing", "Any time after 10am.", 2, true]);
  assert.equal(bola.unread, 1, "answering stamped it read; only the later reply is unread");
  assert.deepEqual([inbox.unread, inbox.counts.all, inbox.counts.unread, inbox.counts["needs-reply"]], [3, 2, 2, 2]);
  assert.deepEqual((await H.hrInbox(db, betaOwner, "all", "beta")).rows.map((r) => r.id), ["fb1_bola"]);
  const ours = (await H.hrInbox(db, sup)).rows.map((r) => r.id);
  assert.ok(ours.includes("fr1_bola") && !ours.some((id) => id.startsWith("fj") || id.startsWith("fb")), "#NotesApp's inbox stays career-only");

  // Opening a thread marks it read for the whole team (the organisation sees it read too); it needs a reply until someone answers.
  const t = await H.hrThread(db, ada, "fj1_kemi", { org: "acme", now: at(30) });
  assert.deepEqual([t.application.roleTitle, t.application.applicant.username, t.hubHref, t.reviewer, t.org], ["Community manager", "kemi", "/profile/jobs?org=acme&app=fj1_kemi", true, "Acme Ltd"]);
  inbox = await H.hrInbox(db, acme, "unread", "acme");
  assert.deepEqual(inbox.rows.map((r) => r.id), ["fj1_bola"]);
  assert.deepEqual((await H.hrInbox(db, acme, "needs-reply", "acme")).rows.map((r) => r.id), ["fj1_kemi", "fj1_bola"]);
  await H.hrMarkRead(db, acme, "fj1_bola", at(31), "acme");
  assert.equal((await H.hrInbox(db, ada, "all", "acme")).unread, 0);
  // Reading it on the firm's job page (the replies route) counts too.
  await R.sendReply(db, { uid: "fbola" }, { kind: "job", id: "fj1_bola", text: "Still keen!" }, at(40));
  assert.equal((await H.hrInbox(db, ada, "unread", "acme")).rows.length, 1);
  await R.listReplies(db, acme, "job", "fj1_bola", { now: at(41) });
  assert.equal((await H.hrInbox(db, ada, "unread", "acme")).rows.length, 0);
  await H.hrReply(db, ada, { org: "acme", id: "fj1_kemi", as: "hr", text: "Tuesday at 11am, then." }, at(42));
  assert.deepEqual((await H.hrInbox(db, ada, "needs-reply", "acme")).rows.map((r) => r.id), ["fj1_bola"]);
  // The read stamp is the team's: never in the applicant's own list.
  const mine = await myApplications(db, "fbola");
  assert.ok(mine.length > 0 && mine.every((a) => !("hrReadAt" in a) && !("hrReadBy" in a)));
  assert.ok((await db.doc("jobApplications/fj1_bola").get()).data()?.hrReadAt, "stored on the (server-only) application");

  // Who gets in: not a member without HR, not another firm (not even its own application through Acme's inbox), not #NotesApp staff,
  // not the applicant; and a firm can't reach another firm's application through its own inbox either.
  for (const v of [wole, betaOwner, sup, { uid: "fbola" }]) {
    await refused(H.hrInbox(db, v, "all", "acme"), 403);
    await refused(H.hrThread(db, v, "fj1_bola", { org: "acme" }), 403);
    await refused(H.hrReply(db, v, { org: "acme", id: "fj1_bola", as: "hr", text: "x" }), 403);
    await refused(H.hrDraft(db, v, { org: "acme", id: "fj1_bola", intent: "x" }, deps as never), 403);
    await refused(H.hrMarkRead(db, v, "fj1_bola", at(50), "acme"), 403);
  }
  await refused(H.hrThread(db, betaOwner, "fj1_bola", { org: "beta" }), 404);
  await refused(H.hrReply(db, betaOwner, { org: "beta", id: "fj1_bola", as: "hr", text: "x" }), 404);
  await refused(H.hrThread(db, ada, "fr1_bola", { org: "acme" }), 404); // #NotesApp's application isn't a firm's
  await refused(H.hrInbox(db, ada, "all", "fbola"), 404); // not an organisation

  console.log("FIRM HR INBOX OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
