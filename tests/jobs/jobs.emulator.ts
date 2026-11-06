// Notes Jobs end to end on the Firestore emulator (lib/jobs-server.ts): only a CAC-verified organisation (or its admin) posts; members
// apply once and hear when it moves on; Business and Enterprise jobs reach members who need a job (a bell, capped) and show them as
// suggested candidates without their contact details; deleting and a report take a job down. Run: npm run test:jobs → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const S = await import("../../lib/jobs-server");
  const { JobsError, BELLS_PER_DAY } = await import("../../lib/jobs");
  const { createReport, resolveReport } = await import("../../lib/reports-server");
  const refused = async (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof JobsError && e.status === status);
  const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => String(d.data().message));

  const verified = { accountKind: "organisation", org: { rcStatus: "verified", rcNumber: "RC1" } };
  await db.doc("users/org_biz").set({ username: "acme", displayName: "Acme Ltd", accountTier: "business", ...verified });
  await db.doc("users/org_free").set({ username: "smallco", displayName: "Small Co", accountTier: "standard", ...verified });
  await db.doc("users/org_unverified").set({ username: "shady", displayName: "Shady Ltd", accountTier: "business", accountKind: "organisation", org: { rcStatus: "unverified" } });
  await db.doc("users/u_admin").set({ username: "ada", displayName: "Ada" });
  await db.doc("users/u_writer").set({ username: "wole", displayName: "Wole" });
  await db.doc("orgMembers/org_biz_u_admin").set({ orgUid: "org_biz", memberUid: "u_admin", role: "admin" });
  await db.doc("orgMembers/org_biz_u_writer").set({ orgUid: "org_biz", memberUid: "u_writer", role: "writer" });
  // members
  await db.doc("users/u_bola").set({ username: "bola", displayName: "Bola", industry: "media", jobTitle: "Community lead", interests: ["marketing", "socialmedia"] });
  await db.doc("users/u_chi").set({ username: "chi", displayName: "Chi", industry: "media", jobTitle: "Community lead", interests: ["marketing", "socialmedia"] });
  await db.doc("users/u_teen").set({ username: "tee", displayName: "Tee", teen: true, industry: "media", jobTitle: "Community lead", interests: ["marketing", "socialmedia"] });
  await db.doc("users/u_dayo").set({ username: "dayo", displayName: "Dayo", industry: "finance" });

  const job = { title: "Community manager", summary: "Grow our members' communities across Lagos", requirements: ["2 years with communities"], type: "full_time", mode: "onsite", city: "Lagos", industry: "media", topics: ["marketing", "socialmedia"] };

  // "I need a job": on for Bola and Chi (city private), refused for a teen and an organisation
  await S.setSeeker(db, "u_bola", { openToWork: true, city: "Lagos" });
  await S.setSeeker(db, "u_chi", { openToWork: true, city: "Lagos" });
  await refused(S.setSeeker(db, "u_teen", { openToWork: true }), 403);
  await refused(S.setSeeker(db, "org_biz", { openToWork: true }), 403);
  await db.doc("jobSeekers/u_teen").set({ openToWork: true, city: "Lagos" }); // even if it got there somehow, a teen is never matched
  // Chi already had BELLS_PER_DAY job bells today
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  await db.doc(`jobBells/u_chi_${today}`).set({ n: BELLS_PER_DAY });

  // who may post
  await refused(S.postJob(db, { uid: "org_unverified" }, "org_unverified", job), 403);
  await refused(S.postJob(db, { uid: "u_writer" }, "org_biz", job), 403);
  await refused(S.postJob(db, { uid: "u_bola" }, "org_biz", job), 403);
  const j1 = await S.postJob(db, { uid: "u_admin" }, "org_biz", job);
  assert.equal(j1.status, "open"); assert.equal(j1.orgTier, "business"); assert.equal(j1.orgName, "Acme Ltd");
  const j2 = await S.postJob(db, { uid: "org_free" }, "org_free", { ...job, title: "Shop assistant" });

  // Business job: Bola (needs a job, strong fit) is told; Chi hit today's cap; the teen and Dayo aren't; a free-plan job tells no one
  assert.ok((await bells("u_bola")).some((m) => m.includes("Community manager at Acme Ltd")));
  assert.equal((await bells("u_chi")).length, 0, "the daily cap holds");
  assert.equal((await bells("u_teen")).length, 0, "teens are never matched");
  assert.equal((await bells("u_dayo")).length, 0);
  assert.ok(!(await bells("u_bola")).some((m) => m.includes("Shop assistant")), "matching is for Business and Enterprise");

  // listing: everyone sees both; "Jobs for you" holds only the Business job, with reasons
  const pub = await S.listJobs(db, null);
  assert.deepEqual(pub.jobs.map((j) => j.id).sort(), [j1.id, j2.id].sort()); assert.equal(pub.forYou.length, 0);
  const mine = await S.listJobs(db, "u_bola");
  assert.deepEqual(mine.forYou.map((j) => j.id), [j1.id]); assert.ok(mine.forYou[0].reasons.length >= 3);

  // Nana: a job question gets the open jobs that fit, and our own /careers roles too
  await db.doc("careerRoles/r_care").set({ title: "Customer care lead", dept: "care", reportsTo: "CEO", summary: "Lead customer care for our members", about: "", responsibilities: [], requirements: ["3+ years in customer support"], hours: "Full-time", location: "Remote (Nigeria)", arrangement: "salary", status: "open", createdAt: "2026-11-01", updatedAt: "2026-11-01", createdByUid: "x" });
  await S.postJob(db, { uid: "org_free" }, "org_free", { ...job, title: "Customer support agent", mode: "remote", city: "", industry: "", topics: [] });
  const { jobsBlock, jobPaths } = await import("../../lib/nana-prompt");
  const forNana = await S.jobsForNana(db, "I want more remote work for customers services representative so I can apply");
  // the Notes Jobs job first, then our own customer care roles (ours, and the seeded ones), and nothing unrelated
  assert.equal(forNana.matches[0].title, "Customer support agent"); assert.equal(forNana.open, 3);
  assert.ok(forNana.matches.some((o) => o.href === "/careers/r_care"));
  assert.ok(forNana.matches.every((o) => /customer/i.test(o.title)), forNana.matches.map((o) => o.title).join(", "));
  assert.ok(jobsBlock(forNana).includes("[Customer care lead](/careers/r_care) at #NotesApp (our own team)"));
  assert.ok(jobPaths(forNana).every((p) => p.startsWith("/jobs/") || p.startsWith("/careers/")));
  assert.ok(jobsBlock(await S.jobsForNana(db, "pilot jobs")).startsWith("NOTES JOBS: no open job fits"));

  // suggested candidates: Business only; Bola and Chi (needs a job, fit), never the teen; no email, phone or city
  await refused(S.suggestedCandidates(db, { uid: "org_free" }, j2.id), 403);
  const cands = await S.suggestedCandidates(db, { uid: "u_admin" }, j1.id);
  assert.deepEqual(cands.map((c) => c.username).sort(), ["bola", "chi"]);
  for (const c of cands) { assert.equal(JSON.stringify(c).includes("Lagos\""), false); assert.ok(!("email" in c) && !("city" in c) && !("phone" in c)); }
  await S.inviteToApply(db, { uid: "u_admin" }, j1.id, "u_chi");
  assert.ok((await bells("u_chi")).some((m) => m.includes("invites you to apply")));
  await refused(S.inviteToApply(db, { uid: "u_admin" }, j1.id, "u_chi"), 409);
  await refused(S.inviteToApply(db, { uid: "u_admin" }, j1.id, "u_dayo"), 404);
  assert.equal((await S.suggestedCandidates(db, { uid: "u_admin" }, j1.id)).find((c) => c.username === "chi")?.invited, true);
  await S.setSeeker(db, "u_chi", { openToWork: false });
  assert.deepEqual((await S.suggestedCandidates(db, { uid: "u_admin" }, j1.id)).map((c) => c.username), ["bola"], "switching it off hides them at once");

  // applying
  const note = "I have run communities for a church of 2,000 people and a creators' group, and I love helping people gather.";
  await refused(S.applyToJob(db, { uid: "org_biz" }, j1.id, { coverNote: note, consent: true }), 400);
  const a = await S.applyToJob(db, { uid: "u_bola" }, j1.id, { coverNote: note, consent: true, phone: "0803", city: "Lagos" });
  await refused(S.applyToJob(db, { uid: "u_bola" }, j1.id, { coverNote: note, consent: true }), 409);
  await S.applyToJob(db, { uid: "u_dayo" }, j1.id, { coverNote: note, consent: true });
  assert.deepEqual(await S.suggestedCandidates(db, { uid: "u_admin" }, j1.id), [], "an applicant moves from suggested to the applications");
  await refused(S.inviteToApply(db, { uid: "u_admin" }, j1.id, "u_bola"), 409);
  assert.ok((await bells("org_biz")).some((m) => m.includes("New application for Community manager")));
  assert.equal((await db.doc(`jobs/${j1.id}`).get()).data()!.applicationCount, 2);
  const board = await S.firmBoard(db, { uid: "u_admin" }, "org_biz");
  assert.equal(board.matching, true); assert.equal(board.applications.length, 2);
  assert.ok(!JSON.stringify(board.applications).includes("@x.test"), "no applicant email reaches the firm");
  await refused(S.firmBoard(db, { uid: "u_writer" }, "org_biz"), 403);
  await S.setApplicationStatus(db, { uid: "u_admin" }, a.id, "interview");
  assert.ok((await bells("u_bola")).some((m) => m.includes("would like to talk to you about Community manager")));
  await refused(S.setApplicationStatus(db, { uid: "org_free" }, a.id, "offer"), 403);
  assert.deepEqual((await S.myApplications(db, "u_bola")).map((x) => x.status), ["interview"]);

  // a report taken down by Trust & safety: the job is removed, the firm is told, it leaves the list
  const rep = await createReport(db, "u_dayo", { kind: "job", targetId: j2.id, reason: "scam", note: "Asked me to pay a fee" });
  await resolveReport(db, "admin", rep.id, "actioned", "Asked applicants for money", { remove: async () => {}, publicUrl: () => "" } as never);
  assert.equal((await db.doc(`jobs/${j2.id}`).get()).data()!.status, "removed");
  assert.ok((await bells("org_free")).some((m) => m.includes("taken down")));
  assert.ok(!(await S.listJobs(db, null)).jobs.some((j) => j.id === j2.id));
  await refused(S.applyToJob(db, { uid: "u_bola" }, j2.id, { coverNote: note, consent: true }), 404);

  // closing, then deleting: applicants still in the running are told
  await S.closeJob(db, { uid: "org_biz" }, j1.id);
  assert.ok((await db.doc(`jobApplications/${a.id}`).get()).data()!.purgeAt, "the 6-month clock starts");
  await refused(S.applyToJob(db, { uid: "u_chi" }, j1.id, { coverNote: note, consent: true }), 404);
  assert.deepEqual(await S.deleteJob(db, { uid: "org_biz" }, j1.id), { removed: 2 });
  assert.ok((await bells("u_bola")).some((m) => m.includes("has withdrawn the Community manager job")));
  assert.equal((await db.doc(`jobs/${j1.id}`).get()).exists, false);

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
