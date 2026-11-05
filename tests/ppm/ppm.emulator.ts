// Pay-per-minute sessions against the Firestore emulator (lib/ppm-server.ts, lib/wallet-server.ts holds, lib/calls-server.ts,
// lib/payouts.ts): the publisher's offer (teens can't sell); booking with the tier gate (teens can't book) and the minutes' price HELD
// from NotesApp Credit (never Bonus Credits, never charged yet); the call; the server's meter from both phones' beats; the "add minutes"
// prompt when the hold runs out, a top-up, and the end: per started minute charged after the grace, unused minutes back, a "ppm" payment
// and a held ledger entry paid out after the problem window. Also: the call ending itself when the hold runs out and nobody adds
// minutes, a dropped phone, a call inside the grace, cancelling, a session that never happened, and reporting a problem.
// Run: npm run test:ppm-server → "PPM SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  PpmError, addPpmMinutes, beatPpm, bookPpm, cancelPpm, myPpmSessions, ppmOfferView, ppmRef, ppmSessionView, reportPpm, savePpmOffer, startPpmCall, sweepPpm,
} from "../../lib/ppm-server";
import { WalletError, walletSummary } from "../../lib/wallet-server";
import { endCall, type CallDeps } from "../../lib/calls-server";
import { commissionRateFor } from "../../lib/tiers";
import { upliftedRate } from "../../lib/gift-catalogue";
import { autoReleasePayouts } from "../../lib/payouts";
import { refundPayment } from "../../lib/refunds";
import { slotLockId } from "../../lib/paystack";
import { sessionStart, weekdayOf } from "../../lib/booking-time";
import type { PpmSessionDoc } from "../../lib/ppm";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const deps = { push: async () => 1, bell: async () => {} } as unknown as CallDeps;
const DAY = 86_400_000;
// The session day: three days ago (Lagos), so payouts can be checked against today's clock; booked the day before.
const D = new Date(Date.now() - 3 * DAY + 3_600_000).toISOString().slice(0, 10);
const BOOKED_AT = new Date(sessionStart(D, "09:00").getTime() - DAY);
const SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const WALLET = 25_000 * 100;
const user = (uid: string, extra = {}) => Promise.all([
  db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid[0].toUpperCase() + uid.slice(1), avatar: "", role: "reader", accountTier: "standard", ...extra }),
  db.doc(`usernames/${uid}`).set({ uid }),
  db.doc(`wallets/${uid}`).set({ creditKobo: WALLET, bonusLots: [] }),
]);
const sub = (uid: string, tier: string) => db.doc(`subscriptions/${uid}_kemi`).set({ subscriberUid: uid, username: "kemi", tier, status: "active", currentPeriodEnd: new Date(Date.now() + 20 * DAY).toISOString() });
const credit = async (uid: string) => (await db.doc(`wallets/${uid}`).get()).data()!.creditKobo as number;
const sess = async (id: string) => (await db.doc(`ppmSessions/${id}`).get()).data() as PpmSessionDoc;
const rejects = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => (e instanceof PpmError || e instanceof WalletError) && e.status === status && re.test(e.message));
const at = (slot: string, sec: number) => new Date(sessionStart(D, slot).getTime() + sec * 1000);

// Both phones in the call: beats every 15 seconds from `from` to `to` (seconds after the slot's start); the host's phone a second later.
async function talk(id: string, slot: string, from: number, to: number, who: ("bisi" | "kemi")[] = ["bisi", "kemi"]) {
  let last: Awaited<ReturnType<typeof beatPpm>> | null = null;
  for (let s = from; s <= to; s += 15) for (const [i, w] of who.entries()) last = await beatPpm(db, w, id, at(slot, s + i), deps);
  return last!;
}
async function call(id: string, slot: string, by = "bisi") {
  const c = await startPpmCall(db, by, id, at(slot, -60), deps);
  // The person called picks up (their browser writes the answer; here, straight to the doc).
  await db.doc(`calls/${c.id}`).update({ status: "accepted", acceptedAt: at(slot, 0).toISOString() });
  return c;
}

(async () => {
  await Promise.all([
    user("kemi", { role: "publisher", accountTier: "basic", displayName: "Dr Kemi Ojo" }), user("bisi"), user("chidi"), user("dayo"), user("poor"),
    user("teena", { teen: true }), user("tolu", { role: "publisher", accountTier: "basic", teen: true }), user("nopay", { role: "publisher", accountTier: "basic" }),
  ]);
  await db.doc("payoutAccounts/kemi").set({ uid: "kemi", recipientCode: "RCP_kemi" });
  await db.doc("payoutAccounts/tolu").set({ uid: "tolu", recipientCode: "RCP_tolu" });
  await db.doc("publisherSettings/kemi").set({ uid: "kemi", username: "kemi", session: { enabled: false, priceKobo: 500_000, minutes: 45, availability: { [String(weekdayOf(D))]: SLOTS } } });
  await Promise.all([sub("bisi", "premium"), sub("teena", "vvip"), sub("poor", "vip"), sub("dayo", "vip")]);
  // Bisi also has Bonus Credits: a hold never touches them.
  await db.doc("wallets/bisi").set({ creditKobo: WALLET, bonusLots: [{ id: "b1", kobo: 50_000, expiresAt: new Date(Date.now() + 30 * DAY).toISOString(), source: "topup" }] });
  await db.doc("wallets/poor").set({ creditKobo: 1_000 * 100, bonusLots: [{ id: "b2", kobo: 900_000, expiresAt: new Date(Date.now() + 30 * DAY).toISOString(), source: "topup" }] });

  // ── The offer: ₦150 a minute voice, ₦300 video, for Premium, VIP and VVIP subscribers ──
  await assert.rejects(savePpmOffer(db, "tolu", { enabled: true, voiceNaira: 100 }), (e: unknown) => e instanceof PpmError && e.status === 403 && /teen mode/.test(e.message));
  await assert.rejects(savePpmOffer(db, "nopay", { enabled: true, voiceNaira: 100 }), (e: unknown) => e instanceof PpmError && e.status === 409 && /bank account/.test(e.message));
  await assert.rejects(savePpmOffer(db, "bisi", { enabled: true, voiceNaira: 100 }), (e: unknown) => e instanceof PpmError && /publishing accounts/.test(e.message));
  await assert.rejects(savePpmOffer(db, "kemi", { enabled: true, voiceNaira: 10 }), /₦50 to ₦50,000/);
  const offer = await savePpmOffer(db, "kemi", { enabled: true, voiceNaira: 150, videoNaira: 300, audience: "premium" });
  assert.deepEqual([offer.voiceKobo, offer.videoKobo, offer.audience], [15_000, 30_000, "premium"]);
  const view = await ppmOfferView(db, "kemi", "bisi", BOOKED_AT);
  assert.ok(view.offered && view.canBook && view.tier === "premium" && view.audienceLine === "For Kemi's Premium, VIP and VVIP subscribers.");
  assert.ok(view.offered && view.voiceKobo === 15_000 && view.figures.minMinutes === 10 && view.figures.upliftPct === 20);
  const nosub = await ppmOfferView(db, "kemi", "chidi", BOOKED_AT);
  assert.ok(nosub.offered && !nosub.canBook && /Premium, VIP and VVIP subscribers/.test(nosub.why));

  // ── Booking: the tier gate, teens, the minimum, the slot, and the hold ──
  const book = (uid: string, o: Record<string, unknown> = {}) => bookPpm(db, uid, { username: "kemi", kind: "voice", minutes: 30, date: D, slot: "09:00", ...o }, BOOKED_AT);
  await rejects(book("chidi"), 403, /Premium, VIP and VVIP subscribers of|for Premium, VIP and VVIP subscribers/);
  await rejects(book("teena"), 403, /teen mode/);
  await rejects(book("bisi", { minutes: 9 }), 400, /at least 10 minutes/);
  await rejects(book("bisi", { slot: "08:00" }), 400, /isn't offered/);
  await rejects(book("bisi", { date: new Date(BOOKED_AT.getTime() + 3_600_000).toISOString().slice(0, 10), slot: "09:00" }), 400, /from tomorrow/);
  await rejects(book("poor"), 402, /Not enough NotesApp Credit.*Bonus Credits can't be used/);
  assert.equal(await credit("poor"), 1_000 * 100, "a refused hold takes nothing");
  await rejects(book("kemi"), 409, /your own offer/);
  // The session that runs out of minutes and is topped up: 10 minutes held to start with.
  const s1 = await book("bisi", { minutes: 10 });
  assert.equal(await credit("bisi"), WALLET - 150_000, "₦1,500 held: 10 minutes at ₦150");
  assert.equal(((await db.doc("wallets/bisi").get()).data()!.bonusLots as { kobo: number }[])[0].kobo, 50_000, "Bonus Credits untouched");
  const hold = (await db.doc(`walletHolds/${s1.id}`).get()).data()!;
  assert.deepEqual([hold.uid, hold.kobo, hold.status, hold.kind], ["bisi", 150_000, "held", "ppm"]);
  assert.ok((await db.doc(`slotLocks/${slotLockId("kemi", D, "09:00")}`).get()).exists, "the time is taken");
  await rejects(book("dayo"), 409, /just taken/);
  assert.equal(s1.commissionRate, upliftedRate(commissionRateFor("basic"), 0.2), "the publisher's rate plus 20% of it, fixed at booking");
  assert.deepEqual([s1.graceSec, s1.topUpWaitSec, s1.status, s1.perMinuteKobo, s1.holdKobo], [60, 60, "booked", 15_000, 150_000]);
  assert.equal((await db.doc(`payments/${ppmRef(s1.id)}`).get()).exists, false, "nothing charged at booking");
  const ws = await walletSummary(db, "bisi", 20);
  assert.equal(ws.heldKobo, 150_000);
  assert.ok(ws.activity.some((a) => a.type === "hold" && a.creditKobo === -150_000 && a.held), "a hold line on the statement");

  // ── The call and the server's meter ──
  await rejects(startPpmCall(db, "bisi", s1.id, at("09:00", -11 * 60), deps), 409, /opens 10 minutes before/);
  await rejects(startPpmCall(db, "dayo", s1.id, at("09:00", 0), deps), 404, /wasn't found/);
  await rejects(beatPpm(db, "bisi", s1.id, at("09:00", 0), deps), 409, /Start the call/);
  const c1 = await call(s1.id, "09:00");
  const cdoc = (await db.doc(`calls/${c1.id}`).get()).data()!;
  assert.deepEqual([cdoc.ppm, cdoc.callerUid, cdoc.calleeUid, cdoc.kind], [s1.id, "bisi", "kemi", "audio"], "a call between the two, no follow needed");
  await rejects(startPpmCall(db, "kemi", s1.id, at("09:00", 0), deps), 409, /already on/);
  // One phone alone doesn't start the meter.
  let v = await beatPpm(db, "bisi", s1.id, at("09:00", 0), deps);
  assert.deepEqual([v.status, v.startedAt], ["booked", null]);
  v = await beatPpm(db, "kemi", s1.id, at("09:00", 2), deps);
  assert.equal(v.status, "live");
  assert.equal(v.startedAt, at("09:00", 2).toISOString(), "the meter starts when the server has heard both phones, on its own clock");
  // Talk to 9:30 into the call (beats from both phones).
  v = await talk(s1.id, "09:00", 17, 572);
  assert.deepEqual([v.status, v.meter.billedMinutes, v.askTopUp], ["live", 10, false]);
  // The 10 held minutes run out: the viewer is asked to add minutes, with the end 60 seconds later.
  v = await talk(s1.id, "09:00", 602, 602, ["kemi", "bisi"]);
  assert.equal(v.askTopUp, true);
  assert.equal(v.meter.endsAt, at("09:00", 662).toISOString());
  assert.ok((await sess(s1.id)).topUpAskedAt, "the prompt is recorded on the session");
  await rejects(addPpmMinutes(db, "kemi", s1.id, 15, at("09:00", 610)), 403, /Only the person who booked/);
  // They add 15 minutes during the wait: ₦2,250 more held, the prompt goes away.
  v = await addPpmMinutes(db, "bisi", s1.id, 15, at("09:00", 610));
  assert.deepEqual([v.holdMinutes, v.holdKobo, v.askTopUp], [25, 375_000, false]);
  assert.equal(await credit("bisi"), WALLET - 375_000);
  assert.equal((await db.doc(`walletHolds/${s1.id}`).get()).data()!.kobo, 375_000);
  assert.equal((await sess(s1.id)).topUpAskedAt, undefined);
  // Talk on to 12:41 (761 seconds after the meter started), then the publisher ends the call.
  v = await talk(s1.id, "09:00", 617, 752);
  assert.equal(v.status, "live");
  const hostView = await ppmSessionView(db, "kemi", s1.id, at("09:00", 763));
  assert.equal(hostView.meter.elapsedSec, 761);
  assert.equal(hostView.meter.billedMinutes, 13, "12:41 → 13 minutes");
  await endCall(db, "kemi", c1.id, "ended", at("09:00", 763), deps);
  const e1 = await sess(s1.id);
  assert.deepEqual([e1.status, e1.endWhy, e1.billedMinutes, e1.chargeKobo, e1.releasedKobo], ["ended", "ended", 13, 195_000, 180_000], "13 minutes charged (₦1,950), 12 unused back (₦1,800)");
  assert.equal(await credit("bisi"), WALLET - 195_000, "only what was used is gone");
  const settled = (await db.doc(`walletHolds/${s1.id}`).get()).data()!;
  assert.deepEqual([settled.status, settled.chargedKobo, settled.releasedKobo], ["settled", 195_000, 180_000]);
  const pay = (await db.doc(`payments/${ppmRef(s1.id)}`).get()).data()!;
  assert.deepEqual([pay.kind, pay.status, pay.amountKobo, pay.payWith, pay.walletDebit.creditKobo, pay.walletDebit.bonusKobo, pay.ppm.billedMinutes], ["ppm", "paid", 195_000, "wallet", 195_000, 0, 13]);
  const led = (await db.doc(`ledger/${ppmRef(s1.id)}`).get()).data()!;
  const commission = Math.round(195_000 * s1.commissionRate);
  assert.deepEqual([led.kind, led.status, led.grossKobo, led.commissionKobo, led.netKobo, led.releaseAfter], ["ppm", "held", 195_000, commission, 195_000 - commission, at("09:00", 763).toISOString()]);
  assert.equal(((await db.doc(`calls/${c1.id}`).get()).data()!).status, "ended");
  const after = await walletSummary(db, "bisi", 30);
  assert.equal(after.heldKobo, 0);
  assert.ok(after.activity.some((a) => a.type === "release" && a.creditKobo === 180_000 && /13 min billed/.test(a.label)));
  // Beats after the end change nothing.
  v = await beatPpm(db, "bisi", s1.id, at("09:00", 800), deps);
  assert.equal(v.status, "ended");
  await rejects(addPpmMinutes(db, "bisi", s1.id, 15, at("09:00", 800)), 409, /over/);

  // Paid out like a session: the end plus the problem window.
  const sent: string[] = [];
  const transfer = async (a: { reference: string }) => { sent.push(a.reference); return { transfer_code: `TRF_${a.reference}`, status: "success" } as never; };
  assert.equal(await autoReleasePayouts({ transfer, now: at("09:00", 763).getTime() + 23 * 3_600_000 }), 0, "inside the problem window");
  assert.equal(await autoReleasePayouts({ transfer, now: at("09:00", 763).getTime() + 25 * 3_600_000 }), 1, "after the end plus the window");
  assert.deepEqual(sent, [`payout_${ppmRef(s1.id)}`]);

  // ── The hold runs out and nobody adds minutes: the server ends the call after the wait, charging only the hold ──
  const s2 = await book("bisi", { slot: "10:00", minutes: 10, kind: "video" });
  assert.equal(s2.perMinuteKobo, 30_000);
  const before2 = await credit("bisi");
  const c2 = await call(s2.id, "10:00", "kemi");
  assert.equal((await db.doc(`calls/${c2.id}`).get()).data()!.kind, "video");
  await talk(s2.id, "10:00", 0, 645);
  assert.equal((await sess(s2.id)).status, "live", "still in the wait");
  v = await beatPpm(db, "bisi", s2.id, at("10:00", 662), deps);
  const e2 = await sess(s2.id);
  assert.deepEqual([e2.status, e2.endWhy, e2.billedMinutes, e2.chargeKobo, e2.releasedKobo], ["ended", "hold_ran_out", 10, 300_000, 0]);
  assert.equal(e2.endedAt, at("10:00", 661).toISOString(), "ended when the wait ran out (the meter started at 0:01 when both phones were heard), not at the late beat");
  assert.equal(v.status, "ended");
  assert.equal(await credit("bisi"), before2, "the hold was all used; nothing more taken");
  assert.equal(((await db.doc(`calls/${c2.id}`).get()).data()!).status, "ended", "the call was ended by the server");

  // ── A phone drops: the call is over at the last moment both were there ──
  const s3 = await book("bisi", { slot: "11:00", minutes: 30 });
  await call(s3.id, "11:00");
  await talk(s3.id, "11:00", 0, 195);
  // Bisi's phone goes quiet after 3:15; Kemi's keeps beating.
  v = await talk(s3.id, "11:00", 211, 241, ["kemi"]);
  const e3 = await sess(s3.id);
  assert.deepEqual([e3.status, e3.endWhy, e3.endedAt, e3.billedMinutes, e3.chargeKobo], ["ended", "dropped", at("11:00", 195).toISOString(), 4, 60_000], "3:14 of meter → 4 minutes");

  // ── Within the grace: nothing charged, everything back, no payment ──
  const before4 = await credit("bisi");
  const s4 = await book("bisi", { slot: "12:00", minutes: 20 });
  const c4 = await call(s4.id, "12:00");
  await talk(s4.id, "12:00", 0, 45);
  await endCall(db, "bisi", c4.id, "ended", at("12:00", 50), deps);
  const e4 = await sess(s4.id);
  assert.deepEqual([e4.status, e4.billedMinutes, e4.chargeKobo, e4.releasedKobo], ["ended", 0, 0, 300_000]);
  assert.equal(await credit("bisi"), before4);
  assert.equal((await db.doc(`payments/${ppmRef(s4.id)}`).get()).exists, false);
  assert.equal((await db.doc(`ledger/${ppmRef(s4.id)}`).get()).exists, false);

  // ── A call nobody answers leaves the session booked; they can call again ──
  const s5 = await book("bisi", { slot: "13:00", minutes: 10 });
  const r5 = await startPpmCall(db, "bisi", s5.id, at("13:00", 0), deps);
  await endCall(db, "bisi", r5.id, "missed", at("13:00", 45), deps);
  assert.equal((await sess(s5.id)).status, "booked");
  // A call left ringing (the app closed) doesn't block the session: after a minute a new call closes it as missed.
  const r5b = await startPpmCall(db, "kemi", s5.id, at("13:00", 50), deps);
  await rejects(startPpmCall(db, "bisi", s5.id, at("13:00", 80), deps), 409, /already ringing/);
  const r5c = await startPpmCall(db, "bisi", s5.id, at("13:00", 120), deps);
  assert.equal((await db.doc(`calls/${r5b.id}`).get()).data()!.status, "missed");
  await endCall(db, "bisi", r5c.id, "missed", at("13:00", 130), deps);
  assert.equal((await sess(s5.id)).status, "booked");
  // ── Cancelling before the call: the whole hold back and the time free again ──
  const before5 = await credit("bisi");
  await rejects(cancelPpm(db, "dayo", s5.id, at("13:00", 60)), 404, /wasn't found/);
  assert.deepEqual(await cancelPpm(db, "bisi", s5.id, at("13:00", 60)), { releasedKobo: 150_000 });
  const e5 = await sess(s5.id);
  assert.deepEqual([e5.status, e5.endWhy], ["cancelled", "viewer_cancelled"]);
  assert.equal(await credit("bisi"), before5 + 150_000);
  assert.equal((await db.doc(`slotLocks/${slotLockId("kemi", D, "13:00")}`).get()).exists, false, "the time is free again");
  await rejects(cancelPpm(db, "bisi", s5.id, at("13:00", 70)), 409, /already over/);
  // A live session can't be cancelled (it's ended instead).
  const s6 = await book("bisi", { slot: "14:00", minutes: 10 });
  await call(s6.id, "14:00");
  await talk(s6.id, "14:00", 0, 30);
  await rejects(cancelPpm(db, "kemi", s6.id, at("14:00", 40)), 409, /end it instead/);

  // ── The cron: a session whose phones both went quiet, and one that never happened ──
  const s7 = await book("dayo", { slot: "15:00", minutes: 15 });
  const dayoBefore = await credit("dayo");
  assert.equal(dayoBefore, WALLET - 225_000);
  assert.equal(await sweepPpm(db, at("15:00", 60 * 60), deps), 1, "s6: both phones quiet since 0:31 (s7's no-show minutes aren't up yet)");
  assert.equal(await sweepPpm(db, at("15:00", 61 * 60), deps), 1, "s7: never called");
  const e6 = await sess(s6.id), e7 = await sess(s7.id);
  assert.deepEqual([e6.status, e6.endWhy, e6.billedMinutes], ["ended", "dropped", 0], "30 seconds in: within the grace");
  assert.deepEqual([e7.status, e7.endWhy, e7.chargeKobo], ["expired", "no_show", 0]);
  assert.equal(await credit("dayo"), WALLET, "the whole hold back");

  // ── Lists, reporting a problem, a refund ──
  const mine = await myPpmSessions(db, "kemi");
  assert.equal(mine.hosting.length, 7);
  assert.equal(mine.hosting[0].id, s7.id, "newest first");
  assert.ok(mine.hosting.every((x) => x.role === "host" && typeof x.netKobo === "number"));
  await rejects(reportPpm(db, "kemi", s3.id, "No-show", at("11:00", 300)), 403, /Only the person who booked/);
  await rejects(reportPpm(db, "bisi", s3.id, "They hung up early and I was charged", at("11:00", 25 * 3_600)), 409, /window to report/);
  assert.deepEqual(await reportPpm(db, "bisi", s3.id, "They hung up early and I was charged", at("11:00", 600)), { ok: true });
  assert.equal((await db.doc(`ledger/${ppmRef(s3.id)}`).get()).data()!.status, "disputed", "the payout is paused for an admin");
  // An admin refunds it: back to the wallet, like any wallet payment.
  const beforeRefund = await credit("bisi");
  await refundPayment(ppmRef(s3.id));
  assert.equal(await credit("bisi"), beforeRefund + 60_000);

  console.log("PPM SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
