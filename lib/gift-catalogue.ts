// Animated gifts and daily gift targets (owner, 3 Nov 2026; HANDOVER item 103). Pure and client-safe.
//
// Animated gifts: a catalogue of named gifts, each an original #NotesApp design drawn in SVG and moved with CSS (components/GiftArt.tsx),
// with a fixed price. Admins rename, reprice, switch off and reorder them in Admin → Pricing → Gifts; the saved copy rides with the
// pricing config (platformSettings/pricing, lib/pricing.ts) and applies live. Sending one is an ordinary gift (kind "gift"): the same
// checkout (Paystack or NotesApp Credit), the same commission (commissionRateFor) and the same 7-day hold. Sound is off unless the
// viewer turns it on.
//
// Daily gift targets: a creator who receives the day's target (Lagos day) from enough different people is pinned in the "Top gifted
// today" shelf at the top of Trending and Explore for the rest of that day. The settings live here too (GIFT_SETTINGS.daily).

import { UNVERIFIED_GIFT_CAP_KOBO } from "./giving";
import { badgeIncluded } from "./tiers";
import type { AccountTier } from "./users";

// The drawings. Each catalogue entry is tied to one; the drawing itself is fixed in code (no uploaded or paid assets).
export const GIFT_MOTIFS = ["kola", "zobo", "jollof", "drum", "adire", "gele", "kente", "baobab", "durbar", "sunrise"] as const;
export type GiftMotif = (typeof GIFT_MOTIFS)[number];
export const isGiftMotif = (v: unknown): v is GiftMotif => typeof v === "string" && (GIFT_MOTIFS as readonly string[]).includes(v);

export type AnimatedGift = { id: GiftMotif; name: string; priceKobo: number; enabled: boolean };
export type DailyTargetSettings = {
  targetKobo: number; // what a creator must receive today (Lagos day) to be pinned
  slots: number; // how many creators the shelf shows
  basis: "gross" | "net"; // count what senders paid, or what the creator keeps after commission
  minSenders: number; // different people who must have sent gifts today (stops one person, or someone gifting themselves through a friend)
};
export type GiftSettings = { catalogue: AnimatedGift[]; daily: DailyTargetSettings };

// One line under each gift's name, what it stands for. Fixed with the drawing.
export const MOTIF_BLURB: Record<GiftMotif, string> = {
  kola: "a welcome",
  zobo: "a cool drink",
  jollof: "a pot to share",
  drum: "a loud well done",
  adire: "made by hand",
  gele: "dressed for the party",
  kente: "royal thanks",
  baobab: "deep roots",
  durbar: "a grand procession",
  sunrise: "the biggest thank-you",
};

// Built-in catalogue, smallest first (owner: "a small one ~₦200 up to ₦100,000, ₦500,000 and ₦1,000,000").
export const DEFAULT_CATALOGUE: AnimatedGift[] = [
  { id: "kola", name: "Kola Nut", priceKobo: 200 * 100, enabled: true },
  { id: "zobo", name: "Zobo Cup", priceKobo: 500 * 100, enabled: true },
  { id: "jollof", name: "Jollof Pot", priceKobo: 1_000 * 100, enabled: true },
  { id: "drum", name: "Talking Drum", priceKobo: 2_000 * 100, enabled: true },
  { id: "adire", name: "Adire Fan", priceKobo: 5_000 * 100, enabled: true },
  { id: "gele", name: "Golden Gele", priceKobo: 10_000 * 100, enabled: true },
  { id: "kente", name: "Kente Crown", priceKobo: 50_000 * 100, enabled: true },
  { id: "baobab", name: "Baobab of Blessings", priceKobo: 100_000 * 100, enabled: true },
  { id: "durbar", name: "Durbar Horse", priceKobo: 500_000 * 100, enabled: true },
  { id: "sunrise", name: "Kilimanjaro Sunrise", priceKobo: 1_000_000 * 100, enabled: true },
];
export const DEFAULT_DAILY: DailyTargetSettings = { targetKobo: 50_000 * 100, slots: 6, basis: "gross", minSenders: 3 };

// The live settings: applyGiftSettings writes into this object (lib/pricing.ts applyPricing), so readers always see what's in force.
export const GIFT_SETTINGS: GiftSettings = { catalogue: DEFAULT_CATALOGUE.map((g) => ({ ...g })), daily: { ...DEFAULT_DAILY } };
export const currentGiftSettings = (): GiftSettings => ({ catalogue: GIFT_SETTINGS.catalogue.map((g) => ({ ...g })), daily: { ...GIFT_SETTINGS.daily } });
export function applyGiftSettings(s: GiftSettings): void {
  GIFT_SETTINGS.catalogue = s.catalogue.map((g) => ({ ...g }));
  Object.assign(GIFT_SETTINGS.daily, s.daily);
}

// Bounds an admin can set. The smallest animated gift is the smallest gift; the largest is a typo guard well above the ₦1,000,000 one.
export const ANIMATED_MIN_KOBO = 200 * 100;
export const ANIMATED_MAX_KOBO = 5_000_000 * 100;
export const GIFT_NAME_MAX = 30;
export const SLOTS_MAX = 20;
export const MIN_SENDERS_MAX = 50;
// From this price up, a gift fills the screen for longer (and gets its rays).
export const GRAND_FROM_KOBO = 100_000 * 100;

export class GiftSettingsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const naira = (k: number) => `₦${Math.round(k / 100).toLocaleString("en-NG")}`;
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

// Checks what an admin saved. A config saved before gifts existed (undefined) keeps the defaults. The catalogue's order is the order
// given; a drawing left out is added at the end, switched off, so nothing is lost by an older form.
export function cleanGiftSettings(input: unknown, d: GiftSettings = { catalogue: DEFAULT_CATALOGUE, daily: DEFAULT_DAILY }): GiftSettings {
  if (input === undefined) return { catalogue: d.catalogue.map((g) => ({ ...g })), daily: { ...d.daily } };
  const i = rec(input);
  const list = Array.isArray(i.catalogue) ? i.catalogue : [];
  const seen = new Set<string>();
  const catalogue: AnimatedGift[] = [];
  for (const raw of list) {
    const o = rec(raw);
    if (!isGiftMotif(o.id)) throw new GiftSettingsError(`Gifts: "${String(o.id)}" isn't one of the gift drawings.`);
    if (seen.has(o.id)) throw new GiftSettingsError(`Gifts: ${o.id} is listed twice.`);
    seen.add(o.id);
    const name = String(o.name ?? "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > GIFT_NAME_MAX) throw new GiftSettingsError(`Gifts: give ${o.id} a name of 2 to ${GIFT_NAME_MAX} characters.`);
    const priceKobo = Math.round(Number(o.priceKobo));
    if (!Number.isFinite(priceKobo) || priceKobo < ANIMATED_MIN_KOBO || priceKobo > ANIMATED_MAX_KOBO || priceKobo % 100 !== 0) {
      throw new GiftSettingsError(`Gifts, ${name}: a price in whole naira from ${naira(ANIMATED_MIN_KOBO)} to ${naira(ANIMATED_MAX_KOBO)}.`);
    }
    catalogue.push({ id: o.id, name, priceKobo, enabled: o.enabled !== false });
  }
  for (const g of DEFAULT_CATALOGUE) if (!seen.has(g.id)) catalogue.push({ ...g, enabled: false });
  const names = new Set<string>();
  for (const g of catalogue) {
    const k = g.name.toLowerCase();
    if (names.has(k)) throw new GiftSettingsError(`Gifts: two gifts are called "${g.name}".`);
    names.add(k);
  }
  if (!catalogue.some((g) => g.enabled)) throw new GiftSettingsError("Gifts: keep at least one gift switched on.");
  const dd = i.daily === undefined ? d.daily : rec(i.daily);
  const whole = (v: unknown, what: string, min: number, max: number) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new GiftSettingsError(`${what}: a whole number from ${min} to ${max}.`);
    return n;
  };
  const targetKobo = Math.round(Number(dd.targetKobo));
  if (!Number.isFinite(targetKobo) || targetKobo < 1_000 * 100 || targetKobo > 100_000_000 * 100) throw new GiftSettingsError("Daily gift target: an amount from ₦1,000 to ₦100,000,000.");
  const basis = dd.basis === "net" ? "net" : dd.basis === "gross" ? "gross" : (() => { throw new GiftSettingsError("Daily gift target: count what senders paid (gross) or what the creator keeps (after commission)."); })();
  return {
    catalogue,
    daily: { targetKobo, slots: whole(dd.slots, "Top gifted today, places", 1, SLOTS_MAX), basis, minSenders: whole(dd.minSenders, "Daily gift target, different senders", 1, MIN_SENDERS_MAX) },
  };
}

export const enabledGifts = (s: GiftSettings = GIFT_SETTINGS) => s.catalogue.filter((g) => g.enabled);
export const findGift = (id: unknown, s: GiftSettings = GIFT_SETTINGS) => (isGiftMotif(id) ? s.catalogue.find((g) => g.id === id) ?? null : null);

// A ✔ or a gold badge: the same idea of "verified" as community giving's cap (lib/community-server.ts). The ✔ is worked out as
// hasVerifiedBadge in lib/users.ts does (that file loads the browser SDK, so it isn't imported on the money path).
type SenderFlags = { suspended?: unknown; goldBadge?: unknown; role?: unknown; verified?: unknown; accountTier?: unknown; badgeUntil?: unknown; accountKind?: unknown; org?: { rcStatus?: unknown } | null };
export function senderVerified(p: SenderFlags | undefined | null, now = Date.now()): boolean {
  if (!p || p.suspended === true) return false;
  if (p.goldBadge) return true;
  if (p.role === "admin" || p.role === "staff" || p.role === "volunteer" || p.verified === true) return true;
  const paid = badgeIncluded(p.accountTier as AccountTier) || (typeof p.badgeUntil === "string" && Date.parse(p.badgeUntil) > now);
  return p.accountKind === "organisation" ? paid && p.org?.rcStatus === "verified" : paid;
}
export const needsVerified = (g: Pick<AnimatedGift, "priceKobo">) => g.priceKobo > UNVERIFIED_GIFT_CAP_KOBO;

// What an animated gift costs and whether this sender may send it. Gifts above the unverified cap (the same cap community giving uses)
// need a sender with a ✔ (or gold) badge. Returns the price, or a reason to show.
export function animatedGiftPrice(id: unknown, senderVerified: boolean, s: GiftSettings = GIFT_SETTINGS): { ok: true; gift: AnimatedGift } | { ok: false; status: number; error: string } {
  const g = findGift(id, s);
  if (!g || !g.enabled) return { ok: false, status: 404, error: "That gift isn't available any more. Choose another." };
  if (g.priceKobo > UNVERIFIED_GIFT_CAP_KOBO && !senderVerified) {
    return { ok: false, status: 403, error: `Gifts over ${naira(UNVERIFIED_GIFT_CAP_KOBO)} need a verified account (the ✔ badge). Choose a smaller gift, or get verified first.` };
  }
  return { ok: true, gift: g };
}

// ── Daily totals (Lagos day) ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Lagos is UTC+1 all year (no daylight saving), so its day is the UTC date an hour on.
export const LAGOS_OFFSET_MS = 3_600_000;
export const lagosDayOf = (d: Date | string | number) => new Date(new Date(d).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
// When the Lagos day containing `d` ends (the pin lasts until then).
export const lagosDayEnds = (d: Date | string | number) => new Date(Date.parse(`${lagosDayOf(d)}T00:00:00Z`) + 86_400_000 - LAGOS_OFFSET_MS);

// giftDaily/{day}_{uid} (server-only): one receiver's gifts on one Lagos day.
export const SENDERS_KEPT = 100; // distinct senders remembered: far more than any minimum an admin can set
export type DailyTotal = { day: string; uid: string; grossKobo: number; netKobo: number; count: number; senders: string[]; reachedAt?: string; lastAt: string; liveId?: string };
export const dailyId = (day: string, uid: string) => `${day}_${uid}`;

// Adds one gift to a receiver's day. A gift from the receiver themself never counts (it can't happen through checkout, but the totals
// don't rely on that). The day is the gift's own Lagos day, so a gift paid at 00:30 in Lagos starts a fresh total.
export function addGift(prev: DailyTotal | null | undefined, g: { uid: string; fromUid: string; grossKobo: number; netKobo: number; at: string; liveId?: string }, s: DailyTargetSettings = GIFT_SETTINGS.daily): DailyTotal {
  const day = lagosDayOf(g.at);
  const base: DailyTotal = prev && prev.day === day ? { ...prev, senders: [...prev.senders] } : { day, uid: g.uid, grossKobo: 0, netKobo: 0, count: 0, senders: [], lastAt: g.at };
  if (g.fromUid === g.uid) return base;
  base.grossKobo += g.grossKobo;
  base.netKobo += g.netKobo;
  base.count += 1;
  base.lastAt = g.at;
  if (g.liveId) base.liveId = g.liveId;
  if (g.fromUid && !base.senders.includes(g.fromUid) && base.senders.length < SENDERS_KEPT) base.senders.push(g.fromUid);
  if (!base.reachedAt && targetReached(base, s)) base.reachedAt = g.at;
  return base;
}

export const countedKobo = (t: Pick<DailyTotal, "grossKobo" | "netKobo">, s: DailyTargetSettings = GIFT_SETTINGS.daily) => (s.basis === "net" ? t.netKobo : t.grossKobo);
export const targetReached = (t: Pick<DailyTotal, "grossKobo" | "netKobo" | "senders">, s: DailyTargetSettings = GIFT_SETTINGS.daily) =>
  countedKobo(t, s) >= s.targetKobo && t.senders.length >= s.minSenders;

// The shelf's order: today's totals that reached the target, most received first; a tie goes to whoever reached it first. Totals from
// another day are ignored. A total that qualifies under today's settings but has no reachedAt (the target was lowered) ranks by its
// last gift.
export function shelfOrder<T extends DailyTotal>(rows: T[], today: string, s: DailyTargetSettings = GIFT_SETTINGS.daily): T[] {
  const when = (r: T) => Date.parse(r.reachedAt ?? r.lastAt);
  return rows
    .filter((r) => r.day === today && targetReached(r, s))
    .sort((a, b) => countedKobo(b, s) - countedKobo(a, s) || when(a) - when(b) || a.uid.localeCompare(b.uid));
}

// For the help and public pages.
export const giftRange = (s: GiftSettings = GIFT_SETTINGS) => {
  const on = enabledGifts(s).map((g) => g.priceKobo);
  return on.length ? { minKobo: Math.min(...on), maxKobo: Math.max(...on), count: on.length } : { minKobo: 0, maxKobo: 0, count: 0 };
};
export const giftNaira = naira;
