// Nana sets up your site and Review my site: the pure rules (lib/site-nana.ts, lib/site-review.ts).
// Run: npm run test:site-nana → "ALL OK".
import assert from "node:assert/strict";
import { emptyBlocks, kitOf, DEFAULT_ORDER, type SiteDoc } from "../../lib/site-kits";
import {
  SKIPPED, applyDraft, applyRewrite, canDraft, changesOf, cleanDraft, cleanRead, defaultReplace, draftContext, draftSystem, factsOk, keepToFacts,
  knownLine, nextQuestion, numbersIn, parseJson, phoneGiven, questionsFor, sourceText, undoOpen, type Answers, type Known,
} from "../../lib/site-nana";
import { reviewSite, reviewTitle, type ReviewInput } from "../../lib/site-review";

const NOW = new Date("2026-11-17T10:00:00Z");
const site = (over: Partial<SiteDoc> = {}): SiteDoc => ({ kit: "", palette: { id: "crimson" }, blocks: emptyBlocks(), order: DEFAULT_ORDER, bookBelowPosts: false, orcid: null, cover: "", ...over });
const known: Known = { name: "Ada's Oven", bio: "", shop: [{ title: "Red velvet cake", priceKobo: 2_500_000 }], bookingHours: "Tue to Sat, 9 AM to 5 PM" };
const none: Known = { name: "Ada", bio: "", shop: [], bookingHours: "" };

// ── Numbers: what counts as given ──
assert.deepEqual([...numbersIn("Birthday cakes from 25k. Cupcakes 12,000 for a box of 12. ₦1.2m wedding")].sort((a, b) => a - b), [12, 12000, 25000, 1200000]);
assert.ok(numbersIn("₦25,000").has(25000));
assert.ok(factsOk("From ₦25,000", numbersIn("from 25k")));
assert.ok(!factsOk("₦30,000", numbersIn("from 25k")));
assert.ok(factsOk("No numbers here", new Set()));
assert.equal(keepToFacts("We bake to order. Over 10 years of experience. Delivered across Enugu.", numbersIn("")), "We bake to order. Delivered across Enugu.");
assert.equal(keepToFacts("We bake to order. Since 1998.\n\nWe have 3 awards.\n\nTell us the day.", numbersIn("")), "We bake to order.\n\nTell us the day.", "paragraphs stay");
assert.ok(phoneGiven("+2348031234567", "call me on 0803 123 4567"));
assert.ok(!phoneGiven("08099999999", "call me on 0803 123 4567"));
assert.ok(!phoneGiven("123", "123"));

// ── The questions ──
const qs = questionsFor(known);
assert.equal(qs.length, 9);
assert.equal(qs[2].id, "use");
assert.equal(qs[2].q, "I found 1 item in your shop and your booking hours (Tue to Sat, 9 AM to 5 PM). Shall I use them?");
assert.equal(questionsFor(none).length, 8);
assert.equal(knownLine(none), "");
assert.equal(nextQuestion(qs, {}), 0);
assert.equal(nextQuestion(qs, { what: "x", where: SKIPPED }), 2);
assert.equal(nextQuestion(qs, Object.fromEntries(qs.map((q) => [q.id, "x"]))), -1);
assert.equal(canDraft({ what: "Cakes" }), false);
assert.equal(canDraft({ what: SKIPPED, offer: "a", reach: "b" }), false);
assert.equal(canDraft({ what: "Cakes", use: "Yes, use them" }), false); // "use" isn't an answer about them
assert.equal(canDraft({ what: "Cakes", offer: "Birthday cakes 25k" }), true);

// ── Account facts only count when the member said to use them ──
const yes: Answers = { what: "I bake cakes in Enugu", use: "Yes, use them", offer: "Birthday cakes from 25k. Cupcakes 12k for a box of 12. Wedding cakes depend on the tiers.", reach: "Tue to Sat. Call 0803 123 4567" };
assert.ok(sourceText(yes, known).includes("₦25,000"));
assert.ok(!sourceText({ ...yes, use: "No, start fresh" }, known).includes("Red velvet"));

// ── Nana's draft made safe ──
const can = { book: false, shop: true };
const ctx = (tier: string, facts = true) => ({ tier, can, source: sourceText(yes, known), now: NOW, facts });
const nana = {
  kit: "food", theme: "luxe", palette: "sunset",
  why: { kit: "You sell by occasion.", look: "Cakes want a photo.", button: "Orders are what you want." },
  button: { kind: "shop", label: "Order a cake" }, second: { kind: "book", label: "Book a tasting" },
  sections: ["hero", "services", "testimonials", "gallery", "info", "faq", "bogus"],
  hero: { eyebrow: "Welcome to Ada's Oven", headline: "Cakes worth the photo, baked in Enugu.", subline: "Made to order. Trusted by 500 families." },
  services: [
    { group: "Cakes", name: "Birthday cake", price: "From ₦25,000", minutes: 0, note: "" },
    { group: "Cakes", name: "Cupcakes, box of 12", price: "₦12,000", minutes: 0, note: "" },
    { group: "Cakes", name: "Wedding cake", price: "From ₦150,000", minutes: 0, note: "" },
    { group: "Small chops", name: "Small chops platter", price: "", minutes: 45, note: "" },
  ],
  faq: [{ q: "How far ahead should I order?", a: "At least 3 days for cakes." }, { q: "Do you deliver?", a: "Yes, across Enugu." }],
  info: { hours: "Tue to Sat", phone: "08031234567", whatsapp: "08099999999", email: "made.up@example.com", address: "" },
  about: "We bake every cake to order in our kitchen in Enugu. We have won 3 awards.\n\nTell us the day, and we'll do the rest.",
};
const pro = cleanDraft(parseJson("Here you go:\n```json\n" + JSON.stringify(nana) + "\n```"), ctx("pro"));
assert.equal(pro.kit, "food");
assert.equal(pro.theme, "luxe");
assert.equal(pro.wanted, null);
assert.deepEqual(pro.services.map((s) => s.price), ["From ₦25,000", "₦12,000", "", ""], "a price the member never gave is dropped");
assert.equal(pro.services[3].minutes, undefined, "a duration the member never gave is dropped");
assert.equal(pro.hero.subline, "Made to order.", "an invented number is taken out of a sentence");
assert.deepEqual(pro.faq.map((f) => f.q), ["Do you deliver?"], "an answer with a made-up number is left out");
assert.equal(pro.info.phone, "08031234567");
assert.equal(pro.info.whatsapp, "", "a number they didn't type is dropped");
assert.equal(pro.info.email, "", "an email they didn't type is dropped");
assert.ok(!pro.about.includes("awards"));
assert.ok(pro.about.includes("Tell us the day"));
assert.ok(!pro.order.includes("testimonials"), "Nana never sets up testimonials");
assert.deepEqual(pro.order, ["hero", "services", "gallery", "info", "faq"]);
assert.equal(pro.button.kind, "shop");
assert.equal(pro.second?.kind, "contact", "Book with bookings off becomes Contact us");
assert.equal(pro.second?.label, "Contact us");
assert.ok(Object.values(pro.keep).every(Boolean));

// The plan doesn't cover the kit or the look: the nearest covered choice, with Nana's first choice kept to show.
const basic = cleanDraft(nana, ctx("basic"));
assert.equal(basic.kit, "personal");
assert.equal(basic.theme, "clean");
assert.deepEqual(basic.wanted, { kit: "food", theme: "luxe" });
const unknown = cleanDraft({ ...nana, kit: "spaceships", theme: "neon", palette: "plaid" }, ctx("pro"));
assert.deepEqual([unknown.kit, unknown.theme, unknown.palette], ["personal", "clean", "crimson"]);
// No shop items and no bookings: a Shop button becomes Contact us.
assert.equal(cleanDraft(nana, { ...ctx("pro"), can: { book: false, shop: false } }).button.kind, "contact");
// The member's own edits aren't fact-checked: their words are theirs.
const edited = cleanDraft({ ...pro, services: [{ name: "Wedding cake", price: "From ₦150,000" }], hero: { ...pro.hero, subline: "Trusted by 500 families." } }, ctx("pro", false), pro);
assert.equal(edited.services[0].price, "From ₦150,000");
assert.equal(edited.hero.subline, "Trusted by 500 families.");
assert.equal(edited.createdAt, pro.createdAt);

// What Nana is told: the kits a plan doesn't cover are marked, and the rules are there.
const sysBasic = draftSystem("basic");
assert.ok(sysBasic.includes("\"food\": Food") && sysBasic.includes("needs Pro"));
assert.ok(sysBasic.includes("Never invent a price"));
assert.ok(draftContext(qs, yes, known, "pro", can).includes("Shop item: Red velvet cake, ₦25,000"));
assert.ok(!draftContext(qs, { ...yes, use: "No" }, known, "pro", can).includes("Red velvet"));
assert.throws(() => parseJson("sorry, no"));

// ── What will change, and putting it on ──
const food = kitOf("food")!;
// A site still on the Food kit's sample words: replacing them is the default; the member's own About is kept unless they allow it.
const sampleSite = site({ kit: "food", blocks: { ...emptyBlocks(), hero: { on: true, headline: food.starter.headline, subline: food.starter.subline, image: "", button: food.starter.button, second: null }, services: { on: true, items: food.starter.services! } } });
const cur = { site: sampleSite, about: "I started baking in my mother's kitchen.", theme: "luxe" };
const rep = defaultReplace(cur);
assert.deepEqual([rep.hero, rep.services, rep.faq, rep.info, rep.about], [true, true, true, true, false]);
const changes = changesOf(cur, pro);
assert.deepEqual(changes.map((c) => `${c.part}:${c.kind}`), ["hero:replace", "services:replace", "faq:fill", "info:fill", "about:replace"]);
assert.equal(changes[0].was, food.starter.headline);
assert.equal(changes[0].now, "Cakes worth the photo, baked in Enugu.");
const put = applyDraft(cur, pro, {}, "pro");
assert.equal(put.site.blocks.hero.headline, "Cakes worth the photo, baked in Enugu.");
assert.equal(put.site.blocks.hero.button?.label, "Order a cake");
assert.equal(put.site.blocks.services.items.length, 4);
assert.equal(put.about, null, "their own About stays unless they switch it on");
assert.equal(applyDraft(cur, pro, { about: true }, "pro").about, pro.about);
assert.equal(put.theme, "luxe");
assert.equal(put.site.palette.id, "sunset");
assert.equal(put.site.blocks.gallery.on, false, "a section with nothing in it isn't switched on");
assert.equal(put.site.blocks.faq.on, true);
assert.equal(put.site.blocks.info.phone, "08031234567");
// Skipped parts aren't used, and the kit's sample prices never come in with the kit.
const skipped = applyDraft({ site: site(), about: "", theme: "legacy" }, { ...pro, keep: { ...pro.keep, services: false, about: false } }, {}, "pro");
assert.equal(skipped.site.blocks.services.items.length, 0);
assert.equal(skipped.site.blocks.services.on, false);
assert.equal(skipped.about, null);
// Their own headline stays unless they allow it.
const own = { site: site({ blocks: { ...emptyBlocks(), hero: { on: true, headline: "Welcome to my page", subline: "", image: "", button: null, second: null } } }), about: "", theme: "clean" };
assert.equal(defaultReplace(own).hero, false);
assert.equal(applyDraft(own, pro, {}, "pro").site.blocks.hero.headline, "Welcome to my page");
assert.equal(applyDraft(own, pro, {}, "pro").site.blocks.hero.button?.label, "Order a cake", "a missing button is still added");
assert.equal(applyDraft(own, pro, { hero: true }, "pro").site.blocks.hero.headline, "Cakes worth the photo, baked in Enugu.");
assert.throws(() => applyDraft(own, pro, {}, "basic"), /Pro/);

// ── Undo window ──
assert.ok(undoOpen("2026-10-20T10:00:00Z", NOW));
assert.ok(!undoOpen("2026-10-17T09:00:00Z", NOW));
assert.ok(!undoOpen(undefined, NOW));

// ── Nana's read ──
const live = put.site;
const read = cleanRead({
  rewrites: [{ field: "headline", now: "Birthday and wedding cakes in Enugu", why: "Says what you sell." }, { field: "headline", now: "dup" }, { field: "subline", now: "Over 200 cakes a month." }, { field: "about", now: "x" }],
  tips: ["Add a price to the wedding cake.", "You have 9,000 followers."],
}, live, "");
assert.deepEqual(read.rewrites.map((r) => r.field), ["headline"]);
assert.equal(read.rewrites[0].was, "Cakes worth the photo, baked in Enugu.");
assert.deepEqual(read.tips, ["Add a price to the wedding cake."]);
assert.equal(applyRewrite(live, "headline", "Birthday and wedding cakes in Enugu").blocks.hero.headline, "Birthday and wedding cakes in Enugu");
assert.throws(() => applyRewrite(live, "subline", "  "));

// ── Review my site ──
const base = (s: SiteDoc, over: Partial<ReviewInput> = {}): ReviewInput => ({ site: s, theme: "clean", tier: "pro", sections: { journals: true, shop: false, courses: false, track: false }, pages: { about: "", contact: "" }, shopItems: 0, bookingOn: false, ...over });
const empty = reviewSite(base(site()));
assert.deepEqual(empty.findings.map((f) => f.id), ["no-banner", "no-contact", "no-about"]);
assert.equal(reviewTitle(3), "3 things are holding visitors back");
assert.equal(reviewTitle(1), "1 thing is holding visitors back");
assert.equal(reviewTitle(0), "Nothing is holding visitors back");

// The baker's site from the mockups: no button, prices missing, Luxe with no photo, no contacts, no About.
const bakerBlocks = { ...emptyBlocks(), hero: { on: true, headline: "Welcome to my page", subline: "", image: "", button: null, second: null },
  services: { on: true, items: [{ name: "Birthday cake", price: "₦25,000", note: "" }, { name: "Cupcakes", price: "₦12,000", note: "" }, { name: "Wedding cake", price: "", note: "" }, { name: "Small chops", price: "", note: "" }, { name: "Chin chin", price: "", note: "" }] },
  gallery: { on: true, items: [] } };
const baker = reviewSite(base(site({ kit: "food", blocks: bakerBlocks }), { theme: "luxe", sections: { journals: false, shop: true, courses: false, track: false }, shopItems: 6 }));
assert.deepEqual(baker.findings.map((f) => f.id), ["no-button", "no-prices", "no-photo", "no-contact", "no-hours", "no-about", "empty-gallery"]);
assert.equal(baker.findings[1].title, "3 of 5 items on your price list have no price");
assert.equal(baker.findings[1].weight, "high");
assert.ok(baker.fine.includes("shop"));

// Dead-end buttons and the kit's sample words and prices.
const kitted = reviewSite(base(sampleSite, { pages: { about: "Hi", contact: "Email me" } }));
assert.ok(kitted.findings.some((f) => f.id === "dead-button-1" && f.why === "“Order now” opens your shop, but there's nothing in it to buy." && f.fix.at === "shop"));
assert.ok(kitted.findings.some((f) => f.id === "starter-banner"));
assert.ok(kitted.findings.some((f) => f.id === "starter-prices" && f.weight === "high"));
const book = site({ blocks: { ...emptyBlocks(), hero: { on: true, headline: "Hair by Tolu", subline: "", image: "", button: { kind: "book", label: "Book now", value: "" }, second: { kind: "call", label: "Call us", value: "" } } } });
const bk = reviewSite(base(book, { pages: { about: "x", contact: "y" } }));
assert.deepEqual(bk.findings.filter((f) => f.id.startsWith("dead")).map((f) => [f.id, f.fix.at]), [["dead-button-1", "booking"], ["dead-button-2", "content"]]);
assert.deepEqual(reviewSite(base(book, { bookingOn: true, pages: { about: "x", contact: "y" } })).findings.filter((f) => f.id.startsWith("dead")).map((f) => f.id), ["dead-button-2"]);
// A finished site has nothing to say.
const done = site({ kit: "personal", blocks: { ...emptyBlocks(), hero: { on: true, headline: "Tolu writes", subline: "", image: "", button: { kind: "contact", label: "Get in touch", value: "" }, second: null }, info: { on: true, hours: "", bookingHours: false, whatsapp: "", phone: "", email: "t@x.ng", address: "", mapUrl: "" } } });
assert.deepEqual(reviewSite(base(done, { pages: { about: "About me", contact: "" } })).findings, []);

console.log("ALL OK");
