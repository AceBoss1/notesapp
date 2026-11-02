"use client";

import { useState } from "react";
import Link from "next/link";
import { categoryLabel, longDate, naira, shortDate, whatOf, type Cash, type CapState, type Entry, type Pnl } from "@/lib/books";
import { Badge, Icon, entryBadge, timeOf, pill, type Api } from "./shared";
import { SavedSale } from "./RecordSale";
import { OutboxPanel } from "./outbox";

export type HomeData = {
  today: string; shop: { name: string; username: string; tier: string }; access: { ok: true; unlimited: boolean; monthPnl: boolean; importRows: number };
  cap: CapState; caps: { freeEntries: number; freeCustomers: number }; inventory: boolean; pnl: Pnl; change: number | null; cash: Cash;
  owed: { totalKobo: number; overdueKobo: number; people: number }; entries: Entry[]; low: { ref: string; title: string; stock: number; lowAt: number }[];
  best: Pnl["best"]; noCostItems: number; youOwe: { id: string; name: string; balanceKobo: number; dueOn?: string }[];
  categories: { id: string; label: string }[]; floatKobo: number; accounts: { uid: string; name: string }[]; owner: string;
};

const greeting = () => { const h = (new Date().getUTCHours() + 1) % 24; return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const firstWord = (s: string) => s.split(/\s+/)[0].replace(/['’]s$/i, "");

// Books home (Today): profit so far in the crimson card, sales, expenses, cash in hand and money owed, the day's entries, what's running
// low, who you owe and the week's best sellers. Stock value is never added to any of these.
export default function Home({ data, api, onSale, onExpense, onNana, onChanged, go }: { data: HomeData; api: Api; onSale: () => void; onExpense: () => void; onNana: () => void; onChanged: () => void; go: (tab: string) => void }) {
  const p = data.pnl;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Business books · {longDate(data.today)}</p>
          <h1 className="mt-1 font-display text-4xl text-ink sm:text-[2.6rem]">{greeting()}, {firstWord(data.shop.name)}</h1>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <button onClick={onNana} className={pill}><Icon name="sparkle" className="h-4 w-4" />Tell Nana</button>
          <button onClick={onExpense} className={pill}><Icon name="card" className="h-4 w-4" />Add expense</button>
          <button onClick={onSale} className="btn-primary !px-6 !py-3.5"><Icon name="plus" className="h-4 w-4" />Record a sale</button>
        </div>
      </div>

      {!data.cap.unlimited && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${data.cap.full ? "bg-red-50 text-red-700" : "bg-field text-slate"}`}>
          {data.cap.full ? <>This month&apos;s {data.cap.limit} sales and expenses are used, so new ones wait for the 1st. Online orders still come in.</> : <>{data.cap.used} of {data.cap.limit} sales and expenses this month on Free Basic. Online orders don&apos;t count.</>}
          {" "}<Link href="/pricing" className="font-semibold text-crimson underline">Pro has no limit</Link>
        </p>
      )}

      <section className="mt-5 rounded-3xl bg-crimson p-6 text-paper sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/80">Profit today so far</p>
          {data.change !== null && <span className="rounded-full bg-paper/15 px-3 py-1 text-xs font-semibold text-paper">{data.change >= 0 ? "▲" : "▼"} {Math.abs(data.change)}% on last {new Date(`${data.today}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}</span>}
        </div>
        <p className="mt-3 font-ui text-5xl font-extrabold tracking-tight text-paper">{naira(p.netKobo)}</p>
        <p className="mt-3 text-[15px] text-paper/85">{naira(p.salesKobo - p.refundsKobo)} sales − {naira(p.costKobo)} cost of what you sold − {naira(p.expensesKobo + p.commissionKobo)} expenses</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TileBox label="Sales" value={naira(p.salesKobo)} sub={`${p.sales} ${p.sales === 1 ? "sale" : "sales"}${p.onlineSales ? ` · ${p.onlineSales} from your online store` : ""}`} />
        <TileBox label="Expenses" value={naira(p.expensesKobo + p.commissionKobo)} sub={p.byCategory.slice(0, 3).map((c) => c.label.split(" (")[0]).join(", ") || "None yet"} />
        <TileBox label="Cash in hand" value={naira(data.cash.drawerKobo)} sub={`In the drawer${data.cash.transferKobo ? ` · ${naira(data.cash.transferKobo)} came by transfer` : ""}${data.cash.posKobo ? ` · ${naira(data.cash.posKobo)} by POS` : ""}`} />
        <button onClick={() => go("owed")} className="text-left"><TileBox label="Owed to you" value={naira(data.owed.totalKobo)} sub={<>{data.owed.overdueKobo ? <span className="font-semibold text-red-700">{naira(data.owed.overdueKobo)} overdue · </span> : null}{data.owed.people} {data.owed.people === 1 ? "person" : "people"}</>} /></button>
      </div>

      <div className="mt-4 space-y-3 lg:hidden">
        <button onClick={onSale} className="btn-primary w-full !py-4 !text-base shadow-lg shadow-crimson/20"><Icon name="plus" className="h-5 w-5" />Record a sale</button>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onExpense} className={`${pill} w-full !py-3`}><Icon name="card" className="h-4 w-4" />Add expense</button>
          <button onClick={onNana} className={`${pill} w-full !py-3`}><Icon name="sparkle" className="h-4 w-4" />Tell Nana</button>
        </div>
      </div>
      <OutboxPanel />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-ui text-lg font-bold text-ink">Today&apos;s entries</h2><button onClick={() => go("sales")} className="text-sm font-semibold text-crimson">See all {data.entries.length}</button></div>
          {data.entries.length ? <EntryList entries={data.entries.slice(0, 8)} api={api} categories={data.categories} onChanged={onChanged} /> : <p className="mt-3 text-sm text-slate">Nothing yet today. Record a sale or add an expense, and paid online orders come in by themselves.</p>}
        </section>
        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between"><h2 className="font-ui text-lg font-bold text-ink">Running low</h2>{data.low.length > 0 && <Badge tone="late">{data.low.length} {data.low.length === 1 ? "item" : "items"}</Badge>}</div>
            {!data.inventory ? <p className="mt-2 text-sm text-slate">Stock isn&apos;t counted yet. <Link href="/profile/inventory" className="text-crimson underline">Inventory</Link> counts it, with alerts.</p> : data.low.length ? (
              <ul className="mt-2 divide-y divide-rule">
                {data.low.map((x) => <li key={x.ref} className="flex items-center justify-between py-2.5"><span><span className="block font-ui font-semibold text-ink">{x.title}</span><span className="text-xs text-slate">Alert at {x.lowAt}</span></span><span className={`font-ui font-bold ${x.stock <= 0 ? "text-red-700" : "text-amber-700"}`}>{x.stock <= 0 ? "Sold out" : `${x.stock} left`}</span></li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-slate">Nothing is running low.</p>}
            {data.inventory && <Link href="/profile/inventory" className={`${pill} mt-3 w-full`}>Record a purchase (restock)</Link>}
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between"><h2 className="font-ui text-lg font-bold text-ink">You owe</h2><span className="font-ui font-bold text-ink">{naira(data.youOwe.reduce((n, x) => n + x.balanceKobo, 0))}</span></div>
            {data.youOwe.length ? <ul className="mt-2 space-y-2">{data.youOwe.slice(0, 4).map((x) => <li key={x.id} className="flex justify-between text-sm"><span className="text-ink">{x.name}</span><span className="text-slate">{x.dueOn ? `due ${shortDate(x.dueOn)}` : naira(x.balanceKobo)}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate">No suppliers to pay. <button onClick={() => go("owed")} className="text-crimson underline">Add one</button></p>}
          </section>
          <section className="card p-5">
            <h2 className="font-ui text-lg font-bold text-ink">Best sellers this week</h2>
            {data.best.length ? <ul className="mt-3 space-y-3">{data.best.map((b) => (
              <li key={b.key}><div className="flex justify-between text-sm"><span className="text-ink">{b.title}</span><span className="font-bold text-ink">{b.units}</span></div><div className="mt-1 h-2 rounded-full bg-field"><div className="h-2 rounded-full bg-crimson" style={{ width: `${Math.max(4, (b.units / data.best[0].units) * 100)}%` }} /></div></li>
            ))}</ul> : <p className="mt-2 text-sm text-slate">Your best sellers show here once you&apos;ve sold a few things.</p>}
          </section>
        </div>
      </div>
      <p className="mt-5 text-sm text-slate">Profit uses the cost price on each item in Inventory.{data.noCostItems > 0 && <> {data.noCostItems} {data.noCostItems === 1 ? "item has" : "items have"} no cost price yet, so profit may be a little high. <Link href="/profile/inventory" className="font-semibold text-crimson">Add cost prices</Link></>}</p>
    </div>
  );
}
function TileBox({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return <div className="card h-full p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">{label}</p><p className="mt-1.5 font-ui text-2xl font-bold text-ink">{value}</p><p className="mt-1 text-[13px] leading-snug text-slate">{sub}</p></div>;
}

// A list of entries; tap one for its details: the receipt (for a sale), receipt photos (for an expense), and void.
export function EntryList({ entries, api, categories, onChanged }: { entries: Entry[]; api: Api; categories: { id: string; label: string }[]; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="mt-2 divide-y divide-rule">
      {entries.map((e) => {
        const title = e.kind === "expense" ? e.note || categoryLabel(e.category, categories) : e.kind === "payment" ? `${e.partyName} paid back` : e.kind === "opening" ? `${e.partyName}: opening balance` : whatOf(e.lines);
        const sub = [timeOf(e.at), e.kind === "expense" ? `Expense · ${categoryLabel(e.category, categories)}${e.files?.length ? " · receipt photo" : ""}` : e.source === "online" ? `Online order ${e.orderRef ? `#${e.orderRef}` : ""}` : e.source === "import" ? "Imported" : e.partyName ? `${e.partyName}${e.owesKobo ? " · on credit" : ""}` : "Walk-in"].join(" · ");
        const out = e.kind === "expense" || e.kind === "refund";
        return (
          <li key={e.id}>
            <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-start justify-between gap-3 py-3 text-left">
              <span className="min-w-0"><span className={`block font-ui font-semibold text-ink ${e.voidedAt ? "line-through opacity-60" : ""}`}>{title}</span><span className="block text-[13px] text-slate">{sub}</span></span>
              <span className="shrink-0 text-right"><span className={`block font-ui font-bold ${out ? "text-red-700" : "text-ink"}`}>{out ? "−" : ""}{naira(e.totalKobo)}</span><span className="mt-1 block">{entryBadge(e)}</span></span>
            </button>
            {open === e.id && <EntryDetail e={e} api={api} onChanged={onChanged} />}
          </li>
        );
      })}
    </ul>
  );
}
function EntryDetail({ e, api, onChanged }: { e: Entry; api: Api; onChanged: () => void }) {
  const [msg, setMsg] = useState("");
  const [receipt, setReceipt] = useState(false);
  const voidIt = async () => {
    const why = window.prompt("Why void this entry? (for example: entered twice)");
    if (!why) return;
    try { await api("", { action: "void", id: e.id, reason: why }); onChanged(); } catch (x) { setMsg((x as Error).message); }
  };
  const photo = async (i: number) => { try { const r = await api<{ url: string }>(`photo=${e.id}&i=${i}`); window.open(r.url, "_blank", "noopener"); } catch (x) { setMsg((x as Error).message); } };
  return (
    <div className="mb-3 rounded-2xl bg-field p-3 text-sm">
      {e.lines.length > 0 && <ul className="space-y-1">{e.lines.map((l, i) => <li key={i} className="flex justify-between gap-2"><span className="text-ink">{l.title} × {l.qty}</span><span className="text-slate">{naira(l.qty * l.unitKobo)}</span></li>)}</ul>}
      {e.voidedAt && <p className="mt-2 text-slate">Voided: {e.voidReason}</p>}
      {e.dueOn && !e.voidedAt && <p className="mt-2 text-slate">Due {shortDate(e.dueOn)}</p>}
      {(e.files ?? []).length > 0 && <div className="mt-2 flex flex-wrap gap-2">{e.files!.map((f, i) => <button key={i} onClick={() => photo(i)} className="rounded-full border border-rule bg-card px-3 py-1 text-xs font-semibold text-ink">Receipt photo {i + 1}</button>)}</div>}
      {!e.voidedAt && (
        <div className="mt-3 flex flex-wrap gap-2">
          {e.kind === "sale" && e.receiptCode && <button onClick={() => setReceipt(true)} className="rounded-full border border-rule bg-card px-3 py-1 text-xs font-semibold text-ink">Receipt</button>}
          {e.source !== "online" && e.kind !== "opening" && <button onClick={voidIt} className="rounded-full border border-rule bg-card px-3 py-1 text-xs font-semibold text-red-700">Void</button>}
        </div>
      )}
      {receipt && e.receiptCode && <div className="mt-3 rounded-2xl bg-card p-3"><SavedSale api={api} saved={{ entry: { id: e.id, totalKobo: e.totalKobo, owesKobo: e.owesKobo - (e.settledKobo || 0), partyName: e.partyName }, receiptUrl: `${window.location.origin}/receipt/${e.receiptCode}`, hasPhone: false, member: false }} onClose={() => setReceipt(false)} /></div>}
      {msg && <p className="mt-2 text-red-700">{msg}</p>}
    </div>
  );
}
