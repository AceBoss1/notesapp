// Global subscriptions (the owner, 9 Nov 2026: "a US reader can subscribe to a Kenyan publisher and vice versa; the system auto balances,
// because we keep a balance in each currency"). Pure rules; the server is lib/global-pay-server.ts.
//
// The model: NotesApp sells the subscription (merchant of record) and pays the publisher their share as earnings in the publisher's own
// currency. The reader pays in theirs, through the provider for it (lib/currency.ts). The publisher's earning is fixed in their currency
// at the moment of the sale, from their own price, so it never moves with the exchange rate. NotesApp keeps a pool in each currency
// (what it collected, less what it paid out); sales in opposite directions mostly cancel out, and the balancing report says which pool
// is short of what it owes and which conversions cover it.
import { currencyInfo, isCurrency, toMajor, toMinor } from "./currency";
import { SUB_TIERS, type SubTier } from "./fans";

export const GLOBAL_PERIOD_DAYS = 31; // one month per payment (no automatic charge: the reader renews; reminded before it ends)
export const GLOBAL_HOLD_DAYS = 7; // earnings are held this long for refunds and chargebacks before they're due
export const RENEW_REMIND_DAYS = 3;
export const RATES_MAX_AGE_HOURS = 48; // older rates stop new cross-currency checkouts until Finance updates them
export const DEFAULT_MARGIN_PCT = 3; // added to a converted price to cover the conversion cost
export const DEFAULT_RESERVE_PCT = 10; // each pool keeps this much over what it owes

export class GlobalPayError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// ── Exchange rates: units of each currency per 1 US dollar (major units), set by Finance ──
export type Rates = { perUsd: Record<string, number>; marginPct: number; reservePct: number; updatedAt: string; updatedBy?: string };

export function cleanRates(b: Record<string, unknown>, now = new Date()): Omit<Rates, "updatedBy"> {
  const raw = (b.perUsd && typeof b.perUsd === "object" ? b.perUsd : {}) as Record<string, unknown>;
  const perUsd: Record<string, number> = { USD: 1 };
  for (const [code, v] of Object.entries(raw)) {
    if (!isCurrency(code) || code === "USD") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) throw new GlobalPayError(`${code}: enter how many ${code} one US dollar buys.`);
    perUsd[code] = n;
  }
  const pct = (v: unknown, d: number, max: number) => {
    if (v === undefined || v === "" || v === null) return d;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new GlobalPayError(`Percentages run from 0 to ${max}.`);
    return Math.round(n * 100) / 100;
  };
  return { perUsd, marginPct: pct(b.marginPct, DEFAULT_MARGIN_PCT, 20), reservePct: pct(b.reservePct, DEFAULT_RESERVE_PCT, 100), updatedAt: now.toISOString() };
}

export const RATES_REMIND_HOURS = 36; // Finance gets a bell this old, 12 hours before the pause

// The rates reminder due now: "soon" from 36 hours (once per set of rates), "paused" from 48 hours (once). sent: what was already sent for
// these rates (saving new rates replaces the document, so the reminders start again).
export function ratesReminderDue(r: Pick<Rates, "updatedAt"> | null | undefined, sent: string | undefined, now = new Date()): "soon" | "paused" | null {
  if (!r) return null;
  const hours = (now.getTime() - Date.parse(r.updatedAt)) / 3_600_000;
  if (hours >= RATES_MAX_AGE_HOURS) return sent === "paused" ? null : "paused";
  if (hours >= RATES_REMIND_HOURS) return sent === "soon" || sent === "paused" ? null : "soon";
  return null;
}

export const ratesFresh = (r: Rates | null | undefined, now = new Date()) =>
  !!r && now.getTime() - Date.parse(r.updatedAt) <= RATES_MAX_AGE_HOURS * 3_600_000;

// Converts whole minor units of one currency into the other (rounded to the nearest minor unit).
export function convert(minor: number, from: string, to: string, r: Pick<Rates, "perUsd">): number {
  if (from === to) return minor;
  const a = r.perUsd[from], b = r.perUsd[to];
  if (!a || !b) throw new GlobalPayError(`There's no exchange rate for ${!a ? from : to} yet.`, 409);
  return toMinor((toMajor(minor, from) / a) * b, to);
}

// A tidy price, rounded up: $4.50 not $4.37, KSh 650 not KSh 641.27, ₦7,550 not ₦7,512.
export function niceCeil(minor: number, code: string): number {
  const major = toMajor(minor, code);
  const step = major < 20 ? 0.5 : major < 100 ? 1 : major < 1_000 ? 10 : major < 10_000 ? 50 : 100;
  const s = currencyInfo(code).minor === 0 ? Math.max(1, step) : step;
  return toMinor(Math.ceil(major / s - 1e-9) * s, code);
}

// What a reader pays for a price set in the publisher's currency: the same amount in the same currency; otherwise converted, plus the
// margin, rounded up to a tidy price.
export function readerPrice(homeMinor: number, home: string, pay: string, r: Pick<Rates, "perUsd" | "marginPct">): number {
  if (home === pay) return homeMinor;
  return niceCeil(convert(homeMinor, home, pay, r) * (1 + r.marginPct / 100), pay);
}

// The publisher's earning, in their own currency, from their own price: never moved by the rate or the rounding.
export const earningOf = (homeMinor: number, commissionRate: number) => homeMinor - Math.round(homeMinor * commissionRate);

// ── What a publisher offers globally ──
// Home currency NGN: their usual tier prices (lib/fans.ts, in kobo) are the home prices. Any other home currency: the prices they set
// in it (publisherGlobal/{uid}.tiers).
export type GlobalSettings = { currency: string; tiers?: Partial<Record<SubTier, { enabled?: boolean; minor?: number }>>; acceptGlobal?: boolean };
export type HomeOffer = { enabled: boolean; currency: string; minor: number };
export function homeOffers(
  ngnTiers: Record<SubTier, { enabled: boolean; priceKobo: number; planCode?: string }>,
  g: GlobalSettings | null | undefined,
): Record<SubTier, HomeOffer> {
  const out = {} as Record<SubTier, HomeOffer>;
  const home = g && isCurrency(g.currency) ? g.currency : "NGN";
  for (const t of SUB_TIERS) {
    if (home === "NGN") out[t] = { enabled: ngnTiers[t].enabled && !!ngnTiers[t].planCode && g?.acceptGlobal !== false, currency: "NGN", minor: ngnTiers[t].priceKobo };
    else {
      const o = g?.tiers?.[t];
      out[t] = { enabled: o?.enabled === true && Number(o.minor) > 0, currency: home, minor: Math.round(Number(o?.minor) || 0) };
    }
  }
  return out;
}

// Limits on a home price, in US dollars (converted when checked): from $0.50 to $500 a month.
export const HOME_MIN_USD = 0.5;
export const HOME_MAX_USD = 500;
export function checkHomePrice(minor: number, code: string, r: Pick<Rates, "perUsd"> | null): string | null {
  if (!Number.isInteger(minor) || minor <= 0) return "Enter a monthly price.";
  if (!r || !r.perUsd[code]) return null; // no rate yet: checked again at checkout
  const usd = toMajor(convert(minor, code, "USD", r), "USD");
  if (usd < HOME_MIN_USD) return `That's under $${HOME_MIN_USD.toFixed(2)} a month; card fees would take most of it.`;
  if (usd > HOME_MAX_USD) return `Monthly prices can go up to about $${HOME_MAX_USD}.`;
  return null;
}

// ── Pools and balancing ──
// One pool per currency: collected (in), paid out to publishers (out), converted in and out, and what is still owed to publishers (due).
export type Pool = { currency: string; inMinor: number; outMinor: number; convInMinor: number; convOutMinor: number; dueMinor: number };
export type PoolLine = Pool & { cashMinor: number; needMinor: number; shortMinor: number; spareMinor: number };
export const emptyPool = (currency: string): Pool => ({ currency, inMinor: 0, outMinor: 0, convInMinor: 0, convOutMinor: 0, dueMinor: 0 });

export function poolLine(p: Pool, reservePct: number): PoolLine {
  const cashMinor = p.inMinor - p.outMinor + p.convInMinor - p.convOutMinor;
  const needMinor = Math.ceil(p.dueMinor * (1 + reservePct / 100));
  return { ...p, cashMinor, needMinor, shortMinor: Math.max(0, needMinor - cashMinor), spareMinor: Math.max(0, cashMinor - needMinor) };
}

export type Conversion = { from: string; to: string; fromMinor: number; toMinor: number };
// Covers each short pool from the pools with the most to spare (by value in dollars), largest shortfall first.
export function suggestConversions(lines: PoolLine[], r: Pick<Rates, "perUsd">): Conversion[] {
  const usd = (minor: number, code: string) => (r.perUsd[code] ? toMajor(minor, code) / r.perUsd[code] : 0);
  const spare = new Map(lines.filter((l) => l.spareMinor > 0 && r.perUsd[l.currency]).map((l) => [l.currency, l.spareMinor]));
  const out: Conversion[] = [];
  for (const short of [...lines].filter((l) => l.shortMinor > 0 && r.perUsd[l.currency]).sort((a, b) => usd(b.shortMinor, b.currency) - usd(a.shortMinor, a.currency))) {
    let left = short.shortMinor;
    while (left > 0) {
      const from = [...spare.entries()].filter(([, m]) => m > 0).sort((a, b) => usd(b[1], b[0]) - usd(a[1], a[0]))[0];
      if (!from) break;
      const [code, have] = from;
      const needFrom = Math.min(have, convert(left, short.currency, code, r) + 1);
      const gets = Math.min(left, convert(needFrom, code, short.currency, r));
      if (gets <= 0) break;
      out.push({ from: code, to: short.currency, fromMinor: needFrom, toMinor: gets });
      spare.set(code, have - needFrom);
      left -= gets;
    }
  }
  return out;
}

// A payout can go only when the pool in that currency has the cash for it (the reserve may be used for a payout).
export const canPayFrom = (line: PoolLine, minor: number) => line.cashMinor >= minor;

export const renewReminderDue = (periodEnd: string, remindedFor: string | undefined, now = new Date()) => {
  const left = Date.parse(periodEnd) - now.getTime();
  return left > 0 && left <= RENEW_REMIND_DAYS * 86_400_000 && remindedFor !== periodEnd;
};

export const isGlobalRef = (ref: string) => /^gp_[A-Za-z0-9_]+$/.test(ref);
