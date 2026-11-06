// Nana and Notes Jobs (the owner's example, 6 Nov 2026): a job question without the word "job" reaches Nana with the open jobs that fit
// and the Notes Jobs article, and only real job pages survive in her reply. Part of npm run test:jobs.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
(async () => {
  const S = await import("../../lib/jobs-server");
  const { chat } = await import("../../lib/nana-server");
  await db.doc("users/org").set({ username: "acme", displayName: "Acme", accountKind: "organisation", org: { rcStatus: "verified" }, accountTier: "standard" });
  await db.doc("staffMeta/careersSeed").set({ marketingSplit: "x" });
  const j = await S.postJob(db, { uid: "org" }, "org", { title: "Customer support agent", summary: "Answer our customers by chat and email", requirements: ["Kind"], type: "full_time", mode: "remote" });
  let sys = "";
  const r = await chat(db, { name: "Ada", email: "ada@x.test", messages: [{ role: "user", content: "I want more remote work for customers services representative so I can apply" }] }, {
    now: () => new Date(),
    complete: async (a) => { sys = JSON.stringify(a.system); return { text: `Here's one: [Customer support agent](/jobs/${j.id}). See [all](/explore?tab=jobs) and [made up](/jobs/fake).`, refused: false } as never; },
  });
  assert.ok(sys.includes("NOTES JOBS: the openings that fit"), "Nana got the openings");
  assert.ok(sys.includes("### Notes Jobs: finding a job"), "and the article");
  console.log(r.reply);
  assert.ok(r.reply.includes(`(/jobs/${j.id})`) && r.reply.includes("(/explore?tab=jobs)") && !r.reply.includes("/jobs/fake"));
  console.log("ALL OK"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
