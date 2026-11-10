// Selling in your local currency (owner, 10 Nov 2026: "member sites are mostly publishers and they should sell in their local currencies,
// however their buyers could use Flutterwave or Stripe to pay, or Paystack if they're in Nigeria"). Pure rules; the server is
// lib/global-sales-server.ts.
//
// A seller prices downloads, shop items, courses and sessions in their home currency (Rates & payouts → the currency you earn in; naira
// until they choose). A buyer pays in theirs, through the provider for it (lib/currency.ts: Paystack for naira, Flutterwave for the rest
// of Africa, Stripe for everywhere else). The usual checkout runs every check and builds the order exactly as before; only the money
// moves differently:
//   · naira item, naira buyer           → the usual Paystack payment and naira payout (nothing here)
//   · anything else                     → a "global" payment: the buyer pays the price converted at our rate (plus the margin) when the
//                                         currencies differ, or exactly the price when they match; the seller's earnings are fixed in the
//                                         seller's currency from their own price, never moved by the rate, and paid from the treasury.
// Delivery by NotesApp's logistics partners stays in Nigeria: outside naira, the seller's own delivery fee applies and they deliver.
import { currencyInfo, formatMoney, isCurrency, type Provider } from "./currency";

export const SALE_KINDS = ["store", "digital", "course", "booking", "store_cart"] as const;
export type SaleKind = (typeof SALE_KINDS)[number];
export const isSaleKind = (k: unknown): k is SaleKind => SALE_KINDS.includes(k as SaleKind);

// What the buyer paid, and through whom (on the payment record, lib/payments.ts PaymentRecord.global).
export type SaleGlobal = {
  payCurrency: string; payMinor: number; provider: Provider;
  saleCurrency: string; // the seller's currency (what the prices on the record are in)
  rates: { pay: number; sale: number }; // units per US dollar at checkout
  marginPct: number;
  backUrl: string; // where the buyer goes once it's confirmed (the usual confirmation page)
  providerRef?: string; // Stripe's checkout session
  paymentRef?: string; // once paid: Stripe's payment intent, Flutterwave's transaction id (what a refund needs)
};

// Does this sale go through the global path? Everything except a naira price paid in naira.
export const isGlobalSale = (saleCurrency: string, payCurrency: string) => saleCurrency !== "NGN" || payCurrency !== "NGN";

// The currency a price is in: an item's own, else naira (everything priced before 10 Nov 2026).
export const priceCurrency = (x: unknown): string => {
  const c = (x as { currency?: unknown } | null | undefined)?.currency;
  return isCurrency(c) ? c : "NGN";
};

// Smallest and largest prices a seller can set, in their currency's minor units: the same ₦100 floor as before, and a ceiling of
// ₦10,000,000, at roughly the same size in every currency (by the currency's minor digits, not its rate: a stable rule a seller can read).
export function priceBounds(code: string): { min: number; max: number } {
  const minor = 10 ** currencyInfo(code).minor;
  return code === "NGN" ? { min: 100 * minor, max: 10_000_000 * minor } : { min: 1 * minor, max: 1_000_000 * minor };
}

// An amount in a record's currency, for messages: naira as ever ("₦5,000"), otherwise its own ("KSh 650", "$12").
export const moneyIn = (minor: number, currency: string | undefined, naira: (kobo: number) => string) => (!currency || currency === "NGN" ? naira(minor) : formatMoney(minor, currency));

// A delivery address for a seller outside naira (they deliver it themselves): any country, a phone number with its country code, and the
// region typed in (state, county, province…) with the country, e.g. "Nairobi County, Kenya". Naira sellers keep the Nigerian form.
export function validateWorldAddress(a: Partial<{ fullName: string; phone: string; street: string; city: string; state: string }> | undefined): string | null {
  if (!a) return "Enter a delivery address.";
  const fullName = String(a.fullName ?? "").trim(), phone = String(a.phone ?? "").replace(/[\s()-]/g, "");
  const street = String(a.street ?? "").trim(), city = String(a.city ?? "").trim(), region = String(a.state ?? "").trim();
  if (fullName.length < 2 || fullName.length > 80) return "Enter the recipient's full name.";
  if (!/^(\+\d{7,15}|0\d{6,14})$/.test(phone)) return "Enter a phone number, with the country code (e.g. +254712345678).";
  if (street.length < 5 || street.length > 200) return "Enter the street address.";
  if (city.length < 2 || city.length > 80) return "Enter the city or town.";
  if (region.length < 2 || region.length > 120) return "Enter the region and country (e.g. Nairobi County, Kenya).";
  return null;
}
