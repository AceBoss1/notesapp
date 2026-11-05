// Paid lives (docs/LIVE_ECONOMY.md, phase 1a; owner, 3 and 4 Nov 2026). Pure and client-safe: the price bands, the late window, the
// subscriber discount, the commission and what the host keeps, and checking what a host sends. The server side is
// lib/live-tickets-server.ts; the room itself is an audio room hosted by the member (lib/rooms.ts, `paid` on the room doc).
//
// - The host schedules a live: a title, a date and time, a poster and three prices: early bird (until a date and time the host picks),
//   normal (from then until the start) and late (from the start until the live has run the late window, Admin → Limits → Audio rooms →
//   Paid lives, `lateWindowMin`; after that no more tickets).
// - Who may buy: everyone, Premium and up, or VIP and up (subscribers of the host's own tiers, lib/fans.ts). They still pay.
// - Subscribers get the discount the host set for their tier (Rates & payouts → Subscriptions, beside each tier's price), capped by
//   `liveDiscountMaxPct`, on top of whichever band applies.
// - #NotesApp takes the host's normal rate plus `liveTicketUpliftPct` % of it (Admin → Pricing), fixed on the payment at checkout, like
//   premium gifts (lib/gift-catalogue.ts upliftedRate).
// - The recording choice: off, for safety only (kept for review, never a replay), or record and offer a replay.
// - Only ticket holders get in (checked by the server at the door and on every join). The money is held until the live ends plus the
//   problem window (PAYOUT_HOLD_HOURS); if the host cancels or never starts, everyone is refunded to their NotesApp Credit.
//
// liveEvents/{id}: LiveEventDoc. liveTickets/{eventId}_{uid}: LiveTicketDoc, one per person. Both written only by the server.
import { upliftedRate } from "./gift-catalogue";
import { SUB_TIERS, TIER_NAME, tierReaches, type SubTier } from "./fans";

export const LIVE_TITLE_MAX = 80;
export const LIVE_PRICE_MIN_KOBO = 100 * 100;
export const LIVE_PRICE_MAX_KOBO = 1_000_000 * 100;
export const LIVE_AHEAD_MIN_MS = 15 * 60_000; // a live is scheduled at least 15 minutes ahead
export const LIVE_AHEAD_MAX_DAYS = 180;
export const LIVE_OPEN_EARLY_MS = 15 * 60_000; // the host can open the room this long before the start
export const LIVE_RESUME_MS = 30 * 60_000; // a live that dropped (the host's connection, a mistaken End) can be reopened this long after
export const LIVE_DESCRIPTION_MAX = 600;

export type LiveAudience = "everyone" | "premium" | "vip";
export const LIVE_AUDIENCES: { id: LiveAudience; label: string }[] = [
  { id: "everyone", label: "Everyone" },
  { id: "premium", label: "Premium and up" },
  { id: "vip", label: "VIP and up" },
];
export const isLiveAudience = (v: unknown): v is LiveAudience => v === "everyone" || v === "premium" || v === "vip";
// Whether a buyer with this subscription tier (or none) may buy.
export const mayBuyFor = (aud: LiveAudience, tier: SubTier | null | undefined) => aud === "everyone" || tierReaches(tier, aud);

export type LiveRecordChoice = "off" | "safety" | "replay";
export const LIVE_RECORD_CHOICES: { id: LiveRecordChoice; label: string; notice: string }[] = [
  { id: "off", label: "Off", notice: "This live isn't recorded." },
  { id: "safety", label: "Safety only", notice: "This live is recorded for safety review only. It won't be offered as a replay. You can stay muted." },
  { id: "replay", label: "Record and offer a replay", notice: "This live is recorded and may be offered as a replay. You can stay muted." },
];
export const isLiveRecordChoice = (v: unknown): v is LiveRecordChoice => v === "off" || v === "safety" || v === "replay";
export const recordNotice = (c: LiveRecordChoice) => LIVE_RECORD_CHOICES.find((x) => x.id === c)!.notice;

export type LiveBand = "early" | "normal" | "late";
export const BAND_NAME: Record<LiveBand, string> = { early: "Early bird", normal: "Normal", late: "Late" };
export type LivePrices = { earlyKobo: number; normalKobo: number; lateKobo: number };
export type LiveStatus = "scheduled" | "live" | "ended" | "cancelled";

export type LiveEventDoc = {
  hostUid: string; hostName: string; hostUsername: string; hostAvatar: string;
  title: string; description: string; poster: string;
  startsAt: string; earlyUntil: string; prices: LivePrices;
  audience: LiveAudience; record: LiveRecordChoice;
  // Fixed when the live is scheduled (Admin → Limits → Audio rooms → Paid lives), so a later change doesn't move this live's rules.
  lateWindowMin: number;
  status: LiveStatus; roomId?: string; startedAt?: string; endedAt?: string; cancelledAt?: string; cancelWhy?: "host" | "no_show" | "admin";
  sold: number; createdAt: string;
};
export type LiveTicketDoc = {
  eventId: string; uid: string; holderName: string; code: string; reference: string;
  band: LiveBand; listKobo: number; discountPct: number; tier?: SubTier; paidKobo: number;
  status: "valid" | "refunded"; createdAt: string; checkedInAt?: string; refundedAt?: string;
};
export const liveTicketId = (eventId: string, uid: string) => `${eventId}_${uid}`;
// The short reference on a ticket ("NAPL-7Q2K"): from its code, easy to read out.
export const ticketRef = (code: string) => `NAPL-${code.slice(0, 4)}`;

// ── The price band now ──
// Early bird until earlyUntil; normal until the start; late from the start until the live has run lateWindowMin minutes (counted from
// when the host really opened it, or from the start time if they opened early; while they haven't yet, late tickets stay on sale until the live is cancelled for not starting).
export type BandNow = { open: true; band: LiveBand; kobo: number; until: string | null } | { open: false; why: string };
export function bandAt(e: Pick<LiveEventDoc, "startsAt" | "earlyUntil" | "prices" | "lateWindowMin" | "status" | "startedAt">, now: Date): BandNow {
  if (e.status === "cancelled") return { open: false, why: "This live was cancelled." };
  if (e.status === "ended") return { open: false, why: "This live has ended." };
  const t = now.getTime();
  if (e.earlyUntil && t < Date.parse(e.earlyUntil) && t < Date.parse(e.startsAt)) return { open: true, band: "early", kobo: e.prices.earlyKobo, until: e.earlyUntil };
  if (t < Date.parse(e.startsAt)) return { open: true, band: "normal", kobo: e.prices.normalKobo, until: e.startsAt };
  const lateEnd = lateClosesAt(e);
  if (lateEnd && t >= Date.parse(lateEnd)) return { open: false, why: `Tickets closed ${e.lateWindowMin} minutes into the live.` };
  return { open: true, band: "late", kobo: e.prices.lateKobo, until: lateEnd };
}
// When late tickets stop: lateWindowMin after the live really started, or after its start time if the host opened the room early (null
// while it hasn't started).
export const lateClosesAt = (e: Pick<LiveEventDoc, "lateWindowMin" | "startedAt" | "startsAt">): string | null =>
  e.startedAt ? new Date(Math.max(Date.parse(e.startedAt), Date.parse(e.startsAt)) + e.lateWindowMin * 60_000).toISOString() : null;

// ── The subscriber discount (the host's tier settings, capped by Admin) ──
export type TierDiscounts = Partial<Record<SubTier, number>>;
export const cleanDiscountPct = (v: unknown, cap: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(Math.max(0, Math.min(100, cap)), n)) : 0;
};
// The discount a buyer gets: their own tier's, never above the cap (a cap lowered later applies at once). No tier: none.
export const discountFor = (tier: SubTier | null | undefined, discounts: TierDiscounts | null | undefined, cap: number): number =>
  tier ? cleanDiscountPct(discounts?.[tier] ?? 0, cap) : 0;
// The price after the discount, in whole naira (rounded to the nearest), never below ₦1.
export const discounted = (kobo: number, pct: number): number => {
  if (!pct) return kobo;
  return Math.max(100, Math.round((kobo * (100 - pct)) / 100 / 100) * 100);
};

// ── Commission (Admin → Pricing → liveTicketUpliftPct) ──
export const liveTicketRate = (rate: number, upliftPct: number) => upliftedRate(rate, Math.max(0, upliftPct) / 100);
export type LiveQuote = { listKobo: number; discountPct: number; payKobo: number; rate: number; commissionKobo: number; netKobo: number };
export function quoteLiveTicket(listKobo: number, discountPct: number, baseRate: number, upliftPct: number): LiveQuote {
  const payKobo = discounted(listKobo, discountPct);
  const rate = liveTicketRate(baseRate, upliftPct);
  const commissionKobo = Math.round(payKobo * rate);
  return { listKobo, discountPct, payKobo, rate, commissionKobo, netKobo: payKobo - commissionKobo };
}

// ── What the host sends ──
export type LiveInput = { title?: unknown; description?: unknown; startsAt?: unknown; earlyUntil?: unknown; earlyNaira?: unknown; normalNaira?: unknown; lateNaira?: unknown; audience?: unknown; record?: unknown };
const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;
export function cleanLiveEvent(v: LiveInput, now: Date): { ok: true; event: Pick<LiveEventDoc, "title" | "description" | "startsAt" | "earlyUntil" | "prices" | "audience" | "record"> } | { ok: false; error: string } {
  const title = String(v.title ?? "").replace(/\s+/g, " ").trim().slice(0, LIVE_TITLE_MAX);
  if (title.length < 3) return { ok: false, error: "Give the live a title." };
  const description = String(v.description ?? "").trim().slice(0, LIVE_DESCRIPTION_MAX);
  const start = Date.parse(String(v.startsAt ?? ""));
  if (!Number.isFinite(start)) return { ok: false, error: "Choose the date and time of the live." };
  if (start < now.getTime() + LIVE_AHEAD_MIN_MS) return { ok: false, error: "Schedule the live at least 15 minutes from now." };
  if (start > now.getTime() + LIVE_AHEAD_MAX_DAYS * 86_400_000) return { ok: false, error: `Schedule the live within the next ${LIVE_AHEAD_MAX_DAYS} days.` };
  const price = (x: unknown, name: string): number | string => {
    const k = Math.round(Number(x) * 100);
    if (!Number.isFinite(k) || k < LIVE_PRICE_MIN_KOBO || k > LIVE_PRICE_MAX_KOBO) return `${name}: a price from ${naira(LIVE_PRICE_MIN_KOBO)} to ${naira(LIVE_PRICE_MAX_KOBO)}.`;
    return k;
  };
  const e = price(v.earlyNaira, "Early bird"), n = price(v.normalNaira, "Normal"), l = price(v.lateNaira, "Late");
  for (const x of [e, n, l]) if (typeof x === "string") return { ok: false, error: x };
  const prices = { earlyKobo: e as number, normalKobo: n as number, lateKobo: l as number };
  if (prices.earlyKobo > prices.normalKobo) return { ok: false, error: "The early bird price can't be more than the normal price." };
  if (prices.lateKobo < prices.normalKobo) return { ok: false, error: "The late price can't be less than the normal price." };
  const early = Date.parse(String(v.earlyUntil ?? ""));
  if (!Number.isFinite(early)) return { ok: false, error: "Choose when the early bird price ends." };
  if (early <= now.getTime()) return { ok: false, error: "The early bird price should end after now." };
  if (early > start) return { ok: false, error: "The early bird price should end by the start of the live." };
  if (!isLiveAudience(v.audience)) return { ok: false, error: "Choose who can buy a ticket." };
  if (!isLiveRecordChoice(v.record)) return { ok: false, error: "Choose whether the live is recorded." };
  return { ok: true, event: { title, description, startsAt: new Date(start).toISOString(), earlyUntil: new Date(early).toISOString(), prices, audience: v.audience, record: v.record } };
}

// ── Cancelling for not starting (Admin → Limits → Audio rooms → Paid lives, `paidNoShowMin`) ──
export const noShowDue = (e: Pick<LiveEventDoc, "status" | "startsAt">, noShowMin: number, now: Date) =>
  e.status === "scheduled" && now.getTime() >= Date.parse(e.startsAt) + noShowMin * 60_000;
// Whether the host may open (or reopen) the room now.
export function mayOpen(e: Pick<LiveEventDoc, "status" | "startsAt" | "endedAt">, noShowMin: number, now: Date): { ok: true } | { ok: false; why: string } {
  const t = now.getTime();
  if (e.status === "cancelled") return { ok: false, why: "This live was cancelled." };
  if (e.status === "ended") return e.endedAt && t < Date.parse(e.endedAt) + LIVE_RESUME_MS ? { ok: true } : { ok: false, why: "This live has ended." };
  if (t < Date.parse(e.startsAt) - LIVE_OPEN_EARLY_MS) return { ok: false, why: "You can open the room from 15 minutes before the start." };
  if (e.status === "scheduled" && noShowDue(e, noShowMin, now)) return { ok: false, why: "This live didn't start in time, so it was cancelled and everyone refunded." };
  return { ok: true };
}

// ── For screens ──
export const tierDiscountLine = (d: TierDiscounts, cap: number) =>
  SUB_TIERS.filter((t) => discountFor(t, d, cap) > 0).map((t) => `${TIER_NAME[t]} ${discountFor(t, d, cap)}% off`).join(" · ");
// "₦2,000 ticket at your 8% rate + 10% of it (8.8%): ₦1,824 each" (the create form's "You keep").
export const pctText = (r: number) => `${+(r * 100).toFixed(2)}%`;
