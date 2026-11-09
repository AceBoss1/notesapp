"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import type { Conversion, PoolLine, Rates } from "@/lib/global-pay";

// Admin → Treasury (Finance): global subscriptions (lib/global-pay-server.ts). One pool per currency (collected, paid out, converted),
// what's owed to creators in it, and what's short; suggested conversions to cover the short pools; exchange rates; payouts; refunds.
type Due = { publisherUid: string; publisherUsername: string; currency: string; minor: number; count: number };
type Pay = { reference: string; publisherUsername: string; tier: string; payCurrency: string; payMinor: number; homeCurrency: string; earningMinor: number; provider: string; status: string; createdAt: string };
type Data = { rates: Rates | null; ratesFresh: boolean; lines: PoolLine[]; suggestions: Conversion[]; due: Due[]; payments: Pay[]; conversions: (Conversion & { id: string; at: string; note?: string })[]; payouts: { id: string; publisherUsername: string; currency: string; minor: number; via: string; externalRef: string; at: string }[] };

export default function AdminTreasuryPage() {
  const { user, loading } = useAdminAuth();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [margin, setMargin] = useState("");
  const [reserve, setReserve] = useState("");
  const [conv, setConv] = useState({ from: "USD", to: "NGN", fromAmount: "", toAmount: "", note: "" });

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/treasury", { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load.");
      setD(j);
      setRates(Object.fromEntries(Object.entries((j.rates?.perUsd ?? {}) as Record<string, number>).map(([k, v]) => [k, String(v)])));
      setMargin(String(j.rates?.marginPct ?? 3)); setReserve(String(j.rates?.reservePct ?? 10));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load."); }
  }, [user]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  const post = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/treasury", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };

  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  const input = "rounded-xl border border-rule bg-card px-2 py-1 text-sm";
  const m = (minor: number, c: string) => formatMoney(minor, c);
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="font-display text-3xl text-ink">Treasury</h1>
      <p className="mt-1 text-sm text-slate">Subscriptions paid in one currency and earned in another. NotesApp sells the subscription and pays the creator&apos;s share in their currency, fixed at the sale. Each currency has a pool; keep each pool above what it owes (plus the reserve) by converting from pools with money to spare.</p>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
      {!d ? <p className="mt-4 text-sm text-slate">Loading…</p> : (
        <>
          <section className="card mt-6 overflow-x-auto p-4">
            <p className="eyebrow">Pools</p>
            {d.lines.length === 0 ? <p className="mt-2 text-sm text-slate">No payments in other currencies yet.</p> : (
              <table className="mt-2 w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-xs text-slate"><th>Currency</th><th>Cash</th><th>Owed to creators</th><th>Needed (with reserve)</th><th>Short</th><th>Spare</th></tr></thead>
                <tbody>{d.lines.map((l) => (
                  <tr key={l.currency} className="border-t border-rule"><td className="py-1 font-semibold">{l.currency}</td><td>{m(l.cashMinor, l.currency)}</td><td>{m(l.dueMinor, l.currency)}</td><td>{m(l.needMinor, l.currency)}</td><td className={l.shortMinor ? "font-semibold text-crimson" : ""}>{l.shortMinor ? m(l.shortMinor, l.currency) : "–"}</td><td>{l.spareMinor ? m(l.spareMinor, l.currency) : "–"}</td></tr>
                ))}</tbody>
              </table>
            )}
            {d.suggestions.length > 0 && (
              <div className="mt-3 rounded-xl bg-crimson/5 p-3 text-sm">
                <p className="font-semibold text-ink">Suggested conversions</p>
                <ul className="mt-1 list-disc pl-5">{d.suggestions.map((s, i) => <li key={i}>{m(s.fromMinor, s.from)} → about {m(s.toMinor, s.to)}</li>)}</ul>
                <p className="mt-1 text-xs text-slate">Convert through a licensed bank or the provider, then record what actually moved below. Naira conversions go only through licensed channels.</p>
              </div>
            )}
          </section>

          <section className="card mt-6 p-4">
            <p className="eyebrow">Record a conversion</p>
            <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
              <select value={conv.from} onChange={(e) => setConv({ ...conv, from: e.target.value })} className={input}>{CURRENCIES.map((c) => <option key={c.code}>{c.code}</option>)}</select>
              <input value={conv.fromAmount} onChange={(e) => setConv({ ...conv, fromAmount: e.target.value })} placeholder="Amount out" inputMode="decimal" className={`${input} w-28`} />
              <span>→</span>
              <select value={conv.to} onChange={(e) => setConv({ ...conv, to: e.target.value })} className={input}>{CURRENCIES.map((c) => <option key={c.code}>{c.code}</option>)}</select>
              <input value={conv.toAmount} onChange={(e) => setConv({ ...conv, toAmount: e.target.value })} placeholder="Amount in" inputMode="decimal" className={`${input} w-28`} />
              <input value={conv.note} onChange={(e) => setConv({ ...conv, note: e.target.value })} placeholder="Bank / reference" className={`${input} w-40`} />
              <button disabled={busy} onClick={() => post({ action: "conversion", ...conv }, "Record this conversion? It moves the pools.")} className="btn-primary !px-4 !py-1.5 text-xs">Record</button>
            </div>
          </section>

          <section className="card mt-6 overflow-x-auto p-4">
            <p className="eyebrow">Due to creators</p>
            {d.due.length === 0 ? <p className="mt-2 text-sm text-slate">Nothing due (earnings are held {7} days first).</p> : (
              <ul className="mt-2 divide-y divide-rule text-sm">{d.due.map((x) => (
                <li key={`${x.publisherUid}_${x.currency}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>@{x.publisherUsername} · {m(x.minor, x.currency)} ({x.count})</span>
                  <span className="flex gap-2">
                    {!["NGN", "USD", "GBP", "EUR", "CAD"].includes(x.currency) && <button disabled={busy} onClick={() => post({ action: "payout", publisherUid: x.publisherUid, currency: x.currency, via: "flutterwave" }, `Send ${m(x.minor, x.currency)} to @${x.publisherUsername} through Flutterwave?`)} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold">Pay via Flutterwave</button>}
                    <button disabled={busy} onClick={() => { const ref = prompt("The transfer's reference from the bank or provider:"); if (ref) void post({ action: "payout", publisherUid: x.publisherUid, currency: x.currency, via: "recorded", externalRef: ref }); }} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold">Record a payout</button>
                  </span>
                </li>
              ))}</ul>
            )}
          </section>

          <section className="card mt-6 p-4">
            <p className="eyebrow">Exchange rates</p>
            <p className="mt-1 text-xs text-slate">How many of each currency one US dollar buys. {d.rates ? `Updated ${new Date(d.rates.updatedAt).toLocaleString("en-GB")}.` : "Not set yet."} {d.ratesFresh ? "" : "Readers can't pay in another currency until these are updated (they expire after 48 hours)."}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CURRENCIES.filter((c) => c.code !== "USD").map((c) => (
                <label key={c.code} className="text-xs text-slate">{c.code}<input value={rates[c.code] ?? ""} onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })} inputMode="decimal" className={`${input} mt-1 block w-full`} /></label>
              ))}
              <label className="text-xs text-slate">Margin %<input value={margin} onChange={(e) => setMargin(e.target.value)} className={`${input} mt-1 block w-full`} /></label>
              <label className="text-xs text-slate">Reserve %<input value={reserve} onChange={(e) => setReserve(e.target.value)} className={`${input} mt-1 block w-full`} /></label>
            </div>
            <button disabled={busy} onClick={() => post({ action: "rates", perUsd: Object.fromEntries(Object.entries(rates).filter(([, v]) => v.trim())), marginPct: margin, reservePct: reserve })} className="btn-primary mt-3 !px-4 !py-1.5 text-xs">Save rates</button>
          </section>

          <section className="card mt-6 overflow-x-auto p-4">
            <p className="eyebrow">Recent payments</p>
            <table className="mt-2 w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs text-slate"><th>When</th><th>Creator</th><th>Paid</th><th>Creator earns</th><th>Via</th><th>Status</th><th></th></tr></thead>
              <tbody>{d.payments.map((p) => (
                <tr key={p.reference} className="border-t border-rule"><td className="py-1">{p.createdAt.slice(0, 10)}</td><td>@{p.publisherUsername}</td><td>{m(p.payMinor, p.payCurrency)}</td><td>{m(p.earningMinor, p.homeCurrency)}</td><td>{p.provider}</td><td>{p.status}</td>
                  <td>{p.status === "paid" && <button disabled={busy} onClick={() => post({ action: "refund", reference: p.reference }, "Refund this payment to the reader and end that month?")} className="text-xs text-crimson underline">Refund</button>}</td></tr>
              ))}</tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
