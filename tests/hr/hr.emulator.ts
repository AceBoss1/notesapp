// Nana-HR, hiring and the staff library against the Firestore and Auth emulators: the library is seeded where each document belongs
// (super admins see all), Nana-HR reads only what the person may open and only their own records, the five vacancies are seeded and
// public, applying works once, only super admins and the Chief of Staff manage hiring, only a super admin opens or closes a role,
// closing starts the 6-month clock, applicants hear back, and Nana-HR's summary is saved.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Access } from "../../lib/admin-access";
import { SEED_DOCS, seedStaffLibrary } from "../../lib/staff-library-seed";
import { listDocs, readDoc } from "../../lib/staff-ops-server";
import { hrLibraryFor, hrRecordsFor } from "../../lib/nana-hr-server";
import { apply, hiringBoard, makeDrafts, openRoles, saveRole, setApplicationStatus, setRoleStatus, summarise, type Staff } from "../../lib/careers-server";
import { CareersError } from "../../lib/careers";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const auth = getAuth();
const sup: Access = { role: "super", depts: [] };
const cosA: Access = { role: "admin", depts: ["executive"], cos: true };
const finA: Access = { role: "admin", depts: ["finance"] };
const engA: Access = { role: "admin", depts: ["engineering"] };
const staff = (uid: string, access: Access): Staff => ({ uid, email: `${uid}@x.test`, access, owner: false });
const refused = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => e instanceof CareersError && e.status === status); };

(async () => {
  for (const uid of ["u_sup", "u_cos", "u_fin", "u_eng", "u_ada", "u_c1", "u_c2", "u_c3", "u_c4"]) await auth.createUser({ uid, email: `${uid}@x.test`, displayName: uid }).catch(() => {});

  // ── The library, seeded where each document belongs ──
  const n = await seedStaffLibrary(db);
  assert.equal(n, SEED_DOCS.length);
  assert.equal(await seedStaffLibrary(db), 0, "a second run writes nothing");
  const titles = async (uid: string, access: Access) => (await listDocs(db, { uid, email: "", name: uid, access }, false)).docs.map((d) => d.title);
  const supSees = await titles("u_sup", sup), finSees = await titles("u_fin", finA), engSees = await titles("u_eng", engA), cosSees = await titles("u_cos", cosA);
  assert.equal(supSees.length, SEED_DOCS.length, "super admins see all");
  assert.ok(finSees.includes("#NotesApp Employee Handbook") && finSees.includes("SOP: Finance and payouts") && finSees.includes("Finance brief"));
  assert.ok(!finSees.includes("SOP: Engineering") && !finSees.includes("#NotesApp Marketing Brief"));
  assert.ok(engSees.includes("SOP: Engineering") && engSees.includes("The NotesApp Engineering Guide") && !engSees.includes("SOP: Product & tech"), "engineering stands alone");
  assert.ok(cosSees.includes("Template: offer of employment") && !finSees.includes("Template: offer of employment"));
  const listed = (await listDocs(db, { uid: "u_fin", email: "", name: "f", access: finA })).docs[0] as unknown as Record<string, unknown>;
  assert.equal(listed.body, undefined, "the list doesn't carry the text");
  assert.equal(listed.hasBody, true);
  const read = await readDoc(db, { uid: "u_fin", email: "", name: "f", access: finA }, "seed-sop-finance");
  assert.match(read.body, /Finance and payouts/);
  await assert.rejects(readDoc(db, { uid: "u_fin", email: "", name: "f", access: finA }, "seed-sop-engineering"));

  // ── Nana-HR reads only what the person may open, and only their own records ──
  const lib = await hrLibraryFor(db, { uid: "u_fin", access: finA });
  assert.ok(lib.titles.includes("SOP: Finance and payouts") && !lib.titles.includes("SOP: Engineering"));
  assert.equal(lib.titles[0], "#NotesApp Employee Handbook", "the handbook first");
  await db.collection("payrollStaff").add({ uid: "u_fin", name: "Fin", basis: "hourly", hourlyKobo: 200000, payDay: 25, active: true });
  const rec = await hrRecordsFor(db, { uid: "u_fin", access: finA, name: "Fin" });
  assert.match(rec, /paid by the hour/);
  assert.match(rec, /day 25/);
  assert.doesNotMatch(rec, /2,000|200000/, "no rate figures in the context");
  const recEng = await hrRecordsFor(db, { uid: "u_eng", access: engA, name: "Eng" });
  assert.match(recEng, /no payroll record/);

  // ── Careers ──
  const open = await openRoles(db);
  assert.deepEqual(open.map((r) => r.id).sort(), ["seed-care-lead", "seed-cmo", "seed-community-strategist", "seed-partnerships-lead", "seed-safety-lead", "seed-ua-lead"]);
  {
    // A site seeded before the Community Strategist was added gets it once; a seeded role someone deleted never comes back.
    const { seedRoles } = await import("../../lib/careers-server");
    await db.doc("careerRoles/seed-community-strategist").delete();
    await db.doc("careerRoles/seed-safety-lead").delete();
    await db.doc("staffMeta/careersSeed").set({ roles: ["cmo", "ua-lead", "partnerships-lead", "care-lead", "safety-lead"], marketingSplit: "x" });
    assert.equal(await seedRoles(db), 1);
    assert.equal((await db.doc("careerRoles/seed-community-strategist").get()).data()?.status, "open");
    assert.equal((await db.doc("careerRoles/seed-safety-lead").get()).exists, false, "a deleted seeded role stays deleted");
    assert.equal(await seedRoles(db), 0, "once only");
    await db.doc("careerRoles/seed-safety-lead").set((await db.doc("careerRoles/seed-care-lead").get()).data()!); // put it back for the rest
  }
  await db.doc("users/u_ada").set({ displayName: "Ada Obi" });
  const note = "I led customer care for a Lagos fintech for four years and trained a team of six.";
  await apply(db, { uid: "u_ada", email: "u_ada@x.test" }, "seed-care-lead", { coverNote: note, consent: true });
  await refused(apply(db, { uid: "u_ada", email: "u_ada@x.test" }, "seed-care-lead", { coverNote: note, consent: true }), 409);
  await refused(apply(db, { uid: "u_ada", email: "u_ada@x.test" }, "nope", { coverNote: note, consent: true }), 404);

  // Who manages hiring: super admins and the Chief of Staff; nobody else.
  await refused(hiringBoard(db, staff("u_fin", finA)), 403);
  const board = await hiringBoard(db, staff("u_cos", cosA));
  assert.equal(board.applications.length, 1);
  assert.equal(board.canOpen, false);
  const drafted = await saveRole(db, staff("u_cos", cosA), undefined, { title: "Editor", dept: "content", requirements: ["Writes well"] });
  assert.equal(drafted.status, "draft");
  await assert.rejects(setRoleStatus(db, staff("u_cos", cosA), drafted.id, "open"), (e: unknown) => e instanceof CareersError && e.status === 403);
  await setRoleStatus(db, staff("u_sup", sup), drafted.id, "open");
  assert.ok((await openRoles(db)).some((r) => r.id === drafted.id));

  // Applicants hear back; closing a role starts the 6-month clock.
  await setApplicationStatus(db, staff("u_cos", cosA), "seed-care-lead_u_ada", "interview", "Strong on rotas");
  const bells = await db.collection("notifications").where("recipientUid", "==", "u_ada").get();
  assert.ok(bells.docs.some((d) => /like to talk to you/.test(String(d.data().message))));
  await setRoleStatus(db, staff("u_sup", sup), "seed-care-lead", "closed");
  assert.ok((await db.doc("careerApplications/seed-care-lead_u_ada").get()).data()?.purgeAt, "purge clock set");

  // Nana-HR's screening summary, with a stand-in model; and the onboarding drafts.
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-standin";
  let seen = "";
  const deps = { now: () => new Date(), complete: async (a: { messages: { content: unknown }[] }) => { seen = String(a.messages[0].content); return { text: "Customer support experience: Met \"four years\"", refused: false }; } };
  const s = await summarise(db, staff("u_cos", cosA), "seed-care-lead_u_ada", deps as never);
  assert.match(s, /Met/);
  assert.match(seen, /REQUIREMENTS/);
  assert.doesNotMatch(seen, /Ada Obi|u_ada@x\.test/, "the model isn't given the applicant's name or email");
  const d = await makeDrafts(db, staff("u_cos", cosA), { name: "Ada Obi", title: "Customer care team lead", arrangement: "salary" });
  assert.deepEqual(d.drafts.map((x) => x.kind), ["offer", "announcement"]);
  await refused(makeDrafts(db, staff("u_fin", finA), { name: "X", title: "Y" }), 403);

  // ── Deleting a vacancy ──
  {
    const { deleteRole, seedRoles } = await import("../../lib/careers-server");
    const note2 = "I have run community programmes for a church of 2,000 people and a creators' group, and I love helping people gather.";
    for (const u of ["u_c1", "u_c2", "u_c3", "u_c4"]) await db.doc(`users/${u}`).set({ displayName: u });
    await apply(db, { uid: "u_c1", email: "c1@x.test" }, "seed-community-strategist", { coverNote: note2, consent: true });
    await apply(db, { uid: "u_c2", email: "c2@x.test" }, "seed-community-strategist", { coverNote: note2, consent: true, futureRoles: true });
    await apply(db, { uid: "u_c3", email: "c3@x.test" }, "seed-community-strategist", { coverNote: note2, consent: true });
    await apply(db, { uid: "u_c4", email: "c4@x.test" }, "seed-community-strategist", { coverNote: note2, consent: true });
    await setApplicationStatus(db, staff("u_cos", cosA), "seed-community-strategist_u_c3", "hired", "");
    await setApplicationStatus(db, staff("u_cos", cosA), "seed-community-strategist_u_c4", "declined", "");
    // the Chief of Staff can delete a draft, not a role that has been on /careers
    await assert.rejects(deleteRole(db, staff("u_cos", cosA), "seed-community-strategist"), (e: unknown) => e instanceof CareersError && e.status === 403);
    const draft = await saveRole(db, staff("u_cos", cosA), undefined, { title: "Draft role", dept: "support", requirements: ["x"] });
    assert.deepEqual(await deleteRole(db, staff("u_cos", cosA), draft.id), { removed: 0, kept: 0 });
    assert.equal((await db.doc(`careerRoles/${draft.id}`).get()).exists, false);
    await assert.rejects(deleteRole(db, staff("u_fin", finA), "seed-care-lead"), (e: unknown) => e instanceof CareersError && e.status === 403);
    // a super admin deletes an open role: its applications go, the ones still in the running are told, the hired and the "keep me" stay
    const before = (await db.collection("notifications").where("recipientUid", "==", "u_c1").get()).size;
    assert.deepEqual(await deleteRole(db, staff("u_sup", sup), "seed-community-strategist"), { removed: 2, kept: 2 });
    assert.equal((await db.doc("careerRoles/seed-community-strategist").get()).exists, false);
    assert.equal((await db.doc("careerApplications/seed-community-strategist_u_c1").get()).exists, false);
    assert.equal((await db.doc("careerApplications/seed-community-strategist_u_c4").get()).exists, false);
    const kept2 = (await db.doc("careerApplications/seed-community-strategist_u_c2").get()).data()!;
    assert.equal(kept2.roleDeleted, true); assert.ok(kept2.purgeAt, "kept for future roles, then deleted 6 months on");
    assert.equal((await db.doc("careerApplications/seed-community-strategist_u_c3").get()).data()!.purgeAt, undefined, "a hire's record stays");
    const bells = (await db.collection("notifications").where("recipientUid", "==", "u_c1").get()).docs.map((d) => String(d.data().message));
    assert.equal(bells.length, before + 1); assert.ok(bells.some((m) => m.includes("withdrawn the Community Strategist role")));
    assert.equal((await db.collection("notifications").where("recipientUid", "==", "u_c4").get()).docs.filter((d) => String(d.data().message).includes("withdrawn")).length, 0, "an applicant already told no isn't told again");
    await assert.rejects(deleteRole(db, staff("u_sup", sup), "seed-community-strategist"), (e: unknown) => e instanceof CareersError && e.status === 404);
    assert.equal(await seedRoles(db), 0, "a deleted seeded role isn't seeded again");
  }

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
