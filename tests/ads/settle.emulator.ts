// Ended boosts and adverts are settled by themselves (lib/promo-settle-server.ts) on the Firestore emulator, with the refund stubbed:
// the undelivered share refunded pro rata once, nothing for a running or fully delivered one, a cancelled boost left alone, a failed
// refund retried and then left for an admin. Run: npm run test:settle → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const { settleEndedPromotions, settleBoost, settleAdCampaign, undeliveredShare, MAX_TRIES } = await import("../../lib/promo-settle-server");
  const now = Date.parse("2026-11-05T10:00:00Z");
  const past = "2026-11-01T00:00:00Z", future = "2026-12-01T00:00:00Z";
  const refunds: [string, number][] = [];
  const refund = async (ref: string, kobo: number) => { refunds.push([ref, kobo]); };

  assert.equal(undeliveredShare(1_250_000, 5_000, 258), 1_185_500, "₦12,500 for 5,000, 258 delivered: ₦11,855 back");
  assert.equal(undeliveredShare(300_000, 1_000, 1_000), 0);
  assert.equal(undeliveredShare(300_000, 1_000, 1_200), 0, "over-delivery never charges more");

  // boosts
  await db.doc("boosts/b_ended").set({ status: "active", endsAt: past, amountKobo: 300_000, impressionsPurchased: 1_000, impressionsDelivered: 300, publisherUid: "u_ada", title: "My gig" });
  await db.doc("boosts/b_running").set({ status: "active", endsAt: future, amountKobo: 300_000, impressionsPurchased: 1_000, impressionsDelivered: 10, publisherUid: "u_ada" });
  await db.doc("boosts/b_full").set({ status: "completed", endsAt: future, amountKobo: 300_000, impressionsPurchased: 1_000, impressionsDelivered: 1_000, publisherUid: "u_ada" });
  await db.doc("boosts/b_cancelled").set({ status: "closed", endsAt: past, amountKobo: 300_000, impressionsPurchased: 1_000, impressionsDelivered: 100, refundedKobo: 135_000, publisherUid: "u_ada" });
  // the advert in the owner's screenshot: Starter, ₦12,500 for 5,000, marked completed with 258 seen and nothing refunded
  await db.doc("adCampaigns/ad_starter").set({ status: "completed", endsAt: past, amountKobo: 1_250_000, impressionsBudget: 5_000, uid: "u_ada", advertiserName: "Ada", creative: { title: "Hire me" } });
  await db.doc("adCampaigns/ad_live").set({ status: "live", endsAt: future, amountKobo: 1_250_000, impressionsBudget: 5_000, uid: "u_ada" });
  await db.doc("adCreatives/ad_starter").set({ active: true, campaignId: "ad_starter" });
  const delivered = async (id: string) => (id === "ad_starter" ? 258 : 0);

  const n = await settleEndedPromotions(db, { refund, now, delivered });
  assert.equal(n, 3, "the ended boost, the fully delivered boost and the ended advert");
  assert.deepEqual(refunds.sort(), [["ad_starter", 1_185_500], ["b_ended", 210_000]].sort(), "only undelivered shares are refunded");

  const be = (await db.doc("boosts/b_ended").get()).data()!;
  assert.equal(be.status, "completed"); assert.equal(be.refundedKobo, 210_000); assert.ok(be.settledAt); assert.equal(be.settledBy, "auto"); assert.equal(be.settlement, "settled");
  const bf = (await db.doc("boosts/b_full").get()).data()!;
  assert.equal(bf.refundedKobo, 0); assert.ok(bf.settledAt);
  assert.equal((await db.doc("boosts/b_running").get()).data()!.settledAt, undefined, "a running boost isn't touched");
  assert.equal((await db.doc("boosts/b_cancelled").get()).data()!.refundedKobo, 135_000, "a cancelled boost keeps its own settlement");

  const ad = (await db.doc("adCampaigns/ad_starter").get()).data()!;
  assert.equal(ad.refundedKobo, 1_185_500); assert.equal(ad.impressionsDelivered, 258); assert.equal(ad.status, "completed"); assert.ok(ad.settledAt);
  assert.equal((await db.doc("adRevenue/refund_ad_starter").get()).data()!.amountKobo, -1_185_500, "the revenue books get the negative entry");
  assert.equal((await db.doc("adCreatives/ad_starter").get()).data()!.active, false);
  assert.equal((await db.doc("adCampaigns/ad_live").get()).data()!.settledAt, undefined);

  const bells = (await db.collection("notifications").where("recipientUid", "==", "u_ada").get()).docs.map((d) => String(d.data().message));
  assert.ok(bells.some((m) => m.includes('"My gig"') && m.includes("300 of 1,000") && m.includes("₦2,100")), "the member is told what comes back");
  assert.ok(!bells.some((m) => m.includes("all 1,000")), "no bell when nothing is refunded");

  // settled once: a second run, and the admin buttons, refund nothing more
  refunds.length = 0;
  assert.equal(await settleEndedPromotions(db, { refund, now, delivered }), 0);
  assert.equal((await settleBoost(db, "b_ended", { refund, now })).settled, false);
  assert.equal((await settleAdCampaign(db, "ad_starter", { refund, now, delivered })).settled, false);
  assert.equal(refunds.length, 0, "never refunded twice");

  // a refund that fails is released and tried again; after MAX_TRIES it waits for an admin
  await db.doc("boosts/b_flaky").set({ status: "active", endsAt: past, amountKobo: 300_000, impressionsPurchased: 1_000, impressionsDelivered: 0, publisherUid: "u_bo" });
  const failing = async () => { throw new Error("Paystack said no"); };
  await settleEndedPromotions(db, { refund: failing, now });
  let fl = (await db.doc("boosts/b_flaky").get()).data()!;
  assert.equal(fl.settleTries, 1); assert.equal(fl.settlement, null); assert.equal(fl.settleError, "Paystack said no"); assert.equal(fl.settledAt, undefined);
  await settleEndedPromotions(db, { refund, now });
  fl = (await db.doc("boosts/b_flaky").get()).data()!;
  assert.equal(fl.refundedKobo, 300_000); assert.ok(fl.settledAt); assert.equal(fl.settleError, null);

  await db.doc("boosts/b_stuck").set({ status: "active", endsAt: past, amountKobo: 300_000, impressionsPurchased: 1_000, impressionsDelivered: 0, publisherUid: "u_bo", settleTries: MAX_TRIES });
  refunds.length = 0;
  await settleEndedPromotions(db, { refund, now });
  assert.equal(refunds.length, 0, "past the retry limit, the sweep leaves it for an admin");
  assert.equal((await settleBoost(db, "b_stuck", { refund, now, by: "u_admin" })).refundKobo, 300_000, "an admin can still settle it");

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
