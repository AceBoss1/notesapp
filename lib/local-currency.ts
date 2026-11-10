// Which currency to show a visitor (owner, 10 Nov 2026: "get paid in your local currency … auto detect and select for
// country/currencies"). In order:
//   1. the currency they picked themselves (the footer's currency picker, or the Subscribe window), kept in this browser;
//   2. the currency of the country they're in, from the country our host detects from their connection (Vercel's
//      x-vercel-ip-country header, which middleware.ts copies into the na_cc cookie);
//   3. a guess from their browser's time zone (lib/currency.ts guessCurrency).
// Anyone can change it at any time; nothing is charged in a currency without them seeing it first.
import { CURRENCIES, currencyForCountry, guessCurrency } from "./currency";

export const COUNTRY_COOKIE = "na_cc"; // two-letter country code, set by middleware.ts
export const CURRENCY_KEY = "notesapp:pay-currency"; // the visitor's own pick (localStorage), shared with the Subscribe window
export const CURRENCY_EVENT = "notesapp:currency"; // fired when the pick changes, so every picker on the page follows

export const isCountryCode = (v: unknown): v is string => typeof v === "string" && /^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1";
// The country from request headers (server): Vercel's geolocation, then the cookie.
export function countryFromHeaders(get: (name: string) => string | null | undefined, cookie?: string | null): string | null {
  const h = (get("x-vercel-ip-country") || "").toUpperCase();
  if (isCountryCode(h)) return h;
  const c = (cookie || "").toUpperCase();
  return isCountryCode(c) ? c : null;
}
// Pure: the currency for a visitor, from what we know.
export function pickCurrency(o: { saved?: string | null; country?: string | null; timeZone?: string | null }): { currency: string; source: "saved" | "country" | "timezone" } {
  if (o.saved && CURRENCIES.some((c) => c.code === o.saved)) return { currency: o.saved, source: "saved" };
  if (o.country && isCountryCode(o.country)) return { currency: currencyForCountry(o.country), source: "country" };
  return { currency: guessCurrency(o.timeZone || undefined), source: "timezone" };
}

// ── In the browser ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function detectedCountry(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)na_cc=([A-Za-z]{2})/);
  return m && isCountryCode(m[1].toUpperCase()) ? m[1].toUpperCase() : null;
}
function savedCurrency(): string | null {
  try { return localStorage.getItem(CURRENCY_KEY); } catch { return null; }
}
// auto: what we'd pick without their own choice (shown as "Automatic").
export function preferredCurrency(): { currency: string; source: "saved" | "country" | "timezone"; country: string | null; auto: string } {
  let timeZone: string | null = null;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* old browser */ }
  const country = detectedCountry();
  return { ...pickCurrency({ saved: savedCurrency(), country, timeZone }), country, auto: pickCurrency({ country, timeZone }).currency };
}
export function setPreferredCurrency(code: string | null) {
  try { if (code) localStorage.setItem(CURRENCY_KEY, code); else localStorage.removeItem(CURRENCY_KEY); } catch { /* private window */ }
  try { window.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: code })); } catch { /* fine */ }
}
