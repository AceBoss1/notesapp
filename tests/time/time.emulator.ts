// Team time server (lib/time-server.ts) and hourly payroll runs, against the Firestore and Auth emulators.
// Run: npm run test:time-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { plusMin, type Viewer } from "../../lib/time";
import {
  addManual, approvedMinutesByUid, confirm, decideLeave, decideSheet, fridayNudges, getTimer, myWeek, requestLeave, saveProject, setCell, setLead, start, stop,
  submit, sweepTimers, teamWeek, viewerOf,
} from "../../lib/time-server";
import { addStaff, startRun } from "../../lib/payroll-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const auth = getAuth();
const bells: { uid: string; message: string }[] = [];
const notify = async (n: { uid?: string | null; message: string }) => { bells.push({ uid: String(n.uid), message: n.message }); };
const bellsFor = (uid: string) => bells.filter((b) => b.uid === uid).map((b) => b.message);
const rejects = async (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: Error) => re.test(e.message));

(async () => {
  const staff = async (uid: string, claims: object) => { await auth.createUser({ uid, email: `${uid}@team.test`, displayName: uid[0].toUpperCase() + uid.slice(1) }); await auth.setCustomUserClaims(uid, { admin: true, ...claims }); };
  await staff("boss", { adminRole: "super" });
  await staff("lea", { adminRole: "admin", depts: ["engineering"] });
  await staff("ada", { adminRole: "admin", depts: ["engineering"] });
  await staff("tola", { adminRole: "admin", depts: ["growth"] });
  const me = (uid: string, superAdmin = false) => viewerOf(db, { uid, superAdmin, owner: false, finance: superAdmin });
  const boss = await me("boss", true);

  // Team leads: chosen by super admins only
  await rejects(setLead(db, await me("lea"), { uid: "lea", depts: ["engineering"] }, new Date(), notify), /super admin/);
  await setLead(db, boss, { uid: "lea", depts: ["engineering", "nonsense"] }, new Date(), notify);
  const lea: Viewer & { finance: boolean } = await me("lea");
  assert.deepEqual(lea.leads, ["engineering"]);

  // A project, by the lead for their department (not another one)
  await rejects(saveProject(db, lea, { name: "Growth push", dept: "growth" }), /departments you lead/);
  const { id: pid } = await saveProject(db, lea, { name: "Paid courses build", dept: "engineering", billable: true, rate: "5000", budgetHours: 10 });

  // The week of Monday 12 October. Ada's timer: never answered → stops with nothing counted, and she's told
  const mon = "2026-10-12", t0 = new Date("2026-10-12T07:50:00.000Z"); // 8:50 am Lagos
  await start(db, "ada", { kind: "other", label: "Support inbox" }, t0, notify);
  const gone = await getTimer(db, "ada", new Date(plusMin(t0.toISOString(), 41)), notify);
  assert.equal(gone.timer, null); assert.equal(gone.stopped?.entry, null, "the unanswered half hour isn't counted");
  assert.match(bellsFor("ada").at(-1)!, /time check wasn't answered/);

  // Answered once, then stopped: 50 minutes on the project, and the project's total moves
  const t1 = new Date("2026-10-12T08:00:00.000Z");
  await start(db, "ada", { kind: "project", refId: pid }, t1, notify);
  await confirm(db, "ada", new Date(plusMin(t1.toISOString(), 31)), notify);
  const s1 = await stop(db, "ada", new Date(plusMin(t1.toISOString(), 50)), notify);
  assert.deepEqual([s1.entry!.minutes, s1.entry!.billable, s1.entry!.label], [50, true, "Paid courses build"]);
  assert.equal((await db.doc(`timeProjects/${pid}`).get()).data()!.minutes, 50);

  // Starting another stops the first; the scheduled sweep asks once, then stops it
  const t2 = new Date("2026-10-13T09:30:00.000Z");
  await start(db, "ada", { kind: "other", label: "Reading PRs" }, t2, notify);
  await start(db, "ada", { kind: "other", label: "Code review", billable: false }, new Date(plusMin(t2.toISOString(), 20)), notify);
  assert.equal((await myWeek(db, "ada", mon, t2)).entries.filter((e) => e.label === "Reading PRs")[0].minutes, 20);
  const ask = new Date(plusMin(t2.toISOString(), 51));
  assert.deepEqual(await sweepTimers(db, ask, notify), { stopped: 0, asked: 1 });
  assert.deepEqual(await sweepTimers(db, ask, notify), { stopped: 0, asked: 0 }, "the bell goes once per check");
  assert.match(bellsFor("ada").at(-1)!, /Still working on “Code review”/);
  assert.deepEqual(await sweepTimers(db, new Date(plusMin(t2.toISOString(), 61)), notify), { stopped: 1, asked: 0 });

  // By hand, and a timesheet cell changed (kept as a correction)
  const wed = new Date("2026-10-14T16:00:00.000Z");
  await addManual(db, "ada", { kind: "item", refId: "nope", day: "2026-10-14", duration: "1h" }, wed).then(() => assert.fail("unknown item"), (e) => assert.match(e.message, /wasn't found/));
  await addManual(db, "ada", { kind: "other", label: "Support inbox", day: "2026-10-14", duration: "1:30" }, wed);
  await setCell(db, "ada", { kind: "other", label: "Support inbox", billable: false, day: "2026-10-14", duration: "1h" }, wed);
  await rejects(setCell(db, "ada", { kind: "other", label: "Support inbox", day: "2026-10-16", duration: "1h" }, wed), /hasn't come/);
  const w = await myWeek(db, "ada", mon, wed);
  assert.equal(w.rows.find((r) => r.label === "Support inbox")!.days["2026-10-14"], 60);
  assert.equal(w.summary.tracked, 50 + 20 + 60, "Reading 20, Code review 0 (never answered), project 50, inbox 60");
  assert.deepEqual([w.summary.daysPresent, w.summary.daysDue], [3, 3]);

  // Leave: Ada asks, her lead approves (not Tola's lead, not Ada herself)
  await requestLeave(db, "ada", { kind: "sick", from: "2026-10-15", to: "2026-10-15" }, wed, notify);
  assert.match(bellsFor("lea").at(-1)!, /ada asked for 1 day of leave/i);
  const lv = (await db.collection("timeLeave").where("uid", "==", "ada").get()).docs[0];
  await rejects(decideLeave(db, await me("ada"), { id: lv.id, decision: "approve" }, wed, notify), /team lead/);
  await decideLeave(db, lea, { id: lv.id, decision: "approve" }, wed, notify);

  // Submit → locked; approved by the lead; never by Ada; Tola's week isn't Lea's to approve
  const fri = new Date("2026-10-16T15:30:00.000Z");
  await submit(db, "ada", mon, fri, notify);
  assert.match(bellsFor("lea").at(-1)!, /ada submitted their timesheet/i);
  await rejects(addManual(db, "ada", { kind: "other", label: "x", day: "2026-10-16", duration: "1h" }, fri), /submitted/);
  await rejects(decideSheet(db, await me("ada"), { uid: "ada", week: mon, decision: "approve" }, fri, notify), /Someone else/);
  await submit(db, "tola", mon, fri, notify);
  assert.ok(bellsFor("boss").some((m) => /tola submitted/i.test(m)), "no growth lead: super admins are told");
  await rejects(decideSheet(db, lea, { uid: "tola", week: mon, decision: "approve" }, fri, notify), /team lead/);
  await decideSheet(db, lea, { uid: "ada", week: mon, decision: "approve" }, fri, notify);
  assert.equal((await myWeek(db, "ada", mon, fri)).sheet.status, "approved");

  // The team report: Lea sees engineering only; the boss sees everyone, with pay
  const tLea = await teamWeek(db, lea, mon, fri);
  assert.deepEqual(tLea.rows.map((r) => r.uid).sort(), ["ada", "lea"]);
  assert.equal(tLea.rows.find((r) => r.uid === "ada")!.payKobo, undefined, "pay is for finance and super admins");
  assert.equal((await teamWeek(db, boss, mon, fri)).rows.length, 4);
  await rejects(teamWeek(db, await me("ada"), mon, fri), /team leads/);

  // Friday 4 pm: once, to everyone whose week isn't submitted
  assert.equal(await fridayNudges(db, fri, notify), 2, "boss and lea; ada and tola submitted");
  assert.equal(await fridayNudges(db, fri, notify), 0, "once a week");

  // Payroll: Ada by the hour, from her approved week (2h 10m × ₦2,000)
  assert.equal((await approvedMinutesByUid(db, ["ada", "tola"], "2026-10")).get("ada"), 130);
  const fin = { uid: "boss", email: "boss@team.test", owner: false, finance: true, product: false };
  await addStaff(db, fin, { name: "Ada", basis: "hourly", hourly: "2000", uid: "ada", startedOn: "2026-10-01" });
  await addStaff(db, fin, { name: "Tola", basis: "hourly", hourly: "2000", uid: "tola", startedOn: "2026-10-01" });
  const runOct = await startRun(db, fin, "2026-10", new Date("2026-10-28T12:00:00Z"));
  assert.deepEqual(runOct.lines.map((l) => [l.name, l.minutes, l.amountKobo]), [["Ada", 130, Math.round((130 * 200000) / 60)]], "Tola's week isn't approved yet: no line");

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
