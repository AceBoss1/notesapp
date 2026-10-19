// Weekly digest (lib/digest.ts, lib/digest-server.ts) against the Firestore emulator. Run: npm run test:digest → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
process.env.EMAIL_LINK_SECRET = "test-secret";
import { buildDigest, countSends, digestToken, digestWanted, digestWeek, setDigestWanted, validDigestToken, weekCourses, weekPool, weekSponsors } from "../../lib/digest-server";
import { pickStories, renderDigestHtml, renderDigestText, type PoolStory } from "../../lib/digest";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  // when: Sunday 5 PM Lagos = 16:00 UTC
  const sun = Date.UTC(2026, 9, 18, 16, 0);
  assert.equal(digestWeek(new Date(sun)).startsAt, sun); assert.equal(digestWeek(new Date(sun)).id, "2026-10-18");
  assert.equal(digestWeek(new Date(sun + 3_600_000 * 30)).startsAt, sun, "Monday evening still belongs to Sunday's run");
  assert.equal(digestWeek(new Date(sun - 60_000)).startsAt, sun - 7 * 86_400_000, "a minute early is last week's");

  // links
  const t = digestToken("u_ada");
  assert.ok(validDigestToken("u_ada", t)); assert.ok(!validDigestToken("u_bola", t)); assert.ok(!validDigestToken("u_ada", t.slice(1) + "x"));

  // choosing
  const base = { summary: "", href: "", image: null, writerAvatar: "", readMinutes: 3, comments: 0, premium: false, publishedAt: "2026-10-15T10:00:00Z" };
  const pool: PoolStory[] = [
    { ...base, id: "1", authorUid: "u_x", authorUsername: "x", title: "Popular", writerName: "X", likes: 900, tags: [] },
    { ...base, id: "2", authorUid: "u_f", authorUsername: "followed", title: "From someone I follow", writerName: "F", likes: 1, tags: [] },
    { ...base, id: "3", authorUid: "u_y", authorUsername: "y", title: "Matches my interest", writerName: "Y", likes: 5, tags: ["#Fintech"] },
    { ...base, id: "4", authorUid: "u_me", authorUsername: "me", title: "My own", writerName: "Me", likes: 5000, tags: [] },
  ];
  const picked = pickStories(pool, { uid: "u_me", follows: new Set(["followed"]), interests: ["fintech"] });
  assert.deepEqual(picked.map((s) => s.id), ["3", "2", "1"], "interests first, then people they follow, then the most viewed");

  // the week's journals and one member's email
  const now = new Date("2026-10-18T16:05:00Z");
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada Obi", avatar: "/images/headshots/default-avatar.png", interests: ["design"] });
  await db.doc("users/u_writer").set({ username: "writer", displayName: "Tola Writer", avatar: "https://media.example.com/t.jpg" });
  await db.doc("follows/u_ada_writer").set({ followerUid: "u_ada", username: "writer" });
  await db.doc("notes/n1").set({ status: "published", date: "2026-10-16T09:00:00Z", slug: "pay-gap", title: "Minding the pay gap", content: "**Bold** opening of the post with [a link](https://x.y) and more words.", author: "Precheks", authorUid: "u_org", authorUsername: "precheks", writerUid: "u_writer", likeCount: 3, tags: ["design"] });
  await db.doc("notes/n1/comments/c1").set({ content: "hi" });
  await db.doc("notes/n2").set({ status: "draft", date: "2026-10-16T09:00:00Z", slug: "draft", title: "Draft", content: "x", author: "A" });
  await db.doc("notes/n3").set({ status: "published", date: "2026-10-01T09:00:00Z", slug: "old", title: "Too old", content: "x", author: "A" });
  const week = await weekPool(db, now);
  assert.deepEqual(week.map((s) => s.id), ["n1"]);
  assert.equal(week[0].comments, 1); assert.equal(week[0].writerName, "Tola Writer"); assert.equal(week[0].inName, "Precheks");
  assert.match(week[0].summary, /^Bold opening of the post with a link and more words\.$/);
  const d = await buildDigest(db, "u_ada", week);
  assert.ok(d); assert.equal(d!.reader.name, "Ada Obi"); assert.match(d!.reader.avatar, /^https:\/\/www\..+\/images\/headshots\/default-avatar\.png$/);
  assert.match(d!.unsubscribeUrl, /\/api\/digest\/unsubscribe\?u=u_ada&t=/);
  const html = renderDigestHtml(d!);
  assert.ok(html.includes("Stories for <strong>Ada Obi</strong>") && html.includes("Tola Writer <span") && html.includes("Minding the pay gap"));
  assert.ok(renderDigestText(d!).includes("Unsubscribe from the weekly digest: "));
  // The mark before the title, the logo above the interests box; Market and Academy only when they have something.
  assert.ok(html.includes("/images/brand/icon-192.png") && html.includes("/images/brand/email-logo.png") && !html.includes("#NotesApp</strong> Weekly Digest"));
  assert.ok(!html.includes("FROM NOTES MARKET") && !html.includes("FROM NOTES ACADEMY"));
  const withMarket = renderDigestHtml({ ...d!, market: [{ title: "Excel course", href: "https://x/shop/1", image: null, price: "₦6,000", by: "Chimdinma", why: "120 views this week" }] });
  assert.ok(withMarket.includes("FROM NOTES MARKET") && withMarket.includes("Excel course") && !withMarket.includes("FROM NOTES ACADEMY"));
  assert.ok(renderDigestText({ ...d!, market: [{ title: "Excel course", href: "https://x/shop/1", image: null, price: "₦6,000", by: "Chimdinma", why: "2 bought in the last 30 days" }] }).includes("From Notes Market:"));
  assert.equal(await buildDigest(db, "u_writer", []), null, "nothing to read, nothing sent");

  // Notes Academy: the most viewed courses this week (paid ones with their price); drafts and suspended teachers left out
  await db.doc("users/u_bad").set({ username: "bad", displayName: "Suspended Teacher", suspended: true });
  await db.doc("courses/c1").set({ ownerUid: "u_writer", title: "Excel in a weekend", slug: "excel-in-a-weekend", status: "published", cover: "/images/shop/ms-excel-beginner-to-advanced.jpg" });
  await db.doc("courses/c2").set({ ownerUid: "u_writer", title: "Writing for the web", slug: "writing-for-the-web", status: "published", cover: "" });
  await db.doc("courses/c3").set({ ownerUid: "u_writer", title: "Draft course", slug: "draft-course", status: "draft" });
  await db.doc("courses/c4").set({ ownerUid: "u_bad", title: "Hidden", slug: "hidden", status: "published" });
  await db.doc("courses/c5").set({ ownerUid: "u_writer", title: "Paid masterclass", slug: "paid-masterclass", status: "published", priceKobo: 40_000 * 100, topics: ["design"] });
  for (const [id, count] of [["c1", 40], ["c3", 90], ["c4", 99], ["c5", 12]] as const) await db.doc(`pageViews/course_${id}_20261017`).set({ kind: "course", id, day: "2026-10-17", count });
  await db.doc("enrolments/c2_u_ada").set({ courseId: "c2", uid: "u_ada", enrolledAt: "2026-10-10T09:00:00Z", done: {} });
  await db.doc("enrolments/c2_u_x").set({ courseId: "c2", uid: "u_x", enrolledAt: "2026-10-12T09:00:00Z", done: {} });
  await db.doc("enrolments/c4_u_ada").set({ courseId: "c4", uid: "u_ada", enrolledAt: "2026-10-12T09:00:00Z", done: {} });
  const courses = await weekCourses(db, now);
  assert.deepEqual(courses.map((c) => [c.title, c.why, c.price, c.by]), [["Excel in a weekend", "40 views this week", "Free", "Tola Writer"], ["Paid masterclass", "12 views this week", "₦40,000", "Tola Writer"]], "most viewed only; a paid course shows its price");
  assert.match(courses[0].href, /^https:\/\/www\..+\/academy\/excel-in-a-weekend$/); assert.match(courses[0].image ?? "", /^https:\/\/.+\/images\/shop\//); assert.equal(courses[1].image, null);
  const dc = await buildDigest(db, "u_ada", week, [], courses);
  assert.deepEqual(dc!.courses!.map((c) => c.title), ["Paid masterclass", "Excel in a weekend"], "Ada's interest (design) comes first");
  assert.ok(renderDigestHtml(dc!).includes("FROM NOTES ACADEMY"));

  // Sponsored slots: a boosted journal, an advert, a boosted item; each email sent counts as an impression
  const ends = "2026-10-30T00:00:00Z";
  await db.doc("boosts/bPost").set({ status: "active", slug: "other-post", title: "Boosted journal", author: "Bola", image: "", publisherUid: "u_bola", impressionsPurchased: 1000, impressionsDelivered: 0, maxPerDay: 2, daily: {}, endsAt: ends });
  await db.doc("boosts/bOwn").set({ status: "active", slug: "pay-gap", title: "Already in the email", author: "Precheks", publisherUid: "u_org", impressionsPurchased: 1000, impressionsDelivered: 0, maxPerDay: 500, daily: {}, endsAt: ends });
  await db.doc("boosts/bItem").set({ status: "active", itemId: "item1", title: "Boosted tote", author: "ApexGlitz", publisherUid: "u_apex", impressionsPurchased: 3, impressionsDelivered: 2, maxPerDay: 100, daily: {}, endsAt: ends });
  await db.doc("boosts/bDone").set({ status: "active", slug: "spent", title: "Spent", author: "Z", publisherUid: "u_z", impressionsPurchased: 10, impressionsDelivered: 10, maxPerDay: 100, daily: {}, endsAt: ends });
  await db.doc("adCreatives/ad1").set({ title: "Bank with us", text: "Open an account", image: "https://media.example.com/ad.jpg", href: "https://bank.example.com", placements: ["digest", "home"], weight: 5, active: true, provider: "notesapp", createdAt: "2026-10-01T00:00:00Z" });
  await db.doc("adCreatives/ad2").set({ title: "Home only", href: "https://x.example.com", placements: ["home"], weight: 5, active: true, provider: "notesapp" });
  const sp = await weekSponsors(db, now, week);
  assert.deepEqual(sp.posts.map((x) => x.id).sort(), ["bOwn", "bPost"]); assert.deepEqual(sp.items.map((x) => x.id), ["bItem"]); assert.deepEqual(sp.ads.map((x) => x.id), ["ad1"], "only adverts with the digest spot");
  assert.equal(sp.left.get("bPost"), 2, "today's cap"); assert.equal(sp.left.get("bItem"), 1, "what's left of what was bought");
  const ds = await buildDigest(db, "u_ada", week, [], [], sp);
  assert.deepEqual(ds!.sponsored!.map((x) => [x.slot, x.id]), [[1, "bPost"], [2, "ad1"], [3, "bItem"]], "the boosted journal already in the email (bOwn) is skipped");
  assert.match(ds!.sponsored![0].href, /\/api\/digest\/go\?b=bPost$/); assert.match(ds!.sponsored![1].href, /\/api\/digest\/go\?a=ad1$/);
  assert.equal(sp.left.get("bItem"), 0, "the item boost is used up for this batch");
  const ds2 = await buildDigest(db, "u_ada", week, [], [], sp);
  assert.deepEqual(ds2!.sponsored!.map((x) => x.id), ["bPost", "ad1"], "the next email in the batch no longer carries it");
  await countSends(db, new Map([["boost:bPost", 2], ["boost:bItem", 5], ["ad:ad1", 2]]), now);
  const bp = (await db.doc("boosts/bPost").get()).data()!, bi = (await db.doc("boosts/bItem").get()).data()!;
  assert.equal(bp.impressionsDelivered, 2); assert.equal(bp.daily["2026-10-18"], 2); assert.equal(bp.digestSends, 2);
  assert.equal(bi.impressionsDelivered, 3, "never past what was bought"); assert.equal(bi.status, "completed");
  const st = (await db.doc("adStats/ad1_20261018").get()).data()!;
  assert.equal(st.impressions, 2); assert.equal(st.byPlacement.digest.impressions, 2);

  // the choice
  assert.equal(await digestWanted(db, "u_ada"), true);
  await setDigestWanted(db, "u_ada", false, "link"); assert.equal(await digestWanted(db, "u_ada"), false);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
