// Currencies and who collects them (the owner, 9 Nov 2026: "Stripe for global: USD, GBP, EUR…; Paystack for Nigeria; Flutterwave for the
// rest of Africa"). A reader pays in their own currency through the provider for it; a publisher earns in theirs. Pure: no I/O.
//
// Who holds each account: Stripe belongs to NotesApp Inc (US); Paystack and Flutterwave to NotesApp Technologies Ltd (Nigeria). A
// Paystack account only charges in its own country's currency, so it takes NGN; GHS, KES and ZAR move to Paystack only once there's a
// registered business in Ghana, Kenya or South Africa, and until then go through Flutterwave.
// Flutterwave (checked on our dashboard, 9 Nov 2026): international cards in the African currencies below; mobile money switched on for
// Ghana, Rwanda, Uganda, Zambia and Kenya; Francophone XOF and XAF mobile money must be switched on there (cards don't take them).
// Malawi isn't offered, so it pays in US dollars. Japan, the UAE and China pay through Stripe (NotesApp Inc), with the rest of the world.

export type Provider = "stripe" | "paystack" | "flutterwave";
export type CurrencyInfo = { code: string; name: string; symbol: string; minor: number; provider: Provider; countries: string[] };

// minor: digits after the point (UGX, RWF, XAF and XOF have none). Amounts are always whole minor units (cents, kobo).
export const CURRENCIES: CurrencyInfo[] = [
  { code: "NGN", name: "Nigerian naira", symbol: "₦", minor: 2, provider: "paystack", countries: ["NG"] },
  { code: "USD", name: "US dollar", symbol: "$", minor: 2, provider: "stripe", countries: ["US"] },
  { code: "GBP", name: "British pound", symbol: "£", minor: 2, provider: "stripe", countries: ["GB"] },
  { code: "EUR", name: "Euro", symbol: "€", minor: 2, provider: "stripe", countries: ["IE", "FR", "DE", "NL", "BE", "ES", "PT", "IT", "FI", "AT", "GR", "LU"] },
  { code: "CAD", name: "Canadian dollar", symbol: "CA$", minor: 2, provider: "stripe", countries: ["CA"] },
  { code: "JPY", name: "Japanese yen", symbol: "¥", minor: 0, provider: "stripe", countries: ["JP"] },
  { code: "AED", name: "UAE dirham", symbol: "AED", minor: 2, provider: "stripe", countries: ["AE"] },
  { code: "CNY", name: "Chinese yuan (renminbi)", symbol: "CN¥", minor: 2, provider: "stripe", countries: ["CN"] },
  // Botswana: Flutterwave doesn't take the pula, Stripe does, so readers there pay in pula by card (not dollars, which their bank converts).
  { code: "BWP", name: "Botswana pula", symbol: "P", minor: 2, provider: "stripe", countries: ["BW"] },
  { code: "KES", name: "Kenyan shilling", symbol: "KSh", minor: 2, provider: "flutterwave", countries: ["KE"] },
  { code: "GHS", name: "Ghanaian cedi", symbol: "GH₵", minor: 2, provider: "flutterwave", countries: ["GH"] },
  { code: "ZAR", name: "South African rand", symbol: "R", minor: 2, provider: "flutterwave", countries: ["ZA"] },
  { code: "UGX", name: "Ugandan shilling", symbol: "USh", minor: 0, provider: "flutterwave", countries: ["UG"] },
  { code: "TZS", name: "Tanzanian shilling", symbol: "TSh", minor: 2, provider: "flutterwave", countries: ["TZ"] },
  { code: "RWF", name: "Rwandan franc", symbol: "RF", minor: 0, provider: "flutterwave", countries: ["RW"] },
  { code: "XAF", name: "Central African CFA franc", symbol: "FCFA", minor: 0, provider: "flutterwave", countries: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
  { code: "XOF", name: "West African CFA franc", symbol: "CFA", minor: 0, provider: "flutterwave", countries: ["CI", "SN", "BJ", "BF", "ML", "NE", "TG", "GW"] },
  { code: "ZMW", name: "Zambian kwacha", symbol: "ZK", minor: 2, provider: "flutterwave", countries: ["ZM"] },
  { code: "EGP", name: "Egyptian pound", symbol: "E£", minor: 2, provider: "flutterwave", countries: ["EG"] },
  { code: "MAD", name: "Moroccan dirham", symbol: "MAD", minor: 2, provider: "flutterwave", countries: ["MA"] },
  { code: "DZD", name: "Algerian dinar", symbol: "DA", minor: 2, provider: "flutterwave", countries: ["DZ"] },
  { code: "TND", name: "Tunisian dinar", symbol: "DT", minor: 3, provider: "flutterwave", countries: ["TN"] },
  { code: "LYD", name: "Libyan dinar", symbol: "LD", minor: 3, provider: "flutterwave", countries: ["LY"] },
  { code: "GMD", name: "Gambian dalasi", symbol: "D", minor: 2, provider: "flutterwave", countries: ["GM"] },
];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export const isCurrency = (v: unknown): v is string => typeof v === "string" && BY_CODE.has(v);
export const currencyInfo = (code: string): CurrencyInfo => {
  const c = BY_CODE.get(code);
  if (!c) throw new Error(`Unknown currency ${code}`);
  return c;
};
export const providerFor = (code: string): Provider => currencyInfo(code).provider;
// A country's currency; anywhere we don't list pays in US dollars through Stripe.
export const currencyForCountry = (country: string | null | undefined): string =>
  CURRENCIES.find((c) => c.countries.includes(String(country || "").toUpperCase()))?.code ?? "USD";

// Major units (what people type) ↔ minor units (what we store).
export const toMinor = (major: number, code: string) => Math.round(major * 10 ** currencyInfo(code).minor);
export const toMajor = (minor: number, code: string) => minor / 10 ** currencyInfo(code).minor;

// "$4.99", "KSh 650", "₦5,000", "USh 18,000". Whole amounts drop the decimals.
export function formatMoney(minor: number, code: string): string {
  const c = currencyInfo(code);
  const major = toMajor(minor, code);
  const n = major.toLocaleString("en-GB", { minimumFractionDigits: c.minor && minor % 10 ** c.minor ? c.minor : 0, maximumFractionDigits: c.minor });
  return c.symbol.length > 1 && /[A-Za-z]$/.test(c.symbol) ? `${c.symbol} ${n}` : `${c.symbol}${n}`;
}

// A best guess at the reader's currency from their browser's time zone (they can always change it).
const ZONES: Record<string, string> = {
  "Africa/Lagos": "NGN", "Africa/Nairobi": "KES", "Africa/Accra": "GHS", "Africa/Johannesburg": "ZAR", "Africa/Kampala": "UGX",
  "Africa/Dar_es_Salaam": "TZS", "Africa/Kigali": "RWF", "Africa/Douala": "XAF", "Africa/Abidjan": "XOF", "Africa/Dakar": "XOF",
  "Africa/Lusaka": "ZMW", "Africa/Casablanca": "MAD", "Africa/Algiers": "DZD", "Africa/Tunis": "TND",
  "Africa/Tripoli": "LYD", "Africa/Banjul": "GMD", "Asia/Tokyo": "JPY", "Asia/Dubai": "AED", "Asia/Shanghai": "CNY", "Africa/Gaborone": "BWP", "Africa/Cairo": "EGP", "Europe/London": "GBP", "America/Toronto": "CAD",
};
// Only an exact time-zone match (no "anywhere in Europe is euros" guess): used to overrule a connection located on another continent.
export const zoneCurrency = (timeZone: string | null | undefined): string | null => (timeZone && ZONES[timeZone]) || null;
export function guessCurrency(timeZone: string | undefined): string {
  if (!timeZone) return "USD";
  if (ZONES[timeZone]) return ZONES[timeZone];
  if (timeZone.startsWith("Europe/")) return "EUR";
  return "USD";
}

// How a reader can pay in a currency, for the Subscribe window. Stripe Checkout shows the methods switched on in the Stripe dashboard
// that fit the currency (dynamic payment methods: we don't list them in the request), so Alipay and WeChat Pay appear for yuan once
// they're switched on there (Settings → Payment methods). Flutterwave offers mobile money where it's switched on in its dashboard.
const MOMO = ["KES", "GHS", "UGX", "RWF", "ZMW", "XOF", "XAF"];
export function payMethodsLabel(code: string): string {
  if (code === "CNY") return "card, Alipay or WeChat Pay";
  if (code === "NGN") return "card, bank transfer or USSD";
  if (MOMO.includes(code)) return code === "XOF" || code === "XAF" ? "mobile money" : "card or mobile money";
  return "card";
}
