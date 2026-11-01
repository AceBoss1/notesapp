// Share to Moments against the Firestore emulator (lib/moments-server.ts shareToMoment, lib/share-targets-server.ts): a moment that
// carries the item's card and credits its creator, built from the item as it is now; drafts, members-only posts and revoked certificates
// refused; the usual Moments rules (who sees it, teen mode, child profiles, the daily limit, 24/48/72 hours, reshares).
// Run: npm run test:share-server → "SHARE SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { listForOwner, reshare, shareToMoment, MomentError } from "../../lib/moments-server";
import { resolveShareCard } from "../../lib/share-targets-server";
import { MOMENT_DAILY_LIMIT } from "../../lib/moments-rules";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const deps = { publicUrl: (k: string) => `https://cdn.test/${k}`, remove: async () => {} };
const user = (uid: string, username: string, extra = {}) => db.doc(`users/${uid}`).set({ uid, username, displayName: username.toUpperCase(), role: "reader", accountTier: "standard", ...extra });
const follow = (followerUid: string, username: string) => db.doc(`follows/${followerUid}_${username}`).set({ followerUid, username });
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) =>
  assert.rejects(p, (e: unknown) => e instanceof MomentError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`);
const T = "sh"; // ids in this run

(async () => {
  await Promise.all([
    user(`${T}_ada`, `${T}ada`, { role: "publisher" }), user(`${T}_bisi`, `${T}bisi`), user(`${T}_chidi`, `${T}chidi`), user(`${T}_eze`, `${T}eze`),
    user(`${T}_teen`, `${T}teen`, { teen: true }),
  ]);
  await db.doc(`notes/${T}n1`).set({ slug: `${T}-first`, title: "My first post", status: "published", featured_image: "https://cdn.test/cover.webp", author: "Ada Obi", authorUsername: `${T}ada`, authorUid: `${T}_ada`, content: "Hi" });
  await db.doc(`notes/${T}n2`).set({ slug: `${T}-draft`, title: "Not yet", status: "draft", author: "Ada Obi", authorUsername: `${T}ada`, content: "…" });
  await follow(`${T}_chidi`, `${T}bisi`); // chidi sees bisi's moments; eze doesn't follow bisi

  // 1. Bisi shares Ada's journal: a "link" moment with the card, the caption, crediting @ada.
  const now = new Date();
  const m = await shareToMoment(db, { uid: `${T}_bisi`, username: `${T}bisi` }, { share: { kind: "journal", id: `${T}n1` }, text: "Worth a read", hours: 48 }, deps, resolveShareCard, now);
  assert.equal(m.kind, "link");
  assert.equal(m.text, "Worth a read");
  assert.equal(m.link?.title, "My first post");
  assert.equal(m.link?.path, `/journals/${T}-first`);
  assert.equal(m.link?.image, "https://cdn.test/cover.webp");
  assert.equal(m.link?.creatorUsername, `${T}ada`);
  assert.equal(new Date(m.expiresAt).getTime() - now.getTime(), 48 * 3_600_000);
  const stored = (await db.doc(`moments/${m.id}`).get()).data()!;
  assert.equal(stored.ownsMedia, false, "the cover belongs to the journal, never deleted with the moment");
  assert.ok(!JSON.stringify(stored).includes("undefined"));

  // 2. Who sees it: the usual audience. A follower yes, a stranger no.
  assert.equal((await listForOwner(db, `${T}_chidi`, `${T}bisi`, deps))[0]?.link?.title, "My first post");
  assert.equal((await listForOwner(db, `${T}_eze`, `${T}bisi`, deps)).length, 0);
  // A reshare keeps the card.
  const rs = await reshare(db, { uid: `${T}_chidi`, username: `${T}chidi` }, m.id, deps, now);
  assert.equal(rs.link?.creatorUsername, `${T}ada`);

  // 3. Not shareable: a draft, an unknown kind or id, a members-only community post, a revoked certificate.
  const bisi = { uid: `${T}_bisi`, username: `${T}bisi` };
  await fails(shareToMoment(db, bisi, { share: { kind: "journal", id: `${T}n2` } }, deps, resolveShareCard), 404, /private, a draft/);
  await fails(shareToMoment(db, bisi, { share: { kind: "journal", id: "nope" } }, deps, resolveShareCard), 404);
  await fails(shareToMoment(db, bisi, { share: { kind: "store", id: "x" } }, deps, resolveShareCard), 404);
  await db.doc(`communities/${T}grace`).set({ id: `${T}grace`, name: "Grace Chapel", joinMode: "open", publicView: { general: true, about: true, contact: true, events: true, members: false, join: true }, spaces: [{ id: "inner", name: "Inner", visibility: "members", whoPosts: "members" }] });
  await db.doc(`communityPosts/${T}p1`).set({ cid: `${T}grace`, channel: "general", text: "Service at 9", image: "", authorUsername: "pastor", authorName: "Pastor", public: true });
  await db.doc(`communityPosts/${T}p2`).set({ cid: `${T}grace`, channel: "inner", text: "Members only", image: "", authorUsername: "pastor", authorName: "Pastor", public: false });
  assert.equal((await shareToMoment(db, bisi, { share: { kind: "post", id: `${T}p1` } }, deps, resolveShareCard)).link?.path, `/c/${T}grace#post-${T}p1`);
  await fails(shareToMoment(db, bisi, { share: { kind: "post", id: `${T}p2` } }, deps, resolveShareCard), 404);
  // An invite-only community keeps even its General posts in.
  await db.doc(`communities/${T}grace`).update({ joinMode: "invite" });
  await fails(shareToMoment(db, bisi, { share: { kind: "post", id: `${T}p1` } }, deps, resolveShareCard), 404);
  await db.doc(`certificates/${T}C1`).set({ uid: `${T}_eze`, learnerName: "Eze", courseTitle: "Excel", status: "revoked", revokedAt: now.toISOString() });
  await fails(shareToMoment(db, bisi, { share: { kind: "certificate", id: `${T}C1` } }, deps, resolveShareCard), 404);
  await db.doc(`certificates/${T}C2`).set({ uid: `${T}_eze`, learnerName: "Eze", courseTitle: "Excel", status: "valid" });
  assert.equal((await resolveShareCard(db, { kind: "certificate", id: `${T}C2` }))?.creatorUsername, `${T}eze`);
  // Courses: published only.
  await db.doc(`courses/${T}c1`).set({ slug: `${T}-excel`, title: "Excel", status: "draft", ownerUsername: `${T}ada` });
  assert.equal(await resolveShareCard(db, { kind: "course", id: `${T}c1` }), null);
  await db.doc(`courses/${T}c1`).update({ status: "published" });
  assert.equal((await resolveShareCard(db, { kind: "course", id: `${T}c1` }))?.path, `/academy/${T}-excel`);

  // Shop items, services and events.
  await db.doc(`storeItems/${T}it1`).set({ ownerUid: `${T}_ada`, title: "Ankara tote", sellable: true, priceKobo: 1_200_000, image: "https://cdn.test/tote.webp", kind: "physical", stock: 0 });
  await db.doc(`storeItems/${T}it2`).set({ ownerUid: `${T}_ada`, title: "On Amazon", sellable: false, link: "https://amazon.test" });
  const tote = await shareToMoment(db, bisi, { share: { kind: "item", id: `${T}it1` }, text: "Sold out but restocking" }, deps, resolveShareCard);
  assert.equal(tote.link?.price, "₦12,000");
  assert.equal(tote.link?.creatorUsername, `${T}ada`);
  await fails(shareToMoment(db, bisi, { share: { kind: "item", id: `${T}it2` } }, deps, resolveShareCard), 404);
  await db.doc(`users/${T}_ada`).update({ shopHidden: true });
  assert.equal(await resolveShareCard(db, { kind: "item", id: `${T}it1` }), null, "a shop an admin switched off");
  await db.doc(`users/${T}_ada`).update({ shopHidden: false });
  await db.doc(`usernames/${T}ada`).set({ uid: `${T}_ada` });
  await db.doc(`publisherSettings/${T}_ada`).set({ uid: `${T}_ada`, username: `${T}ada`, session: { enabled: true, priceKobo: 1_500_000, minutes: 45, availability: {} } });
  assert.equal((await shareToMoment(db, bisi, { share: { kind: "service", id: `${T}ada` } }, deps, resolveShareCard)).link?.price, "₦15,000 · 45 min");
  await db.doc(`publisherSettings/${T}_ada`).update({ "session.enabled": false });
  await fails(shareToMoment(db, bisi, { share: { kind: "service", id: `${T}ada` } }, deps, resolveShareCard), 404);
  await db.doc(`sites/${T}_ada`).set({ uid: `${T}_ada`, blocks: { services: { on: true, items: [{ name: "Braids", price: "20,000", note: "" }] } } });
  assert.equal((await resolveShareCard(db, { kind: "service", id: `${T}ada~0` }))?.path, `/s/${T}ada#services`);
  assert.equal(await resolveShareCard(db, { kind: "service", id: `${T}ada~1` }), null);
  await db.doc(`events/${T}ev1`).set({ title: "Book launch", visibility: "public", hostUsername: `${T}ada`, hostName: "Ada Obi", startsAt: "2026-11-20T15:00:00.000Z" });
  await db.doc(`events/${T}ev2`).set({ title: "Members' meeting", visibility: "members", hostUsername: `${T}ada` });
  assert.equal((await shareToMoment(db, bisi, { share: { kind: "event", id: `${T}ev1` } }, deps, resolveShareCard)).link?.path, `/events/${T}ev1`);
  await fails(shareToMoment(db, bisi, { share: { kind: "event", id: `${T}ev2` } }, deps, resolveShareCard), 404);

  // 4. Moments rules: hours, caption length, a child profile, teen mode, the daily limit.
  await fails(shareToMoment(db, bisi, { share: { kind: "journal", id: `${T}n1` }, hours: 12 }, deps, resolveShareCard), 400, /24, 48 or 72/);
  await fails(shareToMoment(db, bisi, { share: { kind: "journal", id: `${T}n1` }, text: "x".repeat(281) }, deps, resolveShareCard), 413);
  await fails(shareToMoment(db, { uid: "kid_abc", username: "" }, { share: { kind: "journal", id: `${T}n1` } }, deps, resolveShareCard), 403, /child profile/);
  await fails(shareToMoment(db, { uid: `${T}_x`, username: "" }, { share: { kind: "journal", id: `${T}n1` } }, deps, resolveShareCard), 400, /profile/);
  await shareToMoment(db, { uid: `${T}_teen`, username: `${T}teen` }, { share: { kind: "journal", id: `${T}n1` } }, deps, resolveShareCard);
  await follow(`${T}_chidi`, `${T}teen`);
  assert.equal((await listForOwner(db, `${T}_chidi`, `${T}teen`, deps)).length, 0, "a teen's moments are for people they follow back");
  await follow(`${T}_teen`, `${T}chidi`);
  assert.equal((await listForOwner(db, `${T}_chidi`, `${T}teen`, deps)).length, 1);
  const day = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  await db.doc(`momentUsage/${T}_eze_${day}`).set({ uid: `${T}_eze`, day, count: MOMENT_DAILY_LIMIT });
  await fails(shareToMoment(db, { uid: `${T}_eze`, username: `${T}eze` }, { share: { kind: "journal", id: `${T}n1` } }, deps, resolveShareCard, now), 429, /moments a day/);

  console.log("SHARE SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
