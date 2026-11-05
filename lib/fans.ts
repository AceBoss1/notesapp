// Fan levels and subscription tiers (owner, 3 Nov 2026; mockups approved). Pure and client-safe; the server side is lib/fans-server.ts.
//
// Subscriptions to a creator come in three tiers, each priced by the creator within a range set in Admin → Limits → Subscriptions
// and fans (serverConfig/fans): Premium (🌄 Starter), VIP (🛡 Army) and VVIP (🏆 VVIP). Each tier includes the ones below it. Paid
// subscriptions from before tiers are Premium. #NotesApp takes the creator's normal rate on Premium, and the rate plus a share OF it on
// VIP (10%) and VVIP (20%), fixed on the payment at checkout, the same as on gifts.
//
// Fan points, per creator and fan, all-time, written only by the server: 1 point per ₦100 paid to the creator (subscriptions and
// gifts), 10 for a share of their work (5 a day count), 3 for a comment (10 a day), 1 for a reaction (20 a day). The top 99 get a badge
// next to their name in the creator's space: 🥇 #1, 🥈 #2, 🥉 #3, 🏅 #4–10, 🎖 #11–99 ("{FirstName}'s Top Fan"). In the creator's lives
// the top three arrive and leave in style: #1 with VVIP by yacht or private jet, #2 and #3 with any subscription by SUV or sports car,
// e-bike or bicycle; the fan picks which of their two.

export const SUB_TIERS = ["premium", "vip", "vvip"] as const;
export type SubTier = (typeof SUB_TIERS)[number];
export const isSubTier = (v: unknown): v is SubTier => typeof v === "string" && (SUB_TIERS as readonly string[]).includes(v);
export const TIER_NAME: Record<SubTier, string> = { premium: "Premium", vip: "VIP", vvip: "VVIP" };
export const TIER_BADGE: Record<SubTier, { emoji: string; label: string }> = {
  premium: { emoji: "🌄", label: "Starter" },
  vip: { emoji: "🛡", label: "Army" },
  vvip: { emoji: "🏆", label: "VVIP" },
};
const TIER_ORDER: Record<SubTier, number> = { premium: 1, vip: 2, vvip: 3 };
// Whether a subscriber's tier reaches what an item needs (an item for "vip" is open to VIP and VVIP).
export const tierReaches = (have: SubTier | null | undefined, need: SubTier) => !!have && TIER_ORDER[have] >= TIER_ORDER[need];
// A subscription record from before tiers is Premium.
export const tierOf = (sub: { tier?: unknown } | null | undefined): SubTier => (isSubTier(sub?.tier) ? sub!.tier as SubTier : "premium");

// ── Settings (Admin → Limits → Subscriptions and fans; serverConfig/fans) ──
export type FanSettingKey = "premiumMin" | "premiumMax" | "vipMin" | "vipMax" | "vvipMin" | "vvipMax" | "vipUpliftPct" | "vvipUpliftPct";
export type FanSettingDef = { key: FanSettingKey; label: string; unit: string; min: number; max: number; def: number };
export const FAN_SETTINGS: FanSettingDef[] = [
  { key: "premiumMin", label: "Premium: lowest monthly price a creator can set", unit: "₦", min: 100, max: 10_000_000, def: 1_000 },
  { key: "premiumMax", label: "Premium: highest monthly price", unit: "₦", min: 100, max: 10_000_000, def: 100_000 },
  { key: "vipMin", label: "VIP: lowest monthly price", unit: "₦", min: 100, max: 10_000_000, def: 5_000 },
  { key: "vipMax", label: "VIP: highest monthly price", unit: "₦", min: 100, max: 10_000_000, def: 200_000 },
  { key: "vvipMin", label: "VVIP: lowest monthly price", unit: "₦", min: 100, max: 10_000_000, def: 10_000 },
  { key: "vvipMax", label: "VVIP: highest monthly price", unit: "₦", min: 100, max: 10_000_000, def: 500_000 },
  { key: "vipUpliftPct", label: "VIP: #NotesApp takes the creator's rate plus this % of it", unit: "%", min: 0, max: 100, def: 10 },
  { key: "vvipUpliftPct", label: "VVIP: #NotesApp takes the creator's rate plus this % of it", unit: "%", min: 0, max: 100, def: 20 },
];
export type FanSettings = Record<FanSettingKey, number>;
export type FanOverrides = Partial<FanSettings>;
export const FAN_DEFAULTS = Object.fromEntries(FAN_SETTINGS.map((s) => [s.key, s.def])) as FanSettings;
export function fanSettings(overrides: FanOverrides = {}): FanSettings {
  const out = { ...FAN_DEFAULTS };
  for (const s of FAN_SETTINGS) {
    const v = overrides[s.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= s.min && v <= s.max) out[s.key] = v;
  }
  // A range the wrong way round falls back to its defaults.
  for (const t of SUB_TIERS) if (out[`${t}Min`] > out[`${t}Max`]) { out[`${t}Min`] = FAN_DEFAULTS[`${t}Min`]; out[`${t}Max`] = FAN_DEFAULTS[`${t}Max`]; }
  return out;
}
export class FanSettingsError extends Error {}
export function cleanFanOverrides(input: unknown): FanOverrides {
  const out: FanOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const s of FAN_SETTINGS) {
    const raw = (input as Record<string, unknown>)[s.key];
    if (raw === undefined || raw === null || raw === "") continue;
    const v = Number(raw);
    if (!Number.isInteger(v) || v < s.min || v > s.max) throw new FanSettingsError(`${s.label}: a whole number from ${s.min.toLocaleString("en-NG")} to ${s.max.toLocaleString("en-NG")}.`);
    if (v !== s.def) out[s.key] = v;
  }
  const all = fanSettings(out);
  for (const t of SUB_TIERS) {
    const lo = Number((input as Record<string, unknown>)[`${t}Min`] ?? all[`${t}Min`]), hi = Number((input as Record<string, unknown>)[`${t}Max`] ?? all[`${t}Max`]);
    if (lo > hi) throw new FanSettingsError(`${TIER_NAME[t]}: the lowest price is above the highest.`);
  }
  return out;
}
// The live settings, for the browser and pure code: the server writes into this object when it loads them (lib/fans-server.ts).
export const FAN_LIVE: FanSettings = { ...FAN_DEFAULTS };
export const applyFanSettings = (s: FanSettings) => { Object.assign(FAN_LIVE, s); };

// A tier's price range, in kobo.
export const tierRangeKobo = (t: SubTier, s: FanSettings = FAN_LIVE) => ({ minKobo: s[`${t}Min`] * 100, maxKobo: s[`${t}Max`] * 100 });
// The share of the creator's rate added on this tier (0 on Premium).
export const tierUplift = (t: SubTier, s: FanSettings = FAN_LIVE) => (t === "vvip" ? s.vvipUpliftPct : t === "vip" ? s.vipUpliftPct : 0) / 100;
// The rate charged: the creator's rate plus that share of it (to 4 places, never over 100%).
export const tierRate = (rate: number, t: SubTier, s: FanSettings = FAN_LIVE) => Math.min(1, Math.round(rate * (1 + tierUplift(t, s)) * 10_000) / 10_000);

// ── A creator's tier prices (publisherSettings.subscription.tiers) ──
// liveDiscountPct (v0.141.0): the discount this tier's subscribers get on the creator's paid-live tickets, set beside the tier's price
// (0–100, capped by Admin → Limits → Audio rooms → Paid lives; lib/live-tickets.ts discountFor).
export type TierOffer = { enabled: boolean; priceKobo: number; planCode?: string; liveDiscountPct?: number };
export type TierOffers = Record<SubTier, TierOffer>;
// Settings saved before tiers: their one price is Premium; VIP and VVIP are off.
export function tierOffers(sub: { enabled?: boolean; priceKobo?: number; planCode?: string; tiers?: Partial<Record<SubTier, Partial<TierOffer>>> } | null | undefined): TierOffers {
  const out = {} as TierOffers;
  for (const t of SUB_TIERS) {
    const o = sub?.tiers?.[t];
    if (o) out[t] = { enabled: o.enabled === true, priceKobo: Number(o.priceKobo) || 0, ...(o.planCode ? { planCode: String(o.planCode) } : {}), ...(Number(o.liveDiscountPct) > 0 ? { liveDiscountPct: Math.min(100, Math.round(Number(o.liveDiscountPct))) } : {}) };
    else if (t === "premium" && sub) out[t] = { enabled: sub.enabled === true, priceKobo: Number(sub.priceKobo) || 0, ...(sub.planCode ? { planCode: sub.planCode } : {}) };
    else out[t] = { enabled: false, priceKobo: 0 };
  }
  return out;
}
// Each tier's paid-live ticket discount, as the host set it (before the Admin cap).
export const tierLiveDiscounts = (o: TierOffers): Partial<Record<SubTier, number>> =>
  Object.fromEntries(SUB_TIERS.filter((t) => (o[t].liveDiscountPct ?? 0) > 0).map((t) => [t, o[t].liveDiscountPct!]));
export const openTiers = (o: TierOffers) => SUB_TIERS.filter((t) => o[t].enabled && !!o[t].planCode);

// Who can see an item: everyone, or subscribers from a tier up. Old posts with premium: true are Premium and up.
export type Audience = "everyone" | SubTier;
export const isAudience = (v: unknown): v is Audience => v === "everyone" || isSubTier(v);
export const AUDIENCE_LABEL: Record<Audience, string> = { everyone: "Everyone", premium: "Premium and up", vip: "VIP and up", vvip: "VVIP only" };
export const noteAudience = (n: { premium?: unknown; minTier?: unknown }): Audience => (isSubTier(n.minTier) ? n.minTier : n.premium === true ? "premium" : "everyone");
export const canSee = (aud: Audience, have: SubTier | null | undefined) => aud === "everyone" || tierReaches(have, aud);

// ── Fan points ──
export type FanAction = "share" | "comment" | "reaction";
export const FAN_ACTIONS: Record<FanAction, { points: number; perDay: number; label: string }> = {
  share: { points: 10, perDay: 5, label: "Share of their post, item, course or Media" },
  comment: { points: 3, perDay: 10, label: "Comment" },
  reaction: { points: 1, perDay: 20, label: "Reaction" },
};
export const KOBO_PER_POINT = 100 * 100; // 1 point per ₦100 paid
export const moneyPoints = (kobo: number) => Math.max(0, Math.floor(kobo / KOBO_PER_POINT));
export const TOP_FANS = 99;

// The badge for a place on a creator's fan list (1-based), or null past the top 99.
export type RankBadge = { emoji: string; tone: "gold" | "silver" | "bronze" | "top10" | "top99"; label: string };
export function rankBadge(rank: number | null | undefined, creatorFirstName: string): RankBadge | null {
  if (!rank || rank < 1 || rank > TOP_FANS) return null;
  const label = `${creatorFirstName}'s Top Fan`;
  if (rank === 1) return { emoji: "🥇", tone: "gold", label };
  if (rank === 2) return { emoji: "🥈", tone: "silver", label };
  if (rank === 3) return { emoji: "🥉", tone: "bronze", label };
  if (rank <= 10) return { emoji: "🏅", tone: "top10", label };
  return { emoji: "🎖", tone: "top99", label };
}
export const firstName = (name: string) => (String(name || "").trim().split(/\s+/)[0] || "Their").slice(0, 30);
// Points still to reach the next band (top 10, top 3, #1), from the points held by the place above it.
export function nextBand(rank: number | null, points: number, pointsAt: (place: number) => number | null): { place: number; needed: number } | null {
  const bands = [99, 10, 3, 1];
  for (const b of bands) {
    if (rank && rank <= b) continue;
    const at = pointsAt(b);
    if (at === null) return { place: b, needed: 1 };
    return { place: b, needed: Math.max(1, at - points + 1) };
  }
  return null;
}

// ── Live entrances ──
export const VEHICLES = ["yacht", "jet", "suv", "sports", "ebike", "bicycle"] as const;
export type Vehicle = (typeof VEHICLES)[number];
export const isVehicle = (v: unknown): v is Vehicle => typeof v === "string" && (VEHICLES as readonly string[]).includes(v);
export const VEHICLE_LABEL: Record<Vehicle, { emoji: string; arrive: string; leave: string }> = {
  yacht: { emoji: "🛥️", arrive: "sailed in by yacht", leave: "sailed off by yacht" },
  jet: { emoji: "✈️", arrive: "flew in by private jet", leave: "flew off by private jet" },
  suv: { emoji: "🚙", arrive: "pulled up in an SUV", leave: "drove off in an SUV" },
  sports: { emoji: "🏎️", arrive: "pulled up in a sports car", leave: "sped off in a sports car" },
  ebike: { emoji: "🛵", arrive: "rode in on an e-bike", leave: "rode off on an e-bike" },
  bicycle: { emoji: "🚲", arrive: "cycled in", leave: "cycled off" },
};
// A top fan arriving or leaving a live, as the room doc carries it (lib/fans-server.ts liveEntrance).
export type Entrance = { uid: string; name: string; vehicle: Vehicle; place: number; tier: SubTier; badge: string; way: "in" | "out"; at: string };
// The two vehicles a fan may choose from at this place, or none: #1 needs VVIP; #2 and #3 need any tier.
export function entranceChoices(rank: number | null | undefined, tier: SubTier | null | undefined): [Vehicle, Vehicle] | null {
  if (rank === 1 && tier === "vvip") return ["yacht", "jet"];
  if (rank === 2 && tier) return ["suv", "sports"];
  if (rank === 3 && tier) return ["ebike", "bicycle"];
  return null;
}
// The vehicle shown: the fan's pick when it's one of their two, else the first.
export function entranceVehicle(rank: number | null | undefined, tier: SubTier | null | undefined, picks: Partial<Record<string, Vehicle>> = {}): Vehicle | null {
  const c = entranceChoices(rank, tier);
  if (!c) return null;
  const want = picks[String(rank)];
  return want && c.includes(want) ? want : c[0];
}
