"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { csvOf } from "@/lib/books-import";
import { naira, type Cash, type Period, type PeriodKind, type Pnl } from "@/lib/books";
import { PeriodPicker } from "./Lists";
import { Icon, download, pill, type Api } from "./shared";

// Profit and loss for a day, a week or (Pro and above) a month: the statement, expenses by category, best sellers by profit, and the
// numbers counted separately (honest numbers: stock value is never added to sales or profit). PDF through the print dialog; CSV.
type View = {
  period: Period; kind: PeriodKind; pnl: Pnl; change: number | null; previousNetKobo: number; bars: { label: string; salesKobo: number; costKobo: number }[]; cash: Cash;
  separate: { sales: number; salesKobo: number; expenses: number; expensesKobo: number; owedKobo: number; stockKobo: number; stockCounted: boolean };
};
const short = (k: number) => { const n = k / 100; return n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : n >= 1_000 ? `₦${Math.round(n / 1_000)}k` : `₦${Math.round(n)}`; };

export default function ProfitLoss({ api, monthOk, shop }: { api: Api; monthOk: boolean; shop: string }) {
  const [kind, setKind] = useState<PeriodKind>(monthOk ? "month" : "week");
  const [back, setBack] = useState(0);
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<{ message: string; code?: string } | null>(null);
  useEffect(() => { setErr(null); api<View>(`view=pnl&period=${kind}&back=${back}`).then(setV).catch((e) => { setV(null); setErr(e); }); }, [api, kind, back]);
  const p = v?.pnl;
  const prevLabel = kind === "day" ? "the day before" : kind === "week" ? "last week" : "the month before";
  const csv = () => {
    if (!v || !p) return;
    download(`profit-and-loss-${v.period.start}-to-${v.period.end}.csv`, csvOf([
      ["Profit and loss", shop], ["From", v.period.start], ["To", v.period.end], [],
      ["Line", "Naira"], ["Sales", (p.salesKobo / 100).toFixed(2)], ["  Walk-in and offline", ((p.walkinKobo + p.importedKobo) / 100).toFixed(2)], ["  Online store orders", (p.onlineKobo / 100).toFixed(2)],
      ["Refunds and returns", (-p.refundsKobo / 100).toFixed(2)], ["Cost of what you sold", (-p.costKobo / 100).toFixed(2)], ["Gross profit", (p.grossKobo / 100).toFixed(2)],
      ...p.byCategory.map((c) => [`Expense: ${c.label}`, (-c.kobo / 100).toFixed(2)]), ["Net profit", (p.netKobo / 100).toFixed(2)], [],
      ["Counted separately", ""], ["Money owed to you", (v.separate.owedKobo / 100).toFixed(2)], ["Stock you hold, at cost (not added to profit)", (v.separate.stockKobo / 100).toFixed(2)],
    ]));
  };
  const max = Math.max(1, ...(v?.bars ?? []).map((b) => b.salesKobo));
  const catMax = Math.max(1, ...(p?.byCategory ?? []).map((c) => c.kobo));
  return (
    <div id="books-pnl">
      <style>{"@media print { body * { visibility: hidden !important } #books-pnl, #books-pnl * { visibility: visible !important } #books-pnl { position: absolute; left: 0; top: 0; width: 100%; padding: 24px } .books-no-print { display: none !important } }"}</style>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Profit and loss · {shop}</p><h1 className="mt-1 font-display text-4xl text-ink">{v?.period.label ?? "Profit and loss"}</h1></div>
        <div className="books-no-print flex flex-wrap gap-2">
          <button onClick={() => window.print()} disabled={!v} className={pill}><Icon name="file" className="h-4 w-4" />PDF report</button>
          <button onClick={csv} disabled={!v} className={pill}><Icon name="download" className="h-4 w-4" />CSV</button>
        </div>
      </div>
      <div className="books-no-print mt-4"><PeriodPicker kind={kind} back={back} setKind={setKind} setBack={setBack} monthOk={monthOk} /></div>
      {err && <p className="card mt-4 p-5 text-sm text-slate">{err.message} {err.code === "month_pnl" && <Link href="/pricing" className="font-semibold text-crimson">See Pro</Link>}</p>}
      {v && p && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <section className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Net profit</p><p className={`mt-1 font-ui text-4xl font-extrabold ${p.netKobo < 0 ? "text-red-700" : "text-ink"}`}>{naira(p.netKobo)}</p></div>
                {v.change !== null && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${v.change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{v.change >= 0 ? "▲" : "▼"} {Math.abs(v.change)}% on {prevLabel}</span>}
              </div>
              {v.bars.length > 0 && (
                <>
                  <p className="mt-2 text-sm text-slate">Sales by {kind === "week" ? "day" : "week"}, with the cost of what you sold in the darker part</p>
                  <div className="mt-4 flex h-40 items-end gap-2 sm:gap-4" role="img" aria-label="Sales by period">
                    {v.bars.map((b) => (
                      <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-ink sm:text-xs">{b.salesKobo ? short(b.salesKobo) : ""}</span>
                        <div className="flex w-full max-w-[56px] flex-col justify-end overflow-hidden rounded-t-lg bg-crimson" style={{ height: `${Math.max(2, (b.salesKobo / max) * 110)}px` }}>
                          <div className="bg-crimson-deep" style={{ height: `${b.salesKobo ? Math.min(100, (b.costKobo / b.salesKobo) * 100) : 0}%` }} />
                        </div>
                        <span className="text-[11px] text-slate">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
            <section className="card p-5">
              <h2 className="font-ui text-lg font-bold text-ink">Statement</h2>
              <dl className="mt-2 divide-y divide-rule text-[15px]">
                <Row k="Sales" v={naira(p.salesKobo)} />
                <Row k="Walk-in and offline" v={naira(p.walkinKobo + p.importedKobo)} sub />
                <Row k="Online store orders" v={naira(p.onlineKobo)} sub />
                <Row k="Refunds and returns" v={p.refundsKobo ? naira(-p.refundsKobo) : naira(0)} neg={p.refundsKobo > 0} />
                <Row k="Cost of what you sold" v={naira(-p.costKobo)} neg={p.costKobo > 0} />
                <Row k={<><b>Gross profit</b>{p.marginPct !== null && <span className="text-slate"> · {p.marginPct}%</span>}</>} v={<b>{naira(p.grossKobo)}</b>} />
                <Row k="Expenses" v={naira(-(p.expensesKobo + p.commissionKobo))} neg={p.expensesKobo + p.commissionKobo > 0} />
                <Row k={<b>Net profit</b>} v={<b className="text-lg">{naira(p.netKobo)}</b>} />
              </dl>
              {p.noCostItems > 0 && <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{p.noCostItems} {p.noCostItems === 1 ? "item has" : "items have"} no cost price yet, so profit may be a little high. <Link href="/profile/inventory" className="font-semibold underline">Add cost prices</Link></p>}
              <p className="mt-3 flex items-center gap-2 rounded-2xl bg-field px-3 py-2.5 text-sm text-slate"><Icon name="lock" className="h-4 w-4 shrink-0" />Only you (and your organisation&apos;s admins) see profit.</p>
            </section>
          </div>
          <div className="space-y-4">
            <section className="card p-5">
              <div className="flex items-center justify-between"><h2 className="font-ui text-lg font-bold text-ink">Expenses</h2><span className="font-ui font-bold text-ink">{naira(p.expensesKobo + p.commissionKobo)}</span></div>
              {p.byCategory.length ? <ul className="mt-3 space-y-3">{p.byCategory.map((c) => <li key={c.id}><div className="flex justify-between text-sm"><span className="text-ink">{c.label}</span><span className="font-semibold text-ink">{naira(c.kobo)}</span></div><div className="mt-1 h-2 rounded-full bg-field"><div className="h-2 rounded-full bg-crimson" style={{ width: `${Math.max(3, (c.kobo / catMax) * 100)}%` }} /></div></li>)}</ul> : <p className="mt-2 text-sm text-slate">No expenses recorded.</p>}
            </section>
            <section className="card p-5">
              <h2 className="font-ui text-lg font-bold text-ink">Best sellers by profit</h2>
              {p.best.length ? (
                <table className="mt-2 w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-slate"><th className="py-2 font-semibold">Item</th><th className="py-2 text-right font-semibold">Sold</th><th className="py-2 text-right font-semibold">Profit</th></tr></thead>
                  <tbody className="divide-y divide-rule">{[...p.best].sort((a, b) => b.profitKobo - a.profitKobo).slice(0, 6).map((b) => <tr key={b.key}><td className="py-2.5 text-ink">{b.title}</td><td className="py-2.5 text-right text-ink">{b.units}</td><td className="py-2.5 text-right font-semibold text-ink">{naira(b.profitKobo)}</td></tr>)}</tbody>
                </table>
              ) : <p className="mt-2 text-sm text-slate">Nothing sold in this {kind}.</p>}
            </section>
            <section className="rounded-xl2 border border-dashed border-rule p-5">
              <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Counted separately</p>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink">Sales recorded</dt><dd className="font-semibold text-ink">{v.separate.sales} · {naira(v.separate.salesKobo)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink">Expenses recorded</dt><dd className="font-semibold text-ink">{v.separate.expenses} · {naira(v.separate.expensesKobo)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink">Money owed to you (now)</dt><dd className="font-semibold text-ink">{naira(v.separate.owedKobo)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink">Stock you hold, at cost</dt><dd className="font-semibold text-ink">{v.separate.stockCounted ? naira(v.separate.stockKobo) : "not counted"}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-slate">Stock is what you own, not business you did, so it is never added to sales or profit.</p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
function Row({ k, v, sub, neg }: { k: React.ReactNode; v: React.ReactNode; sub?: boolean; neg?: boolean }) {
  return <div className={`flex justify-between gap-3 py-2.5 ${sub ? "pl-3 text-sm text-slate" : "text-ink"}`}><dt>{k}</dt><dd className={`tabular-nums ${neg ? "text-red-700" : ""}`}>{v}</dd></div>;
}
