"use client";

import { useEffect, useState } from "react";
import { currencyInfo, formatMoney, payMethodsLabel } from "@/lib/currency";
import { CURRENCY_EVENT, preferredCurrency } from "@/lib/local-currency";

// Under a price in the seller's currency: what the buyer pays in theirs (their pick in the footer, else where they are), and how
// (lib/global-sales.ts). Nothing when they're the same currency, or while rates are being updated (then checkout charges the seller's).
export default function PayPreview({ minor, currency, className = "" }: { minor: number; currency: string; className?: string }) {
  const [pay, setPay] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setPay(preferredCurrency().currency);
    read();
    window.addEventListener(CURRENCY_EVENT, read);
    return () => window.removeEventListener(CURRENCY_EVENT, read);
  }, []);
  useEffect(() => {
    setShown(null);
    if (!pay || pay === currency || !(minor > 0)) return;
    let live = true;
    fetch(`/api/global/price?minor=${minor}&from=${currency}&to=${pay}`).then((r) => r.json())
      .then((j) => { if (live && typeof j.payMinor === "number") setShown(formatMoney(j.payMinor, pay)); }).catch(() => {});
    return () => { live = false; };
  }, [minor, currency, pay]);
  if (!pay || pay === currency) return null;
  return (
    <p className={`text-xs text-slate ${className}`}>
      {shown ? <>You pay about <b className="text-ink">{shown}</b> ({pay}), by {payMethodsLabel(pay)}. </> : null}
      Priced in {currencyInfo(currency).name}; the exact amount shows before you pay.
    </p>
  );
}
