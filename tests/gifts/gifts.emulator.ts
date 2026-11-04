// Animated gifts against the Firestore emulator (lib/gifts-server.ts, lib/payments.ts, lib/wallet-server.ts): an animated gift paid from
// NotesApp Credit settles like any gift (the plan's commission, held 7 days), adds to the receiver's total for the Lagos day in the same
// transaction, sets what visitors of their page play, and puts an animated gift in their bell. The big gifts need a verified sender.
// Once the target is reached from enough different people the receiver is on "Top gifted today"; a teen only for people who follow them.
// Run: npm run test:gifts-server → "GIFTS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GiftError, announceGrandGift, giftGate, priceAnimatedGift, topGiftedToday, weeklyBoards } from "../../lib/gifts-server";
import { GiftEarningsError, receivedGifts, setArchived, withdrawGifts } from "../../lib/gift-earnings-server";
import { autoReleasePayouts, releaseLedgerEntry } from "../../lib/payouts";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { payFromWallet } from "../../lib/wallet-server";
import { commissionRateFor } from "../../lib/tiers";
import { GIFT_SETTINGS, dailyId, giftUplift, lagosDayOf, lagosWeekOf, upliftedRate, weekBefore, withdrawRoute } from "../../lib/gift-catalogue";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const user = (uid: string, extra = {}) => Promise.all([
  db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid[0].toUpperCase() + uid.slice(1), role: "publisher", accountTier: "basic", ...extra }),
  db.doc(`usernames/${uid}`).set({ uid }),
  db.doc(`wallets/${uid}`).set({ creditKobo: 2_000_000 * 100, bonusLots: [] }),
]);
let n = 0;
// The checkout's record (app/api/paystack/initialize, kind "gift"), paid from the wallet, then settled.
async function send(from: string, to: string, giftId: string, anonymous = false, liveId?: string, quantity = 1, extra: Record<string, unknown> = {}): Promise<string> {
  const g = await priceAnimatedGift(db, from, giftId);
  const reference = `GIFT${++n}`;
  const to0 = (await db.doc(`users/${to}`).get()).data()!;
  const record: PaymentRecord = {
    reference, kind: "gift", uid: from, email: `${from}@x.ng`, amountKobo: g.priceKobo * quantity, status: "pending",
    publisherUid: to, publisherUsername: to, commissionRate: upliftedRate(commissionRateFor(to0.accountTier), giftUplift(g.priceKobo)), // as the checkout sets it
    gift: { username: to, message: "Thank you!", anonymous, senderName: from.toUpperCase(), animId: g.id, animName: g.name, uplift: giftUplift(g.priceKobo), ...(liveId ? { liveId } : {}), ...(quantity > 1 ? { quantity } : {}), ...extra },
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

  // ── Gifting everywhere (v0.140.0) ──────────────────────────────────────────────────────────────────────────────────────────────
  const week = lagosWeekOf(new Date());
  // Who may gift whom: payouts first, never yourself, never someone who blocked you, a teen only from mutual followers.
  assert.equal((await giftGate(db, "bisi", { username: "ada" })).ok, false);
  assert.equal(((await giftGate(db, "bisi", { username: "ada" })) as { reason: string }).reason, "no-payout");
  for (const u of ["ada", "tola", "dayo"]) await db.doc(`payoutAccounts/${u}`).set({ recipientCode: `RCP_${u}` });
  assert.deepEqual(await giftGate(db, "bisi", { username: "ada" }), { ok: true, uid: "ada", username: "ada", name: "Ada" });
  assert.equal(((await giftGate(db, "ada", { uid: "ada" })) as { reason: string }).reason, "self");
  await db.doc("dmBlocks/ada_dayo").set({ blocker: "ada", blocked: "dayo" });
  assert.equal(((await giftGate(db, "dayo", { uid: "ada" })) as { reason: string }).reason, "blocked");
  const teen = await giftGate(db, "fan", { uid: "tola" }); // fan follows Tola, but Tola doesn't follow fan back
  assert.ok(!teen.ok && teen.reason === "teen" && /only people Tola follows back/.test(teen.message));
  await db.doc("follows/tola_fan").set({ followerUid: "tola", username: "fan" });
  assert.equal((await giftGate(db, "fan", { uid: "tola" })).ok, true, "mutual followers may gift a teen");
  assert.equal(((await giftGate(db, "bisi", { uid: "tola" })) as { reason: string }).reason, "teen");
  assert.equal(((await giftGate(db, null, { uid: "tola" })) as { reason: string }).reason, "teen", "signed out: off");
  await db.doc("publisherSettings/dayo").set({ gifts: { enabled: false } });
  assert.equal(((await giftGate(db, "bisi", { uid: "dayo" })) as { reason: string }).reason, "off");

  // A send of 25 Garden Eggs to Ada as a commenter: one payment of 25 × ₦200, one gift record with ×25.
  const rq = await send("bisi", "ada", "gardenegg", false, undefined, 25, { toKind: "commenter", context: "comment" });
  const gq = (await db.doc(`gifts/${rq}`).get()).data()!;
  assert.deepEqual([gq.amountKobo, gq.quantity, gq.toKind, gq.context], [500_000, 25, "commenter", "comment"]);
  assert.equal((await db.doc(`ledger/${rq}`).get()).data()!.grossKobo, 500_000);
  assert.equal((await db.doc("giftShows/ada").get()).data()!.quantity, 25, "plays once with ×25");
  const qBell = (await db.collection("notifications").where("recipientUid", "==", "ada").get()).docs.map((d) => d.data()).find((b) => b.giftQty === 25);
  assert.match(qBell!.message, /BISI sent you 25 × Garden Egg \(₦5,000\)/);
  assert.equal((await db.doc("giftBursts/latest").get()).data()!.reference, r10, "a send of N small gifts is never announced, whatever the total");
  // A gift with no toKind or context is to the creator, from their profile.
  assert.deepEqual([(await db.doc(`gifts/${r1}`).get()).data()!.toKind, (await db.doc(`gifts/${r1}`).get()).data()!.context], ["creator", "profile"]);

  // Received gifts, grouped by gift, with count and value.
  let rec = (await db.doc("giftReceived/ada_gardenegg").get()).data()!;
  assert.deepEqual([rec.count, rec.valueKobo, rec.archived], [25, 500_000, false]);
  assert.deepEqual([(await db.doc("giftReceived/ada_kente").get()).data()!.count, (await db.doc("giftReceived/ada_kente").get()).data()!.valueKobo], [1, 5_000_000]);
  // Gift points: 1 per ₦100 spent, all time and this week (anonymous gifts count for the sender too).
  const pts = (await db.doc("giftPoints/chidi").get()).data()!;
  assert.deepEqual([pts.total, pts.thisWeek, pts.week], [500 + 1_000 + 1_500 + 250, 3_250, week]);
  assert.equal((await db.doc("giftPoints/bisi").get()).data()!.total, 200 + 200 + 10 + 50, "Adire Fan ×2, a Kola Nut, 25 Garden Eggs");

  // Weekly boards: Top gifted (receivers) and Ada's Top gifters (senders; anonymous senders left out).
  let boards = await weeklyBoards(db, null, { creatorUsername: "ada" });
  assert.equal(boards.week, week);
  assert.deepEqual(boards.gifted.map((r) => [r.username, r.kobo]), [["dayo", 17_600_000], ["ada", 8_000_000]], "teen left off for signed-out visitors");
  assert.deepEqual(boards.gifters!.map((r) => [r.username, r.kobo]), [["chidi", 5_000_000], ["bisi", 2_500_000]], "Dayo's gift was anonymous");
  boards = await weeklyBoards(db, { uid: "fan" }, {});
  assert.deepEqual(boards.gifted.map((r) => r.username), ["dayo", "tola", "ada"], "a follower sees the teen");
  // Last week is kept: a total written for last week still reads, and this week's doesn't leak into it.
  const lastWeek = weekBefore(week);
  await db.doc(`giftWeekly/${lastWeek}_bisi`).set({ week: lastWeek, uid: "bisi", grossKobo: 9_000_000, count: 4, senders: ["x"], lastAt: "x" });
  const last = await weeklyBoards(db, null, { which: "last" });
  assert.deepEqual([last.week, last.gifted.map((r) => [r.username, r.kobo])], [lastWeek, [["bisi", 9_000_000]]]);

  // Ada's Gifts tab: everyone sees the gifts; only Ada sees the money. Nothing is past the 7-day review yet.
  const pub = await receivedGifts(db, { uid: "bisi" }, "ada");
  assert.equal(pub!.money, undefined);
  assert.deepEqual(pub!.rows.map((r) => [r.key, r.count]), [["kente", 1], ["adire", 1], ["gardenegg", 25], ["jollof", 1]]);
  let mine = await receivedGifts(db, { uid: "ada" }, "ada");
  assert.equal(mine!.money!.readyKobo, 0);
  assert.ok(mine!.money!.inReviewKobo > 0 && mine!.money!.payoutReady && mine!.money!.autoBelowKobo === 2_000_000);
  await assert.rejects(withdrawGifts(db, "ada"), (e: unknown) => e instanceof GiftEarningsError && e.status === 409 && /past its review/.test(e.message));
  assert.equal(await receivedGifts(db, { uid: "bisi" }, "tola"), null, "a teen's gifts: only for people they follow");
  assert.ok(await receivedGifts(db, { uid: "fan" }, "tola"));

  // Archive: out of the list, still counted under Archived, earnings untouched.
  await setArchived(db, "ada", "kente", true);
  mine = await receivedGifts(db, { uid: "ada" }, "ada");
  assert.deepEqual([mine!.rows.map((r) => r.key), mine!.archived.kinds, mine!.archived.count, mine!.archived.valueKobo], [["adire", "gardenegg", "jollof"], 1, 1, 5_000_000]);
  await assert.rejects(setArchived(db, "ada", "sunrise", true), GiftEarningsError);

  // Two small gifts pass their review: under the line, so the withdrawal goes automatically through the usual payout.
  const past = new Date(Date.now() - 60_000).toISOString();
  const jollofRef = (await db.collection("gifts").where("toUid", "==", "ada").where("animId", "==", "jollof").get()).docs[0].id;
  for (const r of [rq, jollofRef]) await db.doc(`ledger/${r}`).update({ releaseAfter: past });
  const smallNet = (await db.doc(`ledger/${rq}`).get()).data()!.netKobo + (await db.doc(`ledger/${jollofRef}`).get()).data()!.netKobo;
  const w1 = await withdrawGifts(db, "ada");
  assert.deepEqual([w1.amountKobo, w1.count, w1.route], [smallNet, 2, "auto"]);
  const pay1 = (await db.doc(`ledger/${w1.id}`).get()).data()!;
  assert.deepEqual([pay1.kind, pay1.netKobo, pay1.commissionKobo, pay1.status, pay1.needsApproval], ["gift_payout", smallNet, 0, "held", undefined]);
  for (const r of [rq, jollofRef]) assert.deepEqual([(await db.doc(`ledger/${r}`).get()).data()!.status, (await db.doc(`ledger/${r}`).get()).data()!.withdrawalId], ["withdrawn", w1.id]);
  const sent: { amountKobo: number; recipient: string; reference: string }[] = [];
  const transfer = async (p: { amountKobo: number; recipient: string; reference: string; reason: string }) => { sent.push(p); return { transfer_code: "TRF_1", status: "pending" }; };
  assert.deepEqual(await releaseLedgerEntry(w1.id, { transfer }), { ok: true, transferStatus: "pending" });
  assert.deepEqual(sent, [{ amountKobo: smallNet, recipient: "RCP_ada", reference: `payout_${w1.id}`, reason: "#NotesApp gift_payout payout" }], "one transfer for both gifts");
  await assert.rejects(withdrawGifts(db, "ada"), GiftEarningsError, "nothing left past its review");

  // The rest pass their review: over the line, so it waits for a person in Admin → Payments; the scheduled payouts leave it alone.
  for (const d of (await db.collection("ledger").where("publisherUid", "==", "ada").where("kind", "==", "gift").where("status", "==", "held").get()).docs) await d.ref.update({ releaseAfter: past });
  const w2 = await withdrawGifts(db, "ada");
  assert.equal(w2.route, "approval");
  assert.ok(w2.amountKobo >= 2_000_000);
  assert.equal((await db.doc(`ledger/${w2.id}`).get()).data()!.needsApproval, true);
  assert.equal(await autoReleasePayouts({ transfer }), 0, "approval withdrawals aren't sent by the schedule");
  assert.equal(sent.length, 1);
  mine = await receivedGifts(db, { uid: "ada" }, "ada");
  assert.deepEqual(mine!.money!.withdrawals.map((w) => [w.id, w.status]), [[w2.id, "waiting for approval"], [w1.id, "sending"]]);
  assert.equal(mine!.archived.valueKobo, 5_000_000, "archived gifts keep their value after withdrawing");
  // A person approves it: the same release, once.
  assert.equal((await releaseLedgerEntry(w2.id, { transfer })).ok, true);
  assert.equal(sent[1].amountKobo, w2.amountKobo);
  // The withdrawal line is an admin setting: lowered, the same amount would have gone automatically.
  GIFT_SETTINGS.economy.autoWithdrawMaxKobo = 100_000_000;
  assert.equal(withdrawRoute(w2.amountKobo), "auto");
  GIFT_SETTINGS.economy.autoWithdrawMaxKobo = 2_000_000;

  console.log("GIFTS SERVER OK");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
