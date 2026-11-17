// Nana Jobs, the two production faults of 15 Nov 2026 (v0.169.1), with real-looking feed data saved as fixtures (tests/nana-jobs/fixtures:
// the shapes RemoteOK, Remotive, Himalayas and Arbeitnow really send, with their own date formats). Nothing here reaches the network.
//   A. "No job ever fits": 455 collected, 0 fit your rules.
//   B. "The CV review fails": Claude's answer was cut off, or the platform stopped the function first, and the browser said "Something
//      went wrong".
// Run: npm run test:nana-jobs → "ALL OK" (this file runs after funnel.test.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_TIMEOUT_MS, ANTHROPIC_THINKING_ROOM, ProviderError, completeJson, type Fetch } from "../../lib/ai-providers";
import { DEFAULT_PROFILE, apiErrorText, cleanProfile, cutSummary, cutText, effectiveProfile, profileEmpty, type NjProfile } from "../../lib/nana-jobs";
import { daysAgo, hardFilter, prescoreAll } from "../../lib/nana-jobs-funnel";
import { FEEDS, fetchFeeds, rssItems } from "../../lib/nana-jobs-sources";

const root = join(process.cwd(), "tests/nana-jobs/fixtures");
const NOW = Date.parse("2026-11-15T07:00:00Z");
const fixture: Fetch = async (url) => {
  const key = Object.keys(FEEDS).find((k) => FEEDS[k].url === url);
  if (!key) throw new Error(`no fixture for ${url}`);
  return new Response(readFileSync(join(root, `${key}.${FEEDS[key].rss ? "xml" : "json"}`), "utf8"), { status: 200, headers: { "content-type": FEEDS[key].rss ? "application/rss+xml" : "application/json" } });
};

(async () => {
  // ---- A. the feeds as they really come ----
  const feeds = await fetchFeeds(fixture);
  assert.deepEqual(feeds.errors, {});
  assert.deepEqual(feeds.counts, { remoteok: 12, remotive: 10, himalayas: 8, arbeitnow: 6, weworkremotely: 5, workingnomads: 3, remotewoman: 3 }, "RemoteOK's legal notice isn't a job");
  // The RSS feeds (v0.178.0): We Work Remotely puts the company in the title; Remote Woman names it in its own tag.
  const wwr = feeds.jobs.filter((j) => j.source === "weworkremotely"), rw = feeds.jobs.filter((j) => j.source === "remotewoman"), wn = feeds.jobs.filter((j) => j.source === "workingnomads");
  for (const j of [...wwr, ...rw, ...wn]) { assert.ok(j.company && j.title && j.postedAt && /^https:\/\//.test(j.url), `${j.source}: ${j.title}`); assert.doesNotMatch(j.description, /<[a-z]|&lt;|CDATA/i, "the description is plain text"); }
  assert.ok(wwr.every((j) => !j.title.startsWith(`${j.company}:`)), "the company is taken out of the title");
  assert.deepEqual(rssItems("<rss><channel><item><title><![CDATA[A &amp; B]]></title><link>https://x.test/1?a=1&amp;b=2</link></item></channel></rss>"), [{ title: "A & B", link: "https://x.test/1?a=1&b=2" }]);
  assert.deepEqual(rssItems("<html>not a feed</html>"), []);
  // The fixes below were measured on the first four feeds.
  const all = feeds.jobs.filter((j) => ["remoteok", "remotive", "himalayas", "arbeitnow"].includes(j.source));

  // Freshness: every feed's date format is read (ISO with an offset, ISO with no zone, Unix seconds), and none lands in the future.
  for (const src of ["remoteok", "remotive", "himalayas", "arbeitnow"]) {
    const ages = all.filter((j) => j.source === src).map((j) => daysAgo(j.postedAt, NOW));
    assert.ok(ages.every((a) => a !== null && a >= 0 && a <= 75), `${src}: dates read (${ages.join(",")})`);
  }
  assert.equal(daysAgo(all.find((j) => j.title === "QA Engineer")!.postedAt, NOW), 70, "Remotive's zone-less date");

  // The owner's case: the profile was never filled in, but the account's job title had been copied in as the only role on the first visit.
  // A title gate of "Founder & CEO" keeps nothing.
  const seeded = cleanProfile({ roles: ["Founder & CEO"] });
  const before = hardFilter(all, seeded, NOW);
  assert.equal(before.kept.length, 0, "the fault reproduced: nothing fits");
  assert.equal(cutSummary(before.reasons)[0].label, "not in your roles", "…and the funnel now says why");

  // An empty profile: no title gate, so the other rules decide. Locations, freshness and level still cut what they should.
  assert.ok(profileEmpty(DEFAULT_PROFILE));
  const { profile: none, from } = effectiveProfile(DEFAULT_PROFILE, null);
  assert.equal(from, "empty");
  const open = hardFilter(all, none, NOW);
  assert.ok(open.kept.length >= 15, `an empty profile keeps the openings that fit everything else (${open.kept.length})`);
  assert.ok(!open.reasons["title isn't a role you want"], "no title gate without roles");
  const keptTitles = open.kept.map((j) => j.title);
  assert.ok(keptTitles.includes("Software Engineer, Payments"), "Himalayas: restricted to Nigeria, Kenya, Ghana fits someone in Nigeria");
  assert.ok(keptTitles.includes("Senior Backend Engineer") && keptTitles.includes("Executive Assistant"), "worldwide and Africa-only remote roles");
  assert.ok(!keptTitles.includes("Account Executive"), "United States only");
  assert.ok(!keptTitles.includes("QA Engineer"), "older than 60 days");
  assert.ok(!keptTitles.includes("Lagerist (m/w/d)"), "on-site in Hamburg");
  assert.ok(!keptTitles.some((t) => t.startsWith("Werkstudent")), "student posts");
  for (const j of all) assert.ok(open.kept.some((k) => k.hash === j.hash) !== open.cuts.has(j.hash), `${j.title}: kept, or cut with its reason`);
  assert.equal(open.cuts.size, all.length - open.kept.length);
  assert.match(cutText(open.reasons), /^\d+ location/, "\"9 location, 2 above your level, …\"");

  // No roles of your own, but a CV review: its roles are used.
  const cv = { profile: { roles: ["Backend Engineer", "Software Engineer"], shipped: ["Payments ledger on Postgres"], skills: ["Node", "Postgres"], cities: [], country: "Nigeria", remote: true, seniority: "mid" as const } };
  const fromCv = effectiveProfile(DEFAULT_PROFILE, cv);
  assert.equal(fromCv.from, "cv"); assert.deepEqual(fromCv.profile.roles, cv.profile.roles); assert.deepEqual(fromCv.profile.skills, ["Node", "Postgres"]);
  const cvRun = hardFilter(all, fromCv.profile, NOW);
  assert.ok(cvRun.kept.length >= 3 && cvRun.kept.every((j) => /engineer|backend|software/i.test(j.title)), cvRun.kept.map((j) => j.title).join(" | "));
  assert.equal(prescoreAll(cvRun.kept, fromCv.profile)[0].title, "Senior Backend Engineer", "the CV's skills rank it");
  // The member's own roles always win over the CV's.
  const mine: NjProfile = { ...DEFAULT_PROFILE, roles: ["Product Designer"] };
  assert.equal(effectiveProfile(mine, cv).from, "yours");
  // A short list of roles works as a gate (whole words, any of them, every place in the title).
  const designer = hardFilter(all, mine, NOW).kept.map((j) => j.title);
  assert.ok(designer.includes("Product Designer") && designer.includes("Senior Product Designer") && designer.every((t) => /product|designer/i.test(t)), designer.join(" | "));
  assert.equal(hardFilter(all, cleanProfile({ roles: ["Engineer"] }), NOW).kept.length, open.kept.filter((j) => /engineer/i.test(j.title)).length);

  // Deal-breakers: an empty or one-letter entry never cuts everything; a real one cuts as a whole word.
  for (const junk of [[""], ["-"], ["a"], ['""'], [" "]]) {
    const p = { ...none, dealBreakers: cleanProfile({ dealBreakers: junk }).dealBreakers.concat(junk) };
    assert.equal(hardFilter(all, p, NOW).kept.length, open.kept.length, `deal-breaker ${JSON.stringify(junk)} cuts nothing`);
  }
  assert.equal(hardFilter(all, { ...none, dealBreakers: ["support"] }, NOW).kept.filter((j) => /support/i.test(j.title)).length, 0);
  // The pay floor is the AI's to judge (it is in the scoring brief), never a hard filter: any wording keeps the same openings.
  for (const payFloor of ["", "₦1,200,000 / month", "$2,500", "negotiable", "0"]) assert.equal(hardFilter(all, { ...none, payFloor }, NOW).kept.length, open.kept.length, payFloor);

  // ---- B. the CV review and Claude ----
  // A stand-in for Claude's current small model: it thinks before it answers, and the thinking counts against max_tokens. At the
  // default (medium) effort it thinks for longer than at low.
  const answer = JSON.stringify({ strengths: ["Payments at scale"], gaps: ["No tests"], fixes: ["Lead with the ledger"], roles: ["Backend Engineer"], profile: { roles: ["Backend Engineer"], shipped: [], skills: ["Node"], cities: ["Lagos"], country: "Nigeria", remote: true, seniority: "mid" } });
  const ANSWER_TOKENS = 1200;
  const bodies: Record<string, unknown>[] = [];
  const claude: Fetch = async (url, init) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    const b = JSON.parse(String(init?.body));
    bodies.push(b);
    const thinking = (b.output_config as { effort?: string } | undefined)?.effort === "low" ? 1500 : 3500;
    const room = Number(b.max_tokens) - thinking;
    if (room < ANSWER_TOKENS) {
      return new Response(JSON.stringify({ content: [{ type: "thinking", thinking: "" }, ...(room > 0 ? [{ type: "text", text: answer.slice(0, Math.floor(answer.length * room / ANSWER_TOKENS)) }] : [])], stop_reason: "max_tokens" }), { status: 200 });
    }
    return new Response(JSON.stringify({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: answer }], stop_reason: "end_turn" }), { status: 200 });
  };
  const acct = { provider: "anthropic" as const, apiKey: "sk-ant-test-standin-0000000000000000" };
  // What the review asked for before the fix (2000 tokens, no effort) is cut off: that was the fault.
  const old = await claude("https://api.anthropic.com/v1/messages", { method: "POST", body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 2000, messages: [] }) });
  assert.equal((await old.json()).stop_reason, "max_tokens", "the stand-in reproduces the cut-off");
  bodies.length = 0;
  const ok = await completeJson(acct, "sys", "THE CV", { fetch: claude, sleep: async () => {}, maxTokens: 4000 });
  assert.deepEqual(ok.roles, ["Backend Engineer"], "the review comes back whole");
  assert.equal((bodies[0].output_config as { effort: string }).effort, "low");
  assert.equal(bodies[0].max_tokens, 4000 + ANTHROPIC_THINKING_ROOM, "room for the thinking on top of the answer");
  assert.equal(bodies[0].model, "claude-haiku-5-5", "the model Nana uses too (lib/nana-server.ts)");
  // A cut-off or a refusal is named, not reported as "not the JSON we asked for".
  const cut: Fetch = async () => new Response(JSON.stringify({ content: [{ type: "text", text: '{"strengths":["Pay' }], stop_reason: "max_tokens" }), { status: 200 });
  await assert.rejects(completeJson(acct, "s", "u", { fetch: cut, sleep: async () => {} }), (e: unknown) => e instanceof ProviderError && /cut off/.test(e.message));
  const no: Fetch = async () => new Response(JSON.stringify({ content: [], stop_reason: "refusal" }), { status: 200 });
  await assert.rejects(completeJson(acct, "s", "u", { fetch: no, sleep: async () => {} }), (e: unknown) => e instanceof ProviderError && /declined/.test(e.message));
  const notFound: Fetch = async () => new Response(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "model: claude-nope" } }), { status: 404 });
  await assert.rejects(completeJson({ ...acct, model: "claude-nope" }, "s", "u", { fetch: notFound, sleep: async () => {} }), (e: unknown) => e instanceof ProviderError && e.message === "404 model: claude-nope", "the provider's own words");
  const length: Fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"a":' }, finish_reason: "length" }] }), { status: 200 });
  await assert.rejects(completeJson({ provider: "groq", apiKey: "gsk_x" }, "s", "u", { fetch: length, sleep: async () => {} }), (e: unknown) => e instanceof ProviderError && /cut off/.test(e.message));
  // A slow AI is stopped by our own timer, with a reason.
  const slow: Fetch = (_u, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
  const keepAlive = setInterval(() => {}, 1000);
  await assert.rejects(completeJson(acct, "s", "u", { fetch: slow, sleep: async () => {}, timeoutMs: 50 }), (e: unknown) => e instanceof ProviderError && e.message === "it took too long to answer");
  clearInterval(keepAlive);

  // Each route gives the platform longer than the AI calls it makes, so our message reaches the browser, not a bare 504.
  const maxDuration = (route: string) => Number(/export const maxDuration = (\d+)/.exec(readFileSync(join(process.cwd(), `app/api/jobs/nana/${route}/route.ts`), "utf8"))?.[1] ?? 0) * 1000;
  assert.ok(maxDuration("cv") > AI_TIMEOUT_MS.cv + 5_000, "the CV route outlasts the CV review's wait");
  assert.ok(maxDuration("cover") > AI_TIMEOUT_MS.cover + 5_000, "the cover-note route outlasts its wait");
  assert.ok(maxDuration("run") > 90_000 + 15_000, "the run route outlasts its AI budget and the link checks");

  // The browser shows the real reason.
  assert.equal(apiErrorText(502, JSON.stringify({ error: 'Your AI (Claude (Anthropic)) couldn\'t review it: "401 invalid x-api-key".' })), 'Your AI (Claude (Anthropic)) couldn\'t review it: "401 invalid x-api-key".');
  assert.match(apiErrorText(504, "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT"), /took too long/);
  assert.match(apiErrorText(504, ""), /took too long/);
  assert.match(apiErrorText(500, "<html>Internal Server Error</html>"), /error 500/);
  assert.ok(!/Something went wrong/.test(apiErrorText(500, "")));

  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
