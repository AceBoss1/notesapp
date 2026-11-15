// Growth measurement: the pure rules (lib/growth.ts): channel mapping, the first-touch cookie, return tags, first value, the weeks,
// cohort maths and the funnel. Run: npm run test:growth → "GROWTH OK".
import assert from "node:assert/strict";
import {
  DAY_MS, WEEK_MS, classifyTouch, cleanDetail, cleanTrigger, cohortWeek, computeGrowth, decodeTouch, encodeTouch, funnelFor, inviteLink,
  isActive, productOf, reachedValue, signupSource, weekOf, weekOver, withReturn, type MemberRow,
} from "../../lib/growth";
import { renderDigestHtml, renderDigestText } from "../../lib/digest";

const now = new Date("2026-11-15T12:00:00Z");
const own = ["notesapp.name.ng", "naapp.tech", "notesapp.ng", "localhost"];
const t = (path: string, params: Record<string, string> = {}, refHost = "", role: "app" | "life" | "prep" | "main" = "main") => classifyTouch({ path, role, params, refHost, ownHosts: own, now });

// ── channel mapping ──
assert.deepEqual(t("/install", { by: "Ada" }), { channel: "creators", detail: "ada", via: "direct", day: "2026-11-15" }, "?by= is a creator's link");
assert.equal(t("/", { by: "@lwb" }).detail, "lwb", "an @ is dropped");
assert.equal(t("/r/tunde").channel, "creators");
assert.equal(t("/r/tunde").detail, "tunde");
assert.equal(t("/u/ada").detail, "ada", "a creator's profile");
assert.equal(t("/s/ada/notes").channel, "creators", "a creator's site");
assert.equal(t("/jobs").channel, "jobs");
assert.equal(t("/nana-jobs").channel, "jobs");
assert.equal(t("/academy/excel").channel, "academy");
assert.equal(t("/exam-prep/jamb").channel, "exam-prep");
assert.equal(t("/", {}, "", "prep").channel, "exam-prep", "the Exam Prep address");
assert.equal(t("/", {}, "", "life").channel, "life", "the Notes Life address");
assert.equal(t("/life/play").channel, "life");
assert.equal(t("/install").channel, "install");
assert.equal(t("/", {}, "www.google.com").channel, "search");
assert.equal(t("/", {}, "www.google.com").detail, "google.com", "the referring host, never its address");
assert.equal(t("/", {}, "wa.me").channel, "whatsapp");
assert.equal(t("/", {}, "l.instagram.com").channel, "social");
assert.equal(t("/", {}, "t.co").channel, "social");
assert.equal(t("/", { utm_source: "whatsapp" }).channel, "whatsapp", "a utm tag");
assert.equal(t("/", { utm_source: "facebook", utm_medium: "cpc", utm_campaign: "Nov Launch!" }).channel, "ads", "paid is Ads");
assert.equal(t("/", { utm_source: "facebook", utm_medium: "cpc", utm_campaign: "Nov Launch!" }).detail, "novlaunch", "the campaign, cleaned");
assert.equal(t("/academy", { utm_medium: "paid" }).channel, "ads", "paid wins over the landing page");
assert.equal(t("/install", { by: "ada", utm_medium: "cpc" }).channel, "creators", "a creator's name wins over everything");
assert.equal(t("/", { src: "whatsapp" }).channel, "whatsapp", "?src= naming a channel");
assert.equal(t("/academy", { src: "flyer1" }).channel, "academy", "?src= that isn't a channel is a campaign tag");
assert.equal(t("/academy", { src: "flyer1" }).detail, "flyer1");
assert.equal(t("/academy", {}, "www.google.com").channel, "academy", "the product landed on beats the referrer");
assert.equal(t("/academy", {}, "www.google.com").via, "search", "but the referrer is kept as via");
assert.equal(t("/").channel, "direct");
assert.equal(t("/", {}, "app.notesapp.name.ng").channel, "direct", "our own pages count as Direct");
assert.equal(t("/", {}, "app.notesapp.name.ng").detail, "", "with no host kept");
assert.equal(t("/", {}, "nairaland.com").channel, "direct", "another site");
assert.equal(t("/", {}, "nairaland.com").detail, "nairaland.com");
assert.equal(t("/r/x").channel, "direct", "a username too short is no creator");
assert.equal(productOf("/feed"), null);
assert.equal(cleanDetail("Hello World <script>"), "helloworldscript");
assert.equal(cleanDetail("x".repeat(80)).length, 40);

// ── the cookie ──
const touch = t("/install", { by: "ada" });
assert.equal(encodeTouch(touch), "1|creators|ada|direct|20261115");
assert.deepEqual(decodeTouch(encodeTouch(touch)), touch);
for (const bad of ["", "junk", "2|creators|ada|direct|20261115", "1|nope|ada|direct|20261115", "1|creators|ada|evil|20261115", "1|creators|ada|direct|2026", null, 7]) assert.equal(decodeTouch(bad), null, String(bad));
assert.equal(decodeTouch("1|creators|<b>Ada</b>|direct|20261115")!.detail, "badab", "a forged detail is cleaned");

// ── what the account keeps ──
assert.deepEqual(signupSource(touch, false), { channel: "creators", detail: "ada", via: "direct" });
assert.deepEqual(signupSource(touch, true), { channel: "creators", detail: "", via: "direct" }, "teens and children: the channel only");
assert.deepEqual(signupSource(null, false), { channel: "direct", detail: "", via: "direct" }, "no cookie: Direct");

// ── return tags ──
assert.equal(withReturn("/bookings", "reminder"), "/bookings?r=reminder");
assert.equal(withReturn("/messages/abc?answer=1", "push"), "/messages/abc?answer=1&r=push");
assert.equal(withReturn("/events/e1#join", "reminder"), "/events/e1?r=reminder#join");
assert.equal(withReturn("/bookings?r=reminder", "bell"), "/bookings?r=reminder", "already tagged");
assert.equal(withReturn("https://bank.example.com/x", "digest", "https://www.notesapp.name.ng"), "https://bank.example.com/x", "another site");
assert.equal(withReturn("https://www.notesapp.name.ng/journals/hi", "digest", "https://www.notesapp.name.ng"), "https://www.notesapp.name.ng/journals/hi?r=digest");
assert.equal(withReturn("https://www.notesapp.name.ng/api/digest/go?b=1", "digest", "https://www.notesapp.name.ng"), "https://www.notesapp.name.ng/api/digest/go?b=1", "an API address");
assert.equal(withReturn("//evil.com/x", "bell"), "//evil.com/x");
assert.equal(withReturn("", "bell"), "");
assert.equal(cleanTrigger("bell"), "bell");
assert.equal(cleanTrigger("DIGEST"), "digest");
assert.equal(cleanTrigger("whatever"), "own");
assert.equal(cleanTrigger(undefined), "own");

// ── first value, per kind of member ──
assert.equal(reachedValue("exam-prep", ["exam"]), true);
assert.equal(reachedValue("exam-prep", ["journal"]), false, "a student is judged on a practice test");
assert.equal(reachedValue("jobs", ["shortlist"]), true);
assert.equal(reachedValue("jobs", ["job"]), true);
assert.equal(reachedValue("academy", ["exam"]), false);
assert.equal(reachedValue("life", ["life"]), true);
assert.equal(reachedValue("creators", ["booking"]), true, "everyone else: any first value");
assert.equal(reachedValue("direct", ["sale"]), true);
assert.equal(reachedValue("direct", ["nonsense"]), false);
assert.equal(reachedValue("direct", []), false);

// ── weeks after joining ──
const j = Date.parse("2026-10-01T10:00:00Z");
assert.equal(weekOf(j, j + 3 * DAY_MS), 0);
assert.equal(weekOf(j, j + 7 * DAY_MS), 1, "week 1 starts a week after joining");
assert.equal(weekOf(j, j + 13 * DAY_MS + 1), 1);
assert.equal(weekOf(j, j + 28 * DAY_MS), 4);
assert.equal(weekOver(j, 1, j + 14 * DAY_MS - 1), false);
assert.equal(weekOver(j, 1, j + 14 * DAY_MS), true);
assert.equal(weekOver(j, 4, j + 35 * DAY_MS), true);
assert.equal(isActive("2026-11-10", now), true);
assert.equal(isActive("2026-10-20", now), false);
assert.equal(isActive(undefined, now), false);
assert.equal(cohortWeek("2026-11-15T12:00:00Z"), "2026-11-09", "Sunday belongs to the week from Monday");
assert.equal(cohortWeek("2026-11-09T00:00:00Z"), "2026-11-09");
assert.equal(inviteLink("https://app.notesapp.name.ng/", "ada"), "https://app.notesapp.name.ng/install?by=ada");

// ── the funnel and where they drop ──
const ago = (d: number) => new Date(now.getTime() - d * DAY_MS).toISOString();
const m = (uid: string, daysAgo: number, o: Partial<MemberRow> = {}): MemberRow => ({ uid, joinedAt: ago(daysAgo), channel: "exam-prep", weeks: [], ...o });
const ten = Array.from({ length: 10 }, (_, i) => m(`s${i}`, 60, { weeks: i < 4 ? [1, 2, 3, 4] : i < 6 ? [1] : [] }));
const values = new Map<string, Set<string>>(ten.slice(0, 8).map((x) => [x.uid, new Set(["exam"])]));
values.set("s9", new Set(["journal"])); // not what an Exam Prep student came for
const f = funnelFor(ten, 100, values, new Map([["s0", Date.parse(ago(10))], ["s9", Date.parse(ago(90))]]), now);
assert.deepEqual(f.steps.map((s) => s.count), [100, 10, 8, 6, 4, 1], "visited, signed up, first value, week 1, week 4, paid (a payment before joining doesn't count)");
assert.deepEqual(f.drop, { from: "Visited", to: "Signed up", pct: 90 }, "the step where most leave");
assert.deepEqual(f.notYet, { week1: 0, week4: 0 });
const young = funnelFor([m("n1", 3), m("n2", 20, { weeks: [1] })], 0, new Map([["n1", new Set(["exam"])], ["n2", new Set(["exam"])]]), new Map(), now);
assert.deepEqual(young.notYet, { week1: 1, week4: 2 }, "members too new for week 1 or week 4");
assert.equal(young.drop, null, "nobody lost at any step yet");
const fresh = funnelFor([m("n1", 3), m("n2", 20)], 0, new Map([["n1", new Set(["exam"])], ["n2", new Set(["exam"])]]), new Map(), now);
assert.deepEqual(fresh.drop, { from: "First value", to: "Back in week 1", pct: 100 }, "only members whose week 1 is over count: n1 is too new");
assert.equal(young.steps[0].count, 2, "visited is never below signed up");

// ── the whole report ──
const members: MemberRow[] = [
  // joined in the last 7 days
  m("a1", 2, { channel: "creators", detail: "ada", installedAt: ago(1), lastSeenDay: ago(0).slice(0, 10) }),
  m("a2", 5, { channel: "search" }),
  m("teen", 3, { channel: "creators", young: true }),
  // 20 days ago
  m("b1", 20, { channel: "creators", detail: "ada", weeks: [1, 2], returns: { bell: 2, own: 1 } }),
  m("b2", 20, { channel: "jobs", weeks: [1], returns: { "nana-jobs": 1 } }),
  // 50 days ago: their week 4 is over
  m("c1", 50, { channel: "creators", detail: "lwb", weeks: [1, 2, 3, 4], returns: { digest: 3, own: 1 }, installedAt: ago(49) }),
  m("c2", 50, { channel: "creators", detail: "lwb", weeks: [1], returns: { reminder: 1 } }),
  m("c3", 45, { channel: "exam-prep", weeks: [4], returns: { own: 1 } }),
];
const report = computeGrowth({
  members,
  firsts: [{ uid: "a1", kind: "read", at: ago(1) }, { uid: "c1", kind: "booking", at: ago(40) }, { uid: "c3", kind: "journal", at: ago(40) }, { uid: "b2", kind: "job", at: ago(19) }],
  payments: [{ uid: "c1", at: ago(30) }],
  daily: [{ day: ago(1).slice(0, 10), visits: { creators: 30, search: 20 }, installs: { creators: 2, direct: 1 } }, { day: ago(40).slice(0, 10), visits: { "exam-prep": 50 }, installs: {} }],
  referrals: [{ uid: "a1", by: "ada", at: ago(2) }, { uid: "teen", by: "ada", at: ago(3) }, { uid: "zz", by: "tunde", at: ago(4) }],
}, now);
const r7 = report.ranges["7"], r30 = report.ranges["30"], r90 = report.ranges["90"];
assert.equal(r7.signups, 3);
assert.equal(r7.installs, 3);
assert.equal(r7.visits, 50);
assert.equal(r7.valuePct, 33, "1 of 3 reached first value");
assert.equal(r7.week4Pct, null, "nobody who joined 35 to 42 days ago");
assert.equal(r30.signups, 5);
assert.equal(r90.signups, 8);
assert.equal(r90.visits, 100);
assert.equal(r90.valuePct, 38, "a1, c1 and b2; c3 published a journal but came for Exam Prep");
assert.equal(r90.week4Pct, 67, "of c1, c2 and c3 (their week 4 is over), c1 and c3 came back in it");
assert.equal(r90.week4Base, 3);

// by channel: most sign-ups first; a channel with only visits or installs still shows
assert.deepEqual(r90.channels.map((c) => c.channel), ["creators", "exam-prep", "search", "jobs", "direct"]);
assert.deepEqual(r90.channels[0], { channel: "creators", visits: 30, signups: 5, installs: 2, valuePct: 40, week4Pct: 50 });
assert.equal(r90.funnels.creators!.steps[1].count, 5);
assert.equal(r90.funnels["exam-prep"]!.steps[0].count, 50);
assert.equal(r90.funnels.all!.steps[5].count, 1, "c1 paid after joining");

// creators' links: the referral programme and first touch together, never a teen
assert.deepEqual(r90.creators.map((c) => [c.username, c.joined, c.installed, c.active, c.week4Pct]), [["ada", 2, 1, 1, null], ["lwb", 2, 1, 0, 50], ["tunde", 1, 0, 0, null]]);
assert.ok(!r7.creators.some((c) => c.joined > 1), "the teen who came through @ada isn't counted for her");

// weekly cohorts: a week shows once it's over for the whole cohort
assert.deepEqual(report.cohorts.map((c) => [c.week, c.joined, c.back]), [
  ["2026-09-21", 2, [100, 50, 50, 50]],
  ["2026-09-28", 1, [0, 0, 0, 100]],
  ["2026-10-26", 2, [100, null, null, null]],
  ["2026-11-09", 3, [null, null, null, null]],
]);
// what brings them back, "on their own" last
assert.deepEqual(report.triggers.map((x) => [x.trigger, x.returns, x.pct]), [["digest", 3, 30], ["bell", 2, 20], ["nana-jobs", 1, 10], ["reminder", 1, 10], ["push", 0, 0], ["own", 3, 30]]);
const empty = computeGrowth({ members: [], firsts: [], payments: [], daily: [], referrals: [] }, now);
assert.equal(empty.ranges["30"].valuePct, null);
assert.deepEqual(empty.cohorts, []);
assert.equal(WEEK_MS, 7 * DAY_MS);

// the weekly digest's links to our pages carry ?r=digest; unsubscribe and other sites don't
const site = "https://www.notesapp.name.ng";
const digest = { reader: { name: "Ada", username: "ada", avatar: "" }, stories: [{ title: "Hi", summary: "", href: `${site}/journals/hi`, image: null, writerName: "B", writerAvatar: "", readMinutes: 2, likes: 0, comments: 0, premium: false }],
  sponsored: [{ slot: 1 as const, kind: "ad" as const, id: "a", title: "Bank", image: null, href: "https://bank.example.com", label: "Sponsored" }],
  site, appUrl: `${site}/install`, unsubscribeUrl: `${site}/api/digest/unsubscribe?u=1`, interestsUrl: `${site}/interests`, company: "X" };
const html = renderDigestHtml(digest), text = renderDigestText(digest);
assert.ok(html.includes(`${site}/journals/hi?r=digest`) && text.includes(`${site}/journals/hi?r=digest`));
assert.ok(html.includes(`${site}/journals?r=digest`) && html.includes(`${site}/interests?r=digest`));
assert.ok(html.includes("https://bank.example.com\"") && !html.includes("unsubscribe?u=1&amp;r=") && !text.includes("unsubscribe?u=1&r="));

console.log("GROWTH OK");
