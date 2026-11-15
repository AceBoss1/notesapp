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
  assert.deepEqual(first.profile.roles, [], "the account's job title is never a role by itself (v0.169.1)");
  assert.equal(first.suggestedRole, "Backend engineer", "…it's offered as a one-tap suggestion");
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
  let geminiDown = false, liteCalls = 0;
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
    if (url === "https://lite.test/v1/chat/completions") {
      liteCalls++;
      const body = JSON.parse(String(init?.body));
      return json({ choices: [{ message: { content: JSON.stringify(scoreFor(String(body.messages[1].content))) }, finish_reason: "stop" }] });
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

  // ---- no AI of their own: Nana Lite (our small model) reads the top 10, one opening per request ----
  const viaLite = await S.runFor(db, "ada", { ...D, account: async () => null, lite: () => ({ provider: "openai", apiKey: "lite-key", baseUrl: "https://lite.test/v1", model: "phi-3.5-mini-instruct" }) }, { manual: true });
  assert.equal(viaLite.via, "lite"); assert.equal(viaLite.provider, ""); assert.equal(viaLite.error, "");
  assert.ok(liteCalls > 0 && liteCalls <= 10, `one request per opening, at most 10 (${liteCalls})`);
  assert.ok(viaLite.funnel.keywordTop <= 10, JSON.stringify(viaLite.funnel));
  assert.ok(viaLite.jobs.some((j) => !j.rough), "Nana Lite's reads are scored, not rough");
  const noLite = await S.runFor(db, "ada", { ...D, account: async () => null, lite: () => null }, { manual: true });
  assert.ok(noLite.jobs.every((j) => j.rough) && !noLite.via, "no AI and no Nana Lite: keyword scores, marked rough");

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

  // ---- v0.169.1, fault A: a profile never filled in. Before, the account's job title was saved as the only role with the first change,
  // and a title gate of "Founder & CEO" kept nothing ("Fit your rules 0"). Now that seeded role doesn't count, an empty profile has no
  // title gate, the run says so, and every collected opening can be seen with the reason it was cut. ----
  await db.doc("users/bola").set({ username: "bola", displayName: "Bola", jobTitle: "Founder & CEO" });
  await db.doc("nanaJobsProfiles/bola").set({ uid: "bola", profile: { roles: ["Founder & CEO"], shipped: [], skills: [], remote: true, cities: [], country: "Nigeria", seniority: "mid", payFloor: "", dealBreakers: [] }, settings: { provider: "", feeds: true, boards: true, companies: [], bell: true, email: false, hour: 8, aiPerDay: 25 }, steps: { sources: true, when: true }, setupDone: true, nextRunAt: null });
  const bolaState = await S.getState(db, "bola");
  assert.deepEqual(bolaState.profile.roles, [], "the seeded title no longer counts as a role");
  assert.equal(bolaState.suggestedRole, "Founder & CEO");
  const bolaRun = await S.runFor(db, "bola", D, { manual: true });
  assert.equal(bolaRun.profileFrom, "empty");
  assert.ok(bolaRun.funnel.fit > 0 && bolaRun.jobs.length > 0, `an empty profile still gets a list: ${JSON.stringify(bolaRun.funnel)}`);
  assert.ok(!bolaRun.rejected["title isn't a role you want"], "no title gate");
  assert.match(bolaRun.note, /profile is empty/);
  assert.equal(bolaRun.rejected["remote, but only from another country"], 1, "the US-only role is still cut, and counted");
  const seen = await S.seenJobs(db, "bola");
  assert.equal(seen.total, bolaRun.funnel.unique, "every collected opening");
  assert.equal(seen.jobs.filter((j) => j.outcome === "listed").length, bolaRun.jobs.length);
  assert.equal(seen.jobs.find((j) => j.company === "Usa Inc")?.why, "Remote, but only from another country");
  assert.match(String(seen.jobs.find((j) => j.company === "Gone Ltd")?.why), /link looks closed/);
  assert.ok(seen.jobs.every((j) => j.url && j.why), "an Open link and a reason on each");
  await db.doc("users/dayo").set({ username: "dayo", displayName: "Dayo" });
  assert.equal((await S.seenJobs(db, "dayo")).total, 0, "only your own run: someone else sees none of it");
  await refused(S.seenJobs(db, "teen"), 403);
  // Choosing roles (even the same title, on purpose) makes them count.
  await S.saveSetup(db, "bola", { profile: { roles: ["Founder & CEO"] } }, now);
  assert.deepEqual((await S.getState(db, "bola")).profile.roles, ["Founder & CEO"]);
  const gated = await S.runFor(db, "bola", D, { manual: true });
  assert.equal(gated.profileFrom, "yours"); assert.equal(gated.funnel.fit, 0);
  assert.ok(gated.rejected["title isn't a role you want"] > 0, "the funnel says why: not in your roles");
  // Finishing set-up no longer needs roles.
  await db.doc("users/cleo").set({ username: "cleo", displayName: "Cleo" });
  await S.saveSetup(db, "cleo", { finish: true }, now);
  assert.equal((await S.getState(db, "cleo")).setupDone, true);

  // ---- v0.169.1, fault B: the CV review with Claude. Claude thinks before it answers and that counts against max_tokens, so the old
  // 2000-token request came back cut off; a slow answer outlived the function. The provider is a stand-in, injected; no network. ----
  await db.doc("aiConnections/bola").set({ uid: "bola", provider: "anthropic", secret: "x", last4: "abcd", createdAt: now.toISOString() });
  await S.saveSetup(db, "bola", { settings: { provider: "anthropic" } }, now);
  const claudeAcct = async () => ({ provider: "anthropic" as const, apiKey: "sk-ant-test-standin-0000000000000000" });
  const claudeBodies: Record<string, unknown>[] = [];
  const claudeNet: Fetch = async (url, init) => {
    if (!url.startsWith("https://api.anthropic.com/v1/messages")) return net(url, init);
    const b = JSON.parse(String(init?.body)); claudeBodies.push(b);
    const review = { strengths: ["Payments at real scale"], gaps: ["No tests"], fixes: ["Lead with the ledger"], roles: ["Backend Engineer"], profile: { roles: ["Backend Engineer"], shipped: ["Payments ledger on Postgres, 40k payouts a month"], skills: ["Node"], cities: ["Lagos"], country: "Nigeria", remote: true, seniority: "mid" } };
    // Thinking takes ~1,500 tokens at low effort, ~3,500 otherwise; the answer ~1,200.
    const room = Number(b.max_tokens) - (b.output_config?.effort === "low" ? 1500 : 3500);
    return room < 1200 ? json({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(review).slice(0, 60) }], stop_reason: "max_tokens" }) : json({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(review) }], stop_reason: "end_turn" });
  };
  const viaClaude = await S.saveCv(db, "bola", { text: cvText }, { ...D, fetch: claudeNet, account: claudeAcct });
  assert.deepEqual(viaClaude.review?.roles, ["Backend Engineer"], "Claude's review comes back whole");
  assert.equal(viaClaude.review?.provider, "anthropic");
  assert.equal(claudeBodies[0].model, "claude-haiku-5-5");
  // With no roles of their own, the run uses the CV review's roles.
  await S.saveSetup(db, "bola", { profile: { roles: [] } }, now);
  const cvRun = await S.runFor(db, "bola", { ...D, fetch: claudeNet, account: async () => null }, { manual: true });
  assert.equal(cvRun.profileFrom, "cv"); assert.match(cvRun.note, /roles from your CV review|keyword ranking/);
  // A slow AI: our own timer stops it with a reason the browser can show ("took too long"), before the platform would.
  const slowNet: Fetch = (url, init) => url.startsWith("https://api.anthropic.com") ? new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))) : net(url, init);
  await refused(S.reviewCv(db, "bola", { ...D, fetch: slowNet, account: claudeAcct, cvTimeoutMs: 50 }), 504, /took too long to answer/);
  // The provider's own error is passed on, word for word.
  const badKey: Fetch = async (url, init) => url.startsWith("https://api.anthropic.com") ? json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401) : net(url, init);
  await refused(S.reviewCv(db, "bola", { ...D, fetch: badKey, account: claudeAcct }), 502, /401 invalid x-api-key/);

  for (const u of ["bola", "cleo"]) await db.doc(`nanaJobsProfiles/${u}`).update({ nextRunAt: null }); // keep the daily-run checks below to Ada

  // ---- someone who turns out not to qualify is taken off the daily run ----
  await db.doc("users/ada").update({ accountKind: "organisation" });
  await db.doc("nanaJobsProfiles/ada").update({ nextRunAt: "2026-11-14T07:00:00.000Z" });
  assert.equal(await S.runDue(db, { ...D, now: () => new Date("2026-11-14T07:01:00Z") }), 0);
  assert.equal((await db.doc("nanaJobsProfiles/ada").get()).data()!.nextRunAt, null);

  clearInterval(alive);
  console.log("ALL OK"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
