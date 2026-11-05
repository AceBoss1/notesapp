// Paid lives against the Firestore emulator (lib/live-tickets-server.ts, lib/payments.ts, lib/rooms-server.ts, lib/payouts.ts): checkout
// with the band, the subscriber discount and the uplifted commission fixed on the payment; the ticket written with the payment; the door
// (only ticket holders, the host and the moderators the host names; community moderators get nothing); the late window; the money held
// until the live ends plus the problem window, then paid out; refunds to NotesApp Credit when the host cancels or never starts (card
// payments too), and a ticket that can't be issued refunded the same way; a "safety only" recording never becomes a replay.
// Run: npm run test:live-tickets-server → "LIVE TICKETS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  LiveEventError, cancelLiveEvent, createLiveEvent, enterPaidLive, liveLobby, liveTicketCheckout, readForLiveTicket, startPaidLive, sweepPaidLives, writeLiveTicket,
} from "../../lib/live-tickets-server";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { payFromWallet } from "../../lib/wallet-server";
import { commissionRateFor } from "../../lib/tiers";
import { upliftedRate } from "../../lib/gift-catalogue";
import { autoReleasePayouts } from "../../lib/payouts";
import { joinRoom, leaveRoom, removeChat, setRoomMods } from "../../lib/rooms-server";
import { CommunityError } from "../../lib/community-server";
import { publishReplay } from "../../lib/live-recording-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const MIN = 60_000;
const T0 = Date.now() - 3 * 3_600_000; // three hours ago, so the live's end is in the past when payouts are checked
const T = (m: number) => new Date(T0 + m * MIN);
const WALLET = 100_000 * 100;
const user = (uid: string, extra = {}) => Promise.all([
  db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid[0].toUpperCase() + uid.slice(1), avatar: "", role: "reader", accountTier: "standard", ...extra }),
  db.doc(`wallets/${uid}`).set({ creditKobo: WALLET, bonusLots: [] }),
]);
const sub = (uid: string, tier: string) => db.doc(`subscriptions/${uid}_ada`).set({ subscriberUid: uid, username: "ada", tier, status: "active", currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000).toISOString() });
const credit = async (uid: string) => (await db.doc(`wallets/${uid}`).get()).data()!.creditKobo as number;
const rejects = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => (e instanceof LiveEventError || e instanceof CommunityError) && e.status === status && re.test(e.message));

let n = 0;
// The checkout (app/api/paystack/initialize, kind "live_ticket"): from NotesApp Credit, then settled.
async function buy(uid: string, eventId: string, at: Date): Promise<PaymentRecord> {
  const lt = await liveTicketCheckout(db, uid, { eventId }, at);
  const record: PaymentRecord = {
    reference: `LT${++n}`, kind: "live_ticket", uid, email: `${uid}@x.ng`, amountKobo: lt.amountKobo, status: "pending",
    publisherUid: lt.hostUid, publisherUsername: lt.hostUsername, commissionRate: lt.commissionRate, liveTicket: lt.info, createdAt: new Date().toISOString(),
  };
  await payFromWallet(db, record);
  return fulfillPayment(record.reference);
}
// A card payment Paystack confirmed (written as fulfillPayment would, without calling Paystack).
async function buyByCard(uid: string, eventId: string, at: Date): Promise<PaymentRecord> {
  const lt = await liveTicketCheckout(db, uid, { eventId }, at);
  const p: PaymentRecord = {
    reference: `LC${++n}`, kind: "live_ticket", uid, email: `${uid}@x.ng`, amountKobo: lt.amountKobo, status: "paid",
    publisherUid: lt.hostUid, publisherUsername: lt.hostUsername, commissionRate: lt.commissionRate, liveTicket: lt.info, createdAt: new Date().toISOString(),
  };
  await db.doc(`payments/${p.reference}`).set(p);
  await db.runTransaction(async (t) => {
    const read = await readForLiveTicket(t, db, p);
    assert.ok(writeLiveTicket(t, db, p, read, new Date().toISOString()));
    t.set(db.doc(`ledger/${p.reference}`), { reference: p.reference, kind: "live_ticket", publisherUid: "ada", publisherUsername: "ada", payerUid: uid, grossKobo: p.amountKobo, commissionKobo: Math.round(p.amountKobo * p.commissionRate), netKobo: p.amountKobo - Math.round(p.amountKobo * p.commissionRate), status: "held", releaseAfter: lt.info.startsAt, createdAt: new Date().toISOString(), awaitingLive: true });
  });
  return p;
}
const live = (o: Record<string, unknown> = {}) => ({
  title: "Raising your first ₦5m: live Q&A", startsAt: T(20).toISOString(), earlyUntil: T(10).toISOString(), earlyNaira: 2000, normalNaira: 3000, lateNaira: 4000, audience: "premium", record: "replay", ...o,
});

(async () => {
  await Promise.all([
    user("ada", { role: "publisher", accountTier: "basic" }), user("bisi"), user("chidi"), user("dayo"), user("eve"), user("zed"), user("mod"), user("cmod"),
    user("tolu", { role: "publisher", accountTier: "basic", teen: true }), user("nopay", { role: "publisher", accountTier: "basic" }),
  ]);
  await db.doc("payoutAccounts/ada").set({ uid: "ada", recipientCode: "RCP_ada" });
  await db.doc("payoutAccounts/tolu").set({ uid: "tolu", recipientCode: "RCP_tolu" });
  // Ada's tiers: Premium 10% off paid-live tickets, VIP 20%, VVIP 80% (over the Admin cap of 50%, so 50%).
  await db.doc("publisherSettings/ada").set({ uid: "ada", username: "ada", subscription: { enabled: true, tiers: { premium: { enabled: true, priceKobo: 200_000, planCode: "P", liveDiscountPct: 10 }, vip: { enabled: true, priceKobo: 750_000, planCode: "V", liveDiscountPct: 20 }, vvip: { enabled: true, priceKobo: 2_500_000, planCode: "W", liveDiscountPct: 80 } } } });
  await Promise.all([sub("dayo", "premium"), sub("chidi", "vip"), sub("eve", "premium"), sub("zed", "vvip")]);
  // Chidi has Bonus Credits: tickets never use them.
  await db.doc("wallets/chidi").set({ creditKobo: WALLET, bonusLots: [{ id: "b1", kobo: 50_000, expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), source: "topup" }] });
  // A moderator of some community: no powers in a member's own live.
  await db.doc("communityMembers/c1_cmod").set({ cid: "c1", uid: "cmod", username: "cmod", role: "moderator", status: "active" });

  // ── Scheduling: publishers with a payout account; never in teen mode ──
  await rejects(createLiveEvent(db, "tolu", live(), T(0)), 403, /teen mode/);
  await rejects(createLiveEvent(db, "nopay", live(), T(0)), 409, /bank account/);
  await rejects(createLiveEvent(db, "bisi", live(), T(0)), 403, /publishing accounts/);
  await rejects(createLiveEvent(db, "ada", live({ lateNaira: 2500 }), T(0)), 400, /late price/);
  const e1 = await createLiveEvent(db, "ada", live(), T(0));
  assert.deepEqual([e1.status, e1.lateWindowMin, e1.sold, e1.prices.earlyKobo, e1.audience, e1.record], ["scheduled", 20, 0, 200_000, "premium", "replay"]);

  // ── Checkout: the band, the tier's discount (capped) and the uplifted commission are fixed on the payment ──
  await rejects(liveTicketCheckout(db, "bisi", { eventId: e1.id }, T(1)), 403, /Premium and up subscribers/);
  await rejects(liveTicketCheckout(db, "ada", { eventId: e1.id }, T(1)), 409, /You're the host/);
  const rate = upliftedRate(commissionRateFor("basic"), 0.1);
  const pd = await buy("dayo", e1.id, T(1)); // early bird, Premium 10% off
  assert.equal(pd.status, "paid");
  assert.deepEqual([pd.amountKobo, pd.commissionRate, pd.liveTicket!.band, pd.liveTicket!.discountPct, pd.liveTicket!.tier, pd.liveTicket!.upliftPct], [180_000, rate, "early", 10, "premium", 10]);
  const pc = await buy("chidi", e1.id, T(12)); // normal, VIP 20% off
  assert.deepEqual([pc.amountKobo, pc.liveTicket!.band, pc.liveTicket!.discountPct], [240_000, "normal", 20]);
  const zq = await liveTicketCheckout(db, "zed", { eventId: e1.id }, T(12));
  assert.equal(zq.info.discountPct, 50, "VVIP's 80% is cut to the cap");
  assert.equal(zq.amountKobo, 150_000);
  await rejects(liveTicketCheckout(db, "dayo", { eventId: e1.id }, T(2)), 409, /already have a ticket/);
  assert.equal(await credit("dayo"), WALLET - 180_000, "taken from NotesApp Credit");
  const cw = (await db.doc("wallets/chidi").get()).data()!;
  assert.deepEqual([cw.creditKobo, cw.bonusLots[0].kobo], [WALLET - 240_000, 50_000], "Bonus Credits are never spent on tickets");
  const tk = (await db.doc(`liveTickets/${e1.id}_dayo`).get()).data()!;
  assert.deepEqual([tk.status, tk.band, tk.listKobo, tk.paidKobo, tk.reference, tk.hostUid], ["valid", "early", 200_000, 180_000, pd.reference, "ada"]);
  const led = (await db.doc(`ledger/${pd.reference}`).get()).data()!;
  assert.deepEqual([led.kind, led.publisherUid, led.grossKobo, led.commissionKobo, led.netKobo, led.status, led.awaitingLive], ["live_ticket", "ada", 180_000, Math.round(180_000 * rate), 180_000 - Math.round(180_000 * rate), "held", true]);
  assert.equal((await db.doc(`liveEvents/${e1.id}`).get()).data()!.sold, 2);
  // Settling the same payment again changes nothing.
  await fulfillPayment(pd.reference);
  assert.equal((await db.doc(`liveEvents/${e1.id}`).get()).data()!.sold, 2);
  // The lobby: Dayo sees the ticket; Bisi why they can't buy; the host the count.
  const lobby = await liveLobby(db, e1.id, "dayo", T(3));
  assert.deepEqual([lobby.ticket?.bandName, lobby.ticket?.paidKobo, lobby.canBuy, lobby.band?.band], ["Early bird", 180_000, false, "early"]);
  assert.match(lobby.ticket!.ref, /^NAPL-[2-9A-Z]{4}$/);
  assert.match((await liveLobby(db, e1.id, "bisi", T(3))).why, /Premium subscribers and up/);
  assert.equal((await liveLobby(db, e1.id, "ada", T(3))).event.sold, 2);
  assert.equal((await liveLobby(db, e1.id, "zed", T(12))).band?.payKobo, 150_000, "the lobby shows the viewer's discounted price");

  // ── Nothing is paid out before the live happens ──
  const sent: string[] = [];
  const transfer = async (a: { reference: string }) => { sent.push(a.reference); return { transfer_code: `TRF_${a.reference}`, status: "success" } as never; };
  assert.equal(await autoReleasePayouts({ transfer, now: Date.now() + 30 * 86_400_000 }), 0, "awaiting the live");

  // ── Going live and the door ──
  await rejects(enterPaidLive(db, "dayo", e1.id, T(14)), 409, /hasn't started/);
  await rejects(startPaidLive(db, "dayo", e1.id, T(16)), 403, /Only the host/);
  await rejects(startPaidLive(db, "ada", e1.id, T(4)), 409, /15 minutes before/);
  const s = await startPaidLive(db, "ada", e1.id, T(16));
  const room = (await db.doc(`communityRooms/${s.roomId}`).get()).data()!;
  assert.deepEqual([room.cid, room.communityName, room.paid, room.hostUid, room.status], ["", "", { eventId: e1.id, record: "replay" }, "ada", "live"], "a member-hosted room, no community");
  let ev1 = (await db.doc(`liveEvents/${e1.id}`).get()).data()!;
  assert.deepEqual([ev1.status, ev1.roomId, ev1.startedAt], ["live", s.roomId, T(16).toISOString()]);
  const bells = (await db.collection("notifications").where("recipientUid", "==", "chidi").get()).docs.map((d) => String(d.data().message));
  assert.ok(bells.some((m) => /is live now/.test(m)), "ticket holders hear it started");
  // No ticket: refused at the door and at the room itself.
  await rejects(enterPaidLive(db, "zed", e1.id, T(16.2)), 403, /ticket holders/);
  await rejects(joinRoom(db, "zed", s.roomId, T(16.2)), 403, /ticket holders/);
  // A ticket: the door gives the room and marks it checked; joining works.
  const door = await enterPaidLive(db, "dayo", e1.id, T(16.3));
  assert.equal(door.roomId, s.roomId);
  assert.equal((await db.doc(`liveTickets/${e1.id}_dayo`).get()).data()!.checkedInAt, T(16.3).toISOString());
  assert.equal((await joinRoom(db, "dayo", s.roomId, T(16.4))).ok, true);
  // A moderator the host names comes in without a ticket and can moderate; a community's moderator can't.
  await rejects(joinRoom(db, "mod", s.roomId, T(16.5)), 403, /ticket holders/);
  await setRoomMods(db, "ada", s.roomId, ["@mod"]);
  assert.equal((await enterPaidLive(db, "mod", e1.id, T(16.5))).roomId, s.roomId);
  assert.equal((await joinRoom(db, "mod", s.roomId, T(16.5))).ok, true);
  await db.doc(`communityRooms/${s.roomId}/chat/m1`).set({ from: "dayo", name: "Dayo", avatar: "", text: "hi", at: T(16.6).toISOString() });
  await rejects(removeChat(db, "cmod", s.roomId, "m1"), 403, /Only the host or a moderator/);
  await removeChat(db, "mod", s.roomId, "m1");
  assert.ok(!(await db.doc(`communityRooms/${s.roomId}/chat/m1`).get()).exists, "the named moderator removed it");

  // ── Late tickets until the live has run the late window (from the start time, as the host opened early) ──
  const pe = await buyByCard("eve", e1.id, T(25)); // late, Premium 10% off, by card
  assert.deepEqual([pe.amountKobo, pe.liveTicket!.band], [360_000, "late"]);
  await rejects(liveTicketCheckout(db, "zed", { eventId: e1.id }, T(40)), 409, /closed 20 minutes into the live/);
  assert.equal((await db.doc(`liveEvents/${e1.id}`).get()).data()!.sold, 3);

  // ── The end: the money waits the problem window from the end, then is paid out ──
  await leaveRoom(db, "ada", s.roomId, T(70));
  ev1 = (await db.doc(`liveEvents/${e1.id}`).get()).data()!;
  assert.deepEqual([ev1.status, ev1.endedAt], ["ended", T(70).toISOString()]);
  for (const ref of [pd.reference, pc.reference, pe.reference]) {
    const l = (await db.doc(`ledger/${ref}`).get()).data()!;
    assert.deepEqual([l.releaseAfter, l.awaitingLive, l.status], [T(70).toISOString(), undefined, "held"]);
  }
  await rejects(enterPaidLive(db, "dayo", e1.id, T(71)), 409, /has ended/);
  assert.equal(await autoReleasePayouts({ transfer, now: T(70).getTime() + 23 * 3_600_000 }), 0, "inside the problem window");
  assert.equal(await autoReleasePayouts({ transfer, now: T(70).getTime() + 25 * 3_600_000 }), 3, "after the end plus the window");
  assert.deepEqual(sent.sort(), [pc.reference, pd.reference, pe.reference].map((r) => `payout_${r}`).sort());
  assert.equal((await db.doc(`ledger/${pd.reference}`).get()).data()!.status, "transferring");

  // ── The host cancels: everyone refunded to NotesApp Credit (a card payment too) ──
  const e2 = await createLiveEvent(db, "ada", live({ audience: "everyone", title: "Second live" }), T(0));
  const d0 = await credit("dayo"), b0 = await credit("bisi");
  const p2 = await buy("dayo", e2.id, T(1));
  const p3 = await buyByCard("bisi", e2.id, T(1));
  assert.equal(p3.amountKobo, 200_000, "everyone: Bisi has no subscription, no discount");
  await rejects(cancelLiveEvent(db, "dayo", e2.id, {}, T(5)), 403, /Only the host/);
  assert.deepEqual(await cancelLiveEvent(db, "ada", e2.id, {}, T(5)), { refunded: 2 });
  assert.equal(await credit("dayo"), d0, "the wallet payment is back");
  assert.equal(await credit("bisi"), b0 + 200_000, "the card payment became NotesApp Credit");
  for (const [p, who] of [[p2, "dayo"], [p3, "bisi"]] as const) {
    assert.equal((await db.doc(`payments/${p.reference}`).get()).data()!.status, "refunded");
    assert.equal((await db.doc(`ledger/${p.reference}`).get()).data()!.status, "refunded");
    assert.equal((await db.doc(`liveTickets/${e2.id}_${who}`).get()).data()!.status, "refunded");
  }
  assert.deepEqual([(await db.doc(`liveEvents/${e2.id}`).get()).data()!.status, (await db.doc(`liveEvents/${e2.id}`).get()).data()!.sold], ["cancelled", 0]);
  await rejects(cancelLiveEvent(db, "ada", e2.id, {}, T(6)), 409, /already cancelled/);
  assert.equal(await credit("bisi"), b0 + 200_000, "refunded once");
  await rejects(liveTicketCheckout(db, "chidi", { eventId: e2.id }, T(6)), 409, /cancelled/);
  // A payment that lands after the cancel (started before it) can't become a ticket: back to credit at once.
  const c0 = await credit("chidi");
  const late: PaymentRecord = { ...p2, reference: "LATE1", uid: "chidi", email: "chidi@x.ng", status: "pending", liveTicket: { ...p2.liveTicket!, holderName: "Chidi" } };
  delete (late as { payWith?: string }).payWith; delete (late as { walletDebit?: unknown }).walletDebit;
  await payFromWallet(db, late);
  assert.equal(await credit("chidi"), c0 - late.amountKobo);
  assert.equal((await fulfillPayment("LATE1")).status, "paid_slot_conflict");
  assert.equal(await credit("chidi"), c0, "refunded to credit");
  assert.equal((await db.doc("payments/LATE1").get()).data()!.status, "refunded");

  // ── Reminders, and a live the host never starts ──
  const e3 = await createLiveEvent(db, "ada", live({ audience: "everyone", title: "Third live" }), T(0));
  await buy("bisi", e3.id, T(1));
  const push = async () => 0;
  assert.equal(await sweepPaidLives(db, T(2), push), 1, "the hour reminder");
  assert.equal(await sweepPaidLives(db, T(3), push), 0, "once");
  const bb = await credit("bisi");
  assert.equal(await sweepPaidLives(db, T(20 + 59), push), 0, "not yet a no-show");
  await rejects(startPaidLive(db, "ada", e3.id, T(20 + 60)), 409, /didn't start in time/);
  assert.equal(await sweepPaidLives(db, T(20 + 60), push), 1, "cancelled and refunded");
  const e3d = (await db.doc(`liveEvents/${e3.id}`).get()).data()!;
  assert.deepEqual([e3d.status, e3d.cancelWhy], ["cancelled", "no_show"]);
  assert.equal(await credit("bisi"), bb + 200_000);

  // ── "Safety only": recorded for review, never a replay ──
  await db.doc("roomRecordings/REC_SAFE1").set({ roomId: "x", cid: "", communityName: "", title: "Safe", hostUid: "ada", hostName: "Ada", status: "ready", startedAt: T(0).toISOString(), published: false, files: { audio: { key: "k", type: "audio/webm", uploadId: "", parts: [], pending: [], lastSeq: 0, size: 1, done: true } }, stage: ["ada"], liveEventId: e1.id, safetyOnly: true });
  await assert.rejects(publishReplay(db, "ada", "REC_SAFE1", { audience: "public" }), /safety review only/);

  console.log("LIVE TICKETS SERVER OK");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
