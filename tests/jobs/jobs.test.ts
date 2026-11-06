// Notes Jobs rules (lib/jobs.ts): what a job and an application must hold, and how a job is matched to a member.
// Run: npm run test:jobs → "ALL OK".
import assert from "node:assert/strict";
import { JobsError, cleanJob, cleanJobApplication, jobIntent, jobsForQuestion, matchScore, matchingTier, payText, placeText, STRONG_MATCH } from "../../lib/jobs";

const base = { title: "Community manager", summary: "Grow our members' communities across Lagos", requirements: "2 years with communities\nWarm and organised", type: "full_time", mode: "onsite", city: "Lagos", industry: "media", topics: ["marketing", "socialmedia", "business"] };
const j = cleanJob(base);
assert.deepEqual(j.requirements, ["2 years with communities", "Warm and organised"]);
assert.equal(j.openDays, 30, "open 30 days by default");
assert.throws(() => cleanJob({ ...base, title: "" }), JobsError);
assert.throws(() => cleanJob({ ...base, requirements: "" }), JobsError);
assert.throws(() => cleanJob({ ...base, mode: "onsite", city: "" }), JobsError, "an on-site job needs a city");
assert.equal(cleanJob({ ...base, mode: "remote", city: "" }).city, "", "a remote job doesn't");
assert.throws(() => cleanJob({ ...base, openDays: 90 }), JobsError, "open 60 days at most");
assert.throws(() => cleanJob({ ...base, payMin: 200000, payMax: 100000, payPeriod: "month" }), JobsError, "range the right way round");
assert.throws(() => cleanJob({ ...base, payMin: 200000 }), JobsError, "pay needs a period");
const paid = cleanJob({ ...base, payMin: 150000, payMax: 250000, payPeriod: "month" });
assert.equal(paid.payMinKobo, 15_000_000); assert.equal(paid.payMaxKobo, 25_000_000);
assert.equal(payText({ payMinKobo: 15_000_000, payMaxKobo: 25_000_000, payPeriod: "month" }), "₦150,000 to ₦250,000 a month");
assert.equal(payText({}), "");
assert.equal(placeText({ mode: "hybrid", city: "Abuja", state: "FCT" }), "Abuja, FCT · Hybrid");
assert.equal(placeText({ mode: "remote", city: "", state: "" }), "Remote");
assert.ok(cleanJob({ ...base, topics: ["marketing", "not-a-topic"] }).topics.every((t) => t !== "not-a-topic"), "only real topics");

assert.throws(() => cleanJobApplication({ coverNote: "too short", consent: true }), JobsError);
assert.throws(() => cleanJobApplication({ coverNote: "x".repeat(50), consent: false }), JobsError);
assert.deepEqual(cleanJobApplication({ coverNote: "x".repeat(50), consent: true, links: "https://a.example/cv\nhttp://insecure.example\nnot a link" }).links, ["https://a.example/cv"]);

const job = { industry: "media", topics: ["marketing", "socialmedia"], title: "Community manager", city: "Lagos", mode: "onsite" as const };
const strong = matchScore(job, { industry: "media", interests: ["marketing", "socialmedia"], jobTitle: "Community lead", city: "lagos" });
assert.equal(strong.score, 3 + 4 + 2 + 2, "industry, two topics, a title word and the city");
assert.ok(strong.score >= STRONG_MATCH);
assert.ok(strong.reasons.some((r) => r.startsWith("Works in")) && strong.reasons.includes("In Lagos"));
assert.equal(matchScore(job, {}).score, 0, "nothing known, no match");
assert.equal(matchScore({ ...job, mode: "remote", city: "" }, {}).score, 1, "a remote job suits anyone a little");
assert.equal(matchScore(job, { jobTitle: "Senior manager" }).score, 0, "common words like manager don't count");
assert.equal(matchingTier("business"), true); assert.equal(matchingTier("enterprise"), true); assert.equal(matchingTier("pro"), false);
// Nana: a real job search, even without the word "job", and the openings that fit it (the owner's example, 6 Nov 2026)
const ask = "I want more remote work for customers services representative so I can apply";
assert.equal(jobIntent(ask), true);
for (const q of ["any vacancies in Lagos?", "is anyone hiring a developer", "I need a job", "how do I find work as a writer"]) assert.equal(jobIntent(q), true, q);
for (const q of ["how do I get the Digital Witch certificate in Notes Life", "how much does a shift pay in the game", "how does booking work", "what is NotesApp"]) assert.equal(jobIntent(q), false, q);
const J = (id: string, title: string, mode: "onsite" | "hybrid" | "remote", city = "Lagos", summary = "Help our members", createdAt = "2026-11-01") =>
  ({ id, title, mode, city, state: "", summary, requirements: [] as string[], industry: "", createdAt });
const open = [J("a", "Customer support agent", "remote"), J("b", "Customer care representative", "onsite"), J("c", "Delivery rider", "onsite"), J("d", "Social media lead", "remote")];
const fit = jobsForQuestion(ask, open).map((j) => j.id);
assert.deepEqual(fit, ["a", "b"], "customer service = support = care; remote ranks first; nothing unrelated");
assert.deepEqual(jobsForQuestion("any remote jobs?", open).map((j) => j.id).sort(), ["a", "d"], "remote alone");
assert.deepEqual(jobsForQuestion("any jobs in Lagos?", open).length, 4, "a city alone");
assert.deepEqual(jobsForQuestion("pilot jobs", open), [], "nothing fits");
console.log("ALL OK");
