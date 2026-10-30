// Referrals and affiliates (docs/REFERRALS.md, step 2). Pure: no database here.
// - A member's link, /r/<username>, remembered for 30 days in the REFERRAL_COOKIE. A friend who joins through it gets their first
//   month of a plan free (annual: one month's value off), and the member earns PLAN_SHARE of the friend's plan payments for
//   PLAN_MONTHS, from the friend's first real payment.
// - Product affiliates: a publisher sets an affiliate percentage on a shop item, download or course; any verified member links to it
//   (/r/<username>?to=<the product>) and earns that percentage of what the buyer paid for it, out of the publisher's share.
// - Earnings wait for the hold, then can be taken as cash (MIN_CASH_KOBO or more, through the usual payouts) or as NotesApp Credit
//   with a CREDIT_BONUS on top (any amount).

export const REFERRAL_COOKIE = "na_ref";
export const REFERRAL_COOKIE_DAYS = 30;
export const PLAN_SHARE = 0.2;
export const PLAN_MONTHS = 12;
export const MIN_CASH_KOBO = 2_000 * 100;
export const CREDIT_BONUS = 0.1;
export const MAX_AFFILIATE_PERCENT = 50;
// How long an earning waits before it can be taken: long enough for the payment to clear and the refund window to pass.
export const HOLD_DAYS = { plan: 7, digital: 7, course: 7, store: 14 } as const;
// A card check for a free first month: charged, then given back once the card is saved for the plan.
export const CARD_CHECK_KOBO = 100 * 100;
// Admin alerts: a referrer whose earnings this week pass ALERT_MIN_KOBO and are ALERT_FACTOR times their usual week.
export const ALERT_MIN_KOBO = 50_000 * 100;
export const ALERT_FACTOR = 3;

export type EarningSource = "plan" | "store" | "digital" | "course";
export type EarningStatus = "held" | "withdrawn" | "reversed";
export type Earning = {
  id: string; // plan_<reference> or prod_<reference>
  uid: string; // who earns it
  source: EarningSource;
  paymentReference: string;
  buyerUid: string;
  sellerUid?: string; // a product's publisher
  itemId?: string;
  title: string;
  baseKobo: number; // what the share is worked out on (what the buyer paid)
  percent: number;
  kobo: number;
  status: EarningStatus;
  releaseAfter: string;
  createdAt: string;
  withdrawalId?: string;
};

export const isAvailable = (e: Pick<Earning, "status" | "releaseAfter">, now: Date) => e.status === "held" && new Date(e.releaseAfter) <= now;

export function referralLink(origin: string, username: string, to?: string): string {
  const base = `${origin.replace(/\/$/, "")}/r/${encodeURIComponent(username)}`;
  return to ? `${base}?to=${encodeURIComponent(to)}` : base;
}
// Where a link may send someone: a path on #NotesApp only (never another site).
export const safeTarget = (to: unknown): string => {
  const s = typeof to === "string" ? to : "";
  return /^\/(?!\/)[A-Za-z0-9/_\-.?=&%]*$/.test(s) && !s.startsWith("/r/") ? s : "/signup";
};

export const planEarningKobo = (paidKobo: number) => Math.round(paidKobo * PLAN_SHARE);
export function withinPlanWindow(firstPaidAt: string | undefined, now: Date): boolean {
  if (!firstPaidAt) return true; // this is the first real payment
  const end = new Date(firstPaidAt);
  end.setMonth(end.getMonth() + PLAN_MONTHS);
  return now < end;
}

export const affiliateKobo = (paidKobo: number, percent: number) => Math.floor((paidKobo * percent) / 100);
export function cleanAffiliatePercent(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_AFFILIATE_PERCENT) throw new Error(`An affiliate share is a whole number from 0 to ${MAX_AFFILIATE_PERCENT}%.`);
  return n;
}

// A referred friend's first payment for a plan: monthly, a refundable card check with the plan starting after the free month;
// annual, the year less one month, charged now, with the yearly plan starting a year on.
export function firstPeriodOffer(interval: "monthly" | "annually", monthlyKobo: number, yearlyKobo: number) {
  return interval === "monthly"
    ? { chargeKobo: CARD_CHECK_KOBO, refundCheck: true, label: "First month free" }
    : { chargeKobo: Math.max(CARD_CHECK_KOBO, yearlyKobo - monthlyKobo), refundCheck: false, label: "One month off your first year" };
}

export const creditWithBonus = (kobo: number) => ({ creditKobo: kobo, bonusKobo: Math.round(kobo * CREDIT_BONUS) });

export function jumpAlert(thisWeekKobo: number, earlierWeeksKobo: number[]): boolean {
  if (thisWeekKobo < ALERT_MIN_KOBO) return false;
  const usual = earlierWeeksKobo.length ? earlierWeeksKobo.reduce((a, b) => a + b, 0) / earlierWeeksKobo.length : 0;
  return thisWeekKobo >= ALERT_FACTOR * Math.max(usual, 1);
}
