// Nana Jobs, the pure parts (lib/nana-jobs*.ts, lib/ai-providers.ts, lib/cv-extract.ts): each provider's key check and pacing, the feeds and
// company boards (with a stand-in fetch: these tests never reach the network), the funnel (some cases adapted from Shortlist's own tests,
// MIT License, Copyright (c) 2026 Victor Dickson; full notice in THIRD_PARTY_NOTICES), the link check, the CV review guard and the cover-note guard. Run: npm run test:nana-jobs → "ALL OK".
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { PROVIDER_INFO, checkProviderKey, completeJson, pacer, parseJsonObject, pickProvider, resetPacers, rpmFor, ProviderError, type Fetch } from "../../lib/ai-providers";
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, cleanProfile, cleanSettings, nextRunAt, whyNotAllowed, type NjProfile, type PoolJob } from "../../lib/nana-jobs";
import {
  dedupe, fitToBudget, groundCoverNote, hardFilter, inCv, jobHash, pickShortlist, prescoreAll, toShort, toText, validateCvReview, validateVerdicts, verifyOne, verifyAll, type Candidate,
} from "../../lib/nana-jobs-funnel";
import { checkBoard, fetchBoards, fetchFeeds, slugsFor } from "../../lib/nana-jobs-sources";
import { docxText, docxXmlText } from "../../lib/cv-extract";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
type Call = { url: string; init?: RequestInit };
function stub(route: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f: Fetch = async (url, init) => { calls.push({ url, init }); return route(url, init); };
  return { f, calls };
}
const hdr = (c: Call, k: string) => (c.init?.headers as Record<string, string>)[k];

// AbortSignal.timeout's timer doesn't hold the process open, so keep it alive while a stand-in fetch waits to be timed out.
const alive = setInterval(() => {}, 1000);
(async () => {
  // ---- who ----
  assert.equal(whyNotAllowed({}), null);
  assert.match(String(whyNotAllowed({ teen: true })), /18 and over/);
  assert.match(String(whyNotAllowed({ kid: true })), /18 and over/);
  assert.match(String(whyNotAllowed({ accountKind: "organisation" })), /personal accounts/);

  // ---- settings: bell on and email off by default; the AI's daily reads are bounded ----
  assert.equal(DEFAULT_SETTINGS.bell, true); assert.equal(DEFAULT_SETTINGS.email, false);
  assert.equal(cleanSettings({ aiPerDay: 999 }).aiPerDay, 60); assert.equal(cleanSettings({ aiPerDay: 1 }).aiPerDay, 5);
  assert.equal(cleanSettings({ hour: 25 }).hour, 8); assert.equal(cleanSettings({ provider: "evil" }).provider, "");
  assert.equal(cleanSettings({ provider: "groq" }).provider, "groq");
  const prof = cleanProfile({ roles: "Backend engineer\nFull-stack\nbackend ENGINEER", dealBreakers: ['"US only"'], shipped: ["• Payments ledger on Postgres, 40k payouts a month"] });
  assert.deepEqual(prof.roles, ["Backend engineer", "Full-stack"], "one per line, no repeats");
  assert.deepEqual(prof.dealBreakers, ["US only"]); assert.equal(prof.shipped[0], "Payments ledger on Postgres, 40k payouts a month");
  // 08:00 Lagos is 07:00 UTC
  assert.equal(nextRunAt(8, new Date("2026-11-12T06:00:00Z")), "2026-11-12T07:00:00.000Z");
  assert.equal(nextRunAt(8, new Date("2026-11-12T07:00:00Z")), "2026-11-13T07:00:00.000Z");

  // ---- providers: each key is checked with a free call that lists models ----
  for (const p of ["gemini", "groq", "anthropic", "openai"] as const) {
    const ok = stub(() => json({ data: [] }));
    await checkProviderKey(p, "k-123456789", { fetch: ok.f, baseUrl: p === "openai" ? "https://openrouter.ai/api/v1" : undefined });
    assert.equal(ok.calls.length, 1); assert.ok(!ok.calls[0].init?.method, `${p}: a GET`);
    const want = { gemini: "generativelanguage.googleapis.com/v1beta/models", groq: "api.groq.com/openai/v1/models", anthropic: "api.anthropic.com/v1/models", openai: "openrouter.ai/api/v1/models" }[p];
    assert.ok(ok.calls[0].url.includes(want), `${p} lists models: ${ok.calls[0].url}`);
    const bad = stub(() => json({ error: { message: "invalid key" } }, 401));
    await assert.rejects(checkProviderKey(p, "k-123456789", { fetch: bad.f }), (e: unknown) => e instanceof ProviderError && e.status === 400 && /didn't accept/.test(e.message));
    const down = stub(() => { throw new Error("ECONNRESET"); });
    await assert.rejects(checkProviderKey(p, "k-123456789", { fetch: down.f }), (e: unknown) => e instanceof ProviderError && e.status === 502);
  }
  assert.equal(hdr((await (async () => { const s = stub(() => json({})); await checkProviderKey("gemini", "AIzaSECRET", { fetch: s.f }); return s.calls[0]; })()), "x-goog-api-key"), "AIzaSECRET", "Gemini's key goes in a header, not the URL");
  assert.ok(PROVIDER_INFO.groq.format.test("gsk_abcdefghijklmnopqrstuvwxyz12"));
  assert.ok(!PROVIDER_INFO.anthropic.format.test("gsk_abcdefghijklmnopqrstuvwxyz12"));

  // A paid AI is never picked unless chosen.
  assert.equal(pickProvider(["anthropic", "openai"], ""), null, "paid only, not chosen → the rough ranking");
  assert.equal(pickProvider(["anthropic", "groq"], ""), "groq", "a free one is fine");
  assert.equal(pickProvider(["anthropic", "groq"], "anthropic"), "anthropic", "the member's choice");
  assert.equal(pickProvider(["gemini", "groq"], "openai"), "gemini", "chosen but not connected → a free one");
  assert.equal(pickProvider(["gemini", "groq"], ""), "gemini");

  // Pacing: free tiers are spaced out; paid keys aren't.
  assert.equal(rpmFor("gemini"), 12); assert.equal(rpmFor("groq"), 25); assert.equal(rpmFor("anthropic"), 0); assert.equal(rpmFor("openai"), 0);
  assert.equal(rpmFor("openai", "https://openrouter.ai/api/v1", "meta-llama/llama-3.3-70b-instruct:free"), 15);
  resetPacers();
  let clock = 1_000_000; const slept: number[] = [];
  const sleep = async (ms: number) => { slept.push(ms); clock += ms; };
  const t = pacer("gemini:test", 12, sleep, () => clock);
  await t(); await t(); await t();
  assert.deepEqual(slept, [5000, 5000], "12 a minute = one every 5 seconds");
  const free = pacer("anthropic:test", 0, sleep, () => clock); slept.length = 0; await free(); await free();
  assert.deepEqual(slept, [], "not paced");

  // Each provider's completion request, and the provider's real error coming through.
  resetPacers();
  const replies: Record<string, unknown> = {
    gemini: { candidates: [{ content: { parts: [{ text: '{"ok":1}' }] }, finishReason: "STOP" }] },
    anthropic: { content: [{ type: "text", text: 'Here you are: {"ok":1}' }] },
    groq: { choices: [{ message: { content: '```json\n{"ok":1}\n```' } }] },
    openai: { choices: [{ message: { content: '{"ok":1}' } }] },
  };
  for (const p of ["gemini", "groq", "anthropic", "openai"] as const) {
    const s = stub(() => json(replies[p]));
    const out = await completeJson({ provider: p, apiKey: `key-${p}`, baseUrl: p === "openai" ? "https://example.ai/v1" : undefined, model: p === "openai" ? "m1" : undefined }, "sys", "user", { fetch: s.f, sleep: async () => {} });
    assert.deepEqual(out, { ok: 1 }, p);
    assert.equal(s.calls[0].init?.method, "POST");
    if (p === "openai") { assert.equal(s.calls[0].url, "https://example.ai/v1/chat/completions"); assert.equal(JSON.parse(String(s.calls[0].init?.body)).model, "m1"); }
  }
  let n429 = 0;
  const quota = stub(() => { n429++; return json({ error: { message: "quota exceeded" } }, 429); });
  await assert.rejects(completeJson({ provider: "gemini", apiKey: "k" }, "s", "u", { fetch: quota.f, sleep: async () => {} }), (e: unknown) => e instanceof ProviderError && e.message === "429 quota exceeded");
  assert.equal(n429, 2, "a 429 is tried once more, then the real error is shown");
  assert.throws(() => parseJsonObject("no json here"), ProviderError);

  // ---- sources (stand-in fetch; a dead feed is skipped, not fatal) ----
  const now = Date.now();
  const iso = (daysBack: number) => new Date(now - daysBack * 86_400_000).toISOString();
  const feedStub = stub((url) => {
    if (url.includes("remoteok")) return json([{ legal: "notice" }, { id: 1, company: "Acme", position: "Backend Engineer", location: "Worldwide", url: "https://remoteok.com/remote-jobs/1", date: iso(2), description: "<p>Node &amp; Postgres</p>", tags: ["node"] }, { id: 2, company: "Home", position: "Backend Engineer", url: "https://home.example/", date: iso(1) }]);
    if (url.includes("remotive")) return json({ jobs: [{ id: 9, company_name: "Acme", title: "Backend  Engineer", candidate_required_location: "Worldwide", url: "https://remotive.com/j/9", publication_date: iso(3), description: "Node" }] });
    if (url.includes("himalayas")) throw new Error("socket hang up");
    return json({ data: [] });
  });
  const feeds = await fetchFeeds(feedStub.f);
  assert.equal(feeds.counts.remoteok, 1, "the legal notice and the bare-domain row are dropped");
  assert.equal(feeds.jobs.find((j) => j.source === "remoteok")?.description, "Node & Postgres");
  assert.match(feeds.errors.himalayas, /socket hang up/); assert.equal(feeds.counts.arbeitnow, 0);
  assert.equal(dedupe(feeds.jobs).length, 1, "the same role on two feeds is one");
  const slow: Fetch = (_url, init) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("timed out"), { name: "TimeoutError" }))));
  const timedOut = await fetchFeeds(slow, 30);
  assert.equal(timedOut.jobs.length, 0); assert.equal(Object.keys(timedOut.errors).length, 4, "every feed times out and is skipped");

  assert.deepEqual(slugsFor("Moniepoint Inc."), ["moniepoint"]); assert.deepEqual(slugsFor("Mono Labs"), ["monolabs", "mono-labs"]);
  const boards = stub((url) => {
    if (url === "https://boards-api.greenhouse.io/v1/boards/paystack/jobs?content=true") return json({ jobs: [{ id: 1, title: "Senior Backend Engineer", location: { name: "Lagos or remote" }, absolute_url: "https://boards.greenhouse.io/paystack/jobs/1", updated_at: iso(1), first_published: iso(700), content: "&lt;p&gt;Ledger&lt;/p&gt;" }] });
    if (url.startsWith("https://api.lever.co/v0/postings/flutterwave")) return json([]);
    if (url.includes("ashbyhq.com")) return json({ jobs: [] });
    return json({ error: "not found" }, 404);
  });
  const ps = await checkBoard(boards.f, "Paystack");
  assert.deepEqual(ps, { name: "Paystack", ats: "greenhouse", slug: "paystack", ok: true });
  assert.equal((await checkBoard(boards.f, "flutterwave")).ats, "lever", "a board with no openings today still counts");
  const kuda = await checkBoard(stub(() => json({}, 404)).f, "kuda");
  assert.equal(kuda.ok, false, "no public board");
  const got = await fetchBoards(boards.f, [{ ats: "greenhouse", slug: "paystack", name: "Paystack" }]);
  assert.equal(got.jobs[0].postedAt, iso(1), "the later of updated and first published");
  assert.equal(got.jobs[0].source, "greenhouse:paystack");

  // ---- the funnel ----
  const P: NjProfile = { ...DEFAULT_PROFILE, roles: ["Backend engineer", "Full-stack"], skills: ["Node", "Postgres", "TypeScript"], shipped: ["Payments ledger on Postgres, 40k payouts a month", "Next.js app, 12k users"], country: "Nigeria", cities: ["Lagos"], remote: true, seniority: "senior", dealBreakers: ["Unpaid trial", "Crypto trading"] };
  const job = (o: Partial<PoolJob> = {}): PoolJob => { const j = { company: "Acme", title: "Backend Engineer", location: "Remote", url: "https://example.com/jobs/1", postedAt: iso(2), description: "Node.js, webhooks, payments.", salaryText: "", tags: [], remoteHint: null, source: "remoteok", sourceLabel: "RemoteOK", ...o }; return { ...j, hash: jobHash(j) }; };
  const keep = (j: PoolJob, p = P) => hardFilter([j], p, now).kept.length === 1;
  assert.ok(keep(job()), "a plain role that fits passes");
  assert.ok(!keep(job({ title: "Senior Accountant", description: "payments, ledgers, Postgres" })), "a title that isn't a role you want, however good the description");
  assert.ok(!keep(job({ title: "Werkstudent Backend Engineering" })), "student posts");
  assert.ok(!keep(job({ title: "Director of Engineering" })), "above the level");
  assert.ok(keep(job({ title: "Senior Engineer / Tech Lead" })), "'lead' in the middle isn't a leading band");
  assert.ok(!keep(job({ postedAt: iso(90) })), "older than 60 days");
  assert.ok(!keep(job({ description: "Join our crypto trading desk" })), "a deal-breaker");
  for (const loc of ["Remote - India", "Remote: United States, Remote: Canada", "Remote (Poland)", "US Remote", "Remote, US only"]) assert.ok(!keep(job({ location: loc })), `${loc}: remote, but only from another country`);
  assert.ok(!keep(job({ location: "Berlin Office", remoteHint: false })), "on-site abroad");
  assert.ok(!keep(job({ location: "San Francisco, CA" })), "a known foreign city");
  for (const loc of ["Remote (worldwide)", "Remote - EMEA", "Lagos, Nigeria", "Remote, Africa", "Anywhere"]) assert.ok(keep(job({ location: loc })), `${loc} fits someone in Lagos`);
  assert.ok(!keep(job({ location: "Remote", description: "We are able to hire in Ghana, Kenya, Morocco and South Africa." })), "a hiring list that leaves Nigeria out");
  assert.ok(keep(job({ location: "Remote", description: "We are able to hire in Ghana, Kenya and Nigeria." })));
  assert.ok(!keep(job({ description: "You must be a US citizen with security clearance." })), "a legal lock");
  assert.ok(keep(job({ location: "Remote - US", description: "must be a us citizen" }), { ...P, country: "United States" }), "…unless you live there");
  assert.ok(!keep(job({ location: "Remote" }), { ...P, remote: false }), "remote, but they chose on-site");
  const counted = hardFilter([job({ title: "Accountant" }), job({ title: "Lead Accountant" }), job()], P, now);
  assert.equal(counted.kept.length, 1); assert.equal(Object.values(counted.reasons).reduce((a, b) => a + b, 0), 2, "rejections counted by reason");
  assert.equal(jobHash({ company: "Acme", title: "Full-Stack Engineer", location: "Lagos, Nigeria" }), jobHash({ company: "acme", title: "Full Stack Engineer", location: "Lagos (hybrid)" }), "same role, written two ways");

  const ranked = prescoreAll(hardFilter([job({ title: "Backend Engineer", description: "Node and Postgres; payments ledger", hash: "a" }), job({ title: "Full-stack developer", company: "B", description: "PHP", postedAt: iso(40) })], P, now).kept, P);
  assert.equal(ranked[0].title, "Backend Engineer", "skills and a full role match rank first");
  assert.ok(ranked[0].prescore > ranked[1].prescore && ranked[0].prescore <= 100);

  const long = `About us. ${"Our story. ".repeat(400)}\n\nRequirements: 5 years of Node.\n\n${"Benefits. ".repeat(300)}`;
  const trimmed = fitToBudget(long, 2500);
  assert.ok(trimmed.length <= 2500 && trimmed.includes("Requirements: 5 years of Node."), "requirements survive the trim");
  assert.equal(toText("<p>a&nbsp;&amp;&#39;b</p><li>x</li>"), "a &'b\n• x");

  // The AI rubric: parts in range, the score is their sum; nonsense is dropped.
  const v = validateVerdicts({ results: [{ id: "j1", domain: 22, stack: 20, seniority: 12, location: 18, signal: 15, reason: "Ledger work.", risk: "Asks for 6+ years." }, { id: "j2", domain: 40, stack: 1, seniority: 1, location: 1, signal: 1 }, { id: "j9", domain: 1, stack: 1, seniority: 1, location: 1, signal: 1 }] }, 2);
  assert.equal(v.size, 1); assert.equal(v.get(0)?.score, 87); assert.equal(v.get(0)?.risk, "Asks for 6+ years.");

  // The shortlist: strong AI picks first; a failed read keeps its keyword score, marked rough; "Not for me" never comes back.
  const c = (hash: string, prescore: number, score?: number): Candidate => ({ ...job({ title: hash }), hash, prescore, hits: ["node"], ageDays: 1, locationFit: "eligible", ...(score !== undefined ? { verdict: { domain: 0, stack: 0, seniority: 0, location: 0, signal: 0, score, reason: "r", risk: "k" } } : {}) });
  const list = pickShortlist([c("a", 50, 87), c("b", 60, 81), c("c", 70), c("d", 30, 20), c("e", 65, 90)], new Set(["e"]));
  assert.deepEqual(list.map((x) => x.hash), ["a", "b", "d", "c"], "hidden e gone; d fills toward the minimum; c rides along rough");
  const sj = toShort(list[3], "unknown");
  assert.equal(sj.rough, true); assert.equal(sj.score, 70); assert.equal(sj.reason, "Mentions node.");
  assert.equal(toShort(list[0], "live").score, 87);

  // ---- the link check fails open and never matches a bare 404 ----
  const page = (title: string, body = "") => `<html><head><title>${title}</title></head><body>${body}</body></html>`;
  const reply = (status: number, body: string): Fetch => async () => new Response(body, { status });
  const J = { url: "https://example.com/jobs/1", title: "Backend Engineer" };
  assert.equal((await verifyOne(J, { fetch: reply(200, page("Backend Engineer @ Acme", "We are hiring a Backend Engineer.")) })).state, "live");
  assert.equal((await verifyOne(J, { fetch: reply(200, page("Job Application for Backend Engineer at Acme", '<svg><path d="M18.99 13.3404Z"/></svg><h1>Backend Engineer</h1>')) })).state, "live", "SVG path data with 404 in it doesn't kill a live page");
  assert.equal((await verifyOne(J, { fetch: reply(200, page("Page not found")) })).state, "dead");
  assert.equal((await verifyOne(J, { fetch: reply(404, "") })).state, "dead");
  assert.equal((await verifyOne(J, { fetch: reply(200, page("Acme careers", "Roles like this are filled fast. Backend Engineer")) })).state, "live", "only the exact closed phrases count…");
  assert.equal((await verifyOne(J, { fetch: reply(200, page("Acme", "Backend Engineer: this job is no longer available")) })).state, "dead", "…and then it's closed");
  assert.equal((await verifyOne({ ...J, url: "https://jobs.ashbyhq.com/x/1" }, { fetch: reply(200, page("Jobs", '<script>window.__appData = {"organization":null,"posting":null};</script>')) })).state, "dead", "an Ashby shell that resolved nothing");
  for (const s of [403, 429, 500, 999]) assert.equal((await verifyOne(J, { fetch: reply(s, "") })).state, "unknown", `HTTP ${s} is not closed`);
  assert.equal((await verifyOne(J, { fetch: slow, timeoutMs: 20 })).state, "unknown", "a timeout fails open");
  assert.equal((await verifyOne({ ...J, url: "https://home.example/" }, { fetch: reply(200, "") })).state, "dead", "a bare domain isn't a posting");
  assert.deepEqual((await verifyAll([J, J], { fetch: async () => { throw new Error("x"); } })).map((r) => r.state), ["unknown", "unknown"]);

  // ---- the CV review: "shipped" only from the CV ----
  const cv = "Ada Obi, Lagos. Backend engineer. At Kora I built the payments ledger on Postgres handling 40,000 payouts a month. Led a Next.js app to 12k users.";
  assert.ok(inCv("Built the payments ledger on Postgres, 40,000 payouts a month", cv));
  assert.ok(!inCv("Built a Kubernetes platform for 2 million users", cv), "invented");
  assert.ok(!inCv("Payments ledger on Postgres, 90,000 payouts a month", cv), "a figure that isn't in the CV");
  const r = validateCvReview({ strengths: ["Real payments scale"], gaps: ["No tests mentioned"], fixes: ["Lead with the ledger"], roles: ["Backend Engineer", "Platform Engineer"], profile: { roles: [], shipped: ["Payments ledger on Postgres, 40,000 payouts a month", "Built a Kubernetes platform for 2 million users"], skills: ["Postgres", "Next.js"], cities: ["Lagos"], country: "Nigeria", seniority: "boss" } }, cv, "Nigeria");
  assert.deepEqual(r.profile.shipped, ["Payments ledger on Postgres, 40,000 payouts a month"]); assert.equal(r.dropped, 1);
  assert.deepEqual(r.profile.roles, ["Backend Engineer", "Platform Engineer"], "the best fitting roles fill an empty list");
  assert.equal(r.profile.seniority, "mid"); assert.equal(r.profile.remote, true);
  assert.throws(() => validateCvReview({}, cv, "Nigeria"));

  // ---- the cover note: a figure that isn't in the shipped list or the job is taken out ----
  const note = groundCoverNote("I built a payments ledger handling 40k payouts a month. I also scaled a platform to 3 million users. I'd love to work on your ledger.", ["Payments ledger on Postgres, 40k payouts a month"], "Senior Backend Engineer at Paystack");
  assert.ok(note.includes("40k payouts") && !note.includes("3 million") && note.includes("I'd love"));

  // ---- reading a Word CV: a real zip, unpacked with DecompressionStream ----
  const xml = '<w:document><w:body><w:p><w:r><w:t>Ada Obi</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Backend </w:t></w:r><w:r><w:t>engineer &amp; lead</w:t></w:r><w:r><w:tab/><w:t>Lagos</w:t></w:r></w:p></w:body></w:document>';
  assert.equal(docxXmlText(xml), "Ada Obi\nBackend engineer & lead Lagos");
  const zip = (name: string, data: Buffer) => {
    const comp = deflateRawSync(data), n = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
    const body = Buffer.concat([local, n, comp]);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + n.length, 12); end.writeUInt32LE(body.length, 16);
    return new Uint8Array(Buffer.concat([body, central, n, end]));
  };
  assert.equal(await docxText(zip("word/document.xml", Buffer.from(xml))), "Ada Obi\nBackend engineer & lead Lagos");
  await assert.rejects(docxText(zip("other.xml", Buffer.from(xml))), /couldn't be read/);

  clearInterval(alive);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
