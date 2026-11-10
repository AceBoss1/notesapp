// Global subscriptions, the pure rules (lib/currency.ts, lib/global-pay.ts, lib/stripe.ts signatures). Run: npx -y tsx tests/global/global.test.ts
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { currencyForCountry, formatMoney, guessCurrency, payMethodsLabel, providerFor, toMajor, toMinor } from "../../lib/currency";
import { canPayFrom, checkHomePrice, cleanRates, convert, earningOf, homeOffers, niceCeil, poolLine, ratesFresh, ratesReminderDue, readerPrice, renewReminderDue, suggestConversions, emptyPool, GlobalPayError } from "../../lib/global-pay";
import { formEncode, isValidStripeSignature } from "../../lib/stripe";
import { countryFromHeaders, isCountryCode, pickCurrency } from "../../lib/local-currency";
import { AFRICAN_CODES } from "../../lib/countries";
import { isGlobalSale, isSaleKind, moneyIn, priceCurrency, validateWorldAddress } from "../../lib/global-sales";
import { isValidFlutterwaveHash } from "../../lib/flutterwave";

// currencies and providers: Stripe for USD/GBP/EUR, Paystack for naira, Flutterwave for the rest of Africa; anywhere else pays USD
assert.equal(providerFor("USD"), "stripe"); assert.equal(providerFor("GBP"), "stripe"); assert.equal(providerFor("EUR"), "stripe");
assert.equal(providerFor("NGN"), "paystack"); assert.equal(providerFor("KES"), "flutterwave"); assert.equal(providerFor("GHS"), "flutterwave");
assert.equal(currencyForCountry("KE"), "KES"); assert.equal(currencyForCountry("fr"), "EUR"); assert.equal(currencyForCountry("BR"), "USD");
assert.equal(toMinor(4.99, "USD"), 499); assert.equal(toMinor(18000, "UGX"), 18000); assert.equal(toMajor(65000, "KES"), 650);
assert.equal(formatMoney(499, "USD"), "$4.99"); assert.equal(formatMoney(500, "USD"), "$5"); assert.equal(formatMoney(65000, "KES"), "KSh 650");
assert.equal(formatMoney(500000, "NGN"), "₦5,000"); assert.equal(formatMoney(18000, "UGX"), "USh 18,000"); assert.equal(formatMoney(1250, "GBP"), "£12.50");
assert.equal(guessCurrency("Africa/Nairobi"), "KES"); assert.equal(guessCurrency("Europe/Berlin"), "EUR"); assert.equal(guessCurrency("America/Chicago"), "USD");

// rates: one US dollar buys 1,500 naira, 129 shillings, 0.79 pounds
const now = new Date("2026-11-10T12:00:00Z");
const r = { ...cleanRates({ perUsd: { NGN: 1500, KES: 129, GBP: 0.79, EUR: 0.92, UGX: 3700 }, marginPct: 3, reservePct: 10 }, now) };
assert.equal(r.perUsd.USD, 1);
assert.throws(() => cleanRates({ perUsd: { NGN: -1 } }), GlobalPayError);
assert.throws(() => cleanRates({ perUsd: { KES: 129 }, marginPct: 50 }), GlobalPayError);
assert.ok(ratesFresh(r, now)); assert.ok(!ratesFresh(r, new Date(now.getTime() + 49 * 3_600_000))); assert.ok(!ratesFresh(null, now));
assert.equal(convert(100, "USD", "NGN", r), 150_000); // $1 → ₦1,500
assert.equal(convert(129_00, "KES", "USD", r), 100); // KSh 129 → $1
assert.throws(() => convert(100, "USD", "ZAR", r), /exchange rate for ZAR/);

// tidy prices, always rounded up
assert.equal(niceCeil(437, "USD"), 450); assert.equal(niceCeil(64127, "KES"), 65000); assert.equal(niceCeil(751200, "NGN"), 755000); assert.equal(niceCeil(17_340, "UGX"), 17_400);

// a Kenyan creator's KSh 650 a month: a US reader pays a tidy dollar price (with the 3% margin); a Kenyan reader pays KSh 650 exactly
assert.equal(readerPrice(65000, "KES", "KES", r), 65000);
const usd = readerPrice(65000, "KES", "USD", r); // 650/129 = 5.04 → ×1.03 = 5.19 → $5.50
assert.equal(usd, 550);
// a Nigerian creator's ₦5,000: a UK reader pays £2.71 → £3.00
assert.equal(readerPrice(500000, "NGN", "GBP", r), 300);
// the creator's earning is from their own price, never the rate: 80% of KSh 650
assert.equal(earningOf(65000, 0.2), 52000);

// what a creator offers: naira creators use their tier prices (needs a Paystack plan) unless they switched readers abroad off
const ngnTiers = { premium: { enabled: true, priceKobo: 500000, planCode: "PLN_1" }, vip: { enabled: true, priceKobo: 1500000 }, vvip: { enabled: false, priceKobo: 0 } };
const ng = homeOffers(ngnTiers, null);
assert.deepEqual(ng.premium, { enabled: true, currency: "NGN", minor: 500000 }); assert.equal(ng.vip.enabled, false, "no plan, not open");
assert.equal(homeOffers(ngnTiers, { currency: "NGN", acceptGlobal: false }).premium.enabled, false);
const ke = homeOffers(ngnTiers, { currency: "KES", tiers: { premium: { enabled: true, minor: 65000 }, vip: { enabled: true, minor: 0 } } });
assert.deepEqual(ke.premium, { enabled: true, currency: "KES", minor: 65000 }); assert.equal(ke.vip.enabled, false); assert.equal(ke.vvip.enabled, false);
assert.equal(checkHomePrice(65000, "KES", r), null);
assert.match(String(checkHomePrice(2000, "KES", r)), /under \$0\.50/); // KSh 20
assert.match(String(checkHomePrice(100_000_00, "KES", r)), /up to about \$500/);
assert.equal(checkHomePrice(0, "KES", r), "Enter a monthly price.");

// pools: the USD pool took $55 and owes nothing; the KES pool owes KSh 5,200 with no cash → short KSh 5,720 with the 10% reserve
const usdLine = poolLine({ ...emptyPool("USD"), inMinor: 5500 }, 10);
const kesLine = poolLine({ ...emptyPool("KES"), dueMinor: 520000 }, 10);
assert.equal(usdLine.spareMinor, 5500); assert.equal(kesLine.shortMinor, 572000); assert.ok(!canPayFrom(kesLine, 520000));
const s = suggestConversions([usdLine, kesLine], r);
assert.equal(s.length, 1); assert.equal(s[0].from, "USD"); assert.equal(s[0].to, "KES");
assert.ok(s[0].toMinor >= 571_900 && s[0].toMinor <= 572000, String(s[0].toMinor)); assert.ok(s[0].fromMinor <= 5500);
// sales both ways mostly cancel out: Kenyans paying a US creator fill the KES pool, so nothing needs converting
const kesBoth = poolLine({ ...emptyPool("KES"), inMinor: 700000, dueMinor: 520000 }, 10);
assert.deepEqual(suggestConversions([usdLine, kesBoth], r), []); assert.ok(canPayFrom(kesBoth, 520000));
// not enough spare anywhere: covers what it can
const tiny = poolLine({ ...emptyPool("USD"), inMinor: 100 }, 10);
assert.ok(suggestConversions([tiny, kesLine], r).reduce((n, c) => n + c.toMinor, 0) < kesLine.shortMinor);

// renewal reminder: within 3 days of the end, once per period
assert.ok(renewReminderDue("2026-11-12T00:00:00Z", undefined, now)); assert.ok(!renewReminderDue("2026-11-12T00:00:00Z", "2026-11-12T00:00:00Z", now));
assert.ok(!renewReminderDue("2026-11-20T00:00:00Z", undefined, now)); assert.ok(!renewReminderDue("2026-11-09T00:00:00Z", undefined, now));

// Stripe: form encoding and webhook signatures (5-minute window)
assert.equal(formEncode({ a: 1, line_items: { 0: { price_data: { currency: "usd" } } } }), "a=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd");
const body = JSON.stringify({ type: "checkout.session.completed" });
const t = Math.floor(now.getTime() / 1000);
const sig = createHmac("sha256", "whsec_test").update(`${t}.${body}`).digest("hex");
assert.ok(isValidStripeSignature(body, `t=${t},v1=${sig}`, "whsec_test", now.getTime()));
assert.ok(!isValidStripeSignature(body + " ", `t=${t},v1=${sig}`, "whsec_test", now.getTime()));
assert.ok(!isValidStripeSignature(body, `t=${t},v1=${sig}`, "whsec_test", now.getTime() + 301_000));
assert.ok(!isValidStripeSignature(body, `t=${t},v1=${sig}`, "", now.getTime()));
assert.ok(isValidFlutterwaveHash("abc123", "abc123")); assert.ok(!isValidFlutterwaveHash("abc124", "abc123")); assert.ok(!isValidFlutterwaveHash(null, "abc123"));

// more currencies (9 Nov): yen has no minor unit, Tunisian dinars three; Malawi pays dollars; Japan, the UAE and China go to Stripe
assert.equal(providerFor("JPY"), "stripe"); assert.equal(providerFor("AED"), "stripe"); assert.equal(providerFor("CNY"), "stripe");
assert.equal(providerFor("MAD"), "flutterwave"); assert.equal(currencyForCountry("MW"), "USD"); assert.equal(currencyForCountry("JP"), "JPY");
assert.equal(formatMoney(1500, "JPY"), "¥1,500"); assert.equal(toMinor(12.5, "TND"), 12500); assert.equal(formatMoney(1999, "AED"), "AED 19.99");
assert.equal(guessCurrency("Asia/Dubai"), "AED"); assert.equal(guessCurrency("Africa/Blantyre"), "USD");

// Botswana pays in pula through Stripe; yuan shows Alipay and WeChat Pay
assert.equal(currencyForCountry("BW"), "BWP"); assert.equal(providerFor("BWP"), "stripe"); assert.equal(formatMoney(4500, "BWP"), "P45");
assert.equal(guessCurrency("Africa/Gaborone"), "BWP");
assert.equal(payMethodsLabel("CNY"), "card, Alipay or WeChat Pay"); assert.equal(payMethodsLabel("KES"), "card or mobile money"); assert.equal(payMethodsLabel("XOF"), "mobile money"); assert.equal(payMethodsLabel("BWP"), "card");

// Detecting a visitor's country and currency (lib/local-currency.ts): their own pick, then their country, then their time zone.
const hdr = (h: Record<string, string>) => (n: string) => h[n];
assert.equal(countryFromHeaders(hdr({ "x-vercel-ip-country": "ke" })), "KE");
assert.equal(countryFromHeaders(hdr({}), "gh"), "GH", "the cookie when there's no header");
assert.equal(countryFromHeaders(hdr({ "x-vercel-ip-country": "XX" })), null, "unknown");
assert.equal(countryFromHeaders(hdr({ "x-vercel-ip-country": "T1" })), null, "Tor");
assert.ok(!isCountryCode("ken"));
assert.deepEqual(pickCurrency({ saved: "GBP", country: "KE", timeZone: "Africa/Lagos" }), { currency: "GBP", source: "saved" });
assert.deepEqual(pickCurrency({ saved: "BTC", country: "KE" }), { currency: "KES", source: "country" }, "an unknown pick is ignored");
assert.deepEqual(pickCurrency({ country: "SN" }), { currency: "XOF", source: "country" });
assert.deepEqual(pickCurrency({ country: "BR" }), { currency: "USD", source: "country" }, "a country we don't list pays in dollars");
assert.deepEqual(pickCurrency({ timeZone: "Africa/Accra" }), { currency: "GHS", source: "timezone" });
assert.deepEqual(pickCurrency({}), { currency: "USD", source: "timezone" });
// a Lagos computer whose connection comes out in the Netherlands (VPN, relay, routing) gets naira, not euros
assert.deepEqual(pickCurrency({ country: "NL", timeZone: "Africa/Lagos" }), { currency: "NGN", source: "timezone" });
assert.deepEqual(pickCurrency({ country: "BJ", timeZone: "Africa/Lagos" }), { currency: "XOF", source: "country" }, "inside Africa the country still wins");
assert.deepEqual(pickCurrency({ country: "NL", timeZone: "Europe/Amsterdam" }), { currency: "EUR", source: "country" });
assert.deepEqual(pickCurrency({ country: "GB", timeZone: "Asia/Dubai" }), { currency: "GBP", source: "country" }, "only an African clock overrules");
assert.ok(AFRICAN_CODES.has("NG") && AFRICAN_CODES.has("ZW") && !AFRICAN_CODES.has("GB") && AFRICAN_CODES.size === 54);
// the 36-hour nudge to Finance, once, then the 48-hour pause notice, once
const rr = { updatedAt: "2026-11-10T00:00:00Z" };
const at = (h: number) => new Date(Date.parse(rr.updatedAt) + h * 3_600_000);
assert.equal(ratesReminderDue(rr, undefined, at(35)), null); assert.equal(ratesReminderDue(rr, undefined, at(36)), "soon");
assert.equal(ratesReminderDue(rr, "soon", at(40)), null); assert.equal(ratesReminderDue(rr, "soon", at(48)), "paused");
assert.equal(ratesReminderDue(rr, "paused", at(60)), null); assert.equal(ratesReminderDue(null, undefined, at(60)), null);

// Selling in your local currency (lib/global-sales.ts): which sales go the global way, an item's currency, the address outside Nigeria.
assert.equal(isGlobalSale("NGN", "NGN"), false, "naira for naira: the usual Paystack checkout");
assert.ok(isGlobalSale("NGN", "USD") && isGlobalSale("KES", "KES") && isGlobalSale("KES", "NGN"));
assert.ok(isSaleKind("store_cart") && isSaleKind("booking") && !isSaleKind("gift") && !isSaleKind("subscription"));
assert.equal(priceCurrency({ currency: "KES" }), "KES"); assert.equal(priceCurrency({}), "NGN"); assert.equal(priceCurrency({ currency: "BTC" }), "NGN"); assert.equal(priceCurrency(null), "NGN");
const nairaFmt = (k: number) => `₦${k / 100}`;
assert.equal(moneyIn(650_00, "KES", nairaFmt), "KSh 650"); assert.equal(moneyIn(5_000_00, undefined, nairaFmt), "₦5000"); assert.equal(moneyIn(1250, "USD", nairaFmt), "$12.50");
const addr = { fullName: "Wanjiku Kamau", phone: "+254 712 345 678", street: "12 Moi Avenue", city: "Nairobi", state: "Nairobi County, Kenya" };
assert.equal(validateWorldAddress(addr), null);
assert.match(String(validateWorldAddress({ ...addr, phone: "712" })), /country code/);
assert.match(String(validateWorldAddress({ ...addr, state: "" })), /region and country/);

console.log("GLOBAL OK");
