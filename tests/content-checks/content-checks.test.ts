// AI content checks, the pure rules (lib/content-checks.ts): settings and thresholds, deciding (block, hold, child safety, context, teens),
// reading the checker's answer, strike counting and what a strike leads to, communities, and the words members see.
// Run: npm run test:content-checks → "ALL OK".
import assert from "node:assert/strict";
import {
  CHECK_DEFAULTS, ContentCheckError, activeStrikes, afterStrike, apiError, blockedMessage, blockedTitle, cleanCheckSettings, communityStep,
  contentCheckBody, contentCheckOf, decide, decideOne, excerpt, findingWords, heldMessage, isContentCheckError, itemWords, markdownImages,
  parseFindings, postingPausedUntil, type Finding, type Standing,
} from "../../lib/content-checks";

const S = CHECK_DEFAULTS;
const F = (category: Finding["category"], confidence: number, item = "text", context: Finding["context"] = "none"): Finding => ({ category, confidence, item, reason: "r", context });
const adult = { teen: false, settings: S };
const teen = { teen: true, settings: S };

// ── Settings ──
assert.deepEqual(cleanCheckSettings({}), S);
assert.equal(S.strikesToSuspend, 3); assert.equal(S.windowDays, 90); assert.equal(S.suspendDays, 14); // the owner's defaults (15 Nov 2026)
const changed = cleanCheckSettings({ blockAt: "0.9", strikesToSuspend: 4, enabled: false });
assert.ok(typeof changed !== "string" && changed.blockAt === 0.9 && changed.strikesToSuspend === 4 && changed.enabled === false);
assert.equal(typeof cleanCheckSettings({ blockAt: 0.4 }), "string", "review level must stay below the block level");
assert.equal(typeof cleanCheckSettings({ blockAt: 1.5 }), "string");
assert.equal(typeof cleanCheckSettings({ teenBlockAt: 0.95 }), "string", "teens can't be looser than adults");
assert.equal(typeof cleanCheckSettings({ strikesToSuspend: 0 }), "string");
assert.equal(typeof cleanCheckSettings({ windowDays: 2.5 }), "string");
assert.equal(typeof cleanCheckSettings({ suspendDays: 400 }), "string");

// ── Deciding one finding ──
assert.equal(decideOne(F("none", 1), adult), "pass");
assert.equal(decideOne(F("sexual", 0.9), adult), "block");
assert.equal(decideOne(F("sexual", 0.85), adult), "block", "at the level is a block");
assert.equal(decideOne(F("sexual", 0.71), adult), "hold", "borderline goes to a person");
assert.equal(decideOne(F("sexual", 0.4), adult), "pass");
assert.equal(decideOne(F("unclear", 0), adult), "hold");
// Teens: stricter.
assert.equal(decideOne(F("sexual", 0.71), teen), "block");
assert.equal(decideOne(F("drugs", 0.35), teen), "hold");
assert.equal(decideOne(F("drugs", 0.35), adult), "pass");
// News, medical and art in context: a person decides, not an outright block; never for sexual content or hate, nor for teens.
assert.equal(decideOne(F("violence", 0.95, "picture 1", "news"), adult), "hold");
assert.equal(decideOne(F("gore", 0.95, "picture 1", "medical"), adult), "hold");
assert.equal(decideOne(F("sexual", 0.95, "picture 1", "art"), adult), "block");
assert.equal(decideOne(F("hate", 0.95, "text", "news"), adult), "block");
assert.equal(decideOne(F("violence", 0.95, "picture 1", "news"), teen), "block");
// Child safety.
assert.equal(decideOne(F("csam", 0.9, "picture 1"), adult), "csam");
assert.equal(decideOne(F("csam", 0.5, "picture 1"), adult), "csam_review");
assert.equal(decideOne(F("csam", 0.1, "picture 1"), adult), "pass");

// ── Deciding a post: the most serious wins, then the surer one ──
assert.deepEqual(decide([], adult), { outcome: "pass" });
let d = decide([F("violence", 0.6, "text"), F("sexual", 0.9, "picture 2"), F("drugs", 0.95, "picture 1")], adult);
assert.equal(d.outcome, "block"); assert.equal(d.finding?.category, "drugs");
d = decide([F("sexual", 0.99, "picture 1"), F("csam", 0.85, "picture 2")], adult);
assert.equal(d.outcome, "csam"); assert.equal(d.finding?.item, "picture 2");
d = decide([F("sexual", 0.6, "picture 1"), F("weapons", 0.7, "text")], adult);
assert.equal(d.outcome, "hold"); assert.equal(d.finding?.category, "weapons");

// ── The checker's answer ──
const parsed = parseFindings({ findings: [
  { item: "picture 1", category: "sexual", confidence: 1.4, context: "art", reason: "x".repeat(400) },
  { item: "picture 9", category: "spam", confidence: "nope", context: "?" },
] }, ["text", "picture 1"]);
assert.equal(parsed[0].confidence, 1); assert.equal(parsed[0].context, "art"); assert.equal(parsed[0].reason.length, 300);
assert.equal(parsed[1].category, "unclear"); assert.equal(parsed[1].item, "text"); assert.equal(parsed[1].confidence, 0); assert.equal(parsed[1].context, "none");
assert.deepEqual(parseFindings(null, ["text"]), []);
assert.deepEqual(parseFindings({ findings: "x" }, ["text"]), []);

// ── Strikes ──
const now = new Date("2026-11-15T12:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const st = (ats: number[], extra: Partial<Standing> = {}): Standing => ({ strikes: ats.map((n, i) => ({ flagId: `f${i}`, at: day(n), category: "sexual", kind: "moment" })), ...extra });
assert.equal(activeStrikes(st([1, 40, 89, 91]).strikes, now, 90).length, 3, "a strike counts for 90 days");
assert.equal(activeStrikes([{ flagId: "a", at: day(1), category: "x", kind: "media", removed: true }], now, 90).length, 0, "an overturned strike doesn't count");
assert.equal(afterStrike(st([0]), now, S), "none");
assert.equal(afterStrike(st([0, 10]), now, S), "none");
assert.equal(afterStrike(st([0, 10, 80]), now, S), "suspend", "three in 90 days");
assert.equal(afterStrike(st([0, 10, 95]), now, S), "none", "one is too old");
assert.equal(afterStrike(st([0], { suspensions: 1 }), now, S), "ban", "a further strike after a suspension is a ban");
assert.equal(afterStrike(st([0], { banned: true }), now, S), "ban");
assert.equal(afterStrike(st([0, 1]), now, { ...S, strikesToSuspend: 2 }), "suspend", "the figure comes from Admin");
assert.equal(postingPausedUntil(st([], { postingSuspendedUntil: day(-3) }), now), day(-3));
assert.equal(postingPausedUntil(st([], { postingSuspendedUntil: day(1) }), now), null, "a pause that has ended");
assert.equal(postingPausedUntil(undefined, now), null);

// ── Communities: warned first, then closed ──
assert.equal(communityStep(2, false, 3), "none");
assert.equal(communityStep(3, false, 3), "warn");
assert.equal(communityStep(4, true, 3), "close");

// ── Words ──
assert.equal(itemWords("picture 2"), "photo 2");
assert.equal(itemWords("video 1"), "the video");
assert.equal(itemWords("text"), "the text");
assert.equal(findingWords({ category: "sexual", item: "picture 1" }), "sexual content in photo 1");
assert.equal(blockedTitle("picture 1"), "This photo can't be posted");
assert.equal(blockedTitle("text"), "This can't be published");
assert.match(blockedMessage({ category: "sexual", item: "picture 1" }, { n: 1, of: 3, windowDays: 90 }, "none"), /sexual content in photo 1\. Your post was not published and nobody saw it\. This is strike 1 of 3\. Strikes clear after 90 days\./);
assert.match(blockedMessage({ category: "hate", item: "text" }, { n: 3, of: 3, windowDays: 90 }, "suspend", "2026-11-29T12:00:00.000Z"), /posting is paused until 29 Nov/);
assert.match(blockedMessage({ category: "hate", item: "text" }, null, "ban"), /suspended because this happened again/);
assert.match(heldMessage({ category: "violence", item: "picture 1" }), /may be violence in photo 1.*isn't a strike/);
assert.equal(excerpt("![x](https://a/b.jpg) **Hello**   world"), "Hello world");
assert.deepEqual(markdownImages("a ![](https://x/1.webp) b ![c](https://x/2.jpg) ![d](http://insecure/3.jpg) ![](https://x/1.webp)"), ["https://x/1.webp", "https://x/2.jpg"]);

// ── The error and how a browser reads it ──
const e = new ContentCheckError(422, { outcome: "blocked", title: "T", message: "M", flagId: "f1", item: "picture 1" });
assert.ok(isContentCheckError(e)); assert.equal(e.message, "M");
assert.deepEqual(contentCheckBody(e), { error: "M", contentCheck: e.detail });
const browser = apiError({ error: "M", contentCheck: e.detail }, "x");
assert.equal(browser.message, "M"); assert.equal(contentCheckOf(browser)?.flagId, "f1");
assert.equal(contentCheckOf(apiError({}, "fallback")), null);
assert.equal(apiError({}, "fallback").message, "fallback");
assert.equal(isContentCheckError(new Error("x")), false);

console.log("ALL OK");
