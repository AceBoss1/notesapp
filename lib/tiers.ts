import { AccountTier } from "./users";

// The single source of truth for the whole tier ladder — pricing page,
// firestore.rules' isPublisher() (duplicated there, rules can't import
// this), and anywhere commission math happens once real payments are
// wired. Change a number here, it's correct everywhere that matters.
export type TierConfig = {
  tier: AccountTier;
  label: string;
  price: string; // display string for /pricing — real billing not wired yet, see README
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
  // NotesApp's cut of a sale through a publisher's INTERNAL brand
  // store. Distinct from external stores (Selar, Amazon, etc.) —
  // those are gated separately, see externalStoreAllowed.
  merchCommission: number | "custom";
  merchCommissionFloor?: number;
  // Linking out to an external store (Selar, Amazon, etc.) instead of
  // NotesApp's own fulfillment. Restricted on purpose — an external
  // link-out is revenue NotesApp never takes a commission on, so it's
  // only available where that trade-off already makes sense: the two
  // founders' existing stores (a separate, role-based allowance — see
  // canUseExternalStore below, not tied to tier at all) and Enterprise.
  externalStoreAllowed: boolean;
};

export const TIERS: TierConfig[] = [
  {
    tier: "standard",
    label: "Free Standard",
    price: "₦0",
    canPublish: false,
    adRevenueShare: null,
    sessionAndUnlockCommission: 0, // N/A — Standard can't publish, nothing to take a cut of
    merchCommission: 0,
    externalStoreAllowed: false,
  },
  {
    tier: "basic",
    label: "Free Basic",
    price: "₦0",
    canPublish: true,
    adRevenueShare: 0,
    sessionAndUnlockCommission: 0.35,
    merchCommission: 0.20,
    externalStoreAllowed: false,
  },
  {
    tier: "pro",
    label: "Pro",
    price: "Coming soon",
    canPublish: true,
    adRevenueShare: 0.25,
    sessionAndUnlockCommission: 0.25,
    merchCommission: 0.15,
    externalStoreAllowed: false,
  },
  {
    tier: "business",
    label: "Business",
    price: "Coming soon",
    canPublish: true,
    adRevenueShare: 0.45,
    sessionAndUnlockCommission: 0.15,
    merchCommission: 0.10,
    externalStoreAllowed: false,
  },
  {
    tier: "enterprise",
    label: "Enterprise",
    price: "Custom",
    canPublish: true,
    adRevenueShare: 0.75, // increased from Business's 45%; the negotiable part is the commission side
    sessionAndUnlockCommission: "custom",
    sessionAndUnlockCommissionFloor: 0.05,
    merchCommission: "custom",
    merchCommissionFloor: 0.05,
    externalStoreAllowed: true,
  },
];

export function getTierConfig(tier: AccountTier): TierConfig {
  return TIERS.find((t) => t.tier === tier) || TIERS[0];
}

export function formatPercent(value: number | "custom", floor?: number): string {
  if (value === "custom") return `Custom (from ${((floor ?? 0.05) * 100).toFixed(0)}%+)`;
  return `${(value * 100).toFixed(0)}%`;
}

// Founders (Emmanuel/Chimdinma — role "admin") get external stores
// regardless of tier — a role-based allowance, not a tier one. This
// is why lib/store.ts's two hardcoded catalogues (Selar/Amazon links)
// were never tier-gated to begin with; this function makes that
// existing behavior explicit rather than accidental.
export function canUseExternalStore(role: string, tier: AccountTier): boolean {
  if (role === "admin") return true;
  return getTierConfig(tier).externalStoreAllowed;
}
