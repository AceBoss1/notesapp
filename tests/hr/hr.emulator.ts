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
  for (const uid of ["u_sup", "u_cos", "u_fin", "u_eng", "u_ada"]) await auth.createUser({ uid, email: `${uid}@x.test`, displayName: uid }).catch(() => {});

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
  assert.deepEqual(open.map((r) => r.id).sort(), ["seed-care-lead", "seed-cmo", "seed-partnerships-lead", "seed-safety-lead", "seed-ua-lead"]);
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

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
