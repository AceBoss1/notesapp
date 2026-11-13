// Which currency to show a visitor (owner, 10 Nov 2026: "get paid in your local currency … auto detect and select for
// country/currencies"). In order:
//   1. the currency they picked themselves (the footer's currency picker, or the Subscribe window), kept in this browser;
//   2. the currency of the country they're in, from the country our host detects from their connection (Vercel's
//      x-vercel-ip-country header, which middleware.ts copies into the na_cc cookie);
//   3. a guess from their browser's time zone (lib/currency.ts guessCurrency).
// Anyone can change it at any time; nothing is charged in a currency without them seeing it first.
import { CURRENCIES, currencyForCountry, guessCurrency, zoneCurrency } from "./currency";
import { AFRICAN_CODES } from "./countries";

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
  // A connection located outside Africa while the computer's clock is on an African time zone is almost always a VPN, a browser's
  // privacy relay or an operator routing traffic through Europe (members in Lagos were shown euros because their connection came out in
  // the Netherlands, 10 Nov 2026): the time zone wins then.
  const zone = zoneCurrency(o.timeZone);
  if (zone && o.timeZone?.startsWith("Africa/") && o.country && isCountryCode(o.country) && !AFRICAN_CODES.has(o.country)) return { currency: zone, source: "timezone" };
  if (o.country && isCountryCode(o.country)) return { currency: currencyForCountry(o.country), source: "country" };
  return { currency: guessCurrency(o.timeZone || undefined), source: "timezone" };
}

// The country to show beside the currency, by the same rule (owner, 12 Nov 2026: "currency fixed but country didn't"): an African time
// zone with a connection located outside Africa means the member is in that time zone's country (Lagos, not the Netherlands); with no
// detected country at all, the time zone's country too. Otherwise the detected one.
const ZONE_COUNTRY: Record<string, string> = {
  "Africa/Lagos": "NG", "Africa/Nairobi": "KE", "Africa/Accra": "GH", "Africa/Johannesburg": "ZA", "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kigali": "RW", "Africa/Douala": "CM", "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Lusaka": "ZM", "Africa/Casablanca": "MA",
  "Africa/Algiers": "DZ", "Africa/Tunis": "TN", "Africa/Tripoli": "LY", "Africa/Banjul": "GM", "Africa/Gaborone": "BW", "Africa/Cairo": "EG",
  "Africa/Addis_Ababa": "ET", "Africa/Kinshasa": "CD", "Africa/Lubumbashi": "CD", "Africa/Luanda": "AO", "Africa/Maputo": "MZ", "Africa/Harare": "ZW",
  "Africa/Windhoek": "NA", "Africa/Freetown": "SL", "Africa/Monrovia": "LR", "Africa/Lome": "TG", "Africa/Porto-Novo": "BJ", "Africa/Ouagadougou": "BF",
  "Africa/Bamako": "ML", "Africa/Niamey": "NE", "Africa/Conakry": "GN", "Africa/Khartoum": "SD", "Africa/Mogadishu": "SO", "Africa/Blantyre": "MW",
  "Africa/Maseru": "LS", "Africa/Mbabane": "SZ", "Africa/Nouakchott": "MR", "Africa/Asmara": "ER", "Africa/Djibouti": "DJ", "Africa/Libreville": "GA",
  "Africa/Malabo": "GQ", "Africa/Brazzaville": "CG", "Africa/Bangui": "CF", "Africa/Ndjamena": "TD", "Africa/Bujumbura": "BI", "Africa/Juba": "SS",
  "Africa/Sao_Tome": "ST", "Africa/Bissau": "GW",
};
export function pickCountry(o: { country?: string | null; timeZone?: string | null }): string | null {
  const zoneCountry = o.timeZone ? ZONE_COUNTRY[o.timeZone] ?? null : null;
  const detected = o.country && isCountryCode(o.country) ? o.country : null;
  if (zoneCountry && (!detected || !AFRICAN_CODES.has(detected))) return zoneCountry;
  return detected;
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
  const detected = detectedCountry();
  return { ...pickCurrency({ saved: savedCurrency(), country: detected, timeZone }), country: pickCountry({ country: detected, timeZone }), auto: pickCurrency({ country: detected, timeZone }).currency };
}
export function setPreferredCurrency(code: string | null) {
  try { if (code) localStorage.setItem(CURRENCY_KEY, code); else localStorage.removeItem(CURRENCY_KEY); } catch { /* private window */ }
  try { window.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: code })); } catch { /* fine */ }
}
