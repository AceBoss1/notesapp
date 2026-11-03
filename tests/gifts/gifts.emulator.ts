// Animated gifts against the Firestore emulator (lib/gifts-server.ts, lib/payments.ts, lib/wallet-server.ts): an animated gift paid from
// NotesApp Credit settles like any gift (the plan's commission, held 7 days), adds to the receiver's total for the Lagos day in the same
// transaction, sets what visitors of their page play, and puts an animated gift in their bell. The big gifts need a verified sender.
// Once the target is reached from enough different people the receiver is on "Top gifted today"; a teen only for people who follow them.
// Run: npm run test:gifts-server → "GIFTS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GiftError, announceGrandGift, priceAnimatedGift, topGiftedToday } from "../../lib/gifts-server";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { payFromWallet } from "../../lib/wallet-server";
import { commissionRateFor } from "../../lib/tiers";
import { GIFT_SETTINGS, dailyId, giftUplift, lagosDayOf, upliftedRate } from "../../lib/gift-catalogue";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const user = (uid: string, extra = {}) => Promise.all([
  db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid[0].toUpperCase() + uid.slice(1), role: "publisher", accountTier: "basic", ...extra }),
  db.doc(`usernames/${uid}`).set({ uid }),
  db.doc(`wallets/${uid}`).set({ creditKobo: 2_000_000 * 100, bonusLots: [] }),
]);
let n = 0;
// The checkout's record (app/api/paystack/initialize, kind "gift"), paid from the wallet, then settled.
async function send(from: string, to: string, giftId: string, anonymous = false, liveId?: string): Promise<string> {
  const g = await priceAnimatedGift(db, from, giftId);
  const reference = `GIFT${++n}`;
  const to0 = (await db.doc(`users/${to}`).get()).data()!;
  const record: PaymentRecord = {
    reference, kind: "gift", uid: from, email: `${from}@x.ng`, amountKobo: g.priceKobo, status: "pending",
    publisherUid: to, publisherUsername: to, commissionRate: upliftedRate(commissionRateFor(to0.accountTier), giftUplift(g.priceKobo)), // as the checkout sets it
    gift: { username: to, message: "Thank you!", anonymous, senderName: from.toUpperCase(), animId: g.id, animName: g.name, uplift: giftUplift(g.priceKobo), ...(liveId ? { liveId } : {}) },
    createdAt: new Date().toISOString(),
  };
  await payFromWallet(db, record);
  assert.equal((await fulfillPayment(reference)).status, "paid");
  return reference;
}
const rejects = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof GiftError && e.status === status && re.test(e.message));

(async () => {
  await Promise.all([user("ada"), user("bisi"), user("chidi", { accountTier: "business" }), user("dayo"), user("tola", { teen: true }), user("fan")]);
  await db.doc("follows/fan_tola").set({ followerUid: "fan", username: "tola" });

  // Gifts from ₦25,000 (Golden Gele up) need a verified sender; a gift that doesn't exist is refused.
  await rejects(priceAnimatedGift(db, "bisi", "kente"), 403, /verified account/);
  await rejects(priceAnimatedGift(db, "bisi", "gele"), 403, /Golden Gele is for verified senders/);
  assert.equal((await priceAnimatedGift(db, "bisi", "adire")).priceKobo, 2_000_000, "₦20,000 Adire Fan: anyone");
  await rejects(priceAnimatedGift(db, "bisi", "lion"), 404, /isn't available/);
  assert.equal((await priceAnimatedGift(db, "chidi", "kente")).priceKobo, 5_000_000);

  // Chidi (Business, so ✔) sends Ada a Kente Crown from the wallet.
  const r1 = await send("chidi", "ada", "kente");
  assert.equal((await db.doc("wallets/chidi").get()).data()!.creditKobo, 2_000_000 * 100 - 5_000_000, "taken from NotesApp Credit");
  const gift = (await db.doc(`gifts/${r1}`).get()).data()!;
  assert.deepEqual([gift.toUid, gift.fromUid, gift.amountKobo, gift.animId, gift.animName], ["ada", "chidi", 5_000_000, "kente", "Kente Crown"]);
  const led = (await db.doc(`ledger/${r1}`).get()).data()!;
  const rate = upliftedRate(commissionRateFor("basic"), 0.2); // Kente Crown is a VIP gift: the normal rate plus 20% of it
  assert.ok(rate > commissionRateFor("basic") && Math.abs(rate - commissionRateFor("basic") * 1.2) < 0.0001);
  assert.equal(led.commissionRate ?? rate, rate);
  assert.deepEqual([led.kind, led.publisherUid, led.grossKobo, led.commissionKobo, led.netKobo, led.status], ["gift", "ada", 5_000_000, Math.round(5_000_000 * rate), 5_000_000 - Math.round(5_000_000 * rate), "held"]);
  const holdDays = (Date.parse(led.releaseAfter) - Date.now()) / 86_400_000;
  assert.ok(holdDays > 6.9 && holdDays <= 7, "held 7 days, the same as every gift");
  const show = (await db.doc("giftShows/ada").get()).data()!;
  assert.deepEqual([show.reference, show.giftId, show.name, show.priceKobo, show.senderName], [r1, "kente", "Kente Crown", 5_000_000, "CHIDI"]);
  const bell = (await db.collection("notifications").where("recipientUid", "==", "ada").get()).docs.map((d) => d.data());
  assert.equal(bell.length, 1);
  assert.equal(bell[0].giftAnim, "kente");
  assert.match(bell[0].message, /CHIDI sent you a Kente Crown \(₦50,000\)/);
  // A grand gift is announced to everyone: not sent in a live, so the link is Ada's page.
  let burst = (await db.doc("giftBursts/latest").get()).data()!;
  assert.deepEqual(burst, { reference: r1, giftId: "kente", name: "Kente Crown", priceKobo: 5_000_000, senderName: "CHIDI", toName: "Ada", toUsername: "ada", href: "/u/ada", live: false, at: burst.at });

  // Today's total: ₦50,000 but one sender, so not on the shelf yet.
  const day = lagosDayOf(new Date());
  let total = (await db.doc(`giftDaily/${dailyId(day, "ada")}`).get()).data()!;
  assert.deepEqual([total.grossKobo, total.netKobo, total.count, total.senders, total.reachedAt], [5_000_000, led.netKobo, 1, ["chidi"], undefined]);
  assert.deepEqual((await topGiftedToday(db, null, new Date(), { fresh: true })).rows, []);

  // Settling the same payment again adds nothing.
  await fulfillPayment(r1);
  assert.equal((await db.doc(`giftDaily/${dailyId(day, "ada")}`).get()).data()!.count, 1);

  // Two more people (one anonymous) → three different senders: the target is reached.
  await send("bisi", "ada", "adire");
  const r3 = await send("dayo", "ada", "jollof", true);
  total = (await db.doc(`giftDaily/${dailyId(day, "ada")}`).get()).data()!;
  assert.deepEqual([total.grossKobo, total.count, total.senders.length], [7_500_000, 3, 3]);
  assert.equal((await db.doc("giftBursts/latest").get()).data()!.reference, r1, "smaller gifts aren't announced");
  assert.ok(total.reachedAt, "reached");
  assert.equal((await db.doc("giftShows/ada").get()).data()!.senderName, "", "an anonymous sender stays anonymous on the page");
  assert.equal((await db.doc("giftShows/ada").get()).data()!.reference, r3);

  // A teen reaches it too, with more: shown only to people who follow them (and to themselves), never to anyone signed out.
  await send("chidi", "tola", "baobab");
  assert.equal((await db.doc("giftBursts/latest").get()).data()!.reference, r1, "a teen receiver is never announced");
  await send("bisi", "tola", "adire");
  await send("dayo", "tola", "drum");
  let shelf = await topGiftedToday(db, null, new Date(), { fresh: true });
  assert.deepEqual(shelf.rows.map((r) => r.username), ["ada"], "signed out: no teen");
  assert.deepEqual(shelf.rows[0], { uid: "ada", username: "ada", displayName: "Ada", avatar: "", kobo: 7_500_000, count: 3, senders: 3, reachedAt: total.reachedAt });
  assert.deepEqual(shelf.target, { kobo: 5_000_000, basis: "gross", minSenders: 3 });
  assert.equal(JSON.stringify(shelf).includes("chidi"), false, "senders aren't named");
  assert.deepEqual((await topGiftedToday(db, { uid: "bisi" })).rows.map((r) => r.username), ["ada"], "a sender who doesn't follow the teen");
  assert.deepEqual((await topGiftedToday(db, { uid: "fan" })).rows.map((r) => r.username), ["tola", "ada"], "a follower: most received first");
  assert.deepEqual((await topGiftedToday(db, { uid: "tola" })).rows.map((r) => r.username), ["tola", "ada"], "the teen themself");

  // The list is cached for a minute (statCache), not rebuilt on every visit.
  assert.ok((await db.doc(`statCache/giftShelf_${day}`).get()).exists);
  await send("bisi", "dayo", "kola");
  assert.deepEqual((await topGiftedToday(db, { uid: "fan" })).rows.map((r) => r.username), ["tola", "ada"], "from the cache");

  // Sent during a live that's on: the announcement opens that live. Anonymous stays anonymous.
  await db.doc("communityRooms/room1").set({ cid: "c1", status: "live", title: "Friday live" });
  const r9 = await send("chidi", "dayo", "champagne", true, "room1");
  burst = (await db.doc("giftBursts/latest").get()).data()!;
  assert.deepEqual([burst.reference, burst.href, burst.live, burst.senderName, burst.name], [r9, "/c/c1?room=room1", true, "", "Circova Champagne"]);
  // The live has ended: the link falls back to the creator's page.
  await db.doc("communityRooms/room1").update({ status: "ended" });
  const r10 = await send("chidi", "dayo", "gele", false, "room1");
  burst = (await db.doc("giftBursts/latest").get()).data()!;
  assert.deepEqual([burst.reference, burst.href, burst.live], [r10, "/u/dayo", false]);
  // Announcing switched off in Admin: nothing is written.
  GIFT_SETTINGS.grand.announce = false;
  assert.equal(await announceGrandGift(db, { reference: "X", giftId: "sunrise", name: "Kilimanjaro Sunrise", priceKobo: 100_000_000, senderName: "Z", toUid: "ada", toUsername: "ada" }), null);
  GIFT_SETTINGS.grand.announce = true;
  assert.equal((await db.doc("giftBursts/latest").get()).data()!.reference, r10);

  console.log("GIFTS SERVER OK");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
