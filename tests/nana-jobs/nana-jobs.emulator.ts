// Nana Jobs end to end on the Firestore emulator (lib/nana-jobs-server.ts, lib/ai-connect.ts). A stand-in fetch plays every job board
// and AI provider, so nothing reaches the network. Checks: who may use it; several AI providers connected next to Nana's Anthropic key
// (which Nana keeps using unchanged), encrypted with only the last four shown; the CV kept encrypted, reviewed and deletable; the shared
// pool collected once for everyone; a run (AI rubric, the rough fallback with the real error, dead links removed); statuses never
// overwritten; the daily run with a bell (email off by default); the cover note. Run: npm run test:nana-jobs-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
process.env.ACCOUNT_DATA_KEY = Buffer.alloc(32, 9).toString("base64");
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const alive = setInterval(() => {}, 1000);

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

(async () => {
  const AI = await import("../../lib/ai-connect");
  const S = await import("../../lib/nana-jobs-server");
  const { NanaJobsError } = await import("../../lib/nana-jobs");
  const { NanaError } = await import("../../lib/nana");
  const { postJob } = await import("../../lib/jobs-server");
  const refused = async (p: Promise<unknown>, status: number, re?: RegExp) => assert.rejects(p, (e: unknown) => (e instanceof NanaJobsError || e instanceof NanaError) && e.status === status && (!re || re.test(e.message)));
  const now = new Date("2026-11-12T06:30:00Z");
  const iso = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

  await db.doc("users/ada").set({ username: "ada", displayName: "Ada", jobTitle: "Backend engineer" });
  await db.doc("jobSeekers/ada").set({ openToWork: true, city: "Lagos" });
  await db.doc("users/teen").set({ username: "tee", displayName: "Tee", teen: true });
  await db.doc("users/org").set({ username: "kora", displayName: "Kora", accountKind: "organisation", org: { rcStatus: "verified" }, accountTier: "business" });

  // ---- who ----
  await refused(S.getState(db, "teen"), 403, /18 and over/);
  await refused(S.getState(db, "org"), 403, /personal accounts/);
  const first = await S.getState(db, "ada");
  assert.deepEqual(first.profile.roles, ["Backend engineer"], "pre-filled from the profile");
  assert.deepEqual(first.profile.cities, ["Lagos"], "and from \"I need a job\"");
  assert.equal(first.settings.bell, true); assert.equal(first.settings.email, false);
  assert.equal(first.steps.ai, false); assert.equal(first.using, null);

  // ---- several AI providers; Nana's own key untouched ----
  const checked: string[] = [];
  const deps = { check: async (p: string, k: string) => { checked.push(p); if (k.endsWith("BAD1")) throw new Error("Gemini didn't accept that key."); }, checkUrl: async (u: string) => (u.startsWith("https://") ? null : "Webhook URLs must start with https://.") };
  await refused(AI.connectProvider(db, "ada", "gemini", { key: "AIzaSyFakeFakeFakeFakeFakeFakeFakeBAD1" }, now, deps), 400, /didn't accept/);
  let provs = await AI.connectProvider(db, "ada", "gemini", { key: "AIzaSyFakeFakeFakeFakeFakeFakeFake8f2a" }, now, deps);
  assert.equal(provs.find((p) => p.provider === "gemini")?.last4, "8f2a");
  const raw = (await db.doc("aiProviderKeys/ada_gemini").get()).data()!;
  assert.ok(!JSON.stringify(raw).includes("AIzaSyFake"), "kept encrypted"); assert.equal(raw.last4, "8f2a");
  await refused(AI.connectProvider(db, "ada", "groq", { key: "not-a-groq-key" }, now, deps), 400);
  await refused(AI.connectProvider(db, "ada", "openai", { key: "sk-test-123456789", baseUrl: "http://10.0.0.1/v1", model: "m" }, now, deps), 400, /https/);
  await refused(AI.connectProvider(db, "ada", "openai", { key: "sk-test-123456789", baseUrl: "https://openrouter.ai/api/v1" }, now, deps), 400, /model/);
  provs = await AI.connectProvider(db, "ada", "openai", { key: "sk-or-test-123456789wxyz", baseUrl: "https://openrouter.ai/api/v1/", model: "meta-llama/llama-3.3-70b-instruct:free" }, now, deps);
  assert.equal(provs.find((p) => p.provider === "openai")?.baseUrl, "https://openrouter.ai/api/v1");
  // Anthropic: the same key Nana uses, stored where Nana reads it.
  assert.equal((await AI.aiStatus(db, "ada")).connected, false, "connecting Gemini doesn't connect Nana");
  provs = await AI.connectProvider(db, "ada", "anthropic", { key: "sk-ant-api03-FakeFakeFakeFakeFakeFake-9a9a" }, now, deps);
  assert.equal((await AI.aiStatus(db, "ada")).connected, true, "Nana sees it as before");
  assert.equal(await AI.ownKey(db, "ada"), "sk-ant-api03-FakeFakeFakeFakeFakeFake-9a9a");
  assert.deepEqual(checked, ["gemini", "gemini", "openai", "anthropic"], "every key checked before it's saved");
  const st = await S.getState(db, "ada");
  assert.equal(st.using, "gemini", "a free one, never the paid one, unless chosen");
  assert.ok(!JSON.stringify(st).includes("FakeFake"), "no key ever goes back to the browser");
  provs = await AI.disconnectProvider(db, "ada", "openai");
  assert.equal(provs.find((p) => p.provider === "openai")?.connected, false);

  // ---- the stand-in internet: AI providers, feeds, boards and job pages ----
  let geminiDown = false;
  const cvText = "Ada Obi, Lagos, Nigeria. Backend engineer, 4 years. At Kora I built the payments ledger on Postgres handling 40k payouts a month. Built a Next.js app used by 12k users. Skills: Node, TypeScript, Postgres, Redis. I mentor two junior developers and wrote our on-call runbook. Education: BSc Computer Science, University of Lagos.";
  const scoreFor = (user: string) => {
    const ids = [...user.matchAll(/### JOB (j\d+)\nCOMPANY: ([^\n]+)\nTITLE: ([^\n]+)/g)];
    return { results: ids.map(([, id, , title]) => ({ id, domain: title.includes("Senior Backend") ? 23 : 15, stack: 20, seniority: 12, location: 17, signal: 15, reason: `Ledger work fits (${title}).`, risk: "Asks for 6+ years; you show 4." })) };
  };
  const answer = (text: string) => json({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
  const net: Fetch = async (url, init) => {
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      if (geminiDown) return json({ error: { code: 429, message: "quota exceeded" } }, 429);
      const body = JSON.parse(String(init?.body));
      const sys = String(body.systemInstruction.parts[0].text), user = String(body.contents[0].parts[0].text);
      if (sys.includes("review one person's CV")) return answer(JSON.stringify({ strengths: ["Payments at real scale"], gaps: ["No tests or CI mentioned"], fixes: ["Put 40k payouts a month in the first line"], roles: ["Backend Engineer", "Platform Engineer"], profile: { roles: ["Backend Engineer"], shipped: ["Payments ledger on Postgres, 40k payouts a month", "Next.js app, 12k users", "Ran a 2 million user Kubernetes platform"], skills: ["Node", "TypeScript", "Postgres"], cities: ["Lagos"], country: "Nigeria", remote: true, seniority: "mid" } }));
      if (sys.includes("cover note")) return answer(JSON.stringify({ note: "At Kora I built a payments ledger on Postgres handling 40k payouts a month. I also led 9 engineers. I'd like to work on your settlement engine." }));
      return answer(JSON.stringify(scoreFor(user)));
    }
    if (url.startsWith("https://remoteok.com/api")) return json([{ legal: 1 }, { id: 1, company: "Remotive Co", position: "Full-stack Developer", location: "Worldwide", url: "https://remoteok.com/remote-jobs/1", date: iso(3), description: "Node, Postgres", tags: ["node"] }, { id: 2, company: "Gone Ltd", position: "Backend Engineer", location: "Worldwide", url: "https://gone.example/jobs/2", date: iso(1), description: "Node Postgres payments" }, { id: 3, company: "Usa Inc", position: "Backend Engineer", location: "Remote - US", url: "https://usa.example/jobs/3", date: iso(1), description: "Node" }]);
    if (url.startsWith("https://remotive.com")) throw new Error("socket hang up");
    if (url.startsWith("https://himalayas.app") || url.startsWith("https://www.arbeitnow.com")) return json({ jobs: [], data: [] });
    if (url === "https://boards-api.greenhouse.io/v1/boards/paystack/jobs?content=true") return json({ jobs: [{ id: 7, title: "Senior Backend Engineer", location: { name: "Lagos or remote" }, absolute_url: "https://boards.greenhouse.io/paystack/jobs/7", updated_at: iso(2), content: "Payments ledger, Node and Postgres. Lagos, Nigeria." }] });
    if (url.includes("boards-api.greenhouse.io") || url.includes("api.lever.co") || url.includes("api.ashbyhq.com")) return json({}, 404);
    if (url === "https://gone.example/jobs/2") return new Response("<title>Page not found</title>", { status: 200 });
    if (url.startsWith("https://")) return new Response(`<title>Job</title><h1>Senior Backend Engineer Full-stack Developer</h1>`, { status: 200 });
    throw new Error(`unexpected ${url}`);
  };
  const bells: string[] = [], mails: string[] = [];
  const D = { fetch: net, sleep: async () => {}, now: () => now, notify: async (b: { message: string }) => { bells.push(b.message); }, email: async (_u: string, s: string) => { mails.push(s); return true; } };

  // ---- the CV: encrypted, reviewed by the member's own AI, "shipped" only from the CV, deletable ----
  await refused(S.saveCv(db, "ada", { text: "too short" }, D), 400);
  const rev = await S.saveCv(db, "ada", { text: cvText, fileName: "ada-cv.pdf" }, D);
  assert.ok(rev.review); assert.deepEqual(rev.review!.roles, ["Backend Engineer", "Platform Engineer"]);
  assert.deepEqual(rev.review!.profile.shipped, ["Payments ledger on Postgres, 40k payouts a month", "Next.js app, 12k users"], "an invented line is dropped");
  assert.equal(rev.dropped, 1);
  const cvDoc = (await db.doc("nanaJobsCv/ada").get()).data()!;
  assert.ok(!JSON.stringify(cvDoc).includes("Kora") && !JSON.stringify(cvDoc).includes("Platform Engineer"), "the CV and its review are encrypted");
  assert.equal((await S.getState(db, "ada")).cv.review?.gaps[0], "No tests or CI mentioned");
  await S.deleteCv(db, "ada");
  assert.equal((await db.doc("nanaJobsCv/ada").get()).exists, false, "deleted");
  assert.equal((await S.getState(db, "ada")).cv.has, false);

  // The member confirms the profile, adds companies (checked first), and finishes set-up.
  await S.saveSetup(db, "ada", { profile: { ...rev.review!.profile, roles: ["Backend Engineer", "Full-stack"], skills: ["Node", "TypeScript", "Postgres"], dealBreakers: ["Crypto trading"] } }, now);
  const cos = await S.addCompany(db, "ada", "Paystack", D, now);
  assert.deepEqual(cos.map((c) => [c.name, c.ats, c.ok]), [["Paystack", "greenhouse", true]]);
  const cos2 = await S.addCompany(db, "ada", "Kuda", D, now);
  assert.equal(cos2[1].ok, false, "no public board, shown as such");
  await S.saveSetup(db, "ada", { settings: { feeds: true, boards: true }, step: "sources" }, now);
  await S.saveSetup(db, "ada", { settings: { hour: 8, aiPerDay: 10 }, step: "when", finish: true }, now);
  const ready = await S.getState(db, "ada");
  assert.deepEqual(ready.steps, { ai: true, profile: true, sources: true, when: true });
  assert.equal(ready.nextRunAt, "2026-11-12T07:00:00.000Z", "08:00 Lagos today");

  // ---- Notes Jobs and the shared pool, collected once for everyone ----
  const nj = await postJob(db, { uid: "org" }, "org", { title: "Platform Engineer", summary: "Build our payments ledger and the Node services around it", requirements: ["Node", "Postgres"], type: "full_time", mode: "remote" });
  const pool = await S.collectPool(db, D);
  assert.equal(pool.counts.notes, 1); assert.equal(pool.counts["greenhouse:paystack"], 1); assert.equal(pool.counts.remoteok, 3);
  assert.match(pool.errors.remotive, /socket hang up/, "a dead feed is skipped and named");
  assert.equal((await db.collection("jobPool").get()).size, 1, "one chunk, not one document per opening");

  // ---- a run: the AI reads the top N; a dead link is removed; Notes Jobs keeps Apply on #NotesApp ----
  const run = await S.runFor(db, "ada", D, { manual: true });
  assert.equal(run.provider, "gemini"); assert.equal(run.error, "");
  const titles = run.jobs.map((j) => `${j.title} · ${j.company}`);
  assert.ok(titles.includes("Senior Backend Engineer · Paystack") && titles.includes("Platform Engineer · Kora"), titles.join(" | "));
  assert.ok(!titles.some((t) => t.includes("Gone Ltd")), "the dead link is gone");
  assert.ok(!titles.some((t) => t.includes("Usa Inc")), "remote, but only from the US");
  const top = run.jobs[0];
  assert.equal(top.title, "Senior Backend Engineer"); assert.equal(top.score, 87); assert.equal(top.rough, false); assert.equal(top.link, "live");
  assert.equal(top.risk, "Asks for 6+ years; you show 4.");
  assert.equal(run.jobs.find((j) => j.company === "Kora")?.notesJobId, nj.id);
  assert.ok(run.funnel.collected >= run.funnel.unique && run.funnel.unique > run.funnel.fit && run.funnel.alive === run.jobs.length, JSON.stringify(run.funnel));
  assert.deepEqual(bells, [], "a run on demand doesn't ring the bell");
  assert.ok(!JSON.stringify(await S.getState(db, "ada")).includes("settlement"), "the stored job texts never go to the browser");

  // ---- statuses: set by the member, never overwritten by a run ----
  await S.setStatus(db, "ada", top.hash, "interested", now);
  const fullstack = run.jobs.find((j) => j.title === "Full-stack Developer")!;
  await S.setStatus(db, "ada", fullstack.hash, "not_for_me", now);
  await refused(S.setStatus(db, "ada", "0123456789abcdef", "applied", now), 404);
  await refused(S.setStatus(db, "ada", top.hash, "hired", now), 400);

  // ---- the AI fails: the keyword score, marked rough, and the real error ----
  geminiDown = true;
  const rough = await S.runFor(db, "ada", D, { manual: true });
  assert.equal(rough.error, "429 quota exceeded");
  assert.ok(rough.jobs.length > 0 && rough.jobs.every((j) => j.rough), "never quietly empty");
  assert.equal(rough.jobs.find((j) => j.hash === top.hash)?.status, "interested", "the status the member set survives the run");
  assert.ok(!rough.jobs.some((j) => j.hash === fullstack.hash), "Not for me never comes back");
  geminiDown = false;

  // ---- the cover note: only the shipped list (a made-up figure is taken out) ----
  const again = await S.runFor(db, "ada", D, { manual: true });
  const cover = await S.coverNote(db, "ada", again.jobs[0].hash, D);
  assert.ok(cover.note.includes("40k payouts") && !cover.note.includes("9 engineers"), cover.note);

  // ---- the daily run at the member's hour: a bell (on by default), no email (off by default) ----
  assert.equal(await S.runDue(db, { ...D, now: () => new Date("2026-11-12T06:59:00Z") }), 0, "not yet");
  assert.equal(await S.runDue(db, { ...D, now: () => new Date("2026-11-12T07:05:00Z") }), 1);
  assert.equal(bells.length, 1); assert.match(bells[0], /Nana Jobs shortlist is ready/); assert.deepEqual(mails, []);
  assert.equal((await db.doc("nanaJobsProfiles/ada").get()).data()!.nextRunAt, "2026-11-13T07:00:00.000Z", "tomorrow");
  await S.saveSetup(db, "ada", { settings: { email: true } }, now);
  await db.doc("nanaJobsProfiles/ada").update({ nextRunAt: "2026-11-13T07:00:00.000Z" });
  assert.equal(await S.runDue(db, { ...D, now: () => new Date("2026-11-13T07:01:00Z") }), 1);
  assert.equal(mails.length, 1, "email when they switch it on");

  // ---- someone who turns out not to qualify is taken off the daily run ----
  await db.doc("users/ada").update({ accountKind: "organisation" });
  await db.doc("nanaJobsProfiles/ada").update({ nextRunAt: "2026-11-14T07:00:00.000Z" });
  assert.equal(await S.runDue(db, { ...D, now: () => new Date("2026-11-14T07:01:00Z") }), 0);
  assert.equal((await db.doc("nanaJobsProfiles/ada").get()).data()!.nextRunAt, null);

  clearInterval(alive);
  console.log("ALL OK"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
