// Share to Moments / Share to Journals: the share-target builder (lib/share-targets.ts). Pure, no emulator.
// Run: npm run test:share → "SHARE OK".
import assert from "node:assert/strict";
import { certificateCard, cleanShareRef, courseCard, couponCard, creditLine, journalCard, journalDraftFromCard, postCard, shareHref, signInHref } from "../../lib/share-targets";

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

// Where visitors and members' own domains finish.
assert.equal(shareHref("moment", { kind: "coupon", id: "ada/SAVE10" }), "/share?to=moment&kind=coupon&id=ada%2FSAVE10");
assert.equal(signInHref("journal", { kind: "journal", id: "n1" }), "/login?next=%2Fshare%3Fto%3Djournal%26kind%3Djournal%26id%3Dn1");

console.log("SHARE OK");
