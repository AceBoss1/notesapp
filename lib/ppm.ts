// Pay-per-minute sessions (docs/LIVE_ECONOMY.md, phase 1b; owner, 3 and 4 Nov 2026). Pure and client-safe: the offer a publisher sets,
// who may book, the commission, and the meter. The server side is lib/ppm-server.ts; the call is a one-to-one call (lib/calls.ts) that
// carries the session's id, phone to phone first and through the relay only when needed (lib/ice-recovery.ts).
//
// - The publisher sets a price per minute for voice and for video, and who may book: everyone, or their own Premium, VIP or VVIP
//   subscribers (from that tier up, lib/fans.ts).
// - The viewer books one of the publisher's open times (the same availability and slot locks as paid sessions, lib/booking-time.ts) and
//   chooses how many minutes to hold (at least `ppmMinMinutes`, Admin → Limits → Pay-per-minute sessions). That amount is HELD from their
//   NotesApp Credit (lib/wallet-server.ts placeHold), never Bonus Credits, and nothing is charged yet.
// - The meter is the server's: it starts when the server has heard from both phones in the call, and counts on server time
//   (lib/ppm-server.ts beatPpm). A call that ends within the grace (`ppmGraceSec`, 60 s) costs nothing; after it, every started minute
//   is charged, counted from the start (12:41 in the call = 13 minutes). Unused minutes go back at the end.
// - When the held minutes are used up the viewer is asked to add minutes; the call ends `ppmTopUpWaitSec` (60 s) later if they don't.
//   That wait is never charged: the charge can't pass the hold.
// - #NotesApp takes the publisher's own rate plus `ppmUpliftPct` % of it (Admin → Pricing, 20 by default: the VIP uplift), fixed at
//   booking. The publisher is paid like a session: after the call ends plus PAYOUT_HOLD_HOURS for problems.
// - Members in teen mode can't sell or book pay-per-minute sessions.
//
// ppmOffers/{uid}: PpmOfferDoc. ppmSessions/{id}: PpmSessionDoc. Both written only by the server.
import { upliftedRate } from "./gift-catalogue";
import { AUDIENCE_LABEL, TIER_NAME, canSee, isAudience, type Audience, type SubTier } from "./fans";

export type PpmKind = "voice" | "video";
export const isPpmKind = (v: unknown): v is PpmKind => v === "voice" || v === "video";
export const PPM_KIND_LABEL: Record<PpmKind, string> = { voice: "Voice", video: "Video" };
// The call kind a session's call is made with (lib/calls.ts).
export const callKindOf = (k: PpmKind) => (k === "video" ? "video" as const : "audio" as const);

// A price per minute: ₦50 to ₦50,000 (the relay costs under ₦0.10 a minute for voice and about ₦1 for 480p video, worked out on 4 Nov).
export const PPM_RATE_MIN_KOBO = 50 * 100;
export const PPM_RATE_MAX_KOBO = 50_000 * 100;
// Steps on the "Add minutes" button.
export const PPM_ADD_STEP = 15;
// The two phones tell the server they are still in the call this often; a phone not heard from for PPM_STALE_MS has left it.
export const PPM_BEAT_MS = 15_000;
export const PPM_STALE_MS = 45_000;
// A session's call can be started from this long before its time.
export const PPM_EARLY_MS = 10 * 60_000;

// Who may book: everyone, or the publisher's subscribers from a tier up.
export type PpmAudience = Audience;
export const PPM_AUDIENCES: { id: PpmAudience; label: string }[] = [
  { id: "everyone", label: "Everyone" },
  { id: "premium", label: "Premium, VIP and VVIP subscribers" },
  { id: "vip", label: "VIP and VVIP subscribers" },
  { id: "vvip", label: "VVIP subscribers" },
];
export const audienceText = (a: PpmAudience) => PPM_AUDIENCES.find((x) => x.id === a)?.label ?? AUDIENCE_LABEL[a];
export const mayBookFor = (a: PpmAudience, tier: SubTier | null | undefined) => canSee(a, tier);
// "For Kemi's Premium, VIP and VVIP subscribers." / "Open to everyone."
export const audienceLine = (a: PpmAudience, firstName: string) => (a === "everyone" ? "Open to everyone." : `For ${firstName}'s ${audienceText(a)}.`);

export type PpmOfferDoc = {
  uid: string; username: string; enabled: boolean;
  voiceKobo: number; videoKobo: number; // 0: that kind isn't offered
  audience: PpmAudience; updatedAt: string;
};
export type PpmOfferInput = { enabled?: unknown; voiceNaira?: unknown; videoNaira?: unknown; audience?: unknown };
const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;
// What a publisher sends. A blank or 0 price switches that kind off; an offer that's on needs at least one.
export function cleanPpmOffer(v: PpmOfferInput): { ok: true; offer: Pick<PpmOfferDoc, "enabled" | "voiceKobo" | "videoKobo" | "audience"> } | { ok: false; error: string } {
  const enabled = v.enabled === true;
  const price = (x: unknown, name: string): number | string => {
    if (x === undefined || x === null || x === "" || Number(x) === 0) return 0;
    const k = Math.round(Number(x) * 100);
    if (!Number.isFinite(k) || k < PPM_RATE_MIN_KOBO || k > PPM_RATE_MAX_KOBO) return `${name}: a price per minute from ${naira(PPM_RATE_MIN_KOBO)} to ${naira(PPM_RATE_MAX_KOBO)}, or leave it empty.`;
    return k;
  };
  let voice = price(v.voiceNaira, "Voice"), video = price(v.videoNaira, "Video");
  // Switched off: a price out of range is simply not kept.
  if (!enabled) { if (typeof voice === "string") voice = 0; if (typeof video === "string") video = 0; }
  if (typeof voice === "string") return { ok: false, error: voice };
  if (typeof video === "string") return { ok: false, error: video };
  if (enabled && !voice && !video) return { ok: false, error: "Set a price per minute for voice, video or both." };
  const audience = v.audience === undefined ? "everyone" : v.audience;
  if (!isAudience(audience)) return { ok: false, error: "Choose who can book." };
  return { ok: true, offer: { enabled, voiceKobo: voice, videoKobo: video, audience } };
}
export const priceOf = (o: Pick<PpmOfferDoc, "voiceKobo" | "videoKobo">, k: PpmKind) => (k === "video" ? o.videoKobo : o.voiceKobo);

// ── Commission (Admin → Pricing → ppmUpliftPct) ──
export const ppmRate = (baseRate: number, upliftPct: number) => upliftedRate(baseRate, Math.max(0, upliftPct) / 100);
export type PpmSplit = { grossKobo: number; rate: number; commissionKobo: number; netKobo: number };
export function splitCharge(grossKobo: number, rate: number): PpmSplit {
  const commissionKobo = Math.round(grossKobo * rate);
  return { grossKobo, rate, commissionKobo, netKobo: grossKobo - commissionKobo };
}

// ── Booking ──
export const holdFor = (minutes: number, perMinuteKobo: number) => minutes * perMinuteKobo;
// The minutes to hold: a whole number from the Admin minimum to the maximum.
export function cleanHoldMinutes(v: unknown, min: number, max: number): { ok: true; minutes: number } | { ok: false; error: string } {
  const m = Number(v);
  if (!Number.isInteger(m) || m < min) return { ok: false, error: `Hold at least ${min} minute${min === 1 ? "" : "s"}.` };
  if (m > max) return { ok: false, error: `Hold at most ${max} minutes at a time. You can add more during the call.` };
  return { ok: true, minutes: m };
}

// ── The session ──
export type PpmStatus = "booked" | "live" | "ended" | "cancelled" | "expired";
export type PpmEndWhy = "ended" | "hold_ran_out" | "dropped" | "host_cancelled" | "viewer_cancelled" | "no_show" | "admin";
export type PpmSessionDoc = {
  viewerUid: string; viewerName: string; viewerUsername: string;
  hostUid: string; hostName: string; hostUsername: string;
  kind: PpmKind; perMinuteKobo: number;
  holdMinutes: number; holdKobo: number; // grows when the viewer adds minutes
  date: string; slot: string; startsAt: string;
  // Fixed at booking, so a later Admin change doesn't move this session's terms.
  baseRate: number; upliftPct: number; commissionRate: number; graceSec: number; topUpWaitSec: number;
  status: PpmStatus;
  callId?: string;
  // Server time of the last word from each phone in the call (lib/ppm-server.ts beatPpm), and when the server first heard both.
  beats?: { viewer?: string; host?: string };
  startedAt?: string;
  topUpAskedAt?: string; // the hold ran out and the viewer was asked to add minutes
  endedAt?: string; endWhy?: PpmEndWhy;
  billedMinutes?: number; chargeKobo?: number; releasedKobo?: number; reference?: string; // set when it ends
  createdAt: string; cancelledAt?: string;
};
export type PpmRole = "viewer" | "host";

// Per started minute after the grace: a call of up to graceSec costs nothing; from then on every started minute counts from the start.
export function billedMinutesFor(elapsedSec: number, graceSec: number): number {
  if (!(elapsedSec > 0) || elapsedSec <= graceSec) return 0;
  return Math.ceil(elapsedSec / 60);
}

export type Meter = {
  elapsedSec: number; billedMinutes: number; chargeKobo: number; holdKobo: number; holdMinutes: number;
  leftSec: number; // held time not used yet
  exhausted: boolean; // every held minute is used: the viewer is asked to add minutes
  endsAt: string | null; // when the call ends if they don't (exhausted only)
  graceLeftSec: number;
};
// The meter at `now` (or at the end). Billing never passes the hold: the wait after it runs out is free.
export function meterAt(s: Pick<PpmSessionDoc, "startedAt" | "endedAt" | "holdMinutes" | "perMinuteKobo" | "graceSec" | "topUpWaitSec">, now: Date): Meter {
  const start = s.startedAt ? Date.parse(s.startedAt) : NaN;
  const until = Math.min(now.getTime(), s.endedAt ? Date.parse(s.endedAt) : Infinity);
  const elapsedSec = Number.isFinite(start) ? Math.max(0, Math.floor((until - start) / 1000)) : 0;
  const billedMinutes = Math.min(s.holdMinutes, billedMinutesFor(elapsedSec, s.graceSec));
  const heldSec = s.holdMinutes * 60;
  const exhausted = Number.isFinite(start) && elapsedSec >= heldSec;
  return {
    elapsedSec, billedMinutes, chargeKobo: billedMinutes * s.perMinuteKobo, holdKobo: holdFor(s.holdMinutes, s.perMinuteKobo), holdMinutes: s.holdMinutes,
    leftSec: Math.max(0, heldSec - elapsedSec), exhausted,
    endsAt: exhausted ? new Date(start + (heldSec + s.topUpWaitSec) * 1000).toISOString() : null,
    graceLeftSec: Math.max(0, s.graceSec - elapsedSec),
  };
}
// The call ends now: the hold ran out and the wait for more minutes is over.
export const topUpOverdue = (m: Meter, now: Date) => m.exhausted && !!m.endsAt && now.getTime() >= Date.parse(m.endsAt);
// When the server first hears from both phones (each within PPM_STALE_MS), the meter starts.
export const bothHere = (beats: PpmSessionDoc["beats"], now: Date) =>
  !!beats?.viewer && !!beats?.host && now.getTime() - Date.parse(beats.viewer) < PPM_STALE_MS && now.getTime() - Date.parse(beats.host) < PPM_STALE_MS;
// A phone that hasn't been heard from for PPM_STALE_MS has left: the call is over at the last moment both were there.
export function droppedAt(s: Pick<PpmSessionDoc, "beats" | "startedAt" | "status">, now: Date): string | null {
  if (s.status !== "live" || !s.startedAt) return null;
  const v = s.beats?.viewer ? Date.parse(s.beats.viewer) : 0, h = s.beats?.host ? Date.parse(s.beats.host) : 0;
  const last = Math.min(v, h);
  if (now.getTime() - last < PPM_STALE_MS) return null;
  return new Date(Math.max(Date.parse(s.startedAt), last)).toISOString();
}
// Whether the session's call can be started now: from PPM_EARLY_MS before its time until the no-show minutes after it.
export function mayCall(s: Pick<PpmSessionDoc, "status" | "startsAt">, noShowMin: number, now: Date): { ok: true } | { ok: false; why: string } {
  if (s.status === "cancelled") return { ok: false, why: "This session was cancelled." };
  if (s.status === "ended" || s.status === "expired") return { ok: false, why: "This session is over." };
  const t = now.getTime(), at = Date.parse(s.startsAt);
  if (t < at - PPM_EARLY_MS) return { ok: false, why: `The call opens ${PPM_EARLY_MS / 60_000} minutes before the session's time.` };
  if (s.status === "booked" && t > at + noShowMin * 60_000) return { ok: false, why: "This session's time has passed." };
  return { ok: true };
}
export const noShowDue = (s: Pick<PpmSessionDoc, "status" | "startsAt">, noShowMin: number, now: Date) =>
  s.status === "booked" && now.getTime() > Date.parse(s.startsAt) + noShowMin * 60_000;

// ── For screens ──
export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};
// "13 min billed · ₦1,950 of ₦4,500 held · 17 min left"
export const meterLine = (m: Meter) => `${m.billedMinutes} min billed · ${naira(m.chargeKobo)} of ${naira(m.holdKobo)} held · ${Math.floor(m.leftSec / 60)} min left`;
// "Dr Kemi Ojo" → "Kemi": a title isn't a first name.
const TITLES = new Set(["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof.", "pastor", "chief", "engr", "engr.", "barr", "barr.", "rev", "rev."]);
export const firstName = (name: string) => { const w = name.trim().split(/\s+/); return (w.length > 1 && TITLES.has(w[0].toLowerCase()) ? w[1] : w[0]) || name; };
export { TIER_NAME };
