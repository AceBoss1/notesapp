// Ad-share accounting. Shared by the admin route and pages.
//
// How a month works:
//   1. An admin records the ad revenue actually RECEIVED for the month
//      (advertiser payments for house banners, network payouts) → adRevenue.
//   2. "Compute statements" divides that revenue over every valid impression
//      served that month (RPM = revenue ÷ all impressions) and credits each
//      opted-in paid publisher: impressions on THEIR pages × RPM × their plan's
//      share (Pro 25%, Business 45%, Enterprise 75%). Free journals carry ads
//      but earn no share.
//   3. An admin reviews each statement (fraud flags shown) and approves or
//      withholds it. Approving puts the amount in the payout ledger, held
//      AD_SHARE_HOLD_DAYS before it can be released to the publisher's bank.
//   4. Under AD_SHARE_MIN_KOBO the amount rolls over into the next month.
// Platform ad revenue = revenue received − shares owed (see lib/revenue.ts).
export const AD_SHARE_MIN_KOBO = 1_000 * 100;
export const AD_SHARE_HOLD_DAYS = 30;

export type AdShareStatus = "pending_review" | "approved" | "rolled_over" | "rolled_forward" | "withheld" | "paid";

export type AdRevenueEntry = {
  id: string;
  month: string; // YYYY-MM
  source: "notesapp" | "google" | "meta" | "admob";
  label: string; // advertiser / network + campaign
  amountKobo: number;
  note?: string;
  createdAt: string;
};

export type AdShareStatement = {
  id: string; // `${month}_${uid}`
  uid: string;
  username: string;
  month: string;
  impressions: number;
  clicks: number;
  rpmKobo: number; // revenue per impression, in kobo (fractional)
  grossKobo: number; // impressions × RPM
  rate: number; // the publisher's plan share, 0–1
  shareKobo: number;
  payableKobo?: number; // share + rolled-over earlier shares (set on decision)
  flags: string[];
  status: AdShareStatus;
  note?: string;
  createdAt: string;
  decidedAt?: string;
};

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function adFlags(impressions: number, clicks: number, activeDays: number): string[] {
  const flags: string[] = [];
  if (clicks > impressions) flags.push("more clicks than views");
  else if (impressions >= 50 && clicks / impressions > 0.15) flags.push("click rate above 15%");
  if (activeDays === 1 && impressions >= 500) flags.push("one-day spike");
  return flags;
}

export const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });
