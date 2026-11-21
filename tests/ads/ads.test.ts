// Adverts and boosts (lib/ad-config.ts) and the weekly digest's picking (lib/digest.ts). Run: npm run test:ads → "ALL OK".
import assert from "node:assert/strict";
import { AD_CONFIG_DEFAULTS, AD_IMAGE, BILLBOARD_IMAGE, cleanAdConfig, cropFor, imageProblem, rightShape, spotOn, SQUARE_IMAGE } from "../../lib/ad-config";
import { AD_PLACEMENTS, fitsSpot, spotPicture } from "../../lib/ads";
import { fillSlots, pickItems, pickStories, renderDigestHtml, renderDigestText, type PoolItem, type PoolStory, type SlotCandidate } from "../../lib/digest";

// ---- the settings ----
assert.deepEqual(AD_CONFIG_DEFAULTS, { boostsWide: 3, boostsPhone: 1, boostRotateSec: 45, adRotateSec: 30, feedPromoted: 2, digestSlots: 3, spotsOff: [] }, "the owner's defaults");
assert.deepEqual(cleanAdConfig(null), AD_CONFIG_DEFAULTS, "nothing stored → the defaults");
assert.deepEqual(cleanAdConfig({ boostsWide: 9, boostsPhone: 0, boostRotateSec: 2, adRotateSec: "60", digestSlots: -1, feedPromoted: 3.6 }),
  { ...AD_CONFIG_DEFAULTS, boostsWide: 4, boostsPhone: 1, boostRotateSec: 10, adRotateSec: 60, digestSlots: 0, feedPromoted: 4 }, "kept within the limits");
assert.deepEqual(cleanAdConfig({ boostsWide: "", adRotateSec: null }).boostsWide, 3, "blank keeps the default");
const off = cleanAdConfig({ spotsOff: ["life", "nope", "life", "digest"] });
assert.deepEqual(off.spotsOff, ["life", "digest"], "unknown spots dropped, no repeats");
assert.equal(spotOn(off, "life"), false); assert.equal(spotOn(off, "home"), true);
for (const p of ["market", "academy", "explore", "search", "course", "digest", "life", "arcade", "arcadesq"]) assert.ok(p in AD_PLACEMENTS, `${p} is a spot`);

// ---- the picture ----
assert.equal(AD_IMAGE.width / AD_IMAGE.height > 1.9 && AD_IMAGE.width / AD_IMAGE.height < 1.92, true, "1.91 : 1");
assert.equal(rightShape(1200, 628, AD_IMAGE), true); assert.equal(rightShape(1080, 1080, AD_IMAGE), false);
assert.equal(imageProblem(1200, 628, AD_IMAGE), null); assert.match(imageProblem(500, 300, AD_IMAGE)!, /at least 600 × 314/);
const sq = cropFor(1080, 1080, AD_IMAGE); // a square: the widest centred band
assert.equal(sq.sw, 1080); assert.equal(Math.round(sq.sh), Math.round(1080 / (1200 / 628))); assert.equal(sq.sx, 0); assert.ok(Math.abs(sq.sy - (1080 - sq.sh) / 2) <= 1, "centred");
assert.equal(sq.width, 1080, "never enlarged"); assert.equal(sq.height, Math.round(1080 / (1200 / 628)));
const big = cropFor(4000, 3000, AD_IMAGE);
assert.equal(big.width, AD_IMAGE.sharpWidth, "a large picture comes out at the sharp size"); assert.equal(big.height, AD_IMAGE.sharpHeight);
const z = cropFor(4000, 3000, AD_IMAGE, { zoom: 2, x: 0, y: 1 });
assert.equal(z.sw, 2000); assert.equal(z.sx, 0); assert.equal(z.sy, 3000 - z.sh, "slid to the bottom left");
const bb = cropFor(1920, 1080, BILLBOARD_IMAGE); assert.equal(bb.width, 1600); assert.equal(bb.height, 900, "a 16:9 picture fits the billboard");

// ---- the square picture (Notes Arcade's square spots) ----
assert.deepEqual([SQUARE_IMAGE.width, SQUARE_IMAGE.height, SQUARE_IMAGE.minWidth, SQUARE_IMAGE.minHeight], [1080, 1080, 400, 400], "1080 × 1080, at least 400 × 400");
assert.deepEqual(SQUARE_IMAGE.safe, { width: 864, height: 864 }, "the safe area is the middle 864 × 864");
assert.ok(SQUARE_IMAGE.bestBytes === 500 * 1024 && SQUARE_IMAGE.maxBytes === 1024 * 1024);
const sqCut = cropFor(1920, 1080, SQUARE_IMAGE);
assert.deepEqual([sqCut.sw, sqCut.sh, sqCut.sx, sqCut.sy, sqCut.width, sqCut.height], [1080, 1080, 420, 0, 1080, 1080], "a wide picture: the middle square");
const sqBig = cropFor(3000, 4000, SQUARE_IMAGE); assert.equal(sqBig.width, 1080); assert.equal(sqBig.height, 1080, "never larger than the spec (no sharp size)");
const sqSmall = cropFor(600, 800, SQUARE_IMAGE); assert.equal(sqSmall.width, 600); assert.equal(sqSmall.height, 600, "never enlarged");
assert.ok(rightShape(1080, 1080, SQUARE_IMAGE) && !rightShape(1200, 628, SQUARE_IMAGE) && !rightShape(1080, 1080, AD_IMAGE), "square and wide are different shapes");
assert.match(imageProblem(300, 300, SQUARE_IMAGE) ?? "", /at least 400 × 400/);
assert.equal(imageProblem(400, 400, SQUARE_IMAGE), null);

// ---- shapes never cross ----
const wideOnly = { image: "w.jpg" }, sqOnly = { square: "s.jpg" }, all = { image: "w.jpg", billboard: "b.jpg", square: "s.jpg" }, titleOnly = {};
assert.ok(!fitsSpot(wideOnly, "square") && fitsSpot(sqOnly, "square") && fitsSpot(all, "square") && !fitsSpot(titleOnly, "square"), "a square spot takes only a square picture");
assert.ok(!fitsSpot(wideOnly, "billboard") && !fitsSpot(sqOnly, "billboard") && fitsSpot(all, "billboard"), "a billboard takes only a billboard picture");
assert.ok(fitsSpot(wideOnly, "wide") && fitsSpot(titleOnly, "wide") && fitsSpot(all, "wide"), "a wide spot takes any advert");
assert.equal(spotPicture(all, "square"), "s.jpg"); assert.equal(spotPicture(all, "billboard"), "b.jpg"); assert.equal(spotPicture(all, "wide"), "w.jpg");
assert.equal(spotPicture(sqOnly, "wide"), undefined, "the square picture is never drawn in a wide spot");
assert.equal(spotPicture(wideOnly, "square"), undefined, "nor the wide one in a square spot");

// ---- the digest: stories on the reader's interests first ----
const story = (id: string, tags: string[], views: number, author = "a"): PoolStory => ({ id, authorUid: `u_${author}`, authorUsername: author, tags, publishedAt: "2026-10-15T10:00:00Z", title: id, summary: "", href: `https://x/journals/${id}`, image: null, writerName: author, writerAvatar: "", readMinutes: 2, likes: 0, comments: 0, views, premium: false });
const pool = [story("big", ["Tech"], 9000), story("fin1", ["Fintech"], 10), story("fin2", ["fintech", "Tech"], 50), story("mine", ["Fintech"], 99999, "me"), story("pal", ["Food"], 5, "pal"), ...Array.from({ length: 12 }, (_, i) => story(`x${i}`, ["Other"], i))];
const picked = pickStories(pool, { uid: "u_me", follows: new Set(["pal"]), interests: ["#Fintech"] });
assert.equal(picked.length, 10, "ten journals");
assert.deepEqual(picked.slice(0, 2).map((s) => s.id), ["fin2", "fin1"], "the reader's interests lead, most viewed first");
assert.equal(picked[2].id, "pal", "then people they follow");
assert.equal(picked[3].id, "big", "then the week's most viewed");
assert.ok(!picked.some((s) => s.id === "mine"), "never their own");
assert.deepEqual(pickStories(pool, { uid: "u_me", follows: new Set(), interests: [] })[0].id, "big", "no interests: the most viewed");

const item = (id: string, tags: string[], heat: number, ownerUid = "o"): PoolItem => ({ id, tags, heat, ownerUid, title: id, href: `https://x/${id}`, image: null, price: "₦1", by: "s", why: `${heat} views` });
const items = [item("hot", ["Fashion"], 900), item("bag", ["Fashion & bags", "fintech"], 3), item("own", ["fintech"], 9999, "u_me"), item("a", [], 50), item("b", [], 40), item("c", [], 30)];
assert.deepEqual(pickItems(items, { uid: "u_me", interests: ["fintech"] }).map((i) => i.title), ["bag", "hot", "a", "b"], "four, interests first, never their own");
assert.ok(!("tags" in pickItems(items, { interests: [] })[0]), "only what the email needs");

// ---- the sponsored slots ----
const c = (kind: "post" | "item" | "ad", id: string, extra: Partial<SlotCandidate> = {}): SlotCandidate => ({ kind, id, title: id, image: null, href: `https://x/go/${id}`, label: kind === "ad" ? "Sponsored: NotesApp Ads" : "Promoted · x", ...extra });
const cands = { posts: [c("post", "p1"), c("post", "p2", { tags: ["Fintech"] }), c("post", "pOwn", { ownerUid: "u_me", tags: ["Fintech"] })], items: [c("item", "i1")], ads: [c("ad", "house"), c("ad", "paid", { paid: true })] };
const slots = fillSlots(cands, { uid: "u_me", interests: ["fintech"] });
assert.deepEqual(slots.map((x) => [x.slot, x.kind, x.id]), [[1, "post", "p2"], [2, "ad", "paid"], [3, "item", "i1"]], "boosted journal on their interests, a paid advert, a boosted item");
assert.ok(!("tags" in slots[0]) && !("paid" in slots[1]), "only what the email needs");
assert.deepEqual(fillSlots({ posts: [], items: [], ads: [c("ad", "only")] }, { uid: "u", interests: [] }).map((x) => [x.slot, x.id]), [[1, "only"]], "one advert fills one slot, never twice");
assert.deepEqual(fillSlots({ ...cands, items: [] }, { uid: "u", interests: [] }).map((x) => x.id), ["p1", "paid", "house"], "no boosted item: slot 3 takes an advert");
assert.equal(fillSlots(cands, { uid: "u", interests: [] }, 1).length, 1, "Admin → Ads can have fewer slots");
assert.equal(fillSlots(cands, { uid: "u", interests: [] }, 0).length, 0);
assert.equal(fillSlots({ posts: [c("post", "dup", { target: "https://x/journals/fin2" })], items: [], ads: [] }, { uid: "u", interests: [], storyHrefs: new Set(["https://x/journals/fin2"]) }).length, 0, "a boosted journal already in the email isn't repeated");

// ---- the email ----
const d = { reader: { name: "R", username: "r", avatar: "https://x/a.png" }, stories: picked, market: pickItems(items, { interests: [] }), courses: [], sponsored: slots, site: "https://x", appUrl: "https://x/install", unsubscribeUrl: "https://x/u", interestsUrl: "https://x/i", company: "NOTESAPP" };
const html = renderDigestHtml(d);
const at = (s: string) => html.indexOf(s);
assert.ok(at("https://x/journals/fin1") < at("https://x/go/p2") && at("https://x/go/p2") < at(`https://x/journals/${picked[2].id}`), "slot 1 after the 2nd journal");
assert.ok(at(`https://x/journals/${picked[5].id}`) < at("https://x/go/paid") && at("https://x/go/paid") < at(`https://x/journals/${picked[6].id}`), "slot 2 after the 6th");
assert.ok(at("FROM NOTES MARKET") < at("https://x/go/i1") && at("https://x/go/i1") < at("Choose your interests</a></td>"), "slot 3 near the end, before the interests box");
assert.equal((html.match(/width="50%"/g) ?? []).length, 4, "four items, two to a row");
assert.match(renderDigestText(d), /Sponsored: NotesApp Ads: paid: https:\/\/x\/go\/paid/);

console.log("ALL OK");
