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
  // Enterprise-only extras. Own domain: the member's page, journals and store served on their
  // domain (notes.yourbrand.com or the root yourbrand.com); default home stays /u/username.
  // API access: server-to-server API + Console, switched on per account by an admin.
  customDomain?: boolean;
  apiAccess?: boolean;
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
    physicalCommission: 0.06,
    digitalCommission: 0.09,
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
    physicalCommission: 0.04,
    digitalCommission: 0.06,
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
    physicalCommission: 0.025,
    digitalCommission: 0.04,
  },
  {
    tier: "enterprise",
    label: "Enterprise",
    price: "From ₦35,000/month",
    priceNote: "rates and seats agreed with us",
    canPublish: true,
    adRevenueShare: 0.75, // increased from Business's 45%; the negotiable part is the commission side
    sessionAndUnlockCommission: "custom",
    sessionAndUnlockCommissionFloor: 0.05,
    physicalCommission: "custom",
    physicalCommissionFloor: 0.01,
    digitalCommission: "custom",
    digitalCommissionFloor: 0.015,
    customDomain: true,
    apiAccess: true,
  },
];

export function getTierConfig(tier: AccountTier): TierConfig {
  return TIERS.find((t) => t.tier === tier) || TIERS[0];
}

export function formatPercent(value: number | "custom", floor?: number): string {
  if (value === "custom") return `Custom (from ${+((floor ?? 0.05) * 100).toFixed(1)}%+)`;
  return `${+(value * 100).toFixed(1)}%`;
}

// Rates agreed with one Enterprise account (users/{uid}.customRates, set by an admin only), as fractions 0–1.
// They apply only while the account is on Enterprise; blank fields fall back to the Enterprise defaults below.
export type CustomRates = { session?: number; physical?: number; digital?: number; adShare?: number };
const agreed = (tier: AccountTier, v: unknown): number | undefined =>
  tier === "enterprise" && typeof v === "number" && v >= 0 && v <= 0.5 ? v : undefined;
// Same rule for the ad share, which can be up to 100%.
const agreedShare = (tier: AccountTier, v: unknown): number | undefined =>
  tier === "enterprise" && typeof v === "number" && v >= 0 && v <= 1 ? v : undefined;

// NotesApp's cut of a session, subscription or gift for a publisher of
// this tier (0–1). Enterprise is negotiated per account: the account's agreed rate, else the 5% floor.
export function commissionRateFor(tier: AccountTier, custom?: CustomRates): number {
  const c = getTierConfig(tier).sessionAndUnlockCommission;
  return agreed(tier, custom?.session) ?? (c === "custom" ? getTierConfig(tier).sessionAndUnlockCommissionFloor ?? 0.05 : c);
}

// NotesApp's cut of the item price on a physical-goods sale (0–1). Enterprise: the agreed rate, else the 1% floor.
export function physicalCommissionRateFor(tier: AccountTier, custom?: CustomRates): number {
  const c = getTierConfig(tier).physicalCommission;
  return agreed(tier, custom?.physical) ?? (c === "custom" ? getTierConfig(tier).physicalCommissionFloor ?? 0.03 : c);
}

// NotesApp's cut of a digital download (0–1): 9 / 6 / 4 %, Enterprise: the agreed rate, else the 1.5% floor.
export function digitalCommissionRateFor(tier: AccountTier, custom?: CustomRates): number {
  const c = getTierConfig(tier).digitalCommission;
  return agreed(tier, custom?.digital) ?? (c === "custom" ? getTierConfig(tier).digitalCommissionFloor ?? 0.05 : c);
}

// The publisher's share of the ad revenue on their pages (0–1): by tier, or the Enterprise account's agreed share.
export function adShareFor(tier: AccountTier, custom?: CustomRates): number {
  return agreedShare(tier, custom?.adShare) ?? (getTierConfig(tier).adRevenueShare ?? 0);
}

// Verified badge: included free on Business and Enterprise; every other
// tier (Free Standard, Free Basic, Pro) can add it for ₦999/month.
export const BADGE_PRICE_KOBO = 999 * 100;
export function badgeIncluded(tier: AccountTier): boolean {
  return tier === "business" || tier === "enterprise";
}
