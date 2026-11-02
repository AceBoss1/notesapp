"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { naira, type Entry, type Period, type PeriodKind } from "@/lib/books";
import { EntryList } from "./Home";
import { Icon, pill, type Api } from "./shared";

// Day / Week / Month, with the arrows to go back. Month is for Pro and above.
export function PeriodPicker({ kind, back, setKind, setBack, monthOk, label }: { kind: PeriodKind; back: number; setKind: (k: PeriodKind) => void; setBack: (n: number) => void; monthOk: boolean; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full bg-field p-1">
        {(["day", "week", "month"] as PeriodKind[]).map((k) => (
          <button key={k} onClick={() => { setKind(k); setBack(0); }} className={`rounded-full px-4 py-1.5 font-ui text-sm font-semibold ${kind === k ? "bg-card text-ink shadow-sm" : "text-slate"}`} title={k === "month" && !monthOk ? "The month comes with Pro" : undefined}>
            {k === "day" ? "Day" : k === "week" ? "Week" : "Month"}{k === "month" && !monthOk ? " · Pro" : ""}
          </button>
        ))}
      </div>
      <div className="inline-flex items-center gap-1">
        <button onClick={() => setBack(back + 1)} aria-label="Earlier" className="grid h-9 w-9 place-items-center rounded-full border border-rule text-ink">‹</button>
        <button onClick={() => setBack(Math.max(0, back - 1))} disabled={back === 0} aria-label="Later" className="grid h-9 w-9 place-items-center rounded-full border border-rule text-ink disabled:opacity-30">›</button>
      </div>
      {label && <span className="text-sm text-slate">{label}</span>}
    </div>
  );
}

// Sales (with refunds and online orders) or expenses for a day, a week or a month.
export function EntriesTab({ api, kind, monthOk, categories, onChanged, onAdd }: { api: Api; kind: "sale" | "expense"; monthOk: boolean; categories: { id: string; label: string }[]; onChanged: () => void; onAdd: () => void }) {
  const [period, setPeriod] = useState<PeriodKind>("day");
  const [back, setBack] = useState(0);
  const [data, setData] = useState<{ period: Period; entries: Entry[]; more: boolean } | null>(null);
  const [err, setErr] = useState("");
  // Who recorded it: the seller can see one person's entries (the owner, admins and staff; online orders are "order").
  const [by, setBy] = useState("");
  const [keepers, setKeepers] = useState<{ uid: string; name: string; role: string }[]>([]);
  useEffect(() => { api<{ keepers: { uid: string; name: string; role: string }[] }>("view=keepers").then((r) => setKeepers(r.keepers)).catch(() => setKeepers([])); }, [api]);
  const load = useCallback(() => {
    if (period === "month" && !monthOk) { setErr("The month's list comes with Pro. Free Basic has the day and the week."); setData(null); return; }
    setErr("");
    api<{ period: Period; entries: Entry[]; more: boolean }>(`view=entries&kind=${kind}&period=${period}&back=${back}${by ? `&by=${encodeURIComponent(by)}` : ""}`).then(setData).catch((e) => setErr(e.message));
  }, [api, kind, period, back, monthOk, by]);
  useEffect(load, [load]);
  const live = (data?.entries ?? []).filter((e) => !e.voidedAt);
  const total = live.reduce((n, e) => n + (e.kind === "refund" ? -e.totalKobo : e.totalKobo), 0);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">{kind === "sale" ? "Sales" : "Expenses"}</p><h1 className="mt-1 font-display text-4xl text-ink">{data?.period.label ?? (kind === "sale" ? "Sales" : "Expenses")}</h1></div>
        <button onClick={onAdd} className="btn-primary"><Icon name="plus" className="h-4 w-4" />{kind === "sale" ? "Record a sale" : "Add expense"}</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><PeriodPicker kind={period} back={back} setKind={setPeriod} setBack={setBack} monthOk={monthOk} />
        {keepers.length > 1 && (
          <select value={by} onChange={(e) => setBy(e.target.value)} aria-label="Recorded by" className="rounded-full border border-rule bg-card px-3 py-2 text-sm text-ink">
            <option value="">Everyone</option>
            {keepers.map((k) => <option key={k.uid} value={k.uid}>{k.name} ({k.role})</option>)}
            {kind === "sale" && <option value="order">Online orders</option>}
          </select>
        )}
      </div>
      {err && <p className="card mt-4 p-4 text-sm text-slate">{err} <Link href="/pricing" className="text-crimson underline">See Pro</Link></p>}
      {data && (
        <section className="card mt-4 p-5">
          <div className="flex items-center justify-between"><h2 className="font-ui text-lg font-bold text-ink">{live.length} {kind === "sale" ? (live.length === 1 ? "sale" : "sales") : live.length === 1 ? "expense" : "expenses"}</h2><span className="font-ui text-lg font-bold text-ink">{naira(total)}</span></div>
          {data.entries.length ? <EntryList entries={data.entries} api={api} categories={categories} onChanged={() => { load(); onChanged(); }} /> : <p className="mt-3 text-sm text-slate">Nothing recorded for this {period}.</p>}
          {data.more && <p className="mt-3 text-xs text-slate">Showing the latest 500. Export everything from Import and export.</p>}
        </section>
      )}
    </div>
  );
}

// Stock: what's running low, Books-only items (from a stock list import) and a way into Inventory. Stock value is shown on its own.
export function StockTab({ api, inventory }: { api: Api; inventory: boolean }) {
  const [items, setItems] = useState<{ ref: string; title: string; sku: string; stock: number | null; lowAt: number; costKobo: number; priceKobo: number; bookItemId?: string }[] | null>(null);
  useEffect(() => { api<{ items: NonNullable<typeof items> }>("view=catalog").then((r) => setItems(r.items)).catch(() => setItems([])); }, [api]);
  const value = (items ?? []).reduce((n, x) => n + (x.stock ?? 0) * x.costKobo, 0);
  return (
    <div>
      <p className="eyebrow">Stock</p><h1 className="mt-1 font-display text-4xl text-ink">What you have</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Walk-in sales lower stock through Inventory, the same way online orders do. Items from a stock list that aren&apos;t in your online store are kept here as Books-only items, never shown for sale online.</p>
      {!inventory && <p className="card mt-4 p-4 text-sm text-slate">Stock isn&apos;t counted yet: <Link href="/profile/inventory" className="font-semibold text-crimson">Inventory</Link> counts it (included on Business; an add-on with a free trial on Free Basic and Pro). You can still sell with prices from your store.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Items</p><p className="mt-1 font-ui text-2xl font-bold text-ink">{items?.length ?? "…"}</p></div>
        <div className="card p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Running low</p><p className="mt-1 font-ui text-2xl font-bold text-ink">{(items ?? []).filter((x) => x.stock !== null && x.stock <= x.lowAt).length}</p></div>
        <div className="rounded-xl2 border border-dashed border-rule p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Stock you hold, at cost</p><p className="mt-1 font-ui text-2xl font-bold text-ink">{inventory ? naira(value) : "—"}</p><p className="text-xs text-slate">What you own, not business you did. Never added to sales or profit.</p></div>
      </div>
      <ul className="card mt-4 divide-y divide-rule">
        {(items ?? []).map((x) => (
          <li key={x.ref} className="flex items-center justify-between gap-3 p-4">
            <span className="min-w-0"><span className="block font-ui font-semibold text-ink">{x.title}</span><span className="text-xs text-slate">{[x.sku, `price ${naira(x.priceKobo)}`, x.costKobo ? `cost ${naira(x.costKobo)}` : "no cost price", x.bookItemId ? "Books only" : "In your store"].filter(Boolean).join(" · ")}</span></span>
            <span className={`shrink-0 font-ui font-bold ${x.stock !== null && x.stock <= x.lowAt ? "text-red-700" : "text-ink"}`}>{x.stock === null ? "—" : `${x.stock} left`}</span>
          </li>
        ))}
        {items && !items.length && <li className="p-4 text-sm text-slate">No items yet. Add them to your store, or import a stock list.</li>}
      </ul>
      <Link href="/profile/inventory" className={`${pill} mt-4`}>Open Inventory</Link>
    </div>
  );
}
