import { NIGERIAN_STATES } from "./merch";
import { cleanText } from "./orders";
import { SHIPMENT_SERVICES, type ShipmentService } from "./shipments";

// The logistics provider network. Providers (Frazo and others) publish where they deliver (coverage areas) and a rate card; stores find
// them by coverage, talk to them in Messages, and choose one as their delivery partner. At checkout a physical item's delivery fee then
// comes from the partner's rate card for the buyer's address; the buyer pays it online, the provider is paid it minus #NotesApp's cut.
// Pure and client-safe; the server side is lib/logistics-server.ts.

// ---- where: zones measured from the provider's base, using Nigeria's six geopolitical zones for "nearby" ----
export const GEO_ZONES: Record<string, string[]> = {
  "North Central": ["Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "FCT (Abuja)"],
  "North East": ["Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"],
  "North West": ["Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"],
  "South East": ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"],
  "South South": ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"],
  "South West": ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"],
};
export const geoZoneOf = (state: string) => Object.keys(GEO_ZONES).find((z) => GEO_ZONES[z].includes(state)) ?? null;

export type Zone = "city" | "state" | "region" | "national";
export const ZONES: { id: Zone; name: string; blurb: string }[] = [
  { id: "city", name: "Same city", blurb: "Within the city or town you're based in" },
  { id: "state", name: "Same state", blurb: "Elsewhere in your state" },
  { id: "region", name: "Nearby states", blurb: "Other states in your geopolitical zone" },
  { id: "national", name: "Rest of Nigeria", blurb: "Every other state you cover" },
];
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export function zoneFor(from: { city: string; state: string }, to: { city: string; state: string }): Zone {
  if (from.state === to.state) return sameText(from.city, to.city) ? "city" : "state";
  const z = geoZoneOf(from.state);
  return z && z === geoZoneOf(to.state) ? "region" : "national";
}

// ---- how much: weight bands, a price per extra kilo past the last band ----
export const WEIGHT_BANDS_KG = [1, 2, 5, 10, 20] as const;
export const MIN_FEE_KOBO = 100 * 100;
export const MAX_FEE_KOBO = 500_000 * 100;
export type RateCard = {
  base: { city: string; state: string }; // where the provider is based: zones are measured from here
  prices: Record<Zone, number[]>; // kobo, one per weight band, never going down as the weight goes up
  extraPerKgKobo: Record<Zone, number>; // past 20 kg, per started kilo
  sameDayKobo: number; // 0 = no same-day service; otherwise the surcharge in the same city
};

// The fee for a parcel of `weightKg` from the card's base to `to`, in kobo. Null when the provider doesn't cover that state.
export function quoteKobo(card: RateCard, coverage: string[], to: { city: string; state: string }, weightKg: number): number | null {
  if (!covers(coverage, to.state)) return null;
  const zone = zoneFor(card.base, to);
  const kg = Math.max(0.1, weightKg);
  const band = WEIGHT_BANDS_KG.findIndex((b) => kg <= b);
  if (band >= 0) return card.prices[zone][band];
  const last = WEIGHT_BANDS_KG.length - 1;
  return card.prices[zone][last] + Math.ceil(kg - WEIGHT_BANDS_KG[last]) * card.extraPerKgKobo[zone];
}

// ---- coverage: the states a provider delivers to, which is what stores browse by ----
export const ALL_STATES = "all";
export const covers = (coverage: string[], state: string) => coverage.includes(ALL_STATES) || coverage.includes(state);
export const coverageLabel = (coverage: string[]) => (coverage.includes(ALL_STATES) ? "All of Nigeria" : coverage.length <= 4 ? coverage.join(", ") : `${coverage.slice(0, 3).join(", ")} and ${coverage.length - 3} more states`);

// A provider's public listing: what stores see in the network.
export type ProviderProfile = {
  listed: boolean; // shown in the network (a provider can pause it)
  about: string; // a few lines: who they are, what they're good at
  areas: string; // free text under the states: the cities, parks or routes they run
  coverage: string[]; // states, or ["all"]
  services: ShipmentService[];
  rateCard: RateCard;
  updatedAt?: string;
};

const kobo = (v: unknown) => Math.round(Number(v));
// What the provider's settings form sends, checked the same way in the browser and on the server. Prices come in kobo.
export function cleanProfile(raw: unknown): { ok: true; value: ProviderProfile } | { ok: false; error: string } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const card = (b.rateCard && typeof b.rateCard === "object" ? b.rateCard : {}) as Record<string, unknown>;
  const base = (card.base && typeof card.base === "object" ? card.base : {}) as Record<string, unknown>;
  const city = cleanText(base.city, 60), state = String(base.state ?? "");
  if (city.length < 2 || !NIGERIAN_STATES.includes(state)) return { ok: false, error: "Enter the city and state you're based in." };
  const coverageIn = Array.isArray(b.coverage) ? b.coverage.map(String) : [];
  const coverage = coverageIn.includes(ALL_STATES) ? [ALL_STATES] : NIGERIAN_STATES.filter((s) => coverageIn.includes(s));
  if (!coverage.length) return { ok: false, error: "Choose the states you deliver to." };
  const servicesIn = Array.isArray(b.services) ? b.services : [];
  const services = SHIPMENT_SERVICES.map((s) => s.id).filter((id) => servicesIn.includes(id));
  if (!services.length) return { ok: false, error: "Choose at least one service." };
  const pricesIn = (card.prices && typeof card.prices === "object" ? card.prices : {}) as Record<string, unknown>;
  const extraIn = (card.extraPerKgKobo && typeof card.extraPerKgKobo === "object" ? card.extraPerKgKobo : {}) as Record<string, unknown>;
  const prices = {} as Record<Zone, number[]>, extraPerKgKobo = {} as Record<Zone, number>;
  for (const z of ZONES) {
    const row = Array.isArray(pricesIn[z.id]) ? (pricesIn[z.id] as unknown[]).map(kobo) : [];
    if (row.length !== WEIGHT_BANDS_KG.length || row.some((p) => !Number.isInteger(p) || p < MIN_FEE_KOBO || p > MAX_FEE_KOBO)) {
      return { ok: false, error: `${z.name}: enter a price from ₦${MIN_FEE_KOBO / 100} to ₦${(MAX_FEE_KOBO / 100).toLocaleString("en-NG")} for every weight.` };
    }
    if (row.some((p, i) => i > 0 && p < row[i - 1])) return { ok: false, error: `${z.name}: a heavier parcel can't cost less than a lighter one.` };
    const extra = kobo(extraIn[z.id] ?? 0);
    if (!Number.isInteger(extra) || extra < 0 || extra > 50_000 * 100) return { ok: false, error: `${z.name}: the price per extra kilo is ₦0 to ₦50,000.` };
    prices[z.id] = row; extraPerKgKobo[z.id] = extra;
  }
  const sameDayKobo = kobo(card.sameDayKobo ?? 0);
  if (!Number.isInteger(sameDayKobo) || sameDayKobo < 0 || sameDayKobo > 100_000 * 100) return { ok: false, error: "The same-day surcharge is ₦0 to ₦100,000." };
  return {
    ok: true,
    value: {
      listed: b.listed !== false, about: cleanText(b.about, 400), areas: cleanText(b.areas, 300), coverage, services,
      rateCard: { base: { city, state }, prices, extraPerKgKobo, sameDayKobo },
    },
  };
}

// ---- #NotesApp's cut of a shipping fee: a share, at least a minimum, never more than the fee (lib/pricing.ts `logistics`) ----
export function shippingCutKobo(feeKobo: number, rate: number, minKobo: number): number {
  return Math.min(feeKobo, Math.max(Math.round(feeKobo * rate), minKobo));
}

// ---- who can be a provider: Business and Enterprise include it; Free Basic and Pro take the logistics add-on (free for the trial) ----
export type ProviderAccess = { ok: true; via: "plan" | "addon" | "trial"; until?: string } | { ok: false; canTrial: boolean };
export type LogisticsAccount = { addonUntil?: string; trialStartedAt?: string };
export function providerAccess(tier: string, acc: LogisticsAccount | undefined, now: Date, trialDays: number): ProviderAccess {
  if (tier === "business" || tier === "enterprise") return { ok: true, via: "plan" };
  if (acc?.addonUntil && new Date(acc.addonUntil) > now) return { ok: true, via: "addon", until: acc.addonUntil };
  if (acc?.trialStartedAt) {
    const until = new Date(new Date(acc.trialStartedAt).getTime() + trialDays * 86_400_000);
    if (until > now) return { ok: true, via: "trial", until: until.toISOString() };
  }
  return { ok: false, canTrial: (tier === "basic" || tier === "pro") && !acc?.trialStartedAt };
}
// Paying for a month: it runs on from the end of the current paid month (or the trial), so paying early loses nothing.
export function addonExtendedUntil(acc: LogisticsAccount | undefined, now: Date, trialDays: number): string {
  const trialEnd = acc?.trialStartedAt ? new Date(acc.trialStartedAt).getTime() + trialDays * 86_400_000 : 0;
  const from = Math.max(now.getTime(), acc?.addonUntil ? new Date(acc.addonUntil).getTime() : 0, trialEnd);
  const d = new Date(from); d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

// ---- items: how heavy (for the rate card); not set = 1 kg ----
export const DEFAULT_ITEM_KG = 1;
export const MAX_ITEM_KG = 500;
export const itemKg = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= MAX_ITEM_KG ? n : DEFAULT_ITEM_KG; };
