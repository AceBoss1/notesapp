"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BONUS_KINDS, PAY_EVENT, nairaOf, type PayAsk } from "@/lib/wallet";

// "Pay with": the wallet or a card. Opened by lib/checkout.ts (choosePayment) when the member has something in their wallet and the
// thing they're buying can be paid from it. Mounted once in the main layout.
type Pending = PayAsk & { resolve: (v: "wallet" | "card" | null) => void };

export default function PayChooser() {
  const [ask, setAsk] = useState<Pending | null>(null);
  const [pick, setPick] = useState<"wallet" | "card">("wallet");
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Pending>).detail;
      const bonusOk = BONUS_KINDS.includes(d.kind);
      const usable = d.creditKobo + (bonusOk ? d.bonusKobo : 0);
      setPick(d.amountKobo === undefined || usable >= d.amountKobo ? "wallet" : "card");
      setAsk(d);
    };
    window.addEventListener(PAY_EVENT, on);
    return () => window.removeEventListener(PAY_EVENT, on);
  }, []);
  if (!ask) return null;
  const done = (v: "wallet" | "card" | null) => { ask.resolve(v); setAsk(null); };
  const bonusOk = BONUS_KINDS.includes(ask.kind);
  const amt = ask.amountKobo;
  const bonusUse = amt === undefined || !bonusOk ? 0 : Math.min(ask.bonusKobo, amt);
  const creditUse = amt === undefined ? 0 : amt - bonusUse;
  const enough = amt === undefined || creditUse <= ask.creditKobo;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Choose how to pay" onClick={() => done(null)}>
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-ui text-lg font-bold text-ink">How do you want to pay?</p>
        {amt !== undefined && <p className="mt-1 text-sm text-slate">Total <b className="text-ink">{nairaOf(amt)}</b></p>}
        <button type="button" disabled={!enough} onClick={() => setPick("wallet")} className={`mt-4 flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left disabled:opacity-60 ${pick === "wallet" ? "border-crimson bg-crimson/5" : "border-rule"}`}>
          <span className={`mt-1 h-4 w-4 shrink-0 rounded-full ${pick === "wallet" ? "border-4 border-crimson" : "border-2 border-slate"}`} />
          <span className="flex-1">
            <b className="text-ink">Wallet</b>
            <span className="block text-xs text-slate">{nairaOf(ask.creditKobo)} credit{ask.bonusKobo > 0 ? ` · 🎁 ${nairaOf(ask.bonusKobo)} bonus${bonusOk ? "" : " (not usable for this)"}` : ""}</span>
            {!enough && <span className="mt-1 block text-xs font-semibold text-crimson">Not enough for this. <Link href="/profile/wallet" className="underline" onClick={() => done(null)}>Top up</Link></span>}
          </span>
        </button>
        <button type="button" onClick={() => setPick("card")} className={`mt-2 flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${pick === "card" ? "border-crimson bg-crimson/5" : "border-rule"}`}>
          <span className={`mt-1 h-4 w-4 shrink-0 rounded-full ${pick === "card" ? "border-4 border-crimson" : "border-2 border-slate"}`} />
          <span className="flex-1"><b className="text-ink">Card, bank transfer or USSD</b><span className="block text-xs text-slate">Through Paystack, just this once</span></span>
        </button>
        {pick === "wallet" && amt !== undefined && enough && (
          <dl className="mt-3 space-y-1 text-sm">
            {bonusUse > 0 && <div className="flex justify-between text-green-700"><dt>🎁 Bonus Credits (used first)</dt><dd>−{nairaOf(bonusUse)}</dd></div>}
            <div className="flex justify-between"><dt>NotesApp Credit</dt><dd>−{nairaOf(creditUse)}</dd></div>
          </dl>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => done(null)} className="btn-ghost !py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={() => done(pick)} className="btn-primary !py-2.5 text-sm">{pick === "wallet" ? (amt !== undefined ? `Pay ${nairaOf(amt)}` : "Pay from wallet") : "Continue to Paystack"}</button>
        </div>
      </div>
    </div>
  );
}
