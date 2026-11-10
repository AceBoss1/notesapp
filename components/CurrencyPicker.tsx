"use client";

import { useEffect, useState } from "react";
import { CURRENCIES, currencyInfo } from "@/lib/currency";
import { COUNTRIES } from "@/lib/countries";
import { CURRENCY_EVENT, preferredCurrency, setPreferredCurrency } from "@/lib/local-currency";

// The visitor's country and currency, in the footer on every page (owner, 10 Nov 2026: "auto detect and select for country/currencies").
// It starts from where they are (lib/local-currency.ts) and anyone can change it; Automatic goes back to the detected one. Checkout
// windows that take other currencies (subscriptions today) open in it, and the visitor still sees the price before paying.
const flag = (cc: string) => String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 0x1f1a5 + c.charCodeAt(0)));

export default function CurrencyPicker({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<ReturnType<typeof preferredCurrency> | null>(null);
  useEffect(() => {
    const read = () => setNow(preferredCurrency());
    read();
    window.addEventListener(CURRENCY_EVENT, read);
    return () => window.removeEventListener(CURRENCY_EVENT, read);
  }, []);
  if (!now) return null;
  const country = now.country ? COUNTRIES.find((c) => c.code === now.country) : null;
  const auto = currencyInfo(now.auto);
  return (
    <label className={`inline-flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <span aria-hidden="true">{now.country ? flag(now.country) : "🌍"}</span>
      <span>{country ? country.name : "Your currency"}</span>
      <span aria-hidden="true">·</span>
      <select
        value={now.source === "saved" ? now.currency : ""}
        onChange={(e) => setPreferredCurrency(e.target.value || null)}
        aria-label="Your currency"
        className="max-w-[11rem] rounded-full border border-paper/20 bg-transparent px-2 py-0.5 text-xs text-paper/80 hover:border-paper/50 [&>option]:text-ink"
      >
        <option value="">{`${auto.symbol} ${auto.code} (automatic)`}</option>
        {CURRENCIES.map((x) => <option key={x.code} value={x.code}>{x.symbol} {x.code} · {x.name}</option>)}
      </select>
    </label>
  );
}
