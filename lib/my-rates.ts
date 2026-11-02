import { adShareFor, commissionRateFor, digitalCommissionRateFor, getTierConfig, physicalCommissionRateFor, type CustomRates } from "./tiers";
import { pct } from "./pricing";
import type { AccountTier } from "./users";

// One member's own rates: their plan's, or for an Enterprise account the rates agreed with us (users/{uid}.customRates). Read on the
// server after the saved prices are applied (app/api/publisher/rates), so it is what checkout will charge on a new sale today.
export type MyRates = { tier: AccountTier; plan: string; canPublish: boolean; agreed: boolean; session: number; physical: number; digital: number; adShare: number };

export function myRates(tier: AccountTier, custom?: CustomRates): MyRates {
  const t = getTierConfig(tier);
  const agreed = tier === "enterprise" && typeof custom?.session === "number";
  return {
    tier, plan: t.label, canPublish: t.canPublish, agreed,
    session: commissionRateFor(tier, custom), physical: physicalCommissionRateFor(tier, custom), digital: digitalCommissionRateFor(tier, custom), adShare: adShareFor(tier, custom),
  };
}

// The line a publisher reads where they set a price or see earnings. kind picks the words; the rate is the same for all three
// (sessions, journal subscriptions and gifts to the publisher share one commission, lib/tiers.ts sessionAndUnlockCommission).
export type CommissionKind = "session" | "subscription" | "gift" | "all";
const WHAT: Record<CommissionKind, string> = {
  session: "of each paid session",
  subscription: "of each journal subscription payment",
  gift: "of each gift to you",
  all: "of each paid session, journal subscription and gift to you",
};
export function commissionLine(r: Pick<MyRates, "session" | "plan" | "agreed">, kind: CommissionKind): string {
  return `NotesApp takes ${pct(r.session)} ${WHAT[kind]} (your plan: ${r.plan}${r.agreed ? ", your agreed rate" : ""}).`;
}
