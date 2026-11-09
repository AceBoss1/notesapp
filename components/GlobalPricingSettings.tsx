"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { CURRENCIES, formatMoney, toMajor } from "@/lib/currency";
import { SUB_TIERS, TIER_NAME, type SubTier } from "@/lib/fans";

// Rates & payouts → "Readers in other currencies" (lib/global-pay.ts). A creator chooses the currency they earn in. In naira, their usual
// tier prices are used and readers abroad pay the same price in their own currency (switch it off to keep subscriptions naira-only).
// In any other currency, they set their prices in it here, and add where they're paid in it (a bank account or mobile money).
type Settings = { currency: string; acceptGlobal?: boolean; tiers?: Partial<Record<SubTier, { enabled?: boolean; minor?: number }>> };
type Payout = { currency: string; method: "bank" | "mobile_money"; accountBank: string; accountName: string; last4: string } | null;
type Data = { settings: Settings; payout: Payout; owed: Record<string, number>; ratesReady: boolean };

export default function GlobalPricingSettings({ user }: { user: User }) {
  const [data, setData] = useState<Data | null>(null);
  const [cur, setCur] = useState("NGN");
  const [accept, setAccept] = useState(true);
  const [prices, setPrices] = useState<Record<SubTier, { on: boolean; price: string }>>({ premium: { on: false, price: "" }, vip: { on: false, price: "" }, vvip: { on: false, price: "" } });
  const [acct, setAcct] = useState({ method: "bank" as "bank" | "mobile_money", accountBank: "", accountNumber: "", accountName: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (method: "GET" | "POST", body?: unknown) => {
    const r = await fetch("/api/publisher/global", { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  };
  useEffect(() => {
    call("GET").then((d: Data) => {
      setData(d); setCur(d.settings.currency || "NGN"); setAccept(d.settings.acceptGlobal !== false);
      const t = d.settings.tiers ?? {};
      setPrices(Object.fromEntries(SUB_TIERS.map((k) => [k, { on: !!t[k]?.enabled, price: t[k]?.minor ? String(toMajor(t[k]!.minor!, d.settings.currency)) : "" }])) as typeof prices);
    }).catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't load." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await call("POST", { action: "settings", currency: cur, acceptGlobal: accept, tiers: Object.fromEntries(SUB_TIERS.map((t) => [t, { enabled: prices[t].on, price: Number(prices[t].price) }])) });
      setMsg({ ok: true, text: "Saved." });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." }); } finally { setBusy(false); }
  }
  async function savePayout(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await call("POST", { action: "payout", currency: cur, ...acct });
      setData((d) => (d ? { ...d, payout: r.payout } : d)); setAcct({ ...acct, accountNumber: "" });
      setMsg({ ok: true, text: "Payout details saved." });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." }); } finally { setBusy(false); }
  }

  const input = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
  const owed = data ? Object.entries(data.owed).filter(([, m]) => m > 0) : [];
  return (
    <div id="global" className="card mt-8 p-6">
      <p className="eyebrow">Readers in other currencies</p>
      <p className="mt-2 text-sm text-slate">Readers anywhere can subscribe and pay in their own currency (US dollars, pounds, euros, shillings, cedis and more). You&apos;re paid in the currency you choose here, at your own price: the exchange rate never changes what you earn.</p>
      {!data ? <p className="mt-3 text-xs text-slate">{msg?.text ?? "Loading…"}</p> : (
        <>
          {owed.length > 0 && <p className="mt-3 rounded-xl bg-crimson/5 px-3 py-2 text-sm text-ink">Waiting to be paid: {owed.map(([c, m]) => formatMoney(m, c)).join(" · ")}</p>}
          <form onSubmit={save} className="mt-4 grid gap-3">
            <label className="text-xs text-slate">I earn in
              <select value={cur} onChange={(e) => setCur(e.target.value)} className={input}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
              </select>
            </label>
            {cur === "NGN" ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                Let readers outside Nigeria subscribe in their own currency, at my tier prices above
              </label>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {SUB_TIERS.map((t) => (
                  <label key={t} className="rounded-xl border border-rule p-3 text-xs text-slate">
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={prices[t].on} onChange={(e) => setPrices({ ...prices, [t]: { ...prices[t], on: e.target.checked } })} /> {TIER_NAME[t]}</span>
                    {prices[t].on && <input type="number" min={0} step="any" inputMode="decimal" value={prices[t].price} onChange={(e) => setPrices({ ...prices, [t]: { ...prices[t], price: e.target.value } })} placeholder={`Monthly, in ${cur}`} className={input} />}
                  </label>
                ))}
              </div>
            )}
            <div><button disabled={busy} className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div>
          </form>
          {cur !== "NGN" && (
            <form onSubmit={savePayout} className="mt-6 grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
              <p className="text-sm font-semibold text-ink sm:col-span-2">Where you&apos;re paid in {cur}</p>
              {data.payout && data.payout.currency === cur && <p className="text-sm text-ink sm:col-span-2">{data.payout.accountName} · {data.payout.method === "mobile_money" ? "Mobile money" : "Bank"} {data.payout.accountBank} · ••••{data.payout.last4}</p>}
              <label className="text-xs text-slate">Paid to
                <select value={acct.method} onChange={(e) => setAcct({ ...acct, method: e.target.value as "bank" | "mobile_money" })} className={input}>
                  <option value="bank">Bank account</option><option value="mobile_money">Mobile money (M-Pesa, MTN, Airtel…)</option>
                </select>
              </label>
              <label className="text-xs text-slate">{acct.method === "bank" ? "Bank code" : "Network code (M-Pesa: MPS)"}<input value={acct.accountBank} onChange={(e) => setAcct({ ...acct, accountBank: e.target.value })} className={input} required /></label>
              <label className="text-xs text-slate">{acct.method === "bank" ? "Account number or IBAN" : "Phone number with country code"}<input value={acct.accountNumber} onChange={(e) => setAcct({ ...acct, accountNumber: e.target.value })} className={input} required /></label>
              <label className="text-xs text-slate">Name on the account<input value={acct.accountName} onChange={(e) => setAcct({ ...acct, accountName: e.target.value })} className={input} required /></label>
              <div className="sm:col-span-2"><button disabled={busy} className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50">{data.payout ? "Replace" : "Save payout details"}</button></div>
              <p className="text-[11px] text-slate sm:col-span-2">We keep only the last 4 digits on show; the full number is stored encrypted and used only to pay you.</p>
            </form>
          )}
          {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-ink" : "text-crimson"}`}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
