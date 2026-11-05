// The help, the pricing table and the publishers' commission lines quote what an admin saved, not the built-in defaults (owner, 2 Nov
// 2026: "help should not hardwire figures that can be changed from admin limits/pricing"). A non-default config is saved in a stand-in
// database, loaded the way the help centre loads it (lib/kb-server.ts getArticles), and the articles must show the new numbers and not
// the old ones. A guard then reads lib/kb-articles.ts for literal percentages and naira amounts equal to an admin default.
// Run: npm run test:help → "ALL OK".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import { COMMISSION_ROW_LABEL, DEFAULT_PRICING, applyPricing, cleanPricing, commissionCell, type PricingConfig } from "../../lib/pricing";
import { TIERS, getTierConfig, commissionRateFor } from "../../lib/tiers";
import { getArticles, clearKbCache } from "../../lib/kb-server";
import { builtInArticles } from "../../lib/kb-articles";
import { academyFaq } from "../../lib/academy-faq";
import { commissionLine, myRates } from "../../lib/my-rates";
import { resetLimitCache } from "../../lib/limits-server";
import { resetAgentSettingsCache } from "../../lib/agents/config-server";
import { resetRecordingSettingsCache } from "../../lib/live-recording-server";
import { PLAN_SHARE } from "../../lib/referrals";
import { resetRoomSettingsCache } from "../../lib/rooms-server";
import { resetFanCaches } from "../../lib/fans-server";

const ROOT = join(__dirname, "..", "..");
const defaults = builtInArticles();
const body = (list: { slug: string; body: string }[], slug: string) => {
  const a = list.find((x) => x.slug === slug);
  assert.ok(a, `article ${slug}`);
  return a.body;
};

// ── A saved config that differs from every default it touches ───────────────────────────────────────────────────────────────────────
const cfg = structuredClone(DEFAULT_PRICING) as PricingConfig;
cfg.basic.session = 0.31; cfg.pro.session = 0.22; cfg.business.session = 0.12; cfg.enterprise.floorSession = 0.04;
cfg.pro.monthlyKobo = 6_000 * 100; cfg.pro.yearlyKobo = 54_000 * 100; // 3 months free
cfg.badgeKobo = 1_234 * 100;
cfg.inventory.addonMonthlyKobo = 1_750 * 100;
cfg.logistics.cutRate = 0.12;
cfg.coursePackages.certificateMinKobo = 1_111 * 100;
cfg.nana.resetEvery = "day";
// Animated gifts and the daily target (Admin → Pricing → Gifts).
cfg.gifts.catalogue[3].name = "Party Jollof"; cfg.gifts.catalogue[3].priceKobo = 1_250 * 100; cfg.gifts.catalogue[1].enabled = false;
cfg.gifts.daily = { targetKobo: 65_000 * 100, slots: 4, basis: "net", minSenders: 5 };
cfg.gifts.grand = { fromKobo: 40_000 * 100, announce: true }; // Golden Gele (₦25,000) is then over the ₦20,000 cap: still ✔; Kente (₦50,000) the first VIP
cfg.gifts.uplift = { premiumPct: 15, vipPct: 25 };
cfg.gifts.economy = { quantityMax: 40, autoWithdrawMaxKobo: 35_000 * 100 }; // gifting everywhere: the "How many?" cap and the withdrawal line
cfg.liveTicketUpliftPct = 12; // paid lives (Admin → Pricing → Gifts)
cfg.ppmUpliftPct = 27; // pay-per-minute sessions (Admin → Pricing → Gifts)
const limits = { messageVoiceNoteSeconds: { standard: 240, basic: 240, pro: 240, business: 240, enterprise: 240 }, coursesPerMember: { basic: 12 }, nanaOperator: { pro: 1 }, replayPublish: { standard: 0, basic: 0 }, mediaVideosPerWeek: { pro: 9 }, mediaVideoMaxSeconds: { pro: 240 }, mediaPicturePostsPerDay: { business: 33 }, mediaStorageGB: { enterprise: 0 } };
const agents = { actionsPerDay: 150, discountCapNaira: 3_000, linkCodeMinutes: 7, weeklySummaryWeekday: 3, draftHours: 72 };
const saved: Record<string, unknown> = {
  "platformSettings/pricing": { config: cfg },
  "serverConfig/limits": { overrides: limits },
  "serverConfig/agents": { overrides: agents },
  "serverConfig/recording": { overrides: { keepDays: 21, maxHours: 3 } },
  "serverConfig/fans": { overrides: { vipMin: 6_000, vvipMax: 450_000, vipUpliftPct: 15 } },
  // Audio rooms' Live mode (Admin → Limits → Audio rooms → Live): the help quotes these, never the defaults.
  "serverConfig/rooms": { overrides: { videoBudgetMinutes: 22, videoGraceSeconds: 40, dropPercent: 15, dropWindowMinutes: 4, videoBurstMinutes: 6, videoTryMinutes: 3, lateWindowMin: 25, liveDiscountMaxPct: 40, paidNoShowMin: 45, ppmMinMinutes: 15, ppmMaxMinutes: 120, ppmGraceSec: 45, ppmTopUpWaitSec: 90, ppmNoShowMin: 30 } },
};
// Just enough of Firestore for the loaders: doc(path).get() and an empty kbArticles collection.
const db = {
  doc: (p: string) => ({ get: async () => ({ exists: p in saved, data: () => saved[p] }) }),
  collection: () => ({ get: async () => ({ docs: [] }) }),
} as unknown as Firestore;

(async () => {
  assert.deepEqual(cleanPricing(structuredClone(cfg)), cfg, "the test config passes the admin form's checks");
  clearKbCache(); resetLimitCache(); resetAgentSettingsCache(); resetRoomSettingsCache(); resetRecordingSettingsCache(); resetFanCaches();
  const live = await getArticles(db);

  // Commission on paid sessions, subscriptions and gifts (one rate), per plan.
  const rates = body(live, "commission-rates");
  for (const x of ["31%", "22%", "12%", "from 4%"]) assert.ok(rates.includes(x), `commission-rates shows ${x}`);
  for (const x of ["35%", "25%", "15%"]) assert.ok(!rates.includes(x), `commission-rates no longer shows the default ${x}`);
  assert.match(rates, /paid sessions, journal subscriptions and gifts to you/);
  assert.match(rates, /giving\*\* to a community \(its funds\) has no commission/, "community giving is kept apart");
  for (const slug of ["paid-sessions", "subscriptions", "gifts"]) {
    const b = body(live, slug);
    assert.ok(b.includes("31% on Free Basic") && b.includes("22% on Pro") && b.includes("12% on Business"), `${slug} quotes the live rates`);
    assert.ok(!b.includes("35%"), `${slug} has no default rate`);
  }
  // Subscription tiers (Admin → Limits → Subscriptions and fans).
  const subs = body(live, "subscriptions");
  for (const x of ["**VIP** (₦6,000 to ₦200,000)", "**VVIP** (₦10,000 to ₦450,000)", "your rate plus 15% of it", "your rate plus 20% of it", "9.2% and 9.6%"]) assert.ok(subs.includes(x), `subscriptions shows ${x}`);
  for (const x of ["₦5,000 to ₦200,000", "₦500,000)", "plus 10% of it"]) assert.ok(!subs.includes(x), `subscriptions no longer shows ${x}`);
  // Animated gifts and Top gifted today.
  const gifts = body(live, "gifts");
  for (const x of ["**Party Jollof** (a plate to share): ₦1,250", "₦65,000 after commission", "at least 5 different people", "the 4 who received the most", "choose one of 13 named gifts", "Gifts marked ✔ (from ₦25,000)", "Each gift from ₦40,000 is also announced"]) assert.ok(gifts.includes(x), `gifts shows ${x}`);
  for (const x of ["Jollof Plate", "Kola Nut", "₦50,000 or more", "at least 3 different", "from ₦25,000 is also announced"]) assert.ok(!gifts.includes(x), `gifts no longer shows ${x}`);
  assert.ok(body(defaults, "gifts").includes("**Jollof Plate** (a plate to share): ₦5,000") && body(defaults, "gifts").includes("₦50,000 or more"), "the defaults were different");
  // The extra commission on premium and VIP gifts follows Admin too.
  assert.ok(gifts.includes("your rate plus 15% of it") && gifts.includes("your rate plus 25% of it") && gifts.includes("a premium gift is charged 9.2%"), "gift commission share is live");
  assert.ok(body(defaults, "gifts").includes("your rate plus 10% of it") && body(defaults, "gifts").includes("a VIP gift 9.6%"), "the default shares");
  // Gifting everywhere: the quantity cap and the withdrawal line follow Admin → Pricing → Gifts, in the gifts and payouts articles.
  for (const x of ["send 1 to 40 of it", "Under ₦35,000 is paid automatically; ₦35,000 and over is approved"]) assert.ok(gifts.includes(x), `gifts shows ${x}`);
  assert.ok(body(live, "payouts").includes("Under ₦35,000 is paid automatically"), "payouts shows the live withdrawal line");
  for (const x of ["send 1 to 99", "₦20,000 is paid automatically"]) assert.ok(!gifts.includes(x), `gifts no longer shows ${x}`);
  assert.ok(body(defaults, "gifts").includes("send 1 to 99 of it") && body(defaults, "gifts").includes("Under ₦20,000 is paid automatically"), "the default cap and line");
  // Prices.
  assert.ok(body(live, "verified-badge").includes("₦1,234") && !body(live, "verified-badge").includes("₦999"), "badge price");
  const plans = body(live, "plans-and-prices");
  assert.ok(plans.includes("₦6,000/month") && plans.includes("₦54,000 a year (three months free)"), "Pro price and months free");
  assert.ok(!plans.includes("₦5,000/month") && !plans.includes("₦50,000 a year"), "no default Pro price");
  assert.ok(plans.includes("₦1,111"), "certificate minimum");
  assert.ok(body(live, "inventory").includes("₦1,750") && !body(live, "inventory").includes("₦1,500"), "inventory add-on");
  assert.ok(body(live, "logistics-network").includes("12%") && !body(live, "logistics-network").includes(" 10% "), "logistics cut");
  assert.match(body(live, "nana-gems-and-credit"), /refreshes every day/, "Nana's allowance timer");
  assert.ok(!body(live, "nana-gems-and-credit").includes("Monday"));
  // Limits (Admin → Limits) and the agent settings.
  assert.ok(body(live, "messages-moments-groups").includes("voice notes of up to 4 minutes"), "voice note limit");
  assert.ok(body(live, "academy").includes("Up to 12 to 30 courses depending on your plan"), "courses per member");
  // Media (Admin → Limits, group "Media").
  const media = body(live, "media");
  assert.ok(media.includes("**Pro:** 9 videos a week, each up to 4 minutes"), "Media videos and length per plan");
  assert.ok(media.includes("33 picture posts a day") && media.includes("**Enterprise:**") && media.includes("no storage limit"), "picture posts and storage");
  assert.ok(!media.includes("**Pro:** 7 videos a week") && !media.includes("each up to 3 minutes; 20"), "no default Media figures for Pro");
  assert.ok(body(defaults, "media").includes("**Pro:** 7 videos a week, each up to 3 minutes; 20 picture posts a day; 20 GB of storage"), "the defaults read as proposed in docs/MEDIA.md");
  assert.ok(body(defaults, "media").includes("**Free Standard:** no videos; 5 picture posts a day; 1 GB of storage"));
  const connect = body(live, "connect-an-ai-assistant");
  assert.ok(connect.includes("150 by default") && connect.includes("₦3,000 by default") && connect.includes("Codes last 7 minutes"), "agent limits");
  assert.ok(!connect.includes("100 by default") && !connect.includes("₦2,000 by default"), "no default agent limits");
  const inbox = body(live, "nanas-inbox");
  assert.ok(inbox.includes("Wednesdays, 07:00") && inbox.includes("expires after 3 days") && inbox.includes("(Pro, Business and Enterprise)"), "Nana's jobs settings");
  // Live recording (Admin → Limits → Live recording, and the "Audio rooms and live" plan switches).
  const recording = body(live, "live-recording-and-replays");
  assert.ok(recording.includes("Kept 21 days, then deleted") && recording.includes("up to 3 hours"), "the keep days and the longest recording");
  assert.ok(!recording.includes("30 days") && !recording.includes("4 hours"), "no default keep days or length");
  assert.ok(recording.includes("hosts on every plan can") && recording.includes("hosts on Pro, Business and Enterprise can"), "who can record and who can publish");
  assert.ok(body(defaults, "live-recording-and-replays").includes("Kept 30 days"), "the default was different");
  // Audio rooms' Live mode.
  const rooms = body(live, "community-audio-rooms");
  for (const x of ["22 video minutes", "40 seconds later", "fall by 15% or more within 4 minutes", "Try 3 minutes of video?", "for 6 minutes in a row"]) assert.ok(rooms.includes(x), `audio rooms help: ${x}`);
  for (const x of ["15 video minutes", "30 seconds later", "Try 2 minutes"]) assert.ok(!rooms.includes(x), `audio rooms help has no default: ${x}`);
  // Paid lives (Admin → Pricing: liveTicketUpliftPct; Admin → Limits → Audio rooms → Paid lives: the late window, discount cap, no-show).
  const paidLives = body(live, "paid-lives");
  for (const x of ["until the live has run 25 minutes", "from 0% up to 40%", "within 45 minutes of its time", "plus 12% of it"]) assert.ok(paidLives.includes(x), `paid lives help: ${x}`);
  for (const x of ["run 20 minutes", "up to 50%", "within 60 minutes", "plus 10% of it"]) assert.ok(!paidLives.includes(x), `paid lives help has no default: ${x}`);
  assert.ok(body(defaults, "paid-lives").includes("run 20 minutes") && body(defaults, "paid-lives").includes("plus 10% of it"), "the paid-lives defaults were different");
  assert.ok(body(live, "subscriptions").includes("from 0% up to 40%"), "the tier discount cap in the subscriptions help");
  assert.ok(body(live, "commission-rates").includes("plus 12% of it"), "the paid-live share in the commission help");
  // Pay-per-minute sessions (Admin → Pricing: ppmUpliftPct; Admin → Limits → Pay-per-minute sessions: the minutes, grace, wait, no-show).
  const ppm = body(live, "pay-per-minute");
  for (const x of ["at least 15, up to 120 when booking", "within the first 45 seconds", "ends 90 seconds later", "30 minutes after its time", "plus 27% of it"]) assert.ok(ppm.includes(x), `pay-per-minute help: ${x}`);
  for (const x of ["at least 10,", "up to 240", "first 60 seconds", "60 seconds later", "60 minutes after its time", "plus 20% of it"]) assert.ok(!ppm.includes(x), `pay-per-minute help has no default: ${x}`);
  const ppmDefaults = body(defaults, "pay-per-minute");
  for (const x of ["at least 10, up to 240", "first 60 seconds", "60 seconds later", "plus 20% of it"]) assert.ok(ppmDefaults.includes(x), `the pay-per-minute defaults were different: ${x}`);
  assert.ok(body(live, "commission-rates").includes("[pay-per-minute session](/help/pay-per-minute), #NotesApp takes your rate above plus 27% of it"), "the pay-per-minute share in the commission help");
  assert.ok(body(live, "payouts").includes("**Pay-per-minute sessions:**"), "pay-per-minute in the payouts help");
  // Fixed in code (not an admin setting) but quoted from the constant: the referral share.
  assert.ok(body(live, "referrals").includes(`${Math.round(PLAN_SHARE * 100)}% of what your friend pays`));
  // The defaults really were different (so the checks above prove something).
  assert.ok(body(defaults, "commission-rates").includes("35%") && body(defaults, "verified-badge").includes("₦999"));

  // The pricing table's commission row and the plan cards, after the same load.
  assert.equal(COMMISSION_ROW_LABEL, "Commission: paid sessions, journal subscriptions and gifts to you");
  assert.match(commissionCell(getTierConfig("basic")), /^NotesApp takes 31% of each · community giving and event tickets: no commission, a flat charge$/);
  assert.match(commissionCell(getTierConfig("enterprise")), /Custom \(from 4%\+\)/);
  assert.equal(commissionCell(getTierConfig("standard")), "—");
  assert.equal(TIERS.find((t) => t.tier === "pro")!.price, "₦6,000/month");

  // A publisher's own line (/booking, /bookings, Rates & payouts, /gifts), and Enterprise's agreed rate.
  assert.equal(commissionLine(myRates("pro"), "session"), "NotesApp takes 22% of each paid session (your plan: Pro).");
  assert.equal(commissionLine(myRates("basic"), "gift"), "NotesApp takes 31% of each gift to you (your plan: Free Basic).");
  assert.equal(commissionLine(myRates("enterprise", { session: 0.07 }), "subscription"), "NotesApp takes 7% of each journal subscription payment (your plan: Enterprise, your agreed rate).");
  assert.equal(commissionRateFor("enterprise"), 0.04, "Enterprise without an agreed rate: the floor");
  assert.equal(myRates("standard").canPublish, false, "a reader sees no commission line");

  // The Notes Academy questions.
  assert.ok(academyFaq().some((f) => f.a.includes("₦1,111")) && academyFaq().some((f) => f.a.includes("refreshes every day")));

  // A change saved later is picked up without waiting for the help's minute-long cache.
  const cfg2 = structuredClone(cfg); cfg2.basic.session = 0.33;
  applyPricing(cfg2);
  assert.ok(body(await getArticles(db, Date.now() + 1), "commission-rates").includes("33%"), "the help is rebuilt when a figure changes, not after its minute-long cache");
  applyPricing(DEFAULT_PRICING);
  clearKbCache();

  // ── Pages that show these figures load the saved config before drawing ────────────────────────────────────────────────────────
  for (const p of ["pricing", "gifts", "booking", "badges", "store-selling", "community", "advertise", "boost", "logistics", "organisations", "books"]) {
    const src = readFileSync(join(ROOT, "app/(main)", p, "page.tsx"), "utf8");
    assert.match(src, /await loadLivePricing\(\)/, `/${p} applies the saved pricing before rendering`);
    assert.match(src, /export const revalidate = 60;/, `/${p} is redrawn each minute, not built once`);
  }
  for (const p of ["help/page.tsx", "help/[slug]/page.tsx"]) assert.match(readFileSync(join(ROOT, "app/(main)", p), "utf8"), /getArticles\(/, `${p} uses the loader`);
  assert.match(readFileSync(join(ROOT, "lib/kb-server.ts"), "utf8"), /ensurePricing\(db\)/, "the help loader applies the saved pricing");

  // ── Guard: no literal in the help equal to an admin default ───────────────────────────────────────────────────────────────────────
  // Template expressions (${…}) are live; what's left is literal text. Allowed literals, each with its reason:
  const ALLOW: { text: string; why: string }[] = [
    { text: "a percentage (1% to", why: "the lowest discount percentage is 1 by definition (the highest is MAX_PERCENT, quoted live)" },
    { text: "(15% more)", why: "Notes Life: the VIP bar's mark-up, a game price" },
    { text: "₦100 to ₦100,000 at a time", why: "Notes Life: buying game money, fixed by the game's rules" },
    { text: "₦45,000", why: "an example of what a seller says to Nana (\"Sold 3 bags of rice ₦45,000…\"), not a price" },
    { text: "₦250,000 in", why: "the influencer challenge's prize split, fixed and not live yet" },
    { text: "a ₦1,000,000 giveaway", why: "the influencer challenge's prize, fixed and not live yet (it happens to equal the largest animated gift)" },
    { text: "and ₦500,000 cash", why: "the influencer challenge's prize split, fixed (it happens to equal an animated gift's price)" },
  ];
  const src = readFileSync(join(ROOT, "lib/kb-articles.ts"), "utf8");
  const start = src.indexOf("export function builtInArticles");
  // Drop each ${…} that holds no template of its own (so the words inside `${X_LIVE ? `…` : ""}` are still read).
  const text = src.slice(start).replace(/\$\{[^`{}]*(?:\{[^`{}]*\}[^`{}]*)*\}/g, "«live»");
  const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;
  const percent = (r: number) => `${+(r * 100).toFixed(1)}%`;
  const d = DEFAULT_PRICING;
  const pctDefaults = new Set([d.basic, d.pro, d.business].flatMap((r) => [r.session, r.physical, r.digital, r.adShare]).concat([d.enterprise.adShare, d.enterprise.floorSession, d.enterprise.floorPhysical, d.enterprise.floorDigital, d.logistics.cutRate, d.certificateLate.weeklyRate, d.certificateLate.capRate]).filter((r) => r > 0).map(percent));
  const koboDefaults = [d.pro.monthlyKobo, d.pro.yearlyKobo, d.business.monthlyKobo, d.business.yearlyKobo, d.enterprise.fromMonthlyKobo, d.enterprise.fromYearlyKobo, d.coursePackages.enterpriseCoursesMonthlyKobo, d.coursePackages.academyApiFromMonthlyKobo, d.coursePackages.certificateMinKobo, d.logistics.addonMonthlyKobo, d.logistics.cutMinKobo, d.inventory.addonMonthlyKobo, d.badgeKobo, d.gold.personal.monthlyKobo, d.gold.personal.depositKobo, d.gold.corporate.monthlyKobo, d.gold.corporate.depositKobo, ...Object.values(d.nana.budgets), ...d.nana.topUps.flatMap((t) => [t.priceKobo, t.creditKobo]), ...d.boosts.map((b) => b.priceKobo), ...d.ads.map((a) => a.priceKobo), ...d.gifts.catalogue.map((g) => g.priceKobo), d.gifts.daily.targetKobo, d.gifts.economy.autoWithdrawMaxKobo];
  const nairaDefaults = new Set(koboDefaults.map(naira));
  const found: string[] = [];
  let scanned = 0;
  for (const line of text.split("\n")) {
    for (const m of line.matchAll(/₦[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%/g)) {
      const v = m[0].replace(/,$/, "");
      scanned++;
      if (!(pctDefaults.has(v) || nairaDefaults.has(v))) continue;
      const around = line.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 40);
      if (ALLOW.some((a) => a.text.includes(v) && line.includes(a.text))) continue;
      found.push(`${v}: …${around}…`);
    }
  }
  assert.ok(scanned > 20, `the guard read the literal figures (${scanned})`);
  assert.deepEqual(found, [], "literal figures in lib/kb-articles.ts that equal an admin default (quote the live value instead, or allow it with a reason)");
  console.log("ALL OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
