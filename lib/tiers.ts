import { AccountTier } from "./users";

// The single source of truth for the whole tier ladder — pricing page,
// firestore.rules' isPublisher() (duplicated there, rules can't import
// this), and anywhere commission math happens once real payments are
// wired. Change a number here, it's correct everywhere that matters.
export type TierConfig = {
  tier: AccountTier;
  label: string;
  price: string; // display string for /pricing
  priceNote?: string; // small print under the price (yearly price, billing status)
  // Paid plans only: what Paystack actually charges (kobo). Keep in sync with `price`.
  monthlyKobo?: number;
  yearlyKobo?: number;
  canPublish: boolean;
  // Ads carry on every publisher's pages regardless of tier — what
  // differs is whether the publisher earns a cut. null = doesn't
  // apply (Standard can't publish, so there's nothing to run ads on).
  adRevenueShare: number | null; // 0–1, or null
  // NotesApp's cut of TWO revenue types, same rate for both: a paid
  // session booking, AND a subscription unlocking someone's locked/
  // premium journals. Enterprise is negotiated per-account, not a
  // fixed number — represented as a floor with "custom" framing
  // rather than a single value.
  sessionAndUnlockCommission: number | "custom";
  sessionAndUnlockCommissionFloor?: number; // Enterprise: "ranging from 5%+"
  // NotesApp's cut of the item price when a buyer pays on-platform for
  // a physical good from a publisher's store (/u/username/store). Lower than
  // the session/subscription cut because physical margins are thin. Delivery
  // fees pass through untouched. Stores sell through #NotesApp checkout only —
  // there are no link-out items (links live in posts and the profile link).
  physicalCommission: number | "custom";
  physicalCommissionFloor?: number;
  // NotesApp's cut of a digital download (a file the seller uploads; instant, no delivery,
  // final once downloaded). Higher than physical because there is no cost of goods to share.
  digitalCommission: number | "custom";
  digitalCommissionFloor?: number;
};

export const TIERS: TierConfig[] = [
  {
    tier: "standard",
    label: "Free Standard",
    price: "₦0",
    canPublish: false,
    adRevenueShare: null,
    sessionAndUnlockCommission: 0, // N/A — Standard can't publish, nothing to take a cut of
    physicalCommission: 0,
    digitalCommission: 0,
  },
  {
    tier: "basic",
    label: "Free Basic",
    price: "₦0",
    canPublish: true,
    adRevenueShare: 0,
    sessionAndUnlockCommission: 0.35,
    physicalCommission: 0.08,
    digitalCommission: 0.2,
  },
  {
    tier: "pro",
    label: "Pro",
    price: "₦5,000/month",
    priceNote: "or ₦50,000/year (2 months free) · cancel anytime",
    monthlyKobo: 5_000 * 100,
    yearlyKobo: 50_000 * 100,
    canPublish: true,
    adRevenueShare: 0.25,
    sessionAndUnlockCommission: 0.25,
    physicalCommission: 0.05,
    digitalCommission: 0.15,
  },
  {
    tier: "business",
    label: "Business",
    price: "₦15,000/month",
    priceNote: "or ₦150,000/year (2 months free) · cancel anytime",
    monthlyKobo: 15_000 * 100,
    yearlyKobo: 150_000 * 100,
    canPublish: true,
    adRevenueShare: 0.45,
    sessionAndUnlockCommission: 0.15,
    physicalCommission: 0.04,
    digitalCommission: 0.1,
  },
  {
    tier: "enterprise",
    label: "Enterprise",
    price: "Custom",
    canPublish: true,
    adRevenueShare: 0.75, // increased from Business's 45%; the negotiable part is the commission side
    sessionAndUnlockCommission: "custom",
    sessionAndUnlockCommissionFloor: 0.05,
    physicalCommission: "custom",
    physicalCommissionFloor: 0.03,
    digitalCommission: "custom",
    digitalCommissionFloor: 0.05,
  },
];

export function getTierConfig(tier: AccountTier): TierConfig {
  return TIERS.find((t) => t.tier === tier) || TIERS[0];
}

export function formatPercent(value: number | "custom", floor?: number): string {
  if (value === "custom") return `Custom (from ${((floor ?? 0.05) * 100).toFixed(0)}%+)`;
  return `${(value * 100).toFixed(0)}%`;
}

// NotesApp's cut of a session, subscription or gift for a publisher of
// this tier (0–1). Enterprise is negotiated per account; until a
// per-account override exists it uses the 5% floor.
export function commissionRateFor(tier: AccountTier): number {
  const c = getTierConfig(tier).sessionAndUnlockCommission;
  // Enterprise is negotiated per account; until an override exists, use the floor.
  return c === "custom" ? getTierConfig(tier).sessionAndUnlockCommissionFloor ?? 0.05 : c;
}

// NotesApp's cut of the item price on a physical-goods sale (0–1). Enterprise is
// negotiated; until an override exists it uses the 3% floor.
export function physicalCommissionRateFor(tier: AccountTier): number {
  const c = getTierConfig(tier).physicalCommission;
  return c === "custom" ? getTierConfig(tier).physicalCommissionFloor ?? 0.03 : c;
}

// NotesApp's cut of a digital download (0–1): 20 / 15 / 10 %, Enterprise negotiated (5% floor).
export function digitalCommissionRateFor(tier: AccountTier): number {
  const c = getTierConfig(tier).digitalCommission;
  return c === "custom" ? getTierConfig(tier).digitalCommissionFloor ?? 0.05 : c;
}

// Verified badge: included free on Business and Enterprise; every other
// tier (Free Standard, Free Basic, Pro) can add it for ₦999/month.
export const BADGE_PRICE_KOBO = 999 * 100;
export function badgeIncluded(tier: AccountTier): boolean {
  return tier === "business" || tier === "enterprise";
}
