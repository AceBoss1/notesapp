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
export const GIFT_MOTIFS = ["gardenegg", "kola", "zobo", "jollof", "drum", "adire", "gele", "kente", "baobab", "champagne", "argungu", "durbar", "ijele", "sunrise"] as const;
export type GiftMotif = (typeof GIFT_MOTIFS)[number];
export const isGiftMotif = (v: unknown): v is GiftMotif => typeof v === "string" && (GIFT_MOTIFS as readonly string[]).includes(v);

export type AnimatedGift = { id: GiftMotif; name: string; priceKobo: number; enabled: boolean };
export type DailyTargetSettings = {
  targetKobo: number; // what a creator must receive today (Lagos day) to be pinned
  slots: number; // how many creators the shelf shows
  basis: "gross" | "net"; // count what senders paid, or what the creator keeps after commission
  minSenders: number; // different people who must have sent gifts today (stops one person, or someone gifting themselves through a friend)
};
// Grand gifts (owner, 3 Nov 2026: "Verified senders only, each comes with a sitewide announcement"): from fromKobo up, a gift needs a
// verified sender and, when announce is on, everyone on the app sees a banner with a link to the live (or page) to witness it.
export type GrandGiftSettings = { fromKobo: number; announce: boolean };
// Commission on animated gifts (owner, 3 Nov 2026): the gifts below the grand price are "premium" gifts, the grand ones "VIP" gifts
// (verified senders). #NotesApp takes the creator's normal rate plus a share OF that rate: premiumPct (10) or vipPct (20). With an 8%
// rate, a premium gift is charged 8.8% and a VIP gift 9.6%. Gifts of a typed amount ("Other") keep the normal rate.
export type GiftUplift = { premiumPct: number; vipPct: number };
// Gifting everywhere (owner, 4 Nov 2026; docs/LIVE_ECONOMY.md phase 2): how many of one small gift a sender may send at once
// (double-tap a premium gift), and the withdrawal line: below autoWithdrawMaxKobo a withdrawal of gift earnings is paid automatically;
// from it up, a person approves it in Admin → Payments first.
export type GiftEconomy = { quantityMax: number; autoWithdrawMaxKobo: number };
export type GiftSettings = { catalogue: AnimatedGift[]; daily: DailyTargetSettings; grand: GrandGiftSettings; uplift: GiftUplift; economy: GiftEconomy };

// One line under each gift's name, what it stands for. Fixed with the drawing.
export const MOTIF_BLURB: Record<GiftMotif, string> = {
  gardenegg: "a small hello",
  kola: "a welcome",
  zobo: "a cool drink",
  jollof: "a plate to share",
  drum: "a loud well done",
  adire: "made by hand",
  gele: "dressed for the party",
  kente: "royal thanks",
  baobab: "deep roots",
  champagne: "pop the bottle",
  argungu: "the great catch",
  durbar: "a grand procession",
  ijele: "the king of masquerades",
  sunrise: "the biggest thank-you",
};

// What each gift plays with, full screen (components/GiftOverlay.tsx): some or all of rays, stars, fireworks, confetti and sound,
// growing with the gift. Fixed with the drawing. Sound plays only for viewers who switched gift sounds on.
export const GIFT_EFFECTS = ["rays", "stars", "fireworks", "confetti", "sound"] as const;
export type GiftEffect = (typeof GIFT_EFFECTS)[number];
export const MOTIF_EFFECTS: Record<GiftMotif, GiftEffect[]> = {
  gardenegg: ["stars", "confetti"],
  kola: ["stars", "sound"],
  zobo: ["confetti", "sound"],
  jollof: ["stars", "confetti", "sound"],
  drum: ["rays", "confetti", "sound"],
  adire: ["rays", "stars", "confetti"],
  gele: ["rays", "stars", "confetti", "sound"],
  kente: ["rays", "fireworks", "confetti", "sound"],
  baobab: ["rays", "stars", "fireworks", "sound"],
  champagne: ["stars", "fireworks", "confetti", "sound"],
  argungu: ["rays", "stars", "fireworks", "confetti", "sound"],
  durbar: ["rays", "stars", "fireworks", "confetti", "sound"],
  ijele: ["rays", "stars", "fireworks", "confetti", "sound"],
  sunrise: ["rays", "stars", "fireworks", "confetti", "sound"],
};

// Built-in catalogue, smallest first: the owner's list of 3 November 2026 (14 gifts, ₦200 to ₦1,000,000).
export const DEFAULT_CATALOGUE: AnimatedGift[] = [
  { id: "gardenegg", name: "Garden Egg", priceKobo: 200 * 100, enabled: true },
  { id: "kola", name: "Kola Nut", priceKobo: 1_000 * 100, enabled: true },
  { id: "zobo", name: "Zobo Bottle", priceKobo: 2_000 * 100, enabled: true },
  { id: "jollof", name: "Jollof Plate", priceKobo: 5_000 * 100, enabled: true },
  { id: "drum", name: "Talking Drum", priceKobo: 10_000 * 100, enabled: true },
  { id: "adire", name: "Adire Fan", priceKobo: 20_000 * 100, enabled: true },
  { id: "gele", name: "Golden Gele", priceKobo: 25_000 * 100, enabled: true },
  { id: "kente", name: "Kente Crown", priceKobo: 50_000 * 100, enabled: true },
  { id: "baobab", name: "Baobab of Blessings", priceKobo: 100_000 * 100, enabled: true },
  { id: "champagne", name: "Cricova Champagne", priceKobo: 150_000 * 100, enabled: true },
  { id: "argungu", name: "Argungu Fishing", priceKobo: 250_000 * 100, enabled: true },
  { id: "durbar", name: "Durbar Horse", priceKobo: 500_000 * 100, enabled: true },
  { id: "ijele", name: "Ijele Masquerade", priceKobo: 750_000 * 100, enabled: true },
  { id: "sunrise", name: "Kilimanjaro Sunrise", priceKobo: 1_000_000 * 100, enabled: true },
];
export const DEFAULT_DAILY: DailyTargetSettings = { targetKobo: 50_000 * 100, slots: 6, basis: "gross", minSenders: 3 };
export const DEFAULT_GRAND: GrandGiftSettings = { fromKobo: 25_000 * 100, announce: true };
export const DEFAULT_UPLIFT: GiftUplift = { premiumPct: 10, vipPct: 20 };
export const DEFAULT_ECONOMY: GiftEconomy = { quantityMax: 99, autoWithdrawMaxKobo: 20_000 * 100 };
export const QUANTITY_MAX_LIMIT = 999;
export const AUTO_WITHDRAW_MIN_KOBO = 1_000 * 100;
export const AUTO_WITHDRAW_MAX_KOBO = 10_000_000 * 100;
export const UPLIFT_MAX_PCT = 100;

// The live settings: applyGiftSettings writes into this object (lib/pricing.ts applyPricing), so readers always see what's in force.
export const GIFT_SETTINGS: GiftSettings = { catalogue: DEFAULT_CATALOGUE.map((g) => ({ ...g })), daily: { ...DEFAULT_DAILY }, grand: { ...DEFAULT_GRAND }, uplift: { ...DEFAULT_UPLIFT }, economy: { ...DEFAULT_ECONOMY } };
export const currentGiftSettings = (): GiftSettings => ({ catalogue: GIFT_SETTINGS.catalogue.map((g) => ({ ...g })), daily: { ...GIFT_SETTINGS.daily }, grand: { ...GIFT_SETTINGS.grand }, uplift: { ...GIFT_SETTINGS.uplift }, economy: { ...GIFT_SETTINGS.economy } });
export function applyGiftSettings(s: GiftSettings): void {
  GIFT_SETTINGS.catalogue = s.catalogue.map((g) => ({ ...g }));
  Object.assign(GIFT_SETTINGS.daily, s.daily);
  Object.assign(GIFT_SETTINGS.grand, s.grand ?? DEFAULT_GRAND);
  Object.assign(GIFT_SETTINGS.uplift, s.uplift ?? DEFAULT_UPLIFT);
  Object.assign(GIFT_SETTINGS.economy, s.economy ?? DEFAULT_ECONOMY);
}

// Bounds an admin can set. The smallest animated gift is the smallest gift; the largest is a typo guard well above the ₦1,000,000 one.
export const ANIMATED_MIN_KOBO = 200 * 100;
export const ANIMATED_MAX_KOBO = 5_000_000 * 100;
export const GIFT_NAME_MAX = 30;
export const SLOTS_MAX = 20;
export const MIN_SENDERS_MAX = 50;
// How long a gift plays: every gift fills the screen; grand ones stay longer, and the biggest longest.
// Gifts that play a video instead of the drawn card (components/GiftOverlay.tsx). The video plays in full with its own sound (when
// the viewer has gift sounds on), over the page dimmed behind it with its edges faded, so its dark background melts in; a Skip button
// appears after skipAfterMs. Owner, 6 Nov 2026: the Cricova Champagne video, black background dropped this way, Skip after 8 s.
export type GiftVideo = { src: string; poster: string; ms: number; skipAfterMs: number };
export const GIFT_VIDEOS: Partial<Record<GiftMotif, GiftVideo>> = {
  champagne: { src: "/gifts/cricova-champagne.mp4", poster: "/gifts/cricova-champagne.jpg", ms: 16_500, skipAfterMs: 8_000 },
};
export const playMs = (priceKobo: number, s: GiftSettings = GIFT_SETTINGS) => (priceKobo >= 500_000 * 100 ? 7_000 : isGrand(priceKobo, s) ? 5_500 : 3_800);
export const isGrand = (priceKobo: number, s: GiftSettings = GIFT_SETTINGS) => priceKobo >= s.grand.fromKobo;
// Premium (below the grand price) or VIP (from it), and the extra share of the creator's rate that kind of gift carries.
export const giftClass = (priceKobo: number, s: GiftSettings = GIFT_SETTINGS): "premium" | "vip" => (isGrand(priceKobo, s) ? "vip" : "premium");
export const giftUplift = (priceKobo: number, s: GiftSettings = GIFT_SETTINGS) => (giftClass(priceKobo, s) === "vip" ? s.uplift.vipPct : s.uplift.premiumPct) / 100;
// The rate charged: the creator's rate plus that share of it (to 4 places, never over 100%).
export const upliftedRate = (rate: number, uplift: number) => Math.min(1, Math.round(rate * (1 + Math.max(0, uplift)) * 10_000) / 10_000);

export class GiftSettingsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const naira = (k: number) => `₦${Math.round(k / 100).toLocaleString("en-NG")}`;
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

// Checks what an admin saved. A config saved before gifts existed (undefined) keeps the defaults. The catalogue's order is the order
// given; a drawing left out is added at the end, switched off, so nothing is lost by an older form.
export function cleanGiftSettings(input: unknown, d: GiftSettings = { catalogue: DEFAULT_CATALOGUE, daily: DEFAULT_DAILY, grand: DEFAULT_GRAND, uplift: DEFAULT_UPLIFT, economy: DEFAULT_ECONOMY }): GiftSettings {
  if (input === undefined) return { catalogue: d.catalogue.map((g) => ({ ...g })), daily: { ...d.daily }, grand: { ...(d.grand ?? DEFAULT_GRAND) }, uplift: { ...(d.uplift ?? DEFAULT_UPLIFT) }, economy: { ...(d.economy ?? DEFAULT_ECONOMY) } };
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
  const gg = i.grand === undefined ? (d.grand ?? DEFAULT_GRAND) : rec(i.grand);
  const fromKobo = Math.round(Number(gg.fromKobo));
  if (!Number.isFinite(fromKobo) || fromKobo < ANIMATED_MIN_KOBO || fromKobo > ANIMATED_MAX_KOBO || fromKobo % 100 !== 0) {
    throw new GiftSettingsError(`Grand gifts: a price in whole naira from ${naira(ANIMATED_MIN_KOBO)} to ${naira(ANIMATED_MAX_KOBO)}.`);
  }
  const uu = i.uplift === undefined ? (d.uplift ?? DEFAULT_UPLIFT) : rec(i.uplift);
  const pctOf = (v: unknown, what: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > UPLIFT_MAX_PCT || Math.round(n * 10) !== n * 10) throw new GiftSettingsError(`${what}: a percent of the creator's rate from 0 to ${UPLIFT_MAX_PCT} (one decimal at most).`);
    return n;
  };
  const ee = i.economy === undefined ? (d.economy ?? DEFAULT_ECONOMY) : rec(i.economy);
  const autoWithdrawMaxKobo = Math.round(Number(ee.autoWithdrawMaxKobo));
  if (!Number.isFinite(autoWithdrawMaxKobo) || autoWithdrawMaxKobo < AUTO_WITHDRAW_MIN_KOBO || autoWithdrawMaxKobo > AUTO_WITHDRAW_MAX_KOBO || autoWithdrawMaxKobo % 100 !== 0) {
    throw new GiftSettingsError(`Gift withdrawals paid automatically below: whole naira from ${naira(AUTO_WITHDRAW_MIN_KOBO)} to ${naira(AUTO_WITHDRAW_MAX_KOBO)}.`);
  }
  return {
    catalogue,
    economy: { quantityMax: whole(ee.quantityMax, "Most of one gift in a single send", 1, QUANTITY_MAX_LIMIT), autoWithdrawMaxKobo },
    grand: { fromKobo, announce: gg.announce !== false },
    uplift: { premiumPct: pctOf(uu.premiumPct, "Premium gifts, extra commission"), vipPct: pctOf(uu.vipPct, "VIP gifts, extra commission") },
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
// A verified sender is needed from the grand price up, and for anything over the cap community giving uses for unverified senders.
export const needsVerified = (g: Pick<AnimatedGift, "priceKobo">, s: GiftSettings = GIFT_SETTINGS) => isGrand(g.priceKobo, s) || g.priceKobo > UNVERIFIED_GIFT_CAP_KOBO;
// The rule in words, for the sheet, the help and errors: "from ₦25,000", the cheapest gift that needs a verified sender (so it always
// matches the catalogue in force).
export const verifiedRuleText = (s: GiftSettings = GIFT_SETTINGS) => {
  const need = s.catalogue.filter((g) => g.enabled && needsVerified(g, s)).map((g) => g.priceKobo);
  return `from ${naira(need.length ? Math.min(...need) : s.grand.fromKobo)}`;
};

// What an animated gift costs and whether this sender may send it. Grand gifts, and any above the unverified cap (the same cap community
// giving uses), need a sender with a ✔ (or gold) badge. Returns the price, or a reason to show.
export function animatedGiftPrice(id: unknown, senderVerified: boolean, s: GiftSettings = GIFT_SETTINGS): { ok: true; gift: AnimatedGift } | { ok: false; status: number; error: string } {
  const g = findGift(id, s);
  if (!g || !g.enabled) return { ok: false, status: 404, error: "That gift isn't available any more. Choose another." };
  if (needsVerified(g, s) && !senderVerified) {
    return { ok: false, status: 403, error: `${g.name} is for verified senders (the ✔ badge): gifts ${verifiedRuleText(s)} need a verified account. Choose a smaller gift, or get verified first.` };
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

// ── Gifting everywhere (owner, 4 Nov 2026; docs/LIVE_ECONOMY.md phase 2) ─────────────────────────────────────────────────────────
// Who a gift is for and where it was sent, kept on gifts/{ref} for the receiver's list and the analytics.
export const GIFT_CONTEXTS = ["profile", "post", "live", "comment", "review", "media", "replay"] as const;
export type GiftContext = (typeof GIFT_CONTEXTS)[number];
export const isGiftContext = (v: unknown): v is GiftContext => typeof v === "string" && (GIFT_CONTEXTS as readonly string[]).includes(v);
export const GIFT_TO_KINDS = ["creator", "host", "speaker", "commenter", "replayHost"] as const;
export type GiftToKind = (typeof GIFT_TO_KINDS)[number];
export const isGiftToKind = (v: unknown): v is GiftToKind => typeof v === "string" && (GIFT_TO_KINDS as readonly string[]).includes(v);

// Quantity: tapping a small (premium) gift twice opens "How many?". N of one gift go as one payment at N times the catalogue price,
// up to quantityMax, and never over the largest gift anyone can send (GIFT_MAX_KOBO, passed in so this file stays free of the boost
// config). VIP gifts go one at a time. A total over the cap for unverified senders needs a verified sender, the same as a single gift.
export function giftQuantity(g: Pick<AnimatedGift, "name" | "priceKobo">, qty: unknown, maxTotalKobo: number, senderIsVerified: boolean, s: GiftSettings = GIFT_SETTINGS):
  { ok: true; quantity: number; totalKobo: number } | { ok: false; status: number; error: string } {
  const n = qty === undefined || qty === null || qty === "" ? 1 : Number(qty);
  if (!Number.isInteger(n) || n < 1 || n > s.economy.quantityMax) return { ok: false, status: 400, error: `Send 1 to ${s.economy.quantityMax} at a time.` };
  if (n > 1 && isGrand(g.priceKobo, s)) return { ok: false, status: 400, error: `${g.name} is a VIP gift: send one at a time.` };
  const totalKobo = g.priceKobo * n;
  if (totalKobo > maxTotalKobo) return { ok: false, status: 400, error: `That's ${naira(totalKobo)}: one send can be up to ${naira(maxTotalKobo)}. Send fewer.` };
  if (n > 1 && totalKobo > UNVERIFIED_GIFT_CAP_KOBO && !senderIsVerified) {
    return { ok: false, status: 403, error: `Sends over ${naira(UNVERIFIED_GIFT_CAP_KOBO)} are for verified senders (the ✔ badge). Send fewer, or get verified first.` };
  }
  return { ok: true, quantity: n, totalKobo };
}
// The most of a gift this sender can pick in the "How many?" box.
export const quantityCap = (g: Pick<AnimatedGift, "priceKobo">, maxTotalKobo: number, senderIsVerified: boolean, s: GiftSettings = GIFT_SETTINGS) =>
  isGrand(g.priceKobo, s) ? 1 : Math.max(1, Math.min(s.economy.quantityMax, Math.floor((senderIsVerified ? maxTotalKobo : Math.max(g.priceKobo, Math.min(maxTotalKobo, UNVERIFIED_GIFT_CAP_KOBO))) / g.priceKobo)));

// Gift points: a running count per sender, 1 point per ₦100 spent on gifts (all time and this Lagos week). The same rate as fan points.
export const GIFT_POINT_KOBO = 100 * 100;
export const giftPointsFor = (kobo: number) => (Number.isFinite(kobo) && kobo > 0 ? Math.floor(kobo / GIFT_POINT_KOBO) : 0);

// Weekly boards reset at midnight going into Monday, Lagos time (owner decision 5, 4 Nov 2026). A week is named by its Monday.
export function lagosWeekOf(d: Date | string | number): string {
  const day = lagosDayOf(d);
  const t = Date.parse(`${day}T00:00:00Z`);
  const dow = new Date(t).getUTCDay(); // 0 Sunday … 6 Saturday
  return new Date(t - ((dow + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
}
export const weekBefore = (week: string) => new Date(Date.parse(`${week}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
// When a Lagos week ends (the next Monday 00:00 in Lagos).
export const lagosWeekEnds = (week: string) => new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86_400_000 - LAGOS_OFFSET_MS);

// Teens (owner decision 2, 4 Nov 2026): a member in teen mode receives gifts only from mutual followers (they follow each other).
export const teenGiftAllowed = (o: { receiverTeen: boolean; mutual: boolean; self?: boolean }) => !o.self && (!o.receiverTeen || o.mutual);
export const TEEN_GIFT_OFF = (name: string) => `${name} is in teen mode: only people ${name} follows back can send them gifts.`;

// Received gifts, grouped by gift: an animated gift by its drawing, a typed amount as "Other". The key is the group's id.
export const receivedKey = (animId: unknown) => (isGiftMotif(animId) ? animId : "other");

// A withdrawal of gift earnings: below the line it is paid automatically, from the line up a person approves it first.
export const withdrawRoute = (kobo: number, s: GiftSettings = GIFT_SETTINGS): "auto" | "approval" => (kobo < s.economy.autoWithdrawMaxKobo ? "auto" : "approval");
// The rule in words, for the sheet, the help and the received gifts page (never a typed-in figure).
export const withdrawRuleText = (s: GiftSettings = GIFT_SETTINGS) => `Under ${naira(s.economy.autoWithdrawMaxKobo)} is paid automatically; ${naira(s.economy.autoWithdrawMaxKobo)} and over is approved by our team first, usually within a day.`;
// Gifts are paid from NotesApp Credit or by card, never with Bonus Credits (owner, 4 Nov 2026). Shown on the sheet.
export const NO_BONUS_TEXT = "Paid from your own NotesApp Credit or by card, never with Bonus Credits.";
