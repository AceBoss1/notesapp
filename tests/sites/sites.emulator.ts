// Member sites against the Firestore emulator (lib/site-server.ts): saving the content sections and colour set, and applying a kit,
// each checked against the member's plan. Run: npm run test:sites-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SiteError, applyKit, readSite, saveSite } from "../../lib/site-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re: RegExp) => {
  await assert.rejects(p, (e: unknown) => e instanceof SiteError && e.status === status && re.test(e.message));
};

(async () => {
  await db.doc("users/reader").set({ uid: "reader", username: "reader1", displayName: "Reader", role: "reader", accountTier: "standard" });
  await db.doc("users/basic").set({ uid: "basic", username: "ada", displayName: "Ada", role: "publisher", accountTier: "basic" });
  await db.doc("users/pro").set({ uid: "pro", username: "cakes", displayName: "Cakes by Tolu", role: "publisher", accountTier: "pro" });
  await db.doc("users/biz").set({ uid: "biz", username: "clinic", displayName: "Good Health Clinic", role: "publisher", accountTier: "business" });

  // No site below Free Basic.
  await fails(saveSite(db, "reader", { blocks: {} }), 403, /Free Basic/);
  await fails(applyKit(db, "reader", "personal"), 403, /Free Basic/);
  await fails(saveSite(db, "ghost", {}), 404, /not found/);

  // Free Basic: the Personal kit only; every content section; no own colour.
  await fails(applyKit(db, "basic", "food"), 403, /Pro/);
  await fails(applyKit(db, "basic", "nope"), 400, /Choose a kit/);
  const a = await applyKit(db, "basic", "personal");
  assert.equal(a.site.kit, "personal");
  const u = (await db.doc("users/basic").get()).data()!;
  assert.equal(u.siteTheme, a.theme); assert.deepEqual(u.siteSections, a.sections);
  const s1 = await saveSite(db, "basic", { blocks: { hero: { on: true, headline: "Hi, I'm Ada" }, team: { on: true, items: [{ name: "Bisi" }] } } });
  assert.equal(s1.blocks.hero.headline, "Hi, I'm Ada");
  assert.equal(s1.blocks.team.on, true); assert.equal(s1.blocks.team.items[0].name, "Bisi");
  await fails(saveSite(db, "basic", { palette: { id: "forest", custom: "#123456" } }), 403, /Pro/);
  assert.equal((await saveSite(db, "basic", { palette: { id: "forest" } })).palette.id, "forest");
  assert.equal(s1.palette.id, a.site.palette.id, "the colour set is kept when only the words change");

  // Pro: the Food kit keeps the member's own words, own colour allowed; the stored order is cleaned.
  await saveSite(db, "pro", { blocks: { hero: { headline: "Tolu's cakes" } }, palette: { id: "royal", custom: "#2a7f62" } });
  const f = await applyKit(db, "pro", "food");
  assert.equal(f.site.blocks.hero.headline, "Tolu's cakes");
  assert.equal(f.site.palette.custom, undefined, "a kit brings its own colour set");
  const o = await saveSite(db, "pro", { order: ["faq", "hero", "faq", "bogus"] });
  assert.equal(o.order[0], "faq"); assert.equal(new Set(o.order).size, o.order.length);
  assert.equal((await readSite(db, "pro")).kit, "food", "a save keeps the kit");
  await fails(applyKit(db, "pro", "church"), 403, /Business/);

  // Business: every kit, Team on.
  const h = await applyKit(db, "biz", "healthcare");
  assert.equal(h.site.blocks.team.on, true);
  assert.equal((await db.doc("sites/biz").get()).data()!.uid, "biz");

  // A downgrade: a custom colour already stored is dropped on the next save rather than refused.
  await db.doc("users/pro").update({ accountTier: "basic" });
  await db.doc("sites/pro").update({ palette: { id: "ocean", custom: "#2a7f62" } });
  const d = await saveSite(db, "pro", { blocks: { hero: { headline: "Still mine" } } });
  assert.equal(d.palette.custom, undefined); assert.equal(d.palette.id, "ocean");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
