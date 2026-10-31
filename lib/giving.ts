// Community giving (docs/COMMUNITY.md, "Giving: charges (approved by the owner, 19 Oct 2026)"). Pure: the charges, what a giver pays and
// what the community receives, the cap before verification, and cleaning the funds admins name. The server side is lib/giving-server.ts.
// Amounts are in kobo.
//
// - A flat charge in bands, like a Nigerian bank transfer: ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above. That band is our margin
//   (payouts to the organisation are batched); there is no commission on top.
// - By card or bank (Paystack): Paystack's own charge at cost, shown as "card charge", plus the band. From the wallet: just the band.
// - The giver can cover the charges: they pay the gift plus the charges and the community gets the whole gift. Otherwise the charges
//   come out of the gift.

export const GIVING_MIN_KOBO = 100 * 100;
export const GIVING_MAX_KOBO = 5_000_000 * 100;
// Before the community (or the organisation that runs it) is verified, each gift is capped at this.
export const UNVERIFIED_GIFT_CAP_KOBO = 20_000 * 100;
// Gifts are held this long, then paid out together on the next payout run after GIVING_PAYOUT_HOUR (Lagos time).
export const GIVING_HOLD_HOURS = 24;
export const GIVING_PAYOUT_HOUR = 10;
export const FUNDS_MAX = 10, FUND_NAME_MAX = 40, GIFT_NOTE_MAX = 200;
export const DEFAULT_FUNDS = ["Donation"];

// The bands: [up to (inclusive), charge].
export const GIVING_BANDS: { uptoKobo: number; chargeKobo: number }[] = [
  { uptoKobo: 5_000 * 100, chargeKobo: 10 * 100 },
  { uptoKobo: 50_000 * 100, chargeKobo: 25 * 100 },
  { uptoKobo: Infinity, chargeKobo: 50 * 100 },
];
export const bandChargeKobo = (giftKobo: number) => GIVING_BANDS.find((b) => giftKobo <= b.uptoKobo)!.chargeKobo;

// Paystack Nigeria, local cards and bank: 1.5% + ₦100, the ₦100 waived under ₦2,500, capped at ₦2,000.
// Check Paystack's current rates before launch.
export const PAYSTACK_LOCAL = { percent: 0.015, flatKobo: 100 * 100, flatWaivedUnderKobo: 2_500 * 100, capKobo: 2_000 * 100 };
export function cardChargeKobo(chargedKobo: number): number {
  const p = PAYSTACK_LOCAL;
  const fee = Math.ceil(chargedKobo * p.percent) + (chargedKobo < p.flatWaivedUnderKobo ? 0 : p.flatKobo);
  return Math.min(p.capKobo, fee);
}

export type GiftQuote = {
  giftKobo: number; // what the giver chose to give
  bandKobo: number; // our charge
  cardChargeKobo: number; // Paystack's, at cost (0 from the wallet)
  payKobo: number; // what the giver pays
  netKobo: number; // what the community receives
  covered: boolean;
};

// What a gift costs and what arrives. With the charges covered by card, the card charge is on the larger amount charged, so the total is
// worked out until it settles (the community still gets the whole gift).
export function quoteGift(giftKobo: number, opts: { method: "card" | "wallet"; cover: boolean }): GiftQuote {
  const bandKobo = bandChargeKobo(giftKobo);
  if (opts.method === "wallet") {
    return opts.cover
      ? { giftKobo, bandKobo, cardChargeKobo: 0, payKobo: giftKobo + bandKobo, netKobo: giftKobo, covered: true }
      : { giftKobo, bandKobo, cardChargeKobo: 0, payKobo: giftKobo, netKobo: giftKobo - bandKobo, covered: false };
  }
  if (!opts.cover) {
    const card = cardChargeKobo(giftKobo);
    return { giftKobo, bandKobo, cardChargeKobo: card, payKobo: giftKobo, netKobo: giftKobo - bandKobo - card, covered: false };
  }
  let pay = giftKobo + bandKobo;
  for (let i = 0; i < 20; i++) {
    const next = giftKobo + bandKobo + cardChargeKobo(pay);
    if (next === pay) break;
    pay = next;
  }
  while (pay - cardChargeKobo(pay) - bandKobo < giftKobo) pay++; // never short of the gift
  return { giftKobo, bandKobo, cardChargeKobo: cardChargeKobo(pay), payKobo: pay, netKobo: pay - cardChargeKobo(pay) - bandKobo, covered: true };
}

// Whether this gift may be given: the amount, and the cap until the community is verified. Null = fine; otherwise words for the giver.
export function giftProblem(giftKobo: number, verified: boolean): string | null {
  if (!Number.isInteger(giftKobo) || giftKobo < GIVING_MIN_KOBO) return "Give ₦100 or more.";
  if (giftKobo > GIVING_MAX_KOBO) return "Gifts can be up to ₦5,000,000 at a time.";
  if (!verified && giftKobo > UNVERIFIED_GIFT_CAP_KOBO) return "Until this community is verified, each gift can be up to ₦20,000.";
  return null;
}

// When a gift's money may be paid out: GIVING_HOLD_HOURS after it was given, at the next GIVING_PAYOUT_HOUR in Lagos, so a day's gifts
// go out together on one run.
export function givingReleaseAfter(givenAt: Date): Date {
  const earliest = givenAt.getTime() + GIVING_HOLD_HOURS * 3_600_000;
  const lagos = new Date(earliest + 3_600_000); // Lagos wall clock (UTC+1) in UTC fields
  let at = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate(), GIVING_PAYOUT_HOUR) - 3_600_000;
  if (at < earliest) at += 86_400_000;
  return new Date(at);
}

export type GivingSettings = { enabled: boolean; funds: string[] };
export function cleanGivingSettings(v: unknown): GivingSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const funds = (Array.isArray(o.funds) ? o.funds : [])
    .map((f) => String(f ?? "").replace(/\s+/g, " ").trim().slice(0, FUND_NAME_MAX))
    .filter((f) => f && !seen.has(f.toLowerCase()) && seen.add(f.toLowerCase()))
    .slice(0, FUNDS_MAX);
  return { enabled: o.enabled === true, funds: funds.length ? funds : DEFAULT_FUNDS };
}
export const cleanGiftNote = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, GIFT_NOTE_MAX);
