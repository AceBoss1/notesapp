// Nana sets up your site and Review my site on the server (lib/site-nana-server.ts) against the Firestore emulator: who may use it,
// answers kept as they come, Nana's draft kept to the facts, the plan's limits, the member's edits, putting the draft on the site and
// putting the old site back, the checklist, Nana's read and its numbers, and closing the account.
// Run: npm run test:site-nana-server → "ALL OK".
import assert from "node:assert/strict";
process.env.ANTHROPIC_API_KEY = "test-key"; // Nana on "our" account; the model is stubbed
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SiteNanaError } from "../../lib/site-nana";
import { answerQuestion, applySetup, editDraft, funnelOf, makeDraft, nanaRead, putBack, redoPart, restartSetup, setupView, siteReview, useRewrite } from "../../lib/site-nana-server";
import { kitOf } from "../../lib/site-kits";
import { eraseAccount } from "../../lib/account-server";
import { AiDown, type CompleteArgs, type NanaDeps } from "../../lib/nana-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const NOW = new Date("2026-11-17T10:00:00Z");
const refused = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => e instanceof SiteNanaError && e.status === status); };
const sent: CompleteArgs[] = [];
const queue: string[] = [];
const ai: NanaDeps = { now: () => NOW, complete: async (a) => { sent.push(a); return { text: queue.shift() ?? "{}", refused: false }; } };
const away: NanaDeps = { now: () => NOW, complete: async () => { throw new AiDown("busy"); } };

const DRAFT = {
  kit: "food", theme: "luxe", palette: "sunset", why: { kit: "You sell by occasion.", look: "Cakes want a photo.", button: "Orders first." },
  button: { kind: "shop", label: "Order a cake" }, second: { kind: "call", label: "Call us" },
  sections: ["hero", "services", "info", "faq"],
  hero: { eyebrow: "Welcome to Ada's Oven", headline: "Cakes worth the photo, baked in Enugu.", subline: "Birthday and wedding cakes, made to order. Rated 4.9 by 300 customers." },
  services: [{ group: "Cakes", name: "Birthday cake", price: "From ₦25,000" }, { group: "Cakes", name: "Wedding cake", price: "From ₦180,000" }],
  faq: [{ q: "Do you deliver?", a: "Yes, across Enugu." }],
  info: { hours: "Tue to Sat, 9 to 5", phone: "0803 123 4567", whatsapp: "", email: "", address: "Independence Layout, Enugu" },
  about: "I bake every cake to order in Enugu.",
};

(async () => {
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada's Oven", bio: "", role: "publisher", accountTier: "pro", siteTheme: "clean", siteSections: { journals: true, shop: true }, sitePages: { about: "I started in my mother's kitchen." } });
  await db.doc("users/u_bob").set({ username: "bob", displayName: "Bob", role: "reader", accountTier: "standard" });
  await db.doc("users/u_free").set({ username: "free", displayName: "Free", role: "publisher", accountTier: "basic" });
  await db.doc("storeItems/i1").set({ ownerUid: "u_ada", title: "Red velvet cake", priceKobo: 2_500_000, sellable: true });
  await db.doc("sites/u_ada").set({ uid: "u_ada", kit: "", blocks: { hero: { on: true, headline: "Welcome to my page", subline: "" } } });

  // Who may use it: members with a site.
  await refused(setupView(db, "u_bob"), 403);
  await refused(setupView(db, "u_none"), 404);
  const v0 = await setupView(db, "u_ada", NOW);
  assert.equal(v0.questions.length, 9, "the shop item adds the 'use them' question");
  assert.deepEqual(v0.known, { shop: 1, bookingHours: "" });
  assert.deepEqual(v0.can, { book: false, shop: true });
  assert.equal(v0.next, 0);
  assert.equal(v0.draft, null);
  assert.equal(v0.undo, null);

  // Answers are kept as they come; a skip counts; Nana isn't called until the draft.
  await refused(answerQuestion(db, "u_ada", { q: "what", text: "   " }, NOW), 400);
  await refused(answerQuestion(db, "u_ada", { q: "nope", text: "x" }, NOW), 400);
  await refused(makeDraft(db, "u_ada", ai), 409);
  await answerQuestion(db, "u_ada", { q: "what", text: "I bake cakes and small chops for birthdays and weddings in Enugu." }, NOW);
  await answerQuestion(db, "u_ada", { q: "where", skip: true }, NOW);
  await answerQuestion(db, "u_ada", { q: "use", text: "Yes, use them" }, NOW);
  await answerQuestion(db, "u_ada", { q: "offer", text: "Birthday cakes from 25k. Wedding cakes depend on the tiers." }, NOW);
  const v1 = await answerQuestion(db, "u_ada", { q: "reach", text: "Tue to Sat, 9 to 5. Call 0803 123 4567. Independence Layout, Enugu." }, NOW);
  assert.equal(v1.answered, 5);
  assert.equal(v1.next, 5);
  assert.equal(v1.canDraft, true);
  assert.equal(sent.length, 0);

  // Nana away: the answers stay, and the member is told to try later.
  await refused(makeDraft(db, "u_ada", away), 503);
  assert.equal((await setupView(db, "u_ada", NOW)).answered, 5);

  // Nana's draft, kept to the facts.
  queue.push(JSON.stringify(DRAFT));
  const v2 = await makeDraft(db, "u_ada", ai);
  assert.equal(sent.length, 1);
  const told = sent[0].system.map((s) => s.text).join("\n") + sent[0].messages.map((m) => m.content).join("\n");
  assert.ok(told.includes("Shop item: Red velvet cake, ₦25,000"));
  assert.ok(told.includes("Never invent a price"));
  assert.ok(!told.includes("u_ada"), "Nana isn't given the member's id");
  const d = v2.draft!;
  assert.equal(d.kit, "food");
  assert.deepEqual(d.services.map((s) => s.price), ["From ₦25,000", ""], "₦180,000 was never given");
  assert.equal(d.hero.subline, "Birthday and wedding cakes, made to order.", "the made-up rating is gone");
  assert.equal(d.info.phone, "08031234567");
  assert.equal(d.second?.kind, "call");
  assert.deepEqual(v2.changes.map((c) => `${c.part}:${c.kind}`), ["hero:replace", "services:fill", "faq:fill", "info:fill", "about:replace"]);
  assert.equal(v2.replace.hero, false, "their own headline is kept unless they say");

  // "Try another" for the banner changes only the banner, and is fact-checked too.
  queue.push(JSON.stringify({ hero: { eyebrow: "", headline: "Birthday and wedding cakes in Enugu", subline: "Since 1998." } }));
  const v3 = await redoPart(db, "u_ada", "hero", ai);
  assert.equal(v3.draft!.hero.headline, "Birthday and wedding cakes in Enugu");
  assert.equal(v3.draft!.hero.subline, "");
  assert.deepEqual(v3.draft!.services, d.services);
  await refused(redoPart(db, "u_ada", "services", ai), 400);

  // The member's edits: their price stays (their words), Skip is kept.
  const v4 = await editDraft(db, "u_ada", { ...v3.draft, services: [...d.services.slice(0, 1), { group: "Cakes", name: "Wedding cake", price: "From ₦180,000" }], keep: { ...v3.draft!.keep, faq: false } }, NOW);
  assert.equal(v4.draft!.services[1].price, "From ₦180,000");
  assert.equal(v4.draft!.keep.faq, false);
  assert.equal(v4.draft!.why.kit, "You sell by occasion.");

  // Put it on: the headline is replaced because they switched it on; the old site is kept.
  const v5 = await applySetup(db, "u_ada", { hero: true }, NOW);
  assert.equal(v5.draft, null);
  assert.deepEqual(v5.undo, { at: NOW.toISOString(), days: 30 });
  const live = (await db.doc("sites/u_ada").get()).data()!;
  assert.equal(live.kit, "food");
  assert.equal(live.blocks.hero.headline, "Birthday and wedding cakes in Enugu");
  assert.equal(live.blocks.hero.button.label, "Order a cake");
  assert.equal(live.blocks.services.items[1].price, "From ₦180,000");
  assert.equal(live.blocks.faq.on, false, "skipped and empty: not switched on");
  assert.equal(live.blocks.services.items.length, 2, "none of the kit's sample prices came in");
  const u = (await db.doc("users/u_ada").get()).data()!;
  assert.equal(u.siteTheme, "luxe");
  assert.equal(u.sitePages.about, "I started in my mother's kitchen.", "their About stays: they didn't allow it");
  assert.equal(u.siteSections.shop, true);
  assert.ok((await setupView(db, "u_ada", NOW)).answered === 5, "the answers stay for next time");

  // The checklist on the live site: free, no Nana.
  const callsBefore = sent.length;
  const r = await siteReview(db, "u_ada");
  assert.equal(sent.length, callsBefore);
  assert.deepEqual(r.findings.map((f) => f.id), ["no-photo"], "Luxe with no photo is all that's left");
  await refused(siteReview(db, "u_bob"), 403);

  // Nana's read: the numbers, and a rewrite she can't pad with a made-up number.
  await db.doc("ownerViews/u_ada_20261110").set({ uid: "u_ada", day: "2026-11-10", count: 40, pages: { "profile:ada": 30, "item:i1": 10 } });
  await db.doc("ownerViews/u_ada_20260901").set({ uid: "u_ada", day: "2026-09-01", count: 999, pages: {} }); // too old
  await db.doc("storeOrders/o1").set({ sellerUid: "u_ada", paidAt: "2026-11-12T10:00:00.000Z", status: "paid" });
  await db.doc("storeOrders/o2").set({ sellerUid: "u_ada", paidAt: "2026-11-13T10:00:00.000Z", status: "refunded" });
  const f = await funnelOf(db, "u_ada", "pro", NOW);
  assert.deepEqual([f.visits, f.shopViews, f.orders, f.bookings, f.pages], [40, 10, 1, 0, null], "visits by page are Business and above");
  assert.equal((await funnelOf(db, "u_ada", "business", NOW)).pages![0].label, "Your site's home");
  queue.push(JSON.stringify({ rewrites: [{ field: "subline", now: "Cakes for 1,000 weddings.", why: "x" }, { field: "headline", now: "Cakes for birthdays and weddings, Enugu", why: "Says what you sell." }], tips: ["Add a photo of your best cake."] }));
  const nr = await nanaRead(db, "u_ada", ai);
  assert.deepEqual(nr.read.rewrites.map((x) => x.field), ["headline"]);
  assert.ok(sent[sent.length - 1].messages[0].content.includes("40 visits, 10 looks at shop items, 1 paid orders"));
  await useRewrite(db, "u_ada", "headline", nr.read.rewrites[0].now, NOW);
  assert.equal((await db.doc("sites/u_ada").get()).data()!.blocks.hero.headline, "Cakes for birthdays and weddings, Enugu");
  await refused(useRewrite(db, "u_ada", "about", "x", NOW), 400);

  // Put my old site back, within 30 days.
  await refused(putBack(db, "u_ada", new Date("2026-12-20T10:00:00Z")), 409);
  await putBack(db, "u_ada", NOW);
  const back = (await db.doc("sites/u_ada").get()).data()!;
  assert.equal(back.blocks.hero.headline, "Welcome to my page");
  assert.equal(back.kit, "");
  assert.equal((await db.doc("users/u_ada").get()).data()!.siteTheme, "clean");
  await refused(putBack(db, "u_ada", NOW), 409);

  // Free Basic: Nana's choice of a Pro kit becomes Personal and creators, with what she wanted kept to show.
  await answerQuestion(db, "u_free", { q: "what", text: "I bake cakes" }, NOW);
  await answerQuestion(db, "u_free", { q: "offer", text: "Birthday cakes from 25k" }, NOW);
  queue.push(JSON.stringify(DRAFT));
  const fv = await makeDraft(db, "u_free", ai);
  assert.deepEqual([fv.draft!.kit, fv.draft!.theme, fv.draft!.wanted], ["personal", "clean", { kit: "food", theme: "luxe" }]);
  assert.equal(fv.draft!.button.kind, "contact", "no shop: Order becomes Contact us");
  assert.equal(fv.draft!.info.phone, "", "no phone given");
  await applySetup(db, "u_free", {}, NOW);
  assert.equal((await db.doc("sites/u_free").get()).data()!.kit, "personal");
  assert.ok(!kitOf("personal")!.starter.services, "and Personal brings no sample prices");

  // Start again clears the answers and the draft.
  const rs = await restartSetup(db, "u_free", NOW);
  assert.deepEqual([rs.answered, rs.draft], [0, null]);

  // Closing the account deletes the setup.
  await eraseAccount(db, "u_ada").catch(() => {});
  assert.equal((await db.doc("siteSetups/u_ada").get()).exists, false);

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
