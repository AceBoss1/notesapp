// Course covers made with Nana (lib/covers.ts, lib/cover-render.tsx): the design check, reading the AI's answer, the daily limits and
// where they're set, Lagos days, the design made without the AI, and that every template's words fit for short and long titles.
// Run: npm run test:covers → "COVERS OK".
import assert from "node:assert/strict";
import {
  COVER_TEMPLATES, DEFAULT_COVER_LIMITS, HEADLINE_MAX, PALETTE_IDS, cleanSpec, coverDailyLimit, coverLimitFor, designFor, isCoverSpec, lagosDay, leftText,
  nextLagosMidnight, parseSpecReply, shorter, type CoverSpec,
} from "../../lib/covers";
import { DEFAULT_PRICING, PricingError, cleanPricing } from "../../lib/pricing";
import { SAMPLE_COVERS } from "../../lib/cover-samples";
import { measureCover, renderCoverPng, toWebp } from "../../lib/cover-render";

const base: CoverSpec = { template: "band", palette: "crimson", pattern: "adire", icon: "book", headline: "Excel for Small Business Owners", subline: "Sheets that save you hours", tag: "Beginner course", layout: "left" };

(async () => {
  // ── the design check ──
  assert.deepEqual(cleanSpec(base, base), { spec: base, fixed: [] }, "a good design passes unchanged");
  assert.ok(isCoverSpec(base));
  const odd = cleanSpec({ ...base, template: "hologram", palette: "MOSS", icon: "unicorn", layout: "diagonal" }, base);
  assert.equal(odd.spec.template, "band"); assert.equal(odd.spec.palette, "moss", "case doesn't matter"); assert.equal(odd.spec.icon, "book"); assert.equal(odd.spec.layout, "left");
  assert.deepEqual(odd.fixed.sort(), ["icon", "layout", "template"]);
  const long = cleanSpec({ ...base, headline: "A ".repeat(80) + "very long headline" }, base);
  assert.ok(long.spec.headline.length <= HEADLINE_MAX && long.fixed.includes("headline"), "a long headline is cut at a word");
  assert.equal(cleanSpec({ ...base, headline: "  <b>Hello</b>\u0000 {world}  " }, base).spec.headline, "b Hello /b world", "markup and control characters go");
  assert.equal(cleanSpec({ ...base, headline: "   " }, base).spec.headline, base.headline, "an empty headline keeps the base");
  assert.equal(cleanSpec({ ...base, subline: "" }, base).spec.subline, "", "no subline is allowed");
  assert.deepEqual(cleanSpec("nonsense", base).spec, base, "not an object → the base design");
  assert.equal(cleanSpec([1, 2], base).fixed.length, 8);

  // ── reading the AI's answer ──
  assert.deepEqual(parseSpecReply('{"template":"arch","palette":"teal"}'), { template: "arch", palette: "teal" });
  assert.deepEqual(parseSpecReply('Here you go:\n```json\n{"headline":"Use {braces} and \\"quotes\\"","tag":"x"}\n```\nEnjoy'), { headline: 'Use {braces} and "quotes"', tag: "x" });
  assert.equal(parseSpecReply("I can't do that."), null);
  assert.equal(parseSpecReply('{"template": "arch",'), null, "cut off");
  assert.equal(parseSpecReply("[1,2,3]"), null);

  // ── daily limits: the owner's numbers, and where an admin changes them ──
  assert.deepEqual(DEFAULT_COVER_LIMITS, { freeDaily: 0, basicDaily: 3, proDaily: 10, businessDaily: 25, enterpriseDaily: 50 });
  assert.equal(coverDailyLimit("standard"), 0, "Free can't publish");
  assert.equal(coverDailyLimit("basic"), 3, "Free Basic: 3 a day (1 + 2 edits, or 3 different)");
  assert.equal(coverDailyLimit("pro"), 10); assert.equal(coverDailyLimit("business"), 25); assert.equal(coverDailyLimit("enterprise"), 50);
  assert.equal(coverDailyLimit("standard", DEFAULT_COVER_LIMITS, true), 50, "admins get at least Enterprise's");
  assert.equal(coverLimitFor(["standard", "business"], DEFAULT_COVER_LIMITS, false), 25, "an organisation's course: the better plan");
  assert.equal(leftText(2, 3), "2 of 3 left today"); assert.equal(leftText(0, 0), "Not on your plan");
  assert.deepEqual(DEFAULT_PRICING.academyCovers, DEFAULT_COVER_LIMITS, "the pricing settings start from the owner's numbers");
  const clone = () => structuredClone(DEFAULT_PRICING) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const before = clone(); delete before.academyCovers;
  assert.deepEqual(cleanPricing(before).academyCovers, DEFAULT_COVER_LIMITS, "a config saved before covers keeps the defaults");
  const more = clone(); more.academyCovers.basicDaily = "5";
  assert.equal(cleanPricing(more).academyCovers.basicDaily, 5, "the admin form sends text");
  for (const bad of [-1, 2.5, 1000, "lots"]) { const c = clone(); c.academyCovers.proDaily = bad; assert.throws(() => cleanPricing(c), PricingError, `refuses ${bad}`); }

  // ── Lagos days ──
  assert.equal(lagosDay(new Date("2026-11-01T22:59:00Z")), "2026-11-01");
  assert.equal(lagosDay(new Date("2026-11-01T23:00:00Z")), "2026-11-02", "midnight in Lagos is 23:00 UTC");
  assert.equal(nextLagosMidnight(new Date("2026-11-01T10:00:00Z")).toISOString(), "2026-11-01T23:00:00.000Z");
  assert.equal(nextLagosMidnight(new Date("2026-11-01T23:30:00Z")).toISOString(), "2026-11-02T23:00:00.000Z");

  // ── a design without the AI (the fallback, and the development stand-in) ──
  const farm = designFor({ id: "c1", title: "AI for Farmers and Agribusiness", summary: "Weather and prices.", level: "beginner" });
  assert.equal(farm.icon, "wheat"); assert.equal(farm.headline, "AI for Farmers and Agribusiness"); assert.equal(farm.tag, "Beginner course");
  assert.equal(designFor({ title: "IT Support Training" }).icon, "headset");
  assert.equal(designFor({ title: "Cooking" }, { prompt: "something blue with a laptop" }).palette, "indigo");
  assert.equal(designFor({ title: "Cooking" }, { prompt: "something blue with a laptop" }).icon, "laptop");
  assert.equal(designFor({ title: "Any" }, { base, prompt: "make it green" }).palette, "moss");
  assert.equal(designFor({ title: "Any" }, { base, prompt: "make it green" }).icon, base.icon, "\"it\" and \"green\" don't change the icon");
  assert.equal(designFor({ title: "Any" }, { base, prompt: "add a laptop" }).icon, "laptop");
  assert.equal(designFor({ title: "Any" }, { base, prompt: "use kente" }).pattern, "kente");
  assert.equal(designFor({ title: "Any" }, { base, prompt: "flip it" }).layout, "right");
  assert.equal(designFor({ title: "Any" }, { base: { ...base, headline: "Excel: Formulas for Small Business Owners" }, prompt: "shorter headline" }).headline, "Excel");
  assert.notEqual(designFor({ title: "Any" }, { base, prompt: "hmm, not sure" }).template, base.template, "an edit always changes something");
  assert.equal(shorter("One Two Three Four Five Six"), "One Two Three");
  assert.notDeepEqual(designFor({ id: "x", title: "Same" }, { seed: 0 }), designFor({ id: "x", title: "Same" }, { seed: 3 }), "Try another varies");
  for (const s of SAMPLE_COVERS) assert.ok(isCoverSpec(s.spec), `${s.slug} is a valid design`);
  assert.equal(SAMPLE_COVERS.length, 9);

  // ── every template's words fit, with short and long titles and every layout ──
  const titles = ["Excel", "IT Support Training", "AI for NGOs, Churches and Public Organisations", "The Complete Practical Guide to Bookkeeping, Taxes, Payroll and Planning for Small Business"];
  let n = 0;
  for (const template of COVER_TEMPLATES) for (const headline of titles) for (const layout of ["left", "right", "center"] as const) {
    const spec: CoverSpec = { ...base, template, layout, headline, palette: PALETTE_IDS[n++ % PALETTE_IDS.length], subline: "A long subline that keeps going so it has to wrap onto a second line and then be cut short" };
    const m = await measureCover(spec);
    assert.ok(m.fitted.ok, `${template}/${layout}: "${headline}" fits`);
    assert.ok(m.fitted.lines.length <= m.maxLines, `${template}: at most ${m.maxLines} lines`);
    assert.ok(m.widest <= m.box.w, `${template}/${layout}: "${headline}" no wider than its box (${Math.round(m.widest)} > ${m.box.w})`);
    assert.ok(m.height <= m.box.h + 1, `${template}: "${headline}" no taller than its box (${Math.round(m.height)} > ${m.box.h})`);
    assert.ok(m.fitted.sub.lines.length <= 2, "the subline is at most two lines");
    if (headline === "Excel") assert.ok(m.fitted.size >= 96, `${template}: a short title is big (${m.fitted.size})`);
  }
  // A word too long for any box is cut, never left to run out.
  const huge = await measureCover({ ...base, template: "split", headline: "Supercalifragilisticexpialidociousnessmanagementologyistically" });
  assert.ok(huge.widest <= huge.box.w);

  // ── it draws, and makes WebP ──
  const { png } = await renderCoverPng(base);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  const webp = await toWebp(png);
  assert.ok(webp && webp.subarray(0, 4).toString() === "RIFF" && webp.subarray(8, 12).toString() === "WEBP" && webp.length < png.length, "WebP, smaller than the PNG");

  console.log("COVERS OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
