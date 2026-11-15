// The campus programme on the Firestore emulator (lib/campus-server.ts): leads appoint coordinators, a coordinator adds her own
// ambassadors and only manages them, tasks go only to her team, ambassadors report and see only their own progress, reviews, and the
// overview counts sign-ups through each ambassador's link. Run: npm run test:campus
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const C = await import("../../lib/campus-server");
  const now = new Date("2026-11-15T10:00:00Z");
  const sent: { uid: string; message: string }[] = [];
  const notify = async (n: { uid: string; message: string }) => { sent.push(n); };
  const emails: Record<string, string> = { "ada@example.test": "ada", "bola@example.test": "bola" };
  const auth = { getUserByEmail: async (e: string) => { if (!emails[e]) throw new Error("no user"); return { uid: emails[e] }; } } as never;
  const people = ["boss", "ada", "bola", "chi", "dayo", "eze", "kid"];
  for (const u of people) await db.doc(`users/${u}`).set({ username: u, displayName: u.toUpperCase(), ...(u === "kid" ? { teen: true } : {}) });
  for (const u of people) await db.doc(`usernames/${u}`).set({ uid: u });
  const lead = { uid: "boss", lead: true, member: null };
  const view = async (uid: string, isLead = false) => C.viewerOf(db, uid, isLead ? { role: "super", depts: [] } : null);

  // Only leads appoint coordinators; the person must exist and be an adult.
  await assert.rejects(C.appointCoordinator(db, auth, await view("chi"), { who: "ada@example.test", country: "NG" }, notify), /Only super admins/);
  await assert.rejects(C.appointCoordinator(db, auth, lead, { who: "nobody@example.test", country: "NG" }, notify), /sign up first/);
  await assert.rejects(C.appointCoordinator(db, auth, lead, { who: "@kid", country: "NG" }, notify), /adults/);
  await assert.rejects(C.appointCoordinator(db, auth, lead, { who: "ada@example.test", country: "GH" }, notify), /country/);
  await C.appointCoordinator(db, auth, lead, { who: "ada@example.test", country: "NG" }, notify);
  await C.appointCoordinator(db, auth, lead, { who: "@bola", country: "NG" }, notify);
  await assert.rejects(C.appointCoordinator(db, auth, lead, { who: "@ada", country: "NG" }, notify), /already a coordinator/);
  assert.ok(sent.some((s) => s.uid === "ada" && /coordinator for Nigeria/.test(s.message)));

  // A coordinator adds her ambassadors; nobody else can, and nobody is on two teams.
  const ada = await view("ada"), bola = await view("bola");
  await assert.rejects(C.addAmbassador(db, auth, await view("chi"), { who: "@dayo", campus: "UNILAG" }, notify), /Only a campus coordinator/);
  await assert.rejects(C.addAmbassador(db, auth, ada, { who: "@chi", campus: "U" }, notify), /campus/);
  await C.addAmbassador(db, auth, ada, { who: "@chi", campus: "University of Lagos", state: "Lagos" }, notify);
  await C.addAmbassador(db, auth, ada, { who: "@dayo", campus: "Covenant University" }, notify);
  await C.addAmbassador(db, auth, bola, { who: "@eze", campus: "UNN" }, notify);
  await assert.rejects(C.addAmbassador(db, auth, bola, { who: "@chi", campus: "UNN" }, notify), /already on a campus team/);
  await assert.rejects(C.addAmbassador(db, auth, ada, { who: "@ada", campus: "UNN" }, notify), /coordinator/);
  assert.deepEqual((await C.team(db, ada)).map((m) => m.uid), ["chi", "dayo"], "a coordinator sees only her team");
  assert.equal((await C.team(db, lead, { country: "NG" })).length, 5, "a lead sees the country");
  await assert.rejects(C.team(db, await view("chi")), /Only coordinators/);

  // Tasks go only to her own ambassadors.
  await assert.rejects(C.createTask(db, await view("chi"), { title: "Hi", due: "2026-11-30" }, notify), /Only a campus coordinator/);
  await assert.rejects(C.createTask(db, ada, { title: "Stand", due: "2026-11-01", assignees: "all" }, notify, now), /passed/);
  await assert.rejects(C.createTask(db, ada, { title: "Stand", due: "2026-11-30", assignees: ["eze"] }, notify, now), /your team/);
  await assert.rejects(C.createTask(db, ada, { title: "Sign-ups", kind: "signups", due: "2026-11-30", assignees: "all" }, notify, now), /how many/);
  const t1 = await C.createTask(db, ada, { title: "Bring 10 sign-ups", kind: "signups", target: 10, due: "2026-11-30", assignees: "all" }, notify, now);
  const t2 = await C.createTask(db, ada, { title: "Hold a stand", kind: "event", due: "2026-11-14", assignees: ["chi"] }, notify, new Date("2026-11-10T10:00:00Z"));
  assert.deepEqual(t1.assignees.sort(), ["chi", "dayo"]);
  assert.ok(sent.some((s) => s.uid === "dayo" && /New campus task/.test(s.message)));

  // Ambassadors see their own tasks with only their own progress, and report on them.
  const chi = await view("chi"), dayo = await view("dayo");
  const mine = await C.tasks(db, chi);
  assert.equal(mine.length, 2);
  assert.deepEqual(Object.keys(mine.find((t) => t.id === t1.id)!.progress), ["chi"], "never another ambassador's progress");
  await assert.rejects(C.report(db, await view("eze"), t1.id, { status: "done" }, notify), /wasn't found/);
  await assert.rejects(C.report(db, chi, t1.id, { status: "done", proofUrl: "javascript:alert(1)" }, notify), /https/);
  await C.report(db, chi, t1.id, { status: "done", note: "12 friends joined", proofUrl: "https://example.test/proof" }, notify, now);
  assert.ok(sent.some((s) => s.uid === "ada" && /finished "Bring 10 sign-ups"/.test(s.message)));
  await assert.rejects(C.review(db, bola, t1.id, "chi", "approved", "", notify), /wasn't found/, "not her task");
  await assert.rejects(C.review(db, ada, t1.id, "dayo", "approved", "", notify), /once they mark it done/);
  await assert.rejects(C.review(db, ada, t1.id, "chi", "redo", "", notify), /what needs doing/);
  const r = await C.review(db, ada, t1.id, "chi", "redo", "Add the screenshots", notify, now);
  assert.equal(r.status, "doing");
  await C.report(db, chi, t1.id, { status: "done", proofUrl: "https://example.test/shots" }, notify, now);
  assert.equal((await C.review(db, ada, t1.id, "chi", "approved", "", notify, now)).review, "approved");
  await C.report(db, dayo, t1.id, { status: "doing" }, notify, now);

  // The overview: sign-ups through each one's link this month and all time, and their tasks.
  await db.doc("referrals/n1").set({ uid: "n1", referredBy: "chi", referredAt: "2026-11-02T09:00:00Z" });
  await db.doc("referrals/n2").set({ uid: "n2", referredBy: "chi", referredAt: "2026-10-31T23:30:00Z" }); // 1 Nov in Lagos
  await db.doc("referrals/n3").set({ uid: "n3", referredBy: "chi", referredAt: "2026-10-20T09:00:00Z" });
  await db.doc("referrals/n4").set({ uid: "n4", referredBy: "dayo", referredAt: "2026-11-10T09:00:00Z" });
  const o = await C.overview(db, ada, {}, now);
  assert.equal(o.totals.ambassadors, 2);
  const c = o.ambassadors.find((a) => a.uid === "chi")!;
  assert.equal(c.signupsMonth, 2, "this month, by the Lagos day");
  assert.equal(c.signupsAll, 3);
  assert.equal(c.done, 1); assert.equal(c.open, 1); assert.equal(c.overdue, 1, "the stand was due yesterday");
  assert.equal(o.ambassadors[0].uid, "chi", "most sign-ups this month first");
  const solo = await C.overview(db, chi, {}, now);
  assert.equal(solo.ambassadors.length, 1, "an ambassador sees only herself");

  // Removing: a coordinator only her own; a coordinator with a team only after it moves.
  await assert.rejects(C.removeMember(db, bola, "chi", notify), /own team/);
  await assert.rejects(C.removeMember(db, lead, "ada", notify), /still has 2/);
  await assert.rejects(C.moveTeam(db, ada, "ada", "bola", notify), /Only super admins/);
  assert.equal((await C.moveTeam(db, lead, "ada", "bola", notify)).moved, 2);
  assert.equal((await C.team(db, bola)).length, 3);
  await C.removeMember(db, lead, "ada", notify);
  await C.removeMember(db, bola, "dayo", notify);
  assert.equal((await db.doc("campusTeam/dayo").get()).exists, false);
  await assert.rejects(C.me(db, await view("dayo")), /coordinators and ambassadors/);
  // Editing and deleting stay with the task's coordinator.
  await assert.rejects(C.deleteTask(db, bola, t1.id), /wasn't found/);

  console.log("CAMPUS OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
