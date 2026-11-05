import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  PPM_ADD_STEP, PPM_STALE_MS, audienceLine, audienceText, bothHere, callKindOf, cleanHoldMinutes, cleanPpmOffer, droppedAt, firstName, holdFor, isPpmKind,
  mayBookFor, mayCall, meterAt, noShowDue, ppmRate, priceOf, splitCharge, topUpOverdue,
  type Meter, type PpmEndWhy, type PpmKind, type PpmOfferDoc, type PpmOfferInput, type PpmRole, type PpmSessionDoc,
} from "./ppm";
import { tierOf, type SubTier } from "./fans";
import { commissionRateFor } from "./tiers";
import { ensurePricing } from "./pricing-server";
import { ppmUpliftPct } from "./pricing";
import { ppmFigures, type PpmFigures } from "./rooms";
import { getRoomSettings } from "./rooms-server";
import { WalletError, holdDoc, placeHold, settleHold, walletDoc } from "./wallet-server";
import type { WalletHold } from "./wallet";
import { formatNaira, formatSlot, sessionStart, weekdayOf, type PublisherSettings } from "./booking-time";
import { PAYOUT_HOLD_HOURS } from "./cancellation";
import { slotLockId } from "./paystack";
import { endCall, openPpmCall, type CallDeps } from "./calls-server";
import { CALL_STALE_MS, type CallDoc } from "./calls";
import { notifyBell, sendEmail } from "./email";
import { getUserEmail } from "./firebase-admin";
import { SITE_URL } from "./host";
import type { AccountTier } from "./users";
import type { LedgerEntry, PaymentRecord } from "./payments";

// Pay-per-minute sessions on the server (the rules are lib/ppm.ts; docs/LIVE_ECONOMY.md 1b).
//
// Booking (bookPpm): one of the publisher's open times (their session availability and the same slot locks as paid sessions), and the
// minutes to hold. In one transaction: the slot is locked, the minutes' price is HELD from the viewer's NotesApp Credit (walletHolds/{id},
// lib/wallet-server.ts placeHold; never Bonus Credits) and ppmSessions/{id} is written with the price, the commission (the publisher's
// rate plus ppmUpliftPct % of it), the grace and the wait, all fixed now.
//
// The call (startPpmCall): a one-to-one call (lib/calls-server.ts openPpmCall) between the two, carrying the session's id. While it's
// connected each phone calls beatPpm every PPM_BEAT_MS. The server writes its own clock time for each beat; the meter starts when the
// server has heard from both phones (startedAt), so neither phone's clock or count is ever used. When the held minutes are used up the
// session is marked topUpAskedAt (the viewer's phone shows "Add minutes"); after the wait, or when a phone stops beating for
// PPM_STALE_MS, the server ends the session itself (here on the next beat, or in the cron's sweepPpm).
//
// The end (endPpm): the meter at the end gives the charge (per started minute after the grace, never more than the hold). The hold is
// settled: the charge is kept and the rest goes back to credit; the charge becomes a "ppm" payment (payWith wallet, so a refund goes back
// to the wallet) and a held ledger entry (releaseAfter = the end; paid out PAYOUT_HOLD_HOURS later, lib/payouts.ts), like a session.

export class PpmError extends Error { constructor(public status: number, message: string) { super(message); } }
type Sess = PpmSessionDoc & { id: string };
export const ppmRef = (id: string) => `PPM_${id}`;
const teen = (u: FirebaseFirestore.DocumentData | undefined) => u?.teen === true || u?.kid === true;
const lagosToday = (now: Date) => new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);

export async function ppmFiguresLive(db: Firestore): Promise<PpmFigures & { upliftPct: number }> {
  await ensurePricing(db).catch(() => undefined);
  return { ...ppmFigures(await getRoomSettings(db)), upliftPct: ppmUpliftPct() };
}

// ── The publisher's offer (Rates & payouts; ppmOffers/{uid}) ──
export async function getPpmOffer(db: Firestore, uid: string): Promise<PpmOfferDoc | null> {
  return ((await db.doc(`ppmOffers/${uid}`).get()).data() as PpmOfferDoc | undefined) ?? null;
}
export async function savePpmOffer(db: Firestore, uid: string, raw: PpmOfferInput, now = new Date()): Promise<PpmOfferDoc> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true) throw new PpmError(403, "Your account can't do that right now.");
  const r = cleanPpmOffer(raw);
  if (!r.ok) throw new PpmError(400, r.error);
  if (r.offer.enabled) {
    if (teen(u)) throw new PpmError(403, "In teen mode you can't sell pay-per-minute sessions.");
    if (u.role !== "publisher" && u.role !== "admin") throw new PpmError(403, "Pay-per-minute sessions are for publishing accounts.");
    const payout = (await db.doc(`payoutAccounts/${uid}`).get()).data();
    if (!payout?.recipientCode) throw new PpmError(409, "Session money is paid to your bank account. Add it first, under Rates & payouts.");
  }
  const doc: PpmOfferDoc = { uid, username: String(u.username ?? ""), ...r.offer, updatedAt: now.toISOString() };
  await db.doc(`ppmOffers/${uid}`).set(doc);
  return doc;
}

// ── Who is booking ──
async function subscriberTier(db: Firestore, uid: string, hostUsername: string, now: Date): Promise<SubTier | null> {
  if (!hostUsername) return null;
  const s = (await db.doc(`subscriptions/${uid}_${hostUsername}`).get()).data();
  if (!s) return null;
  const active = s.status === "demo" || (!!s.currentPeriodEnd && Date.parse(String(s.currentPeriodEnd)) > now.getTime());
  return active ? tierOf(s) : null;
}
async function hostByUsername(db: Firestore, username: unknown) {
  const name = String(username ?? "").toLowerCase();
  if (!/^[a-z0-9_.-]{1,40}$/.test(name)) throw new PpmError(404, "That publisher wasn't found.");
  const uid = String((await db.doc(`usernames/${name}`).get()).data()?.uid ?? "");
  if (!uid) throw new PpmError(404, "That publisher wasn't found.");
  const [u, offer, settings, payout] = await Promise.all([
    db.doc(`users/${uid}`).get().then((d) => d.data()),
    getPpmOffer(db, uid),
    db.doc(`publisherSettings/${uid}`).get().then((d) => d.data() as PublisherSettings | undefined),
    db.doc(`payoutAccounts/${uid}`).get().then((d) => d.data()),
  ]);
  if (!u || u.suspended === true) throw new PpmError(404, "That publisher wasn't found.");
  return { uid, username: name, user: u, offer, availability: settings?.session?.availability ?? {}, payable: !!payout?.recipientCode };
}
// Why this viewer can't book (or "" when they can).
function whyNot(h: Awaited<ReturnType<typeof hostByUsername>>, viewer: FirebaseFirestore.DocumentData | undefined, viewerUid: string | null, tier: SubTier | null): string {
  if (!h.offer?.enabled || teen(h.user) || !h.payable) return "This publisher isn't taking pay-per-minute sessions right now.";
  if (!viewerUid) return "Sign in to book.";
  if (viewerUid === h.uid) return "This is your own offer.";
  if (!viewer || viewer.suspended === true) return "Your account can't book right now.";
  if (teen(viewer)) return "In teen mode you can't book pay-per-minute sessions.";
  if (!mayBookFor(h.offer.audience, tier)) return `Pay-per-minute sessions with @${h.username} are for ${audienceText(h.offer.audience)}.`;
  return "";
}

// What the booking card shows (public; the viewer's tier and whether they may book when signed in).
export async function ppmOfferView(db: Firestore, username: unknown, viewerUid: string | null, now = new Date()) {
  const h = await hostByUsername(db, username);
  const fig = await ppmFiguresLive(db);
  if (!h.offer?.enabled || teen(h.user) || !h.payable) return { offered: false as const, figures: fig };
  const viewer = viewerUid ? (await db.doc(`users/${viewerUid}`).get()).data() : undefined;
  const tier = viewerUid ? await subscriberTier(db, viewerUid, h.username, now) : null;
  const why = whyNot(h, viewer, viewerUid, tier);
  const credit = viewerUid ? Number((await walletDoc(db, viewerUid).get()).data()?.creditKobo ?? 0) : null;
  const hostName = String(h.user.displayName ?? h.username);
  return {
    offered: true as const, figures: fig,
    host: { uid: h.uid, username: h.username, name: hostName },
    voiceKobo: h.offer.voiceKobo, videoKobo: h.offer.videoKobo, audience: h.offer.audience, audienceLine: audienceLine(h.offer.audience, firstName(hostName)),
    tier, canBook: !why, why: why === "Sign in to book." ? "" : why, creditKobo: credit,
  };
}

// ── Booking ──
export type PpmBookInput = { username?: unknown; kind?: unknown; minutes?: unknown; date?: unknown; slot?: unknown };
export async function bookPpm(db: Firestore, uid: string, raw: PpmBookInput, now = new Date()): Promise<Sess> {
  const h = await hostByUsername(db, raw.username);
  const viewer = (await db.doc(`users/${uid}`).get()).data();
  const tier = await subscriberTier(db, uid, h.username, now);
  const why = whyNot(h, viewer, uid, tier);
  if (why) throw new PpmError(why.startsWith("In teen") || why.startsWith("Pay-per-minute sessions with") ? 403 : 409, why);
  const blocked = await db.getAll(db.doc(`dmBlocks/${h.uid}_${uid}`), db.doc(`dmBlocks/${uid}_${h.uid}`));
  if (blocked.some((b) => b.exists)) throw new PpmError(403, "You can't book a session with this member.");
  if (!isPpmKind(raw.kind)) throw new PpmError(400, "Choose voice or video.");
  const kind: PpmKind = raw.kind;
  const perMinuteKobo = priceOf(h.offer!, kind);
  if (!perMinuteKobo) throw new PpmError(409, `@${h.username} doesn't offer ${kind} sessions.`);
  const s = await getRoomSettings(db);
  const m = cleanHoldMinutes(raw.minutes, s.ppmMinMinutes, s.ppmMaxMinutes);
  if (!m.ok) throw new PpmError(400, m.error);
  const date = String(raw.date ?? ""), slot = String(raw.slot ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new PpmError(400, "Pick a date.");
  if (date <= lagosToday(now)) throw new PpmError(400, "Pick a date from tomorrow.");
  if (!(h.availability[String(weekdayOf(date))] ?? []).includes(slot)) throw new PpmError(400, "That time isn't offered. Pick one of the open times.");
  await ensurePricing(db);
  const baseRate = commissionRateFor(((h.user.accountTier as AccountTier) || "basic"), h.user.customRates);
  const upliftPct = ppmUpliftPct();
  const ref = db.collection("ppmSessions").doc();
  const holdKobo = holdFor(m.minutes, perMinuteKobo);
  const hostName = String(h.user.displayName ?? h.username);
  const doc: PpmSessionDoc = {
    viewerUid: uid, viewerName: String(viewer?.displayName ?? viewer?.username ?? "A member"), viewerUsername: String(viewer?.username ?? ""),
    hostUid: h.uid, hostName, hostUsername: h.username, kind, perMinuteKobo, holdMinutes: m.minutes, holdKobo,
    date, slot, startsAt: sessionStart(date, slot).toISOString(),
    baseRate, upliftPct, commissionRate: ppmRate(baseRate, upliftPct), graceSec: s.ppmGraceSec, topUpWaitSec: s.ppmTopUpWaitSec,
    status: "booked", createdAt: now.toISOString(),
  };
  const lockRef = db.doc(`slotLocks/${slotLockId(h.username, date, slot)}`);
  const label = `per-minute ${kind} session with @${h.username}, ${m.minutes} min`;
  await db.runTransaction(async (t) => {
    const [lock, w, hold] = await Promise.all([t.get(lockRef), t.get(walletDoc(db, uid)), t.get(holdDoc(db, ref.id))]);
    if (lock.exists) throw new PpmError(409, "That time was just taken. Pick another.");
    placeHold(t, db, { uid, wallet: w.data(), holdId: ref.id, hold: hold.data() as WalletHold | undefined, kobo: holdKobo, kind: "ppm", label, now });
    t.set(lockRef, { reference: ref.id, kind: "ppm", createdAt: now.toISOString() });
    t.set(ref, doc);
  });
  const when = `${date} at ${formatSlot(slot)}`;
  await notifyBell({ uid: h.uid, type: "booking", linkHref: `/ppm/${ref.id}`, message: `${doc.viewerName} booked a per-minute ${kind} session for ${when} (${m.minutes} minutes held).` }).catch(() => {});
  const to = await getUserEmail(uid).catch(() => null);
  if (to) await sendEmail({
    to, subject: `Booked: per-minute ${kind} session with @${h.username}`,
    text: `Your per-minute ${kind} session with ${hostName} (@${h.username}) is booked for ${when} (Lagos time).\n${formatNaira(holdKobo)} (${m.minutes} minutes at ${formatNaira(perMinuteKobo)} a minute) is held from your NotesApp Credit. You pay only for the minutes you use; the rest comes back when the call ends.\n\nOpen the session to start the call: ${SITE_URL}/ppm/${ref.id}\n\n#NotesApp`,
    action: { label: "Open the session", url: `${SITE_URL}/ppm/${ref.id}` },
  }).catch(() => false);
  return { ...doc, id: ref.id };
}

async function sessionOf(db: Firestore, id: unknown): Promise<Sess> {
  const sid = String(id ?? "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(sid)) throw new PpmError(404, "That session wasn't found.");
  const s = (await db.doc(`ppmSessions/${sid}`).get()).data() as PpmSessionDoc | undefined;
  if (!s) throw new PpmError(404, "That session wasn't found.");
  return { ...s, id: sid };
}
const roleOf = (s: PpmSessionDoc, uid: string): PpmRole | null => (uid === s.viewerUid ? "viewer" : uid === s.hostUid ? "host" : null);
async function partyOf(db: Firestore, uid: string, id: unknown) {
  const s = await sessionOf(db, id);
  const role = roleOf(s, uid);
  if (!role) throw new PpmError(404, "That session wasn't found.");
  return { s, role };
}

// ── The end: settle the hold, write the charge, free the slot if it never happened ──
// Safe to run twice (only a booked or live session ends). `at`: when it really ended (a dropped call: the last moment both were there).
export async function endPpm(db: Firestore, id: string, why: PpmEndWhy, now = new Date(), at?: Date, deps?: CallDeps): Promise<{ ended: boolean; meter?: Meter }> {
  const ref = db.doc(`ppmSessions/${id}`);
  const endAt = at && at.getTime() < now.getTime() ? at : now;
  const res = await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as PpmSessionDoc | undefined;
    if (!cur || (cur.status !== "booked" && cur.status !== "live")) return null;
    const [w, h] = await Promise.all([t.get(walletDoc(db, cur.viewerUid)), t.get(holdDoc(db, id))]);
    const started = cur.status === "live" && !!cur.startedAt;
    const meter = meterAt({ ...cur, endedAt: endAt.toISOString() }, endAt);
    const charge = started ? meter.chargeKobo : 0;
    const reference = ppmRef(id);
    const what = `per-minute ${cur.kind} session with @${cur.hostUsername}`;
    const label = !started ? `Hold back: ${what} (${why === "host_cancelled" ? "cancelled by the publisher" : why === "viewer_cancelled" ? "you cancelled" : "it didn't happen"})`
      : `${what}: ${meter.billedMinutes} min billed (${formatNaira(charge)})${charge < cur.holdKobo ? `, ${formatNaira(cur.holdKobo - charge)} back` : ""}`;
    const split = settleHold(t, db, { wallet: w.data(), holdId: id, hold: h.data() as WalletHold | undefined, chargeKobo: charge, label, reference: id, now });
    const charged = split?.chargedKobo ?? 0;
    if (charged > 0) {
      const p = splitCharge(charged, cur.commissionRate);
      const payment: PaymentRecord & { paidAt: string } = {
        reference, kind: "ppm", uid: cur.viewerUid, email: "", amountKobo: charged, status: "paid", publisherUid: cur.hostUid, publisherUsername: cur.hostUsername,
        commissionRate: cur.commissionRate, payWith: "wallet", walletDebit: { creditKobo: charged, bonusKobo: 0 },
        ppm: { sessionId: id, kind: cur.kind, perMinuteKobo: cur.perMinuteKobo, billedMinutes: meter.billedMinutes, heldKobo: cur.holdKobo, baseRate: cur.baseRate, upliftPct: cur.upliftPct },
        createdAt: endAt.toISOString(), paidAt: endAt.toISOString(),
      } as PaymentRecord & { paidAt: string };
      t.set(db.doc(`payments/${reference}`), payment);
      t.set(db.doc(`ledger/${reference}`), {
        reference, kind: "ppm", publisherUid: cur.hostUid, publisherUsername: cur.hostUsername, payerUid: cur.viewerUid,
        grossKobo: charged, commissionKobo: p.commissionKobo, netKobo: p.netKobo, status: "held", releaseAfter: endAt.toISOString(), createdAt: now.toISOString(),
      } satisfies LedgerEntry);
    }
    // A session that never happened frees its time again.
    if (!started) {
      const lockRef = db.doc(`slotLocks/${slotLockId(cur.hostUsername, cur.date, cur.slot)}`);
      t.delete(lockRef);
    }
    t.update(ref, {
      status: started ? "ended" : why === "host_cancelled" || why === "viewer_cancelled" ? "cancelled" : "expired",
      endedAt: endAt.toISOString(), endWhy: why, billedMinutes: started ? meter.billedMinutes : 0, chargeKobo: charged, releasedKobo: split?.releasedKobo ?? 0,
      ...(charged > 0 ? { reference } : {}), ...(started ? {} : { cancelledAt: now.toISOString() }), topUpAskedAt: FieldValue.delete(),
    });
    return { cur, meter, charged, released: split?.releasedKobo ?? 0, started };
  });
  if (!res) return { ended: false };
  const { cur, meter, charged, released, started } = res;
  // The call ends too, if it's still on (its own end is then a no-op here).
  if (cur.callId) {
    const c = (await db.doc(`calls/${cur.callId}`).get()).data() as CallDoc | undefined;
    if (c && (c.status === "ringing" || c.status === "accepted")) await endCall(db, cur.hostUid, cur.callId, "ended", now, deps).catch((e) => console.error("ppm end call", id, e));
  }
  const link = `/ppm/${id}`;
  if (started) {
    const net = splitCharge(charged, cur.commissionRate).netKobo;
    await notifyBell({ uid: cur.viewerUid, type: "booking", linkHref: link, message: `Your session with ${cur.hostName}: ${meter.billedMinutes} min, ${formatNaira(charged)}.${released ? ` ${formatNaira(released)} is back in your NotesApp Credit.` : ""}${why === "hold_ran_out" ? " It ended when your held minutes ran out." : ""}` }).catch(() => {});
    await notifyBell({ uid: cur.hostUid, type: "booking", linkHref: link, message: `Session with ${cur.viewerName}: ${meter.billedMinutes} min billed. You earn ${formatNaira(net)}, paid ${PAYOUT_HOLD_HOURS} hours after the call.` }).catch(() => {});
  } else if (why !== "viewer_cancelled") {
    await notifyBell({ uid: cur.viewerUid, type: "booking", linkHref: "/profile/wallet", message: `Your session with ${cur.hostName} ${why === "host_cancelled" ? "was cancelled by the publisher" : "didn't happen"}: ${formatNaira(released)} is back in your NotesApp Credit.` }).catch(() => {});
  }
  if (why === "viewer_cancelled") await notifyBell({ uid: cur.hostUid, type: "booking", linkHref: link, message: `${cur.viewerName} cancelled the per-minute session on ${cur.date} at ${formatSlot(cur.slot)}.` }).catch(() => {});
  return { ended: true, meter };
}

// Either of them cancels before the call has started: nothing was charged, the whole hold goes back and the time is free again.
export async function cancelPpm(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ releasedKobo: number }> {
  const { s, role } = await partyOf(db, uid, id);
  if (s.status !== "booked") throw new PpmError(409, s.status === "live" ? "The call has started: end it instead." : "This session is already over.");
  const r = await endPpm(db, s.id, role === "host" ? "host_cancelled" : "viewer_cancelled", now);
  if (!r.ended) throw new PpmError(409, "This session is already over.");
  return { releasedKobo: s.holdKobo };
}

// ── The call ──
// Either of them starts the session's call, from PPM_EARLY_MS before its time. One call at a time.
export async function startPpmCall(db: Firestore, uid: string, id: unknown, now = new Date(), deps?: CallDeps): Promise<{ id: string; cid: string; kind: "audio" | "video"; name: string; avatar: string }> {
  const { s, role } = await partyOf(db, uid, id);
  const can = mayCall(s, (await getRoomSettings(db)).ppmNoShowMin, now);
  if (!can.ok) throw new PpmError(409, can.why);
  if (s.callId) {
    const c = (await db.doc(`calls/${s.callId}`).get()).data() as CallDoc | undefined;
    // A call still ringing, or on with a phone the server heard from lately (or just answered), stands. One left behind (nobody answered and the app was
    // closed, or nobody is in it any more) is closed first, so the session can be called again.
    const heard = [s.beats?.viewer, s.beats?.host].some((b) => !!b && now.getTime() - Date.parse(b) < PPM_STALE_MS);
    const stands = c && ((c.status === "ringing" && now.getTime() - Date.parse(c.createdAt) < CALL_STALE_MS) || (c.status === "accepted" && (heard || now.getTime() - Date.parse(c.acceptedAt ?? c.createdAt) < 2 * PPM_STALE_MS)));
    if (stands) throw new PpmError(409, c!.status === "ringing" ? "The call is already ringing." : "The call is already on.");
    if (c && (c.status === "ringing" || c.status === "accepted")) await endCall(db, c.callerUid, s.callId, c.status === "ringing" ? "missed" : "failed", now, deps).catch(() => ({ outcome: null }));
    if (s.status === "live" && c?.status === "accepted" && !heard) {
      // Nobody has been in it for a while: the sweep (or the call's end just now) settles it; it can't be called again.
      const after = await sessionOf(db, s.id);
      if (after.status !== "live") throw new PpmError(409, "This session has ended.");
    }
  }
  const other = role === "viewer" ? s.hostUid : s.viewerUid;
  const call = await openPpmCall(db, uid, other, callKindOf(s.kind), s.id, now, deps);
  // A new call after a drop starts the meter again from the server's next beats; beats from the old call no longer count.
  await db.doc(`ppmSessions/${s.id}`).update({ callId: call.id, beats: FieldValue.delete() });
  const o = (await db.doc(`users/${other}`).get()).data();
  return { ...call, kind: callKindOf(s.kind), name: String(o?.displayName ?? (role === "viewer" ? s.hostName : s.viewerName)), avatar: String(o?.avatar ?? "") };
}

// A call that ended (lib/calls-server.ts endCall). A live session ends on the server's meter; one whose call never connected stays booked
// (they can call again).
export async function ppmCallEnded(db: Firestore, id: string, callId: string, now = new Date()): Promise<void> {
  const s = (await db.doc(`ppmSessions/${id}`).get()).data() as PpmSessionDoc | undefined;
  if (!s || s.callId !== callId) return;
  if (s.status === "live") await endPpm(db, id, "ended", now);
}

// One phone says it's still in the call (every PPM_BEAT_MS while it's connected). The server's clock is the meter.
export async function beatPpm(db: Firestore, uid: string, id: unknown, now = new Date(), deps?: CallDeps) {
  const { s, role } = await partyOf(db, uid, id);
  if (s.status !== "booked" && s.status !== "live") return viewOf(s, role, now);
  if (!s.callId) throw new PpmError(409, "Start the call first.");
  const ref = db.doc(`ppmSessions/${s.id}`);
  const after = await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as PpmSessionDoc;
    if (cur.status !== "booked" && cur.status !== "live") return { cur, end: null as null | { why: PpmEndWhy; at?: Date } };
    const beats = { ...(cur.beats ?? {}), [role]: now.toISOString() };
    const patch: Record<string, unknown> = { beats };
    let next: PpmSessionDoc = { ...cur, beats };
    if (cur.status === "booked" && bothHere(beats, now)) { patch.status = "live"; patch.startedAt = now.toISOString(); next = { ...next, status: "live", startedAt: now.toISOString() }; }
    let end: null | { why: PpmEndWhy; at?: Date } = null;
    if (next.status === "live") {
      const gone = droppedAt(next, now);
      const m = meterAt(next, now);
      if (gone) end = { why: "dropped", at: new Date(gone) };
      else if (topUpOverdue(m, now)) end = { why: "hold_ran_out", at: new Date(m.endsAt!) };
      else if (m.exhausted && !cur.topUpAskedAt) { patch.topUpAskedAt = now.toISOString(); next = { ...next, topUpAskedAt: now.toISOString() }; }
    }
    t.update(ref, patch);
    return { cur: next, end };
  });
  if (after.end) {
    await endPpm(db, s.id, after.end.why, now, after.end.at, deps);
    return viewOf({ ...(await sessionOf(db, s.id)) }, role, now);
  }
  return viewOf({ ...after.cur, id: s.id }, role, now);
}

// The viewer adds minutes (before or during the call). More credit is held; the "add minutes" prompt goes away.
export async function addPpmMinutes(db: Firestore, uid: string, id: unknown, minutes: unknown = PPM_ADD_STEP, now = new Date()) {
  const { s, role } = await partyOf(db, uid, id);
  if (role !== "viewer") throw new PpmError(403, "Only the person who booked adds minutes.");
  const max = (await getRoomSettings(db)).ppmMaxMinutes;
  const m = Number(minutes);
  if (!Number.isInteger(m) || m < 1 || m > max) throw new PpmError(400, `Add from 1 to ${max} minutes.`);
  const ref = db.doc(`ppmSessions/${s.id}`);
  const next = await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as PpmSessionDoc;
    if (cur.status !== "booked" && cur.status !== "live") throw new PpmError(409, "This session is over.");
    const meter = meterAt(cur, now);
    if (topUpOverdue(meter, now)) throw new PpmError(409, "The call has ended: your held minutes ran out.");
    const [w, h] = await Promise.all([t.get(walletDoc(db, uid)), t.get(holdDoc(db, s.id))]);
    const kobo = holdFor(m, cur.perMinuteKobo);
    placeHold(t, db, { uid, wallet: w.data(), holdId: s.id, hold: h.data() as WalletHold | undefined, kobo, kind: "ppm", label: `per-minute ${cur.kind} session with @${cur.hostUsername}, +${m} min`, reference: s.id, now });
    const patch = { holdMinutes: cur.holdMinutes + m, holdKobo: cur.holdKobo + kobo, topUpAskedAt: FieldValue.delete() };
    t.update(ref, patch);
    return { ...cur, holdMinutes: patch.holdMinutes, holdKobo: patch.holdKobo, topUpAskedAt: undefined };
  });
  return viewOf({ ...next, id: s.id }, role, now);
}

// The viewer reports a problem within the problem window after the call: the publisher's payout is paused for an admin (lib/payouts.ts).
export async function reportPpm(db: Firestore, uid: string, id: unknown, reason: unknown, now = new Date()): Promise<{ ok: true }> {
  const { s, role } = await partyOf(db, uid, id);
  if (role !== "viewer") throw new PpmError(403, "Only the person who booked can report a problem.");
  const why = String(reason ?? "").trim().slice(0, 500);
  if (why.length < 5) throw new PpmError(400, "Tell us what went wrong.");
  if (s.status !== "ended" || !s.endedAt) throw new PpmError(409, "You can report a problem once the call has ended.");
  if (now.getTime() > Date.parse(s.endedAt) + PAYOUT_HOLD_HOURS * 3_600_000) throw new PpmError(409, `The ${PAYOUT_HOLD_HOURS}-hour window to report a problem has passed. Contact support if it's urgent.`);
  if (!s.reference) throw new PpmError(409, "Nothing was charged for this session.");
  await db.runTransaction(async (t) => {
    const l = await t.get(db.doc(`ledger/${s.reference}`));
    if (!l.exists || l.data()?.status !== "held") throw new PpmError(409, "This session's payout is already being processed. Contact support.");
    t.update(l.ref, { status: "disputed" });
    t.update(db.doc(`ppmSessions/${s.id}`), { reportedProblem: { reason: why, at: now.toISOString() } });
  });
  await notifyBell({ uid: s.hostUid, type: "booking", linkHref: `/ppm/${s.id}`, message: `${s.viewerName} reported a problem with your per-minute session, so its payout is paused while we review it.` }).catch(() => {});
  return { ok: true };
}

// ── The cron (app/api/cron/reminders): calls that dropped or ran out without a beat to notice, and sessions that never happened ──
export async function sweepPpm(db: Firestore, now = new Date(), deps?: CallDeps): Promise<number> {
  const s = await getRoomSettings(db);
  const snap = await db.collection("ppmSessions").where("status", "in", ["booked", "live"]).limit(500).get();
  let n = 0;
  for (const d of snap.docs) {
    const x = d.data() as PpmSessionDoc;
    if (x.status === "live") {
      const gone = droppedAt(x, now);
      const m = meterAt(x, now);
      if (gone) n += (await endPpm(db, d.id, "dropped", now, new Date(gone), deps)).ended ? 1 : 0;
      else if (topUpOverdue(m, now)) n += (await endPpm(db, d.id, "hold_ran_out", now, new Date(m.endsAt!), deps)).ended ? 1 : 0;
    } else if (noShowDue(x, s.ppmNoShowMin, now)) {
      n += (await endPpm(db, d.id, "no_show", now, undefined, deps)).ended ? 1 : 0;
    }
  }
  return n;
}

// ── Views ──
function viewOf(s: Sess, role: PpmRole, now: Date) {
  const meter = meterAt(s, now);
  return {
    id: s.id, role, status: s.status, kind: s.kind, perMinuteKobo: s.perMinuteKobo, holdMinutes: s.holdMinutes, holdKobo: s.holdKobo,
    date: s.date, slot: s.slot, startsAt: s.startsAt, graceSec: s.graceSec, topUpWaitSec: s.topUpWaitSec,
    host: { uid: s.hostUid, name: s.hostName, username: s.hostUsername }, viewer: { uid: s.viewerUid, name: s.viewerName, username: s.viewerUsername },
    startedAt: s.startedAt ?? null, endedAt: s.endedAt ?? null, endWhy: s.endWhy ?? null, callId: s.callId ?? null,
    askTopUp: s.status === "live" && meter.exhausted, meter, now: now.toISOString(),
    billedMinutes: s.billedMinutes ?? null, chargeKobo: s.chargeKobo ?? null, releasedKobo: s.releasedKobo ?? null,
    // What the publisher keeps of the charge so far (their own screen only).
    ...(role === "host" ? { commissionRate: s.commissionRate, netKobo: splitCharge(s.status === "ended" ? s.chargeKobo ?? 0 : meter.chargeKobo, s.commissionRate).netKobo } : {}),
    // Whether either phone has gone quiet (the session page says "waiting for …").
    heard: { viewer: !!s.beats?.viewer && now.getTime() - Date.parse(s.beats.viewer) < PPM_STALE_MS, host: !!s.beats?.host && now.getTime() - Date.parse(s.beats.host) < PPM_STALE_MS },
  };
}
export type PpmView = ReturnType<typeof viewOf>;
export async function ppmSessionView(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<PpmView> {
  const { s, role } = await partyOf(db, uid, id);
  return viewOf(s, role, now);
}
// A member's sessions, as the viewer and as the publisher, newest first.
export async function myPpmSessions(db: Firestore, uid: string, now = new Date()): Promise<{ booked: PpmView[]; hosting: PpmView[] }> {
  const [a, b] = await Promise.all([
    db.collection("ppmSessions").where("viewerUid", "==", uid).orderBy("startsAt", "desc").limit(100).get(),
    db.collection("ppmSessions").where("hostUid", "==", uid).orderBy("startsAt", "desc").limit(100).get(),
  ]);
  const list = (snap: FirebaseFirestore.QuerySnapshot, role: PpmRole) => snap.docs.map((d) => viewOf({ ...(d.data() as PpmSessionDoc), id: d.id }, role, now)).sort((x, y) => y.startsAt.localeCompare(x.startsAt));
  return { booked: list(a, "viewer"), hosting: list(b, "host") };
}
export { WalletError };
