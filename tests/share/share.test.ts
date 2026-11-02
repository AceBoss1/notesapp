// Share to Moments / Share to Journals: the share-target builder (lib/share-targets.ts). Pure, no emulator.
// Run: npm run test:share → "SHARE OK".
import assert from "node:assert/strict";
import { certificateCard, cleanShareRef, courseCard, couponCard, creditLine, eventCard, itemCard, journalCard, journalDraftFromCard, postCard, sessionCard, shareHref, signInHref, siteServiceCard } from "../../lib/share-targets";

// Refs: only known kinds and safe ids; a coupon is seller/CODE, tidied.
assert.deepEqual(cleanShareRef({ kind: "journal", id: "abc_123" }), { kind: "journal", id: "abc_123" });
assert.equal(cleanShareRef({ kind: "store", id: "x" }), null);
assert.equal(cleanShareRef({ kind: "journal", id: "../users/x" }), null);
assert.equal(cleanShareRef({ kind: "journal", id: "" }), null);
assert.deepEqual(cleanShareRef({ kind: "coupon", id: "Ada/save10" }), { kind: "coupon", id: "ada/SAVE10" });
assert.equal(cleanShareRef({ kind: "coupon", id: "ada/SAVE10/x" }), null);
assert.equal(cleanShareRef(null), null);

// Journals: published only; draft and missing ones have no card.
const j = journalCard("n1", { slug: "my-first", title: "  My   first post ", status: "published", featured_image: "https://cdn.test/c.webp", authorUsername: "ada", author: "Ada Obi" })!;
assert.deepEqual(j, { kind: "journal", id: "n1", title: "My first post", path: "/journals/my-first", image: "https://cdn.test/c.webp", creatorUsername: "ada", creatorName: "Ada Obi", label: "Journal" });
assert.equal(journalCard("n2", { slug: "d", title: "Draft", status: "draft" }), null);
assert.equal(journalCard("n3", undefined), null);
// An unsafe cover is dropped, not passed on.
assert.equal(journalCard("n4", { slug: "s", title: "T", status: "published", featured_image: "javascript:alert(1)" })!.image, undefined);
assert.equal(journalCard("n5", { slug: "s", title: "T", status: "published", featured_image: "https://x.test/a\" onerror=\"x" })!.image, undefined);

// Courses: published only.
assert.equal(courseCard("c1", { slug: "excel", title: "Excel", status: "draft" }), null);
assert.equal(courseCard("c1", { slug: "excel", title: "Excel", status: "published", cover: "/covers/x.webp", ownerUsername: "tolu", ownerName: "Tolu" })!.path, "/academy/excel");

// Certificates: valid only, credited to the learner.
assert.equal(certificateCard("NA-C-1", { courseTitle: "Excel", learnerName: "Bisi", status: "revoked", revokedAt: "2026-10-01" }), null);
const cert = certificateCard("NA-C-2", { courseTitle: "Excel", learnerName: "Bisi", status: "valid" }, "bisi")!;
assert.equal(cert.title, "Bisi: Excel");
assert.equal(cert.image, "/certificates/NA-C-2/image.png");
assert.equal(creditLine(cert), "Shared from @bisi");

// Coupons: only an open one (the server passes null for an ended code).
assert.equal(couponCard("ada", "SAVE10", null), null);
assert.equal(couponCard("ada", "SAVE10", { label: "10% off" })!.title, "10% off at @ada's shop");

// Community posts: public channel in a findable community only.
assert.equal(postCard("p1", { cid: "grace", text: "Hello" }, { name: "Grace" }, false), null);
const post = postCard("p2", { cid: "grace", text: "x".repeat(150), authorUsername: "pastor", authorName: "Pastor" }, { name: "Grace" }, true)!;
assert.equal(post.path, "/c/grace#post-p2");
assert.ok(post.title.endsWith("…") && post.title.length === 101);
assert.equal(postCard("p3", { cid: "grace", text: "" }, { name: "Grace" }, true)!.title, "A post in Grace");

// Credit when there is no handle.
assert.equal(creditLine({ creatorName: "Precheks" }), "Shared from Precheks");
assert.equal(creditLine({}), "Shared on #NotesApp");

// The journal draft: a quoted block with the title as a link, the cover and the credit; a draft, never published by itself.
const d = journalDraftFromCard(j, "https://www.notesapp.name.ng");
assert.equal(d.status, "draft");
assert.deepEqual(d.shared, { kind: "journal", id: "n1" });
assert.ok(d.content.startsWith("> **Journal: [My first post](https://www.notesapp.name.ng/journals/my-first)**"));
assert.ok(d.content.includes("> ![My first post](https://cdn.test/c.webp)"));
assert.ok(d.content.includes("> Shared from @ada (Ada Obi)"));
assert.ok(d.content.endsWith("\n\n"), "room for the member's own words");
// Markdown in a title can't break out of the link.
const tricky = journalDraftFromCard({ ...j, title: "a](javascript:x) [b", image: undefined }, "https://n.test");
assert.ok(tricky.content.includes("[a\\](javascript:x) \\[b](https://n.test/journals/my-first)"));
assert.ok(!tricky.content.includes("!["));
// Relative covers become absolute.
assert.ok(journalDraftFromCard(cert, "https://n.test/").content.includes("(https://n.test/certificates/NA-C-2/image.png)"));

// Shop items: sold through #NotesApp (in stock or not), price in naira; not link-out items, hidden shops or suspended sellers.
const seller = { username: "apexglitz", displayName: "ApexGlitz boutique" };
const gown = itemCard("it1", { title: "Royal Blue Maxi Gown", sellable: true, priceKobo: 13_000_000, image: "https://cdn.test/g.webp", kind: "physical" }, seller)!;
assert.deepEqual(gown, { kind: "item", id: "it1", title: "Royal Blue Maxi Gown", path: "/shop/it1", image: "https://cdn.test/g.webp", creatorUsername: "apexglitz", creatorName: "ApexGlitz boutique", label: "Shop item", price: "₦130,000" });
assert.equal(itemCard("it2", { title: "Sold out gown", sellable: true, priceKobo: 100_00 }, seller)!.price, "₦100");
assert.equal(itemCard("it3", { title: "Amazon book", sellable: false }, seller), null);
assert.equal(itemCard("it1", { title: "x", sellable: true }, { ...seller, shopHidden: true }), null);
assert.equal(itemCard("it1", { title: "x", sellable: true }, { ...seller, suspended: true }), null);
assert.equal(itemCard("it4", { title: "Excel templates", sellable: true, priceKobo: 500_000, kind: "digital" }, seller)!.label, "Digital download");
// Services: 1:1 sessions while they're on, and a line of the site's services while that section is on.
const sess = sessionCard("adaobi", { displayName: "Ada Obi" }, { enabled: true, priceKobo: 1_500_000, minutes: 45 })!;
assert.equal(sess.title, "Book a 1:1 session with Ada Obi");
assert.equal(sess.price, "₦15,000 · 45 min");
assert.equal(sess.path, "/u/adaobi#book");
assert.equal(sessionCard("adaobi", { displayName: "Ada" }, { enabled: false, priceKobo: 1 }), null);
const svc = { on: true, items: [{ name: "Deep tissue massage", price: "25,000", minutes: 60 }, { name: "Facial", price: "₦18,000" }] };
assert.deepEqual(siteServiceCard("glow", 0, { displayName: "Glow Spa" }, svc), { kind: "service", id: "glow~0", title: "Deep tissue massage", path: "/s/glow#services", image: undefined, creatorUsername: "glow", creatorName: "Glow Spa", label: "Service", price: "₦25,000 · 60 min" });
assert.equal(siteServiceCard("glow", 1, { displayName: "Glow Spa" }, svc)!.price, "₦18,000");
assert.equal(siteServiceCard("glow", 5, { displayName: "Glow Spa" }, svc), null);
assert.equal(siteServiceCard("glow", 0, { displayName: "Glow Spa" }, { ...svc, on: false }), null);
assert.deepEqual(cleanShareRef({ kind: "service", id: "Glow~3" }), { kind: "service", id: "glow~3" });
assert.equal(cleanShareRef({ kind: "service", id: "glow~x" }), null);
// Events: public and not cancelled.
assert.equal(eventCard("e1", { title: "Book launch", visibility: "members" }), null);
assert.equal(eventCard("e1", { title: "Book launch", visibility: "public", cancelled: true }), null);
assert.equal(eventCard("e1", { title: "Book launch", visibility: "public", hostUsername: "adaobi", startsAt: "2026-11-20T15:00:00.000Z" })!.label, "Event · 20 Nov 2026");
// The journal quote carries the price.
assert.ok(journalDraftFromCard(gown, "https://n.test").content.startsWith("> **Shop item: [Royal Blue Maxi Gown](https://n.test/shop/it1)** · ₦130,000"));

// Where visitors and members' own domains finish.
assert.equal(shareHref("moment", { kind: "coupon", id: "ada/SAVE10" }), "/share?to=moment&kind=coupon&id=ada%2FSAVE10");
assert.equal(signInHref("journal", { kind: "journal", id: "n1" }), "/login?next=%2Fshare%3Fto%3Djournal%26kind%3Djournal%26id%3Dn1");

console.log("SHARE OK");
