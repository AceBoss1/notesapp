// Sites (lib/site-themes.ts, lib/site-kits.ts): who has a site and which looks, colour sets, content made safe, what visitors see, buttons,
// and kits that never wipe the member's words. Run: npm run test:sites → "ALL OK".
import assert from "node:assert/strict";
import { backgroundOf, canHaveSite, meetsTier, paletteRgb, paletteVars, themeAllowed } from "../../lib/site-themes";
import { KITS, applyKitTo, cleanEmail, cleanFocus, durationText, isBeautyKit, bookingHoursText, buttonHref, byYear, cleanBlocks, cleanButton, cleanOrder, cleanPalette, kitAllowed, kitOf, resolveButton, shopStyleOf, siteDocOf, sortItems, visibleBlocks } from "../../lib/site-kits";
import { siteSectionsShown } from "../../lib/site-settings";
import { placeCoords } from "../../lib/places";
import { landDots } from "../../lib/globe-land";

const u = (accountTier: string, role = "publisher") => ({ username: "x", role, accountTier }) as never;
// Who has a site, and the looks
assert.equal(canHaveSite(u("standard", "reader")), false);
assert.equal(canHaveSite(u("basic")), true); assert.equal(canHaveSite(u("pro")), true);
assert.equal(themeAllowed("clean", "basic"), true); assert.equal(themeAllowed("legacy", "basic"), true);
assert.equal(themeAllowed("aurora", "basic"), false); assert.equal(themeAllowed("maroon", "pro"), true);
assert.ok(meetsTier("enterprise", "business")); assert.ok(!meetsTier("pro", "business"));

// Colour sets: presets for all, a custom colour from Pro, too-light colours darkened
{ const v = paletteVars(null, "basic"); assert.deepEqual([v["--c-crimson"], v["--c-crimson-bright"], v["--c-crimson-deep"]], ["122 3 40", "166 9 61", "78 1 25"], "the default is #NotesApp's own crimson"); }
assert.equal(paletteVars({ id: "forest" }, "basic")["--c-crimson"], "16 110 74");
assert.equal(paletteVars({ id: "forest", custom: "#123456" }, "basic")["--c-crimson"], "16 110 74", "Free Basic can't use a custom colour");
assert.equal(paletteVars({ id: "forest", custom: "#123456" }, "pro")["--c-crimson"], "18 52 86");
const light = paletteRgb({ custom: "#ffff66" }, "pro").base;
assert.ok((0.2126 * light[0] + 0.7152 * light[1] + 0.0722 * light[2]) / 255 <= 0.56, "a pale yellow is darkened so white text stays readable");
assert.deepEqual(cleanPalette({ id: "nope", custom: "red" }), { id: "crimson" });

// Content made safe
const b = cleanBlocks({
  hero: { on: true, headline: "  Fresh   cakes ", subline: "x".repeat(500), image: "javascript:alert(1)", button: { kind: "whatsapp", label: "", value: "0803 123 4567" }, second: { kind: "link", value: "http://insecure" } },
  info: { on: true, hours: "Mon–Sat", whatsapp: "+234 803 000 0000", mapUrl: "https://evil.example/maps" },
  services: { on: true, items: [{ name: "Cake", price: "₦25,000" }, { name: "" }, ...Array.from({ length: 50 }, (_, i) => ({ name: `S${i}` }))] },
  gallery: { on: true, items: [{ image: "https://media.notesapp.name.ng/a.jpg", caption: "Shop" }, { image: "data:image/png;base64,xx" }] },
  faq: { on: true, items: [{ q: "Q?", a: "" }, { q: "Delivery?", a: "Yes" }] },
  extra: { on: true },
});
assert.equal(b.hero.headline, "Fresh cakes"); assert.equal(b.hero.subline.length, 240); assert.equal(b.hero.image, "", "only https pictures");
assert.deepEqual(b.hero.button, { kind: "contact", label: "Contact us", value: "" }, "an Order on WhatsApp button saved before becomes Contact us");
assert.equal(b.hero.second, null, "an http link is refused");
assert.equal(b.info.whatsapp, "+2348030000000"); assert.equal(b.info.mapUrl, "", "only Google Maps links");
assert.equal(b.services.items.length, 40, "empty rows dropped, then the limit"); assert.equal(b.services.items[0].name, "Cake");
assert.equal(b.gallery.items.length, 1); assert.deepEqual(b.faq.items, [{ q: "Delivery?", a: "Yes" }]);
assert.equal((b as unknown as Record<string, unknown>).extra, undefined);
assert.deepEqual(cleanOrder(["faq", "faq", "nope", "hero"]).slice(0, 3), ["faq", "hero", "info"]);
assert.equal(cleanButton({ kind: "link", value: "" }), null);
assert.deepEqual(cleanButton({ kind: "call", value: "" }), { kind: "call", label: "Call us", value: "" }, "a Call button may use the strip's number");

// Buttons
const info = { on: true, hours: "", bookingHours: false, whatsapp: "08031234567", phone: "", address: "", mapUrl: "" };
assert.equal(buttonHref(resolveButton({ kind: "call", label: "x", value: "" }, { ...info, phone: "08031234567" })!, ""), "tel:08031234567");
assert.equal(resolveButton({ kind: "call", label: "x", value: "" }, { ...info, whatsapp: "" }), null, "no number anywhere: no button");
assert.equal(buttonHref({ kind: "book", label: "", value: "" }, "/s/apex"), "/s/apex/#book");
assert.equal(buttonHref({ kind: "shop", label: "", value: "" }, ""), "/shop");

// What visitors see: switched on, filled in, covered by the plan, in order
const d = siteDocOf({ blocks: { ...b, team: { on: true, items: [{ name: "Ada" }] } }, order: ["faq", "team", "hero"] });
assert.deepEqual(visibleBlocks(d, "basic"), ["faq", "team", "hero", "info", "services", "gallery"], "every section is open from Free Basic (docs/SITES.md)");
assert.deepEqual(visibleBlocks(d, "standard"), [], "no site below Free Basic");
assert.deepEqual(siteSectionsShown({ ...(u("basic") as object), siteSections: { journals: true, shop: true, courses: true, track: true } } as never), { journals: true, shop: true, courses: true, track: false }, "Shop from Free Basic (higher commission), Track from Business");

// Kits
assert.equal(KITS.length, 18);
assert.deepEqual(KITS.filter((k) => kitAllowed(k, "basic")).map((k) => k.id), ["personal", "scholar"], "Free Basic: the personal kits only (Personal and creators, Academics)");
assert.deepEqual(KITS.filter((k) => kitAllowed(k, "pro")).map((k) => k.id), ["personal", "scholar", "fashion", "food", "services", "healthcare", "beauty-spa", "beauty-massage", "beauty-hair", "beauty-nails", "fitness", "events", "electronics", "motor", "solar", "realestate"]);
assert.equal(KITS.filter((k) => kitAllowed(k, "business")).length, 18);
// A linked community (lib/site-kits.ts): a community address or nothing.
assert.equal(siteDocOf({ community: "grace-chapel" }).community, "grace-chapel");
assert.equal(siteDocOf({ community: "../../users/x" }).community, "");
assert.equal(siteDocOf({}).community, "");
const mine = siteDocOf({ blocks: { hero: { headline: "My own words" }, services: { items: [{ name: "Mine", price: "₦1" }] } } });
const r = applyKitTo(mine, kitOf("food")!, "pro");
assert.equal(r.theme, "clean"); assert.equal(r.site.kit, "food"); assert.equal(r.site.palette.id, "sunset");
assert.equal(r.site.blocks.hero.headline, "My own words", "the member's words are kept");
assert.equal(r.site.blocks.hero.subline, kitOf("food")!.starter.subline, "empty parts get starter words");
assert.deepEqual(r.site.blocks.services.items, [{ name: "Mine", price: "₦1", note: "" }]);
assert.equal(r.site.blocks.hero.on && r.site.blocks.services.on && !r.site.blocks.faq.on, true);
assert.deepEqual(r.sections, { journals: false, shop: true, courses: false, track: false });
const r2 = applyKitTo(siteDocOf({}), kitOf("healthcare")!, "basic");
assert.equal(r2.site.blocks.team.on, true);
assert.equal(applyKitTo(siteDocOf({}), kitOf("food")!, "basic").sections.shop, true, "Shop is open from Free Basic");
assert.equal(applyKitTo(siteDocOf({}), { ...kitOf("food")!, sections: { journals: false, shop: false, courses: false, track: true } }, "pro").sections.track, false, "a page the plan doesn't cover (Track below Business) stays off");

// Booking hours in words (owner, 21 Oct 2026: the hours strip connects to the booking calendar)
const wk = (slots: string[]) => Object.fromEntries([1, 2, 3, 4, 5].map((d) => [String(d), slots]));
assert.equal(bookingHoursText({ ...wk(["09:00", "10:00", "16:00"]), "6": ["10:00", "12:00"] }, 60), "Mon–Fri, 9:00 AM to 5:00 PM · Sat, 10:00 AM to 1:00 PM");
assert.equal(bookingHoursText({ "1": ["09:00"], "3": ["09:00"] }, 30), "Mon, 9:00 AM to 9:30 AM · Wed, 9:00 AM to 9:30 AM", "only days next to each other run together");
assert.equal(bookingHoursText({ "0": ["14:00"], "1": ["bad"] }, 60), "Sun, 2:00 PM to 3:00 PM");
assert.equal(bookingHoursText(null, 60), "");
assert.equal(cleanBlocks({ info: { on: true, bookingHours: true } }).info.bookingHours, true);
assert.deepEqual(visibleBlocks(siteDocOf({ blocks: { info: { on: true, bookingHours: true } } }), "basic"), ["info"], "booking hours alone fill the strip");

// Backgrounds: white or paper with every colour set and look; Clean is white unless chosen
assert.deepEqual(cleanPalette({ id: "ocean", bg: "white" }), { id: "ocean", bg: "white" });
assert.deepEqual(cleanPalette({ id: "ocean", bg: "pink" }), { id: "ocean" });
assert.equal(backgroundOf({}, "clean"), "white"); assert.equal(backgroundOf({}, "legacy"), "paper"); assert.equal(backgroundOf({ bg: "paper" }, "clean"), "paper");
assert.equal(paletteVars({ id: "crimson", bg: "white" }, "basic", "maroon")["--c-paper"], "255 255 255");
assert.equal(paletteVars({ id: "crimson" }, "basic", "aurora")["--c-paper"], undefined, "paper: the usual background");
assert.equal(applyKitTo(siteDocOf({ palette: { id: "gold", bg: "paper" } }), kitOf("personal")!, "basic").site.palette.bg, "paper", "a kit keeps the background choice");
assert.equal(siteDocOf({}).bookBelowPosts, false); assert.equal(siteDocOf({ bookBelowPosts: true }).bookBelowPosts, true);

// Phase 3: the Scholar look and the academic sections, open from Free Basic
assert.equal(themeAllowed("scholar", "basic"), true);
assert.equal(placeCoords("Lagos")?.[0], 6.52); assert.deepEqual(placeCoords("sao paulo, brazil"), [-23.55, -46.63]); assert.equal(placeCoords("Atlantis"), null);
assert.equal(placeCoords("Cambridge")?.[1], 0.12, "the first of two Cambridges is the UK one");
const ac = cleanBlocks({
  publications: { on: true, items: [{ title: "Graph learning for drug repurposing", authors: "A. Obi, B. Ade", venue: "Nature", year: "2025", url: "javascript:alert(1)" }, { title: "" }, { title: "Preprint", year: "Forthcoming", url: "https://arxiv.org/abs/1" }] },
  awards: { on: true, items: [{ title: "Rhodes Scholarship", by: "Rhodes Trust", year: "2023" }] },
  talks: { on: true, items: [{ title: "AI in medicine", place: "Lagos, Nigeria", year: "2024" }, { title: "Keynote", place: "Somewhere small", lat: "10.5", lng: 7.4 }, { title: "Bad", place: "Nowhere", lat: 200, lng: 5 }, { title: "Moved", place: "Accra", lat: null }] },
  news: { on: true, items: [{ title: "Young scientist of the year", outlet: "The Guardian", url: "https://guardian.ng/x" }] },
});
assert.equal(ac.publications.items.length, 2, "empty rows dropped"); assert.equal(ac.publications.items[0].url, "", "only https links");
assert.deepEqual([ac.talks.items[0].lat, ac.talks.items[0].lng], [6.52, 3.38], "a known place gets its dot");
assert.deepEqual([ac.talks.items[1].lat, ac.talks.items[1].lng], [10.5, 7.4], "typed coordinates");
assert.deepEqual([ac.talks.items[2].lat, ac.talks.items[2].lng], [null, null], "impossible coordinates: listed, no dot");
assert.equal(ac.talks.items[3].lat, 5.6);
assert.deepEqual(visibleBlocks(siteDocOf({ blocks: ac }), "basic"), ["publications", "awards", "talks", "news"]);
assert.deepEqual(byYear([{ year: "2023" }, { year: "" }, { year: "2025" }, { year: "Forthcoming" }, { year: "2023–2024" }, { year: "2025" }]).map((g) => [g.year, g.items.length]),
  [["Forthcoming", 1], ["2025", 2], ["2023–2024", 1], ["2023", 1], ["", 1]]);
const sch = applyKitTo(siteDocOf({}), kitOf("scholar")!, "basic");
assert.equal(sch.theme, "scholar"); assert.deepEqual(sch.site.order.slice(0, 3), ["hero", "publications", "talks"]); assert.equal(sch.site.blocks.publications.on, true);
assert.deepEqual(paletteVars({ id: "ocean" }, "basic", "scholar")["--c-crimson-light"].split(" ").length, 3, "a light accent for dark mode");
const dots = landDots();
assert.ok(dots.length > 3000 && dots.length < 5000, `land dots: ${dots.length}`);
const near = (lat: number, lng: number) => dots.some(([a, b]) => Math.abs(a - lat) <= 2 && Math.abs(b - lng) <= 2);
assert.ok(near(9, 8), "Nigeria is land"); assert.ok(!near(0, -30), "the middle of the Atlantic isn't");

// Phase 4: the new kits each start a usable site; a cover photo; team members tagged by username.
for (const k of KITS) {
  const r = applyKitTo(siteDocOf({}), k, "business");
  assert.ok(r.site.blocks.hero.headline && r.site.blocks.hero.button, `${k.id}: a banner with a button`);
  assert.ok(visibleBlocks(r.site, "business").includes("hero"), `${k.id}: shows something`);
  assert.equal(new Set(r.site.order).size, r.site.order.length, `${k.id}: each section once`);
}
assert.equal(siteDocOf({ cover: "https://img.test/c.jpg" }).cover, "https://img.test/c.jpg");
assert.equal(siteDocOf({ cover: "javascript:alert(1)" }).cover, ""); assert.equal(siteDocOf({}).cover, "");
const tm = cleanBlocks({ team: { on: true, items: [{ name: "Bisi", username: "@Bisi_A" }, { name: "Tolu", username: "no spaces!" }, { name: "Ada" }] } }).team.items;
assert.equal(tm[0].username, "bisi_a"); assert.equal(tm[1].username, undefined); assert.equal("username" in tm[2], false);

// the shop: pictures by kit, and search and sorting
assert.deepEqual(shopStyleOf("fashion"), { ratio: "portrait", fit: "cover" });
assert.deepEqual(shopStyleOf("salon"), { ratio: "portrait", fit: "cover" });
assert.deepEqual(shopStyleOf("electronics"), { ratio: "square", fit: "contain" });
assert.deepEqual(shopStyleOf("motor"), { ratio: "square", fit: "contain" });
assert.deepEqual(shopStyleOf("food"), { ratio: "square", fit: "cover" });
assert.deepEqual(shopStyleOf(""), { ratio: "square", fit: "cover" });
const goods = [
  { title: "Ankara gown", subtitle: "Made to measure", category: "Fashion & clothing", priceKobo: 2500000, createdAt: "2026-01-02T00:00:00Z" },
  { title: "Leather bag", category: "Shoes & bags", subcategory: "Bags", priceKobo: 1800000, createdAt: { toMillis: () => Date.parse("2026-03-01T00:00:00Z") } },
  { title: "Gift card", createdAt: "2026-02-01T00:00:00Z" },
  { title: "beaded necklace", category: "Jewellery", priceKobo: 900000 },
];
const titles = (l: { title: string }[]) => l.map((g) => g.title);
assert.deepEqual(titles(sortItems(goods, "new")), ["Leather bag", "Gift card", "Ankara gown", "beaded necklace"]);
assert.deepEqual(titles(sortItems(goods, "low")), ["beaded necklace", "Leather bag", "Ankara gown", "Gift card"]);
assert.deepEqual(titles(sortItems(goods, "high")), ["Ankara gown", "Leather bag", "beaded necklace", "Gift card"]);
assert.deepEqual(titles(sortItems(goods, "az")), ["Ankara gown", "beaded necklace", "Gift card", "Leather bag"]);
assert.deepEqual(titles(sortItems(goods, "new", "  BAGS ")), ["Leather bag"]);
assert.deepEqual(titles(sortItems(goods, "az", "made gown")), ["Ankara gown"]);
assert.deepEqual(sortItems(goods, "new", "nothing like it"), []);
const viewed = goods.map((g, i) => ({ ...g, id: `i${i}` }));
assert.deepEqual(titles(sortItems(viewed, "popular", "", { i3: 50, i0: 9 })), ["beaded necklace", "Ankara gown", "Leather bag", "Gift card"], "most viewed first, then newest");
assert.equal(goods[0].title, "Ankara gown", "the shop's own list is left alone");

// Beauty and wellness: four flavours of one kit, the old Spa and Salon kits still found, services with times and tabs, the photo hero
const beauty = KITS.filter((k) => k.family?.id === "beauty");
assert.deepEqual(beauty.map((k) => k.family!.flavour), ["Spa", "Massage", "Hair", "Nails"]);
assert.equal(kitOf("spa")?.id, "beauty-spa"); assert.equal(kitOf("salon")?.id, "beauty-hair");
assert.ok(isBeautyKit("beauty-nails") && isBeautyKit("spa") && !isBeautyKit("fashion"));
for (const k of beauty) {
  assert.equal(k.starter.button.kind, "book", `${k.id} opens with booking`);
  assert.ok(k.starter.services!.every((x) => x.minutes && x.group), `${k.id}: every starter service has a time and a tab`);
}
const nails = applyKitTo(siteDocOf({}), kitOf("beauty-nails")!, "pro").site;
assert.equal(nails.blocks.hero.style, "photo"); assert.equal(nails.blocks.hero.eyebrow, "Welcome to");
const kept = applyKitTo(siteDocOf({ blocks: { hero: { on: true, headline: "Mine", eyebrow: "Hello from" } } }), kitOf("beauty-spa")!, "pro").site;
assert.equal(kept.blocks.hero.headline, "Mine"); assert.equal(kept.blocks.hero.eyebrow, "Hello from", "applying a kit keeps what they wrote");
const sv = cleanBlocks({ services: { on: true, items: [{ name: "Facial", price: "₦25,000", minutes: "70", group: " Facials ", image: "https://img.test/f.jpg" }, { name: "Tea", minutes: 2, image: "http://x" }] } }).services.items;
assert.deepEqual(sv[0], { name: "Facial", price: "₦25,000", note: "", minutes: 70, group: "Facials", image: "https://img.test/f.jpg" });
assert.deepEqual(sv[1], { name: "Tea", price: "", note: "" }, "too short a time and an insecure picture are left out");
assert.equal(cleanBlocks({ hero: { style: "weird", eyebrow: "  " } }).hero.style, undefined);
assert.deepEqual([durationText(45), durationText(60), durationText(70), durationText(135), durationText(0)], ["45 min", "1 hr", "1 hr 10 min", "2 hr 15 min", ""]);
// Luxe, Home focus, the services button, email instead of phone
for (const k of beauty) { assert.equal(k.theme, "luxe"); assert.equal(k.starter.second?.kind, "services", `${k.id}: Check our services`); }
assert.equal(kitOf("fashion")!.theme, "luxe"); assert.equal(kitOf("fashion")!.starter.heroStyle, "photo");
assert.equal(buttonHref({ kind: "services", label: "Check our services", value: "" }, "/s/x"), "/s/x/#services");
assert.equal(buttonHref({ kind: "services", label: "x", value: "" }, ""), "/#services");
assert.deepEqual(["shop", "services", "courses", "notes", "mix", "weird", undefined].map(cleanFocus), ["shop", "services", "courses", "notes", "mix", "mix", "mix"]);
assert.equal(siteDocOf({}).focus, "mix");
assert.equal(cleanEmail(" Hello@Studio.NG "), "hello@studio.ng"); assert.equal(cleanEmail("not an email"), ""); assert.equal(cleanEmail("a@b"), "");
assert.equal(cleanBlocks({ info: { on: true, email: "hi@x.ng", phone: "0803" } }).info.email, "hi@x.ng");
assert.deepEqual(visibleBlocks(siteDocOf({ blocks: { info: { on: true, phone: "08031234567" } } }), "pro").includes("info"), false, "a phone number alone doesn't show the strip (it isn't shown on Home)");
console.log("ALL OK");
