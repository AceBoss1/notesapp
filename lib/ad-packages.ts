// Self-serve banner advertising. Advertisers buy a campaign: a block of
// VALIDATED IMPRESSIONS (unique per visitor per ad per day — the same counting
// the ad-share uses) delivered across the chosen placements within a window.
// Pricing is a placeholder — EDIT the packages here (nothing else hard-codes them).
export type AdPackage = { id: string; name: string; impressions: number; priceKobo: number; windowDays: number };

export const AD_PACKAGES: AdPackage[] = [
  { id: "starter", name: "Starter", impressions: 5_000, priceKobo: 12_500 * 100, windowDays: 30 }, // ₦2,500 per 1,000
  { id: "growth", name: "Growth", impressions: 25_000, priceKobo: 55_000 * 100, windowDays: 45 }, // ₦2,200 per 1,000
  { id: "scale", name: "Scale", impressions: 100_000, priceKobo: 200_000 * 100, windowDays: 60 }, // ₦2,000 per 1,000
];
export const getAdPackage = (id: unknown) => AD_PACKAGES.find((p) => p.id === id);

export type CampaignStatus = "awaiting_payment" | "in_review" | "live" | "completed" | "rejected";

export type AdCampaign = {
  id: string; // = the Paystack payment reference
  uid: string;
  email: string;
  advertiserName: string;
  packageId: string;
  packageName: string;
  impressionsBudget: number;
  windowDays: number;
  amountKobo: number;
  placements: string[];
  creative: { title: string; text: string; image: string; href: string };
  status: CampaignStatus;
  createdAt: string;
  paidAt?: string;
  approvedAt?: string;
  endsAt?: string;
  completedAt?: string;
  impressionsDelivered?: number;
  rejectedReason?: string;
  refundedKobo?: number;
};

// What we won't run. Shown on the buy page and in the Terms; admins review every ad.
export const AD_RULES = [
  "Illegal goods or services, scams, or anything misleading about what you offer.",
  "Adult, hateful, violent or harassing content.",
  "Impersonating #NotesApp, another brand or a person, or copying a verification badge.",
  "Loans or investment schemes promising guaranteed returns; unlicensed financial, medical or betting offers.",
  "Links to malware, phishing or pages that differ from what the ad says.",
];
