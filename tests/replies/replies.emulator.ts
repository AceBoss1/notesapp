// Replies on job applications (lib/app-replies-server.ts), on the Firestore emulator with a stand-in AI: a firm's hiring team (the
// organisation, its admins and its writers) and #NotesApp's own hiring team reply as HR, Nana-HR or themselves; the applicant reads
// and replies; Nana-HR drafts (never sends) and summarises for the firm; "Apply with NotesApp" off sends applicants elsewhere.
// Run: npm run test:replies → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const R = await import("../../lib/app-replies-server");
  const J = await import("../../lib/jobs-server");
  const { cleanJob, JobsError } = await import("../../lib/jobs");
  const refused = async (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => (e instanceof R.RepliesError || e instanceof JobsError) && (e as { status: number }).status === status);
  let prompt = "";
  const deps = { now: () => new Date("2026-11-09T10:00:00Z"), complete: async (a: { system: { text: string }[]; messages: { content: string }[] }) => { prompt = a.system.map((b) => b.text).join("\n") + "\n" + a.messages[0].content; return { text: prompt.includes("screening summary") ? "Requirement A: Met" : "Hello Bola, can you do a call on Tuesday at 10am?", refused: false }; } };
  const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => String(d.data().message));

  const verified = { accountKind: "organisation", org: { rcStatus: "verified" }, accountTier: "business" };
  await db.doc("users/org").set({ username: "acme", displayName: "Acme Ltd", ...verified });
  for (const [u, n] of [["adm", "ada"], ["wri", "wole"], ["bola", "bola"], ["str", "stranger"], ["staff", "ngozi"]]) await db.doc(`users/${u}`).set({ username: n, displayName: n[0].toUpperCase() + n.slice(1), accountTier: "pro" });
  // the owner puts team members in HR whatever their role: Ada (admin) and Wole (writer) are; Stranger is an admin without HR
  await db.doc("orgMembers/org_adm").set({ orgUid: "org", memberUid: "adm", role: "admin", hr: true });
  await db.doc("orgMembers/org_wri").set({ orgUid: "org", memberUid: "wri", role: "writer", hr: true });
  await db.doc("orgMembers/org_str").set({ orgUid: "org", memberUid: "str", role: "admin" });
  const job = await J.postJob(db, { uid: "wri" }, "org", { title: "Community manager", summary: "Grow our communities across Lagos", requirements: ["2 years with communities"], type: "full_time", mode: "onsite", city: "Lagos" });
  const note = "I have run communities for a church of 2,000 people and a creators' group, and I love helping people gather.";
  const app = await J.applyToJob(db, { uid: "bola" }, job.id, { coverNote: note, consent: true });

  // HR, not the role, decides: a writer in HR posted the job above and sees the applications; an admin without HR sees nothing
  assert.equal((await J.firmBoard(db, { uid: "wri" }, "org")).canManage, true);
  await refused(J.firmBoard(db, { uid: "str" }, "org"), 403);
  await refused(J.postJob(db, { uid: "str" }, "org", { title: "X job", summary: "A summary that is long enough", requirements: ["y"], type: "full_time", mode: "remote" }), 403);
  await J.setApplicationStatus(db, { uid: "wri" }, app.id, "reviewing");

  // replies: as HR (the applicant doesn't see who pressed send), as a person, and Nana-HR's draft sent by a writer
  const hr = await R.sendReply(db, { uid: "adm" }, { kind: "job", id: app.id, as: "hr", text: "Thanks Bola, we're reading your application." });
  assert.equal(hr.label, "HR, Acme Ltd");
  assert.ok((await bells("bola")).some((m) => m.includes("HR, Acme Ltd replied about your application for Community manager")));
  const me = await R.sendReply(db, { uid: "wri" }, { kind: "job", id: app.id, as: "me", text: "Hi, I'm Wole from the team." });
  assert.equal(me.label, "@wole, Acme Ltd");
  const { draft } = await R.draftReply(db, { uid: "wri" }, { kind: "job", id: app.id, intent: "invite them to a call on Tuesday at 10am" }, deps as never);
  assert.ok(draft.includes("Tuesday") && prompt.includes("invite them to a call on Tuesday at 10am") && prompt.includes("HR, Acme Ltd: Thanks Bola"));
  const nana = await R.sendReply(db, { uid: "wri" }, { kind: "job", id: app.id, as: "nana", text: draft });
  assert.equal(nana.label, "Nana-HR for Acme Ltd");
  await refused(R.sendReply(db, { uid: "adm" }, { kind: "job", id: app.id, as: "boss", text: "x" }), 400);
  await refused(R.sendReply(db, { uid: "adm" }, { kind: "job", id: app.id, as: "hr", text: "   " }), 400);

  // the applicant reads the thread (who sent the HR and Nana-HR replies stays with the team) and replies; the firm gets a bell
  const mine = await R.listReplies(db, { uid: "bola" }, "job", app.id);
  assert.equal(mine.reviewer, false);
  assert.deepEqual(mine.replies.map((r) => [r.from, r.byUsername ?? null]), [["hr", null], ["me", "wole"], ["nana", null]]);
  assert.equal((await R.listReplies(db, { uid: "adm" }, "job", app.id)).replies[0].byUsername, "ada", "the team sees who sent it");
  await R.sendReply(db, { uid: "bola" }, { kind: "job", id: app.id, as: "hr", text: "Tuesday at 10 works, thank you!" });
  assert.equal((await R.listReplies(db, { uid: "adm" }, "job", app.id)).replies[3].from, "applicant", "an applicant can't pick a sender");
  assert.ok((await bells("org")).some((m) => m.includes("Bola replied about Community manager")));
  await refused(R.draftReply(db, { uid: "bola" }, { kind: "job", id: app.id, intent: "x" }, deps as never), 403);
  await refused(R.listReplies(db, { uid: "str" }, "job", app.id), 403);

  // Nana-HR's screening summary, for the hiring team only, never in the applicant's own list
  const sum = await R.summariseJobApplication(db, { uid: "wri" }, app.id, deps as never);
  assert.equal(sum.text, "Requirement A: Met");
  assert.ok(prompt.includes("2 years with communities"));
  await refused(R.summariseJobApplication(db, { uid: "bola" }, app.id, deps as never), 403);
  assert.ok(!("summary" in (await J.myApplications(db, "bola"))[0]));
  assert.equal((await J.firmBoard(db, { uid: "adm" }, "org")).applications[0].summary?.text, "Requirement A: Met");

  // #NotesApp's own roles: the hiring team (super admins and the Chief of Staff) and the applicant
  await db.doc("careerApplications/r1_bola").set({ roleId: "r1", roleTitle: "Campus Ambassador", uid: "bola", name: "Bola", status: "new", createdAt: "2026-11-09T09:00:00Z" });
  const superA = { role: "super" as const, depts: [] };
  const r = await R.sendReply(db, { uid: "staff", access: superA }, { kind: "career", id: "r1_bola", as: "me", text: "Thanks for applying!" });
  assert.equal(r.label, "@ngozi, #NotesApp");
  await refused(R.listReplies(db, { uid: "str", access: { role: "admin" as const, depts: ["support" as const] } }, "career", "r1_bola"), 403);
  assert.equal((await R.listReplies(db, { uid: "bola" }, "career", "r1_bola")).replies.length, 1);

  // "Apply with NotesApp" off: the job needs a link, and takes no applications here
  assert.throws(() => cleanJob({ title: "Driver", summary: "Drive our van around Lagos", requirements: ["Licence"], type: "full_time", mode: "onsite", city: "Lagos", applyWithNotesApp: false }), JobsError);
  const ext = await J.postJob(db, { uid: "org" }, "org", { title: "Driver", summary: "Drive our van around Lagos", requirements: ["Licence"], type: "full_time", mode: "onsite", city: "Lagos", applyWithNotesApp: false, applyUrl: "https://acme.example/jobs/driver" });
  assert.equal(ext.applyUrl, "https://acme.example/jobs/driver");
  await refused(J.applyToJob(db, { uid: "bola" }, ext.id, { coverNote: note, consent: true }), 409);
  const back = await J.updateJob(db, { uid: "org" }, ext.id, { title: "Driver", summary: "Drive our van around Lagos", requirements: ["Licence"], type: "full_time", mode: "onsite", city: "Lagos" });
  assert.equal(back.applyUrl, undefined, "switching it back on clears the link");

  // deleting the job deletes its applications' conversations
  await J.deleteJob(db, { uid: "org" }, job.id);
  assert.equal((await db.collection("appReplies").where("kind", "==", "job").get()).size, 0);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
