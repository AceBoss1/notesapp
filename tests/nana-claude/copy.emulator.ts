// The Nana on Claude copy on the Firestore emulator (lib/nana-claude-server.ts): the dry run writes nothing, a download is remembered,
// and a price changed in Admin → Pricing or an article written by the team shows as a change. Run: npm run test:nana-claude-server.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const S = await import("../../lib/nana-claude-server");
  const { readCopy } = await import("../../lib/nana-claude");
  const { saveArticle, clearKbCache } = await import("../../lib/kb-server");
  const { DEFAULT_PRICING } = await import("../../lib/pricing");
  const { savePricing } = await import("../../lib/pricing-server");

  // ---- the dry run before any copy: says so, and writes nothing ----
  const first = await S.claudeCopyCheck(db);
  assert.equal(first.last, null); assert.equal(first.gaps.never, true); assert.ok(first.total > 100);
  assert.equal((await db.doc("serverConfig/nanaClaudeCopy").get()).exists, false, "checking never writes");

  // ---- a download: a valid copy file, no team-only articles, remembered ----
  const copy = await S.claudeCopyExport(db, "owner@x.test", new Date("2026-11-17T09:00:00Z"));
  assert.deepEqual(readCopy(JSON.parse(JSON.stringify(copy))), copy, "the page accepts what Admin downloads");
  assert.equal(copy.articles.length, first.total); assert.ok(!copy.articles.some((a) => a.slug.startsWith("hub-")));
  assert.match(copy.system, /^You are Nana AI/); assert.match(copy.siteUrl, /^https:\/\//);
  const after = await S.claudeCopyCheck(db);
  assert.equal(after.gaps.upToDate, true); assert.deepEqual(after.last, { at: "2026-11-17T09:00:00.000Z", byEmail: "owner@x.test", total: first.total });

  // ---- the team writes an article, and corrects a built-in one ----
  await saveArticle(db, "care@x.test", { title: "Nana on Claude: what it is", category: "Getting started", body: "A page on claude.ai where Nana answers from a copy of these articles." });
  await saveArticle(db, "care@x.test", { slug: "gifts", title: "Gifts", category: "Publishing and earning", body: "Gifts, rewritten by the team with a new rule about refunds." });
  let now = await S.claudeCopyCheck(db);
  assert.deepEqual(now.gaps.added, ["Nana on Claude: what it is"]); assert.deepEqual(now.gaps.changed, ["Gifts"]); assert.equal(now.gaps.instructions, true, "the list of articles Nana is given changed");

  // ---- a price changes in Admin → Pricing: the articles that quote it show as changed ----
  await S.claudeCopyExport(db, "owner@x.test");
  assert.equal((await S.claudeCopyCheck(db)).gaps.upToDate, true);
  await savePricing(db, { uid: "o", email: "owner@x.test", owner: true, super: true }, { ...DEFAULT_PRICING, pro: { ...DEFAULT_PRICING.pro, monthlyKobo: 7_500 * 100, yearlyKobo: 75_000 * 100 } });
  clearKbCache();
  now = await S.claudeCopyCheck(db);
  assert.ok(now.gaps.changed.some((t) => /plans|pric/i.test(t)), `the plans article shows as changed: ${now.gaps.changed.join(", ")}`);
  assert.equal(now.gaps.added.length, 0);
  assert.match((await S.claudeCopyExport(db, "owner@x.test")).articles.find((a) => a.slug === "plans-and-prices")!.body, /₦7,500\/month/, "the copy quotes the saved price");
  console.log("NANA CLAUDE SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
