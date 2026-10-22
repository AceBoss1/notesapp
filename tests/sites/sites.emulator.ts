// Member sites against the Firestore emulator (lib/site-server.ts): saving the content sections and colour set, and applying a kit,
// each checked against the member's plan. Run: npm run test:sites-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SiteError, applyKit, bookingOf, linkCommunity, readSite, saveSite } from "../../lib/site-server";
import { setOrcid, syncOrcidFor, syncOrcidSites } from "../../lib/publications-server";

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

  // Free Basic: the Academics kit and the academic sections (phase 3).
  const sc = await applyKit(db, "basic", "scholar");
  assert.equal(sc.theme, "scholar"); assert.equal((await db.doc("users/basic").get()).data()!.siteTheme, "scholar");
  const pub = await saveSite(db, "basic", { blocks: { ...sc.site.blocks, talks: { on: true, items: [{ title: "Keynote", place: "Nairobi, Kenya" }] } } });
  assert.equal(pub.blocks.talks.items[0].lat, -1.29);

  // Background, "Book me" under posts, and the booking calendar's hours.
  const w = await saveSite(db, "basic", { palette: { id: "forest", bg: "white" }, bookBelowPosts: true });
  assert.deepEqual(w.palette, { id: "forest", bg: "white" }); assert.equal(w.bookBelowPosts, true);
  assert.equal((await saveSite(db, "basic", { blocks: { hero: { on: true, headline: "x" } } })).bookBelowPosts, true, "kept when other things are saved");
  assert.equal((await applyKit(db, "basic", "personal")).site.palette.bg, "white", "a kit keeps the background");
  assert.deepEqual(await bookingOf(db, "basic"), { offered: false, hours: "" });
  await db.doc("publisherSettings/basic").set({ session: { enabled: true, minutes: 60, priceKobo: 500000, availability: { "1": ["09:00", "16:00"], "2": ["09:00", "16:00"] } } });
  assert.deepEqual(await bookingOf(db, "basic"), { offered: true, hours: "Mon–Tue, 9:00 AM to 5:00 PM" });
  await db.doc("publisherSettings/basic").update({ "session.enabled": false });
  assert.equal((await bookingOf(db, "basic")).offered, false, "sessions off: no booking link");

  // ORCID: link with sync; the daily sync adds new works once, keeps the member's own, and a later save keeps the link.
  await fails(setOrcid(db, "reader", { orcid: "0000-0002-1825-0097", sync: true }), 403, /Free Basic/);
  await fails(setOrcid(db, "basic", { orcid: "0000-0002-1825-0098", sync: true }), 400, /ORCID/);
  assert.deepEqual(await setOrcid(db, "basic", { orcid: "https://orcid.org/0000-0002-1825-0097", sync: true }), { id: "0000-0002-1825-0097", sync: true });
  await saveSite(db, "basic", { blocks: { ...(await readSite(db, "basic")).blocks, publications: { on: false, items: [{ title: "My own paper", note: "Best paper" }] } } });
  const works = async () => [{ title: "My own paper", authors: "", venue: "", year: "2020", url: "", note: "" }, { title: "A new paper", authors: "K", venue: "Nature", year: "2026", url: "https://doi.org/10.1/new", note: "" }];
  const now2 = new Date("2026-10-22T06:00:00Z");
  assert.equal(await syncOrcidSites(db, now2, works), 1);
  let st = await readSite(db, "basic");
  assert.deepEqual(st.blocks.publications.items.map((x) => x.title), ["My own paper", "A new paper"]); assert.equal(st.blocks.publications.on, true);
  assert.equal(st.blocks.publications.items[0].note, "Best paper");
  assert.equal(await syncOrcidSites(db, new Date("2026-10-22T10:00:00Z"), works), 0, "not again within 20 hours");
  assert.equal(await syncOrcidFor(db, "basic", new Date("2026-10-23T10:00:00Z"), works), 0, "nothing new");
  await saveSite(db, "basic", { palette: { id: "royal" } });
  st = await readSite(db, "basic");
  assert.equal(st.orcid?.id, "0000-0002-1825-0097", "saving the site keeps the ORCID link");
  assert.equal((await saveSite(db, "basic", { cover: "https://img.test/cover.jpg" })).cover, "https://img.test/cover.jpg");
  assert.equal((await saveSite(db, "basic", { palette: { id: "gold" } })).cover, "https://img.test/cover.jpg", "kept by other saves");
  assert.equal((await applyKit(db, "basic", "personal")).site.cover, "https://img.test/cover.jpg", "and by a kit");
  // Churches and NGOs: link a community the member runs (owner or admin); a plain member can't; other saves keep the link.
  await db.doc("communityMembers/grace-chapel_biz").set({ cid: "grace-chapel", uid: "biz", role: "owner", status: "active" });
  await db.doc("communityMembers/youth-club_biz").set({ cid: "youth-club", uid: "biz", role: "member", status: "active" });
  assert.equal((await applyKit(db, "biz", "church")).site.kit, "church");
  await fails(linkCommunity(db, "biz", "youth-club"), 403, /owner or admins/);
  await fails(linkCommunity(db, "biz", "Not A Slug!"), 400, /wasn't found/);
  assert.equal((await linkCommunity(db, "biz", "grace-chapel")).community, "grace-chapel");
  await saveSite(db, "biz", { palette: { id: "forest" } });
  assert.equal((await applyKit(db, "biz", "church")).site.community, "grace-chapel", "kept by saves and kits");
  assert.equal((await linkCommunity(db, "biz", "grace-chapel", new Date(), false)).communityPage, false, "the page switched off");
  assert.equal((await linkCommunity(db, "biz", "grace-chapel")).communityPage, false, "and it stays off when nothing is said");
  assert.equal((await saveSite(db, "biz", { palette: { id: "forest" } })).communityPage, false, "other saves keep it");
  assert.equal((await linkCommunity(db, "biz", "grace-chapel", new Date(), true)).communityPage, true);
  assert.equal((await linkCommunity(db, "biz", "")).community, "", "unlinked");
  assert.equal(await setOrcid(db, "basic", { orcid: null }), null);
  assert.equal((await readSite(db, "basic")).orcid, null);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
