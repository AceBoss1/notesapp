import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import {
  BAND_NAME, bandAt, cleanLiveEvent, discountFor, lateClosesAt, liveTicketId, mayBuyFor, mayOpen, noShowDue, quoteLiveTicket, recordNotice, ticketRef,
  LIVE_AUDIENCES, type LiveEventDoc, type LiveInput, type LiveTicketDoc,
} from "./live-tickets";
import { makeTicketCode } from "./tickets";
import { reminderDue } from "./events";
import { tierLiveDiscounts, tierOffers, tierOf, type SubTier } from "./fans";
import { commissionRateFor } from "./tiers";
import { ensurePricing } from "./pricing-server";
import { liveTicketUpliftPct } from "./pricing";
import { paidLiveFigures, type PaidLiveFigures, type RoomMode } from "./rooms";
import { getRoomSettings, posterFor, startMemberLive, type RoomDeps } from "./rooms-server";
import { markLiveReopened } from "./live-door-server";
import { refundCardToCredit, refundToWallet } from "./wallet-server";
import { notifyBell, sendEmail } from "./email";
import { getAdminDb, getUserEmail } from "./firebase-admin";
import { formatNaira } from "./booking-time";
import { SITE_URL } from "./host";
import { sendPush } from "./push-server";
import type { AccountTier } from "./users";
import type { LiveTicketInfo, PaymentRecord } from "./payments";

// Paid lives on the server (the rules are lib/live-tickets.ts). Buying is a payment of kind "live_ticket" (app/api/paystack/initialize,
// by card or from NotesApp Credit, never Bonus Credits); lib/payments.ts fulfillPayment calls readForLiveTicket/writeLiveTicket, which write
// liveTickets/{eventId}_{uid} and move the sold count. The host's money is a "live_ticket" ledger entry, held (awaitingLive) until the live
// ends, then the problem window (lib/payouts.ts). The room is a member-hosted audio room (lib/rooms-server.ts startMemberLive): the door
// is checked at /api/lives "enter" and again on every join (lib/rooms-server.ts mayEnter).

export class LiveEventError extends Error { constructor(public status: number, message: string) { super(message); } }
type Ev = LiveEventDoc & { id: string };

export async function paidFigures(db: Firestore): Promise<PaidLiveFigures & { upliftPct: number }> {
  await ensurePricing(db).catch(() => undefined);
  return { ...paidLiveFigures(await getRoomSettings(db)), upliftPct: liveTicketUpliftPct() };
}

export async function liveEventOf(db: Firestore, id: unknown): Promise<Ev> {
  const sid = String(id ?? "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(sid)) throw new LiveEventError(404, "That live wasn't found.");
  const e = (await db.doc(`liveEvents/${sid}`).get()).data() as LiveEventDoc | undefined;
  if (!e) throw new LiveEventError(404, "That live wasn't found.");
  return { ...e, id: sid };
}

// ── Scheduling ──
// A publisher with a bank account for payouts schedules a paid live. A member in teen mode can't sell tickets (lib/young.ts: teen
// rules; they may still buy one).
export async function createLiveEvent(db: Firestore, uid: string, raw: LiveInput & { poster?: { source?: unknown; url?: unknown } }, now = new Date()): Promise<Ev> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true) throw new LiveEventError(403, "Your account can't do that right now.");
  if (u.teen === true) throw new LiveEventError(403, "In teen mode you can't sell tickets to a live. You can still host free lives in your communities.");
  if (u.role !== "publisher" && u.role !== "admin") throw new LiveEventError(403, "Paid lives are for publishing accounts.");
  const payout = (await db.doc(`payoutAccounts/${uid}`).get()).data();
  if (!payout?.recipientCode) throw new LiveEventError(409, "Ticket money is paid to your bank account. Add it first, under Rates & payouts.");
  const r = cleanLiveEvent(raw, now);
  if (!r.ok) throw new LiveEventError(400, r.error);
  const poster = raw.poster?.source ? await posterFor(db, uid, raw.poster.source, raw.poster.url).catch((e) => { throw new LiveEventError(400, e instanceof Error ? e.message : "Choose a poster."); }) : "";
  const upcoming = await db.collection("liveEvents").where("hostUid", "==", uid).where("status", "==", "scheduled").limit(51).get();
  if (upcoming.size >= 50) throw new LiveEventError(409, "You can have up to 50 paid lives scheduled.");
  const s = await getRoomSettings(db);
  const ref = db.collection("liveEvents").doc();
  const e: LiveEventDoc = {
    ...r.event, hostUid: uid, hostName: String(u.displayName ?? ""), hostUsername: String(u.username ?? ""), hostAvatar: String(u.avatar ?? ""), poster,
    lateWindowMin: s.lateWindowMin, status: "scheduled", sold: 0, createdAt: now.toISOString(),
  };
  await ref.set(e);
  return { ...e, id: ref.id };
}

// ── Who is buying ──
async function buyerTier(db: Firestore, uid: string, hostUsername: string, now: Date): Promise<SubTier | null> {
  if (!hostUsername) return null;
  const s = (await db.doc(`subscriptions/${uid}_${hostUsername}`).get()).data();
  if (!s) return null;
  const active = s.status === "demo" || (!!s.currentPeriodEnd && Date.parse(String(s.currentPeriodEnd)) > now.getTime());
  return active ? tierOf(s) : null;
}
async function hostDiscounts(db: Firestore, hostUid: string) {
  return tierLiveDiscounts(tierOffers((await db.doc(`publisherSettings/${hostUid}`).get()).data()?.subscription));
}
async function ticketOf(db: Firestore, eventId: string, uid: string): Promise<LiveTicketDoc | null> {
  return ((await db.doc(`liveTickets/${liveTicketId(eventId, uid)}`).get()).data() as LiveTicketDoc | undefined) ?? null;
}

// What a buyer would pay now, or why they can't buy.
async function priceFor(db: Firestore, e: Ev, uid: string | null, now: Date) {
  const band = bandAt(e, now);
  const tier = uid ? await buyerTier(db, uid, e.hostUsername, now) : null;
  const cap = (await getRoomSettings(db)).liveDiscountMaxPct;
  const discountPct = discountFor(tier, await hostDiscounts(db, e.hostUid), cap);
  const audienceOk = mayBuyFor(e.audience, tier);
  return { band, tier, discountPct, audienceOk };
}

// ── The lobby (/lives/[id]) ──
export async function liveLobby(db: Firestore, id: unknown, viewerUid: string | null, now = new Date()) {
  const e = await liveEventOf(db, id);
  const isHost = viewerUid === e.hostUid;
  const ticket = viewerUid ? await ticketOf(db, e.id, viewerUid) : null;
  const p = await priceFor(db, e, viewerUid, now);
  const audienceLabel = LIVE_AUDIENCES.find((a) => a.id === e.audience)!.label;
  const bands = (["early", "normal", "late"] as const).map((b) => ({ band: b, name: BAND_NAME[b], listKobo: e.prices[`${b}Kobo`], payKobo: quoteLiveTicket(e.prices[`${b}Kobo`], p.discountPct, 0, 0).payKobo }));
  const why = !p.band.open ? p.band.why
    : isHost ? "You're the host."
    : !p.audienceOk ? `Tickets to this live are for ${audienceLabel.replace(" and up", " subscribers and up")} of @${e.hostUsername}.`
    : "";
  return {
    event: {
      id: e.id, title: e.title, description: e.description, poster: e.poster, hostUid: e.hostUid, hostName: e.hostName, hostUsername: e.hostUsername, hostAvatar: e.hostAvatar,
      startsAt: e.startsAt, earlyUntil: e.earlyUntil, prices: e.prices, audience: e.audience, audienceLabel, record: e.record, recordNotice: recordNotice(e.record),
      lateWindowMin: e.lateWindowMin, lateClosesAt: lateClosesAt(e), status: e.status, startedAt: e.startedAt ?? null, endedAt: e.endedAt ?? null, roomId: e.status === "live" ? e.roomId ?? null : null,
      ...(isHost ? { sold: e.sold } : {}),
    },
    now: now.toISOString(),
    band: p.band.open ? { band: p.band.band, name: BAND_NAME[p.band.band], listKobo: p.band.kobo, payKobo: quoteLiveTicket(p.band.kobo, p.discountPct, 0, 0).payKobo, until: p.band.until } : null,
    bands, tier: p.tier, discountPct: p.discountPct, isHost,
    canBuy: !!viewerUid && !isHost && p.band.open && p.audienceOk && !(ticket?.status === "valid"),
    why,
    ticket: ticket ? { ref: ticketRef(ticket.code), band: ticket.band, bandName: BAND_NAME[ticket.band], paidKobo: ticket.paidKobo, discountPct: ticket.discountPct, status: ticket.status, checkedInAt: ticket.checkedInAt ?? null } : null,
  };
}

// ── Checkout (app/api/paystack/initialize, kind "live_ticket") ──
export async function liveTicketCheckout(db: Firestore, uid: string, raw: { eventId?: unknown }, now = new Date()) {
  const e = await liveEventOf(db, raw.eventId);
  if (e.hostUid === uid) throw new LiveEventError(409, "You're the host, so you don't need a ticket.");
  const have = await ticketOf(db, e.id, uid);
  if (have?.status === "valid") throw new LiveEventError(409, "You already have a ticket to this live.");
  const p = await priceFor(db, e, uid, now);
  if (!p.band.open) throw new LiveEventError(409, p.band.why);
  if (!p.audienceOk) throw new LiveEventError(403, `Tickets to this live are for ${LIVE_AUDIENCES.find((a) => a.id === e.audience)!.label} subscribers of @${e.hostUsername}.`);
  const host = (await db.doc(`users/${e.hostUid}`).get()).data();
  if (!host || host.suspended === true) throw new LiveEventError(409, "This live isn't selling tickets right now.");
  const payout = (await db.doc(`payoutAccounts/${e.hostUid}`).get()).data();
  if (!payout?.recipientCode) throw new LiveEventError(409, "The host hasn't set up payouts yet, so tickets can't be sold.");
  await ensurePricing(db);
  const baseRate = commissionRateFor(((host.accountTier as AccountTier) || "basic"), host.customRates);
  const upliftPct = liveTicketUpliftPct();
  const q = quoteLiveTicket(p.band.kobo, p.discountPct, baseRate, upliftPct);
  const buyer = (await db.doc(`users/${uid}`).get()).data();
  const info: LiveTicketInfo = {
    eventId: e.id, eventTitle: e.title, startsAt: e.startsAt, band: p.band.band, listKobo: p.band.kobo, discountPct: p.discountPct, ...(p.tier ? { tier: p.tier } : {}),
    holderName: String(buyer?.displayName || buyer?.username || "Guest"), baseRate, upliftPct,
  };
  // The commission is fixed now and recorded on the payment: the host's rate plus upliftPct % of it.
  return { info, amountKobo: q.payKobo, hostUid: e.hostUid, hostUsername: e.hostUsername, commissionRate: q.rate };
}

// Reads for fulfillPayment's transaction (every read before any write).
export async function readForLiveTicket(t: Transaction, db: Firestore, p: PaymentRecord) {
  const lt = p.liveTicket!;
  const [ev, tk] = await Promise.all([t.get(db.doc(`liveEvents/${lt.eventId}`)), t.get(db.doc(`liveTickets/${liveTicketId(lt.eventId, p.uid)}`))]);
  return { event: ev.data() as LiveEventDoc | undefined, ticket: tk.data() as LiveTicketDoc | undefined, code: makeTicketCode((n) => randomBytes(n)) };
}
// The writes: false when the ticket can't be issued (the live was cancelled or is over, or they hold one already).
export function writeLiveTicket(t: Transaction, db: Firestore, p: PaymentRecord, read: Awaited<ReturnType<typeof readForLiveTicket>>, now: string): boolean {
  const lt = p.liveTicket!;
  if (!read.event || read.event.status === "cancelled" || read.event.status === "ended") return false;
  if (read.ticket?.status === "valid") return false;
  const doc: LiveTicketDoc & { hostUid: string } = {
    eventId: lt.eventId, uid: p.uid, hostUid: p.publisherUid, holderName: lt.holderName, code: read.code, reference: p.reference,
    band: lt.band, listKobo: lt.listKobo, discountPct: lt.discountPct, ...(lt.tier ? { tier: lt.tier } : {}), paidKobo: p.amountKobo,
    status: "valid", createdAt: now,
  };
  t.set(db.doc(`liveTickets/${liveTicketId(lt.eventId, p.uid)}`), doc);
  t.update(db.doc(`liveEvents/${lt.eventId}`), { sold: FieldValue.increment(1) });
  return true;
}

export async function notifyLiveTicket(p: PaymentRecord) {
  const lt = p.liveTicket!;
  const tk = (await getAdminDb().doc(`liveTickets/${liveTicketId(lt.eventId, p.uid)}`).get()).data() as LiveTicketDoc | undefined;
  const when = new Date(lt.startsAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const url = `${SITE_URL}/lives/${lt.eventId}`;
  await sendEmail({
    to: p.email,
    subject: `Your ticket: ${lt.eventTitle}`,
    bell: { uid: p.uid, type: "event", linkHref: `/lives/${lt.eventId}`, message: `Your ticket to ${lt.eventTitle} is ready. We'll remind you a day and an hour before, and when it starts.` },
    text: `Thanks! Your ${BAND_NAME[lt.band].toLowerCase()} ticket to ${lt.eventTitle} with @${p.publisherUsername}, ${when} (Lagos time).\nPaid: ${formatNaira(p.amountKobo)}${lt.discountPct ? ` (your subscriber discount of ${lt.discountPct}% included)` : ""}${p.payWith === "wallet" ? " from your NotesApp Credit" : ""}.\n${tk ? `Ticket: ${ticketRef(tk.code)}\n` : ""}\nOpen the live's page to go in when it starts: ${url}\nIf the host cancels or never starts, you get the whole price back as NotesApp Credit automatically.\nReference: ${p.reference}\n\n#NotesApp`,
    action: { label: "Open the live", url },
  }).catch(() => false);
  await notifyBell({ uid: p.publisherUid, type: "event", linkHref: `/lives/${lt.eventId}`, message: `${lt.holderName} bought a ticket to ${lt.eventTitle} (${formatNaira(p.amountKobo)}).` }).catch(() => {});
}

// ── Refunds: always to NotesApp Credit (owner: "everyone is refunded to their NotesApp Credit automatically") ──
// Wallet payments go back to the wallet as they came; card payments become credit. The ticket stops being valid, the sold count goes
// down, the host's ledger entry is refunded. Safe to run twice.
export async function refundLiveTicketToCredit(db: Firestore, reference: string, label: string, now = new Date()): Promise<number> {
  const payRef = db.doc(`payments/${reference}`);
  const p = (await payRef.get()).data() as (PaymentRecord & { paidAt?: string }) | undefined;
  if (!p || p.kind !== "live_ticket" || !p.liveTicket) return 0;
  if (p.status === "refunded") return 0;
  if (p.status !== "paid" && p.status !== "paid_slot_conflict") return 0;
  const back = p.payWith === "wallet" ? await refundToWallet(db, reference, undefined, `Refund: ${label}`, now) : await refundCardToCredit(db, reference, `Refund: ${label}`, now);
  const tRef = db.doc(`liveTickets/${liveTicketId(p.liveTicket.eventId, p.uid)}`);
  await db.runTransaction(async (t) => {
    const [tk, led] = await Promise.all([t.get(tRef), t.get(db.doc(`ledger/${reference}`))]);
    const ticket = tk.data() as LiveTicketDoc | undefined;
    const ours = ticket && ticket.reference === reference && ticket.status === "valid";
    if (ours) {
      t.update(tRef, { status: "refunded", refundedAt: now.toISOString() });
      t.update(db.doc(`liveEvents/${p.liveTicket!.eventId}`), { sold: FieldValue.increment(-1) });
    }
    if (led.exists) t.update(led.ref, { status: "refunded", awaitingLive: FieldValue.delete() });
    t.update(payRef, { status: "refunded", refundedAt: now.toISOString(), refundedTo: "credit" });
  });
  return back;
}

// An admin refunded a paid-live ticket purchase in full (lib/refunds.ts): the ticket stops being valid.
export async function voidLiveTicket(db: Firestore, reference: string, now = new Date()): Promise<void> {
  const p = (await db.doc(`payments/${reference}`).get()).data() as PaymentRecord | undefined;
  if (!p?.liveTicket) return;
  const ref = db.doc(`liveTickets/${liveTicketId(p.liveTicket.eventId, p.uid)}`);
  await db.runTransaction(async (t) => {
    const tk = (await t.get(ref)).data() as LiveTicketDoc | undefined;
    if (!tk || tk.reference !== reference || tk.status !== "valid") return;
    t.update(ref, { status: "refunded", refundedAt: now.toISOString() });
    t.update(db.doc(`liveEvents/${p.liveTicket!.eventId}`), { sold: FieldValue.increment(-1) });
  });
}

async function refundAll(db: Firestore, e: Ev, why: string, now: Date): Promise<number> {
  const snap = await db.collection("liveTickets").where("eventId", "==", e.id).limit(20_000).get();
  let n = 0;
  for (const d of snap.docs) {
    const tk = d.data() as LiveTicketDoc;
    if (tk.status !== "valid") continue;
    const back = await refundLiveTicketToCredit(db, tk.reference, `${e.title} (${why})`, now).catch((err) => { console.error("live refund", tk.reference, err); return -1; });
    if (back < 0) continue;
    n++;
    await notifyBell({ uid: tk.uid, type: "event", linkHref: "/wallet", message: `${e.title} ${why === "cancelled by the host" ? "was cancelled by the host" : "didn't start"}: ${formatNaira(tk.paidKobo)} is back in your NotesApp Credit.` }).catch(() => {});
  }
  return n;
}

// The host (or an admin) cancels a live that hasn't started: everyone is refunded to NotesApp Credit.
export async function cancelLiveEvent(db: Firestore, uid: string, id: unknown, opts: { admin?: boolean } = {}, now = new Date()): Promise<{ refunded: number }> {
  const e = await liveEventOf(db, id);
  if (e.hostUid !== uid && !opts.admin) throw new LiveEventError(403, "Only the host can cancel this live.");
  const ref = db.doc(`liveEvents/${e.id}`);
  const ok = await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as LiveEventDoc;
    if (cur.status !== "scheduled") return false;
    t.update(ref, { status: "cancelled", cancelledAt: now.toISOString(), cancelWhy: opts.admin && e.hostUid !== uid ? "admin" : "host" });
    return true;
  });
  if (!ok) throw new LiveEventError(409, e.status === "live" ? "This live is on now: end it from the room instead." : `This live is already ${e.status}.`);
  return { refunded: await refundAll(db, e, "cancelled by the host", now) };
}

// ── Going live, and the door ──
// The host opens the room (from 15 minutes before the start). The room is a member-hosted audio room with the recording the host chose.
// Reopening after a drop (within LIVE_RESUME_MS of the end) opens a new room for the same tickets.
export async function startPaidLive(db: Firestore, uid: string, id: unknown, now = new Date(), deps?: RoomDeps, opts: { stageMode?: unknown; mods?: unknown } = {}): Promise<{ roomId: string; mode: RoomMode; note?: string; recording?: boolean }> {
  const e = await liveEventOf(db, id);
  if (e.hostUid !== uid) throw new LiveEventError(403, "Only the host opens this live.");
  if (e.status === "live" && e.roomId) {
    const room = (await db.doc(`communityRooms/${e.roomId}`).get()).data();
    if (room?.status === "live") return { roomId: e.roomId, mode: room.mode };
  }
  const s = await getRoomSettings(db);
  const can = mayOpen(e, s.paidNoShowMin, now);
  if (!can.ok) throw new LiveEventError(409, can.why);
  const r = await startMemberLive(db, uid, { eventId: e.id, title: e.title, poster: e.poster, record: e.record }, now, deps, opts);
  const reopened = e.status === "ended" || e.status === "live";
  await db.doc(`liveEvents/${e.id}`).update({ status: "live", roomId: r.id, ...(e.startedAt ? {} : { startedAt: now.toISOString() }), endedAt: FieldValue.delete() });
  if (reopened) await markLiveReopened(db, e.id);
  else await remindHolders(db, e, "start", now).catch((err) => console.error("live start reminder", err));
  return { roomId: r.id, mode: r.mode, ...(r.note ? { note: r.note } : {}), ...(r.recording ? { recording: true } : {}) };
}

// The door: a ticket holder (or the host, or a moderator the host named) gets the room to join; the first time, their ticket is marked
// checked. Joining checks the ticket again (lib/rooms-server.ts mayEnter), so the room can't be entered around the door.
export async function enterPaidLive(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ roomId: string; checkedInAt?: string }> {
  const e = await liveEventOf(db, id);
  if (e.status === "cancelled") throw new LiveEventError(410, "This live was cancelled. Your ticket was refunded to your NotesApp Credit.");
  if (e.status !== "live" || !e.roomId) throw new LiveEventError(409, e.status === "ended" ? "This live has ended." : "The host hasn't started the live yet. It opens here when they do.");
  if (uid === e.hostUid) return { roomId: e.roomId };
  const room = (await db.doc(`communityRooms/${e.roomId}`).get()).data();
  if (room?.mods?.[uid]) return { roomId: e.roomId };
  const ref = db.doc(`liveTickets/${liveTicketId(e.id, uid)}`);
  return db.runTransaction(async (t) => {
    const tk = (await t.get(ref)).data() as LiveTicketDoc | undefined;
    if (!tk || tk.status !== "valid") throw new LiveEventError(403, "This live is for ticket holders. Get a ticket first.");
    const at = tk.checkedInAt ?? now.toISOString();
    if (!tk.checkedInAt) t.update(ref, { checkedInAt: at });
    return { roomId: e.roomId!, checkedInAt: at };
  });
}

// ── Reminders and cancelling for not starting (the 15-minute cron, app/api/cron/reminders) ──
async function remindHolders(db: Firestore, e: Ev, kind: "day" | "hour" | "start", now: Date, push = (uid: string, p: { title: string; body: string; url: string }) => sendPush(db, uid, p)): Promise<number> {
  const key = db.doc(`liveEventReminders/${e.id}_${kind}`);
  const first = await db.runTransaction(async (t) => { if ((await t.get(key)).exists) return false; t.set(key, { at: now.toISOString() }); return true; });
  if (!first) return 0;
  const snap = await db.collection("liveTickets").where("eventId", "==", e.id).limit(20_000).get();
  const message = kind === "start" ? `${e.title} is live now. Tap to go in.` : kind === "hour" ? `${e.title} starts in an hour.` : `${e.title} is tomorrow, ${new Date(e.startsAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} (Lagos time).`;
  let sent = 0;
  for (const d of snap.docs) {
    const tk = d.data() as LiveTicketDoc;
    if (tk.status !== "valid") continue;
    const to = kind === "start" ? null : await getUserEmail(tk.uid).catch(() => null);
    const bell = { uid: tk.uid, type: "event" as const, linkHref: `/lives/${e.id}`, message };
    if (to) await sendEmail({ to, subject: kind === "hour" ? `Starting soon: ${e.title}` : `Tomorrow: ${e.title}`, text: `${message}\n\n${SITE_URL}/lives/${e.id}\n\n#NotesApp`, bell }).catch(() => {});
    else await notifyBell(bell).catch(() => {});
    await push(tk.uid, { title: e.title, body: message, url: `/lives/${e.id}` }).catch(() => 0);
    sent++;
  }
  return sent;
}
export async function sweepPaidLives(db: Firestore, now = new Date(), push?: (uid: string, p: { title: string; body: string; url: string }) => Promise<number>): Promise<number> {
  const s = await getRoomSettings(db);
  const snap = await db.collection("liveEvents").where("status", "==", "scheduled").limit(500).get();
  let n = 0;
  for (const d of snap.docs) {
    const e = { ...(d.data() as LiveEventDoc), id: d.id };
    if (noShowDue(e, s.paidNoShowMin, now)) {
      const ok = await db.runTransaction(async (t) => {
        const cur = (await t.get(d.ref)).data() as LiveEventDoc;
        if (!noShowDue(cur, s.paidNoShowMin, now)) return false;
        t.update(d.ref, { status: "cancelled", cancelledAt: now.toISOString(), cancelWhy: "no_show" });
        return true;
      });
      if (ok) {
        n += await refundAll(db, e, "never started", now);
        await notifyBell({ uid: e.hostUid, type: "event", linkHref: `/lives/${e.id}`, message: `${e.title} didn't start within ${s.paidNoShowMin} minutes of its time, so it was cancelled and every ticket refunded to NotesApp Credit.` }).catch(() => {});
      }
      continue;
    }
    const kind = reminderDue(new Date(e.startsAt), now);
    if (kind) n += await remindHolders(db, e, kind, now, push);
  }
  return n;
}

// ── Lists ──
export type LiveCard = Pick<LiveEventDoc, "title" | "poster" | "hostName" | "hostUsername" | "hostAvatar" | "startsAt" | "status" | "audience" | "prices"> & { id: string };
const card = (e: Ev): LiveCard => ({ id: e.id, title: e.title, poster: e.poster, hostName: e.hostName, hostUsername: e.hostUsername, hostAvatar: e.hostAvatar, startsAt: e.startsAt, status: e.status, audience: e.audience, prices: e.prices });
// Upcoming and on-now paid lives (Explore's list), soonest first.
export async function upcomingLives(db: Firestore, now = new Date()): Promise<LiveCard[]> {
  const snap = await db.collection("liveEvents").where("status", "in", ["scheduled", "live"]).limit(300).get();
  return snap.docs.map((d) => ({ ...(d.data() as LiveEventDoc), id: d.id })).filter((e) => e.status === "live" || Date.parse(e.startsAt) > now.getTime() - 6 * 3_600_000)
    .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0) || a.startsAt.localeCompare(b.startsAt)).slice(0, 60).map(card);
}
// A host's own lives, newest first, with what sold.
export async function hostLives(db: Firestore, uid: string): Promise<(LiveCard & { sold: number })[]> {
  const snap = await db.collection("liveEvents").where("hostUid", "==", uid).limit(200).get();
  return snap.docs.map((d) => ({ ...(d.data() as LiveEventDoc), id: d.id })).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((e) => ({ ...card(e), sold: e.sold }));
}
// A member's tickets, with their lives.
export async function myLiveTickets(db: Firestore, uid: string): Promise<(LiveCard & { ref: string; band: string; paidKobo: number; ticketStatus: LiveTicketDoc["status"] })[]> {
  const snap = await db.collection("liveTickets").where("uid", "==", uid).limit(200).get();
  const tks = snap.docs.map((d) => d.data() as LiveTicketDoc);
  if (!tks.length) return [];
  const evs = await db.getAll(...tks.map((t) => db.doc(`liveEvents/${t.eventId}`)));
  return tks.flatMap((t, i) => (evs[i].exists ? [{ ...card({ ...(evs[i].data() as LiveEventDoc), id: evs[i].id }), ref: ticketRef(t.code), band: BAND_NAME[t.band], paidKobo: t.paidKobo, ticketStatus: t.status }] : []))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}
