"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PageHero from "@/components/PageHero";
import { formatNaira } from "@/lib/booking-time";
import { LOW_STOCK, RANGE_DAYS, SOURCE_LABEL, change, salesCsv, type Report } from "@/lib/analytics";

// Your analytics (lib/analytics.ts, docs/SITES.md phase 1): what you earned, orders and customers, best sellers and stock, bookings, visits and
// promotion, for 7 days on every plan, 30 and 90 days with customers and the download on Pro, and visits by page and source on Business.
type Account = { uid: string; username: string; name: string };
type Data = { report: Report; tier: string; ranges: number[]; accounts: Account[]; can: { customers: boolean; download: boolean; visits: boolean } };
const TABS = [["overview", "Overview"], ["sales", "Sales"], ["orders", "Orders"], ["products", "Products"], ["customers", "Customers"], ["visits", "Visits"], ["promotion", "Promotion"]] as const;
type Tab = (typeof TABS)[number][0];
const KIND: Record<string, string> = {
  order: "Store orders", digital: "Downloads", booking: "Sessions", subscription: "Subscriptions", gift: "Gifts", course: "Courses",
  certificate: "Certificates", adshare: "Ad share", shipping: "Deliveries",
};
const ORDER_STATUS: Record<string, string> = { paid: "Paid", dispatched: "On the way", delivered: "Delivered", confirmed: "Received", disputed: "Problem reported", refunded: "Refunded" };
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const n = (x: number) => x.toLocaleString("en-NG");

function Stat({ label, value, now, before, note }: { label: string; value: string; now?: number; before?: number; note?: string }) {
  const c = now !== undefined && before !== undefined ? change(now, before) : "";
  return (
    <div className="card p-4">
      <p className="text-xs text-slate">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
      {c && <p className={`mt-0.5 text-xs font-semibold ${c.startsWith("+") ? "text-green-700" : "text-crimson"}`}>{c} on the period before</p>}
      {note && <p className="mt-0.5 text-xs text-slate">{note}</p>}
    </div>
  );
}

// A plain line chart, one point a day. The line stretches to any width (phones too); the labels are ordinary text around it.
function Chart({ points, money }: { points: { day: string; v: number }[]; money: boolean }) {
  const w = 600, h = 160;
  const max = Math.max(1, ...points.map((p) => p.v));
  const x = (i: number) => (i * w) / Math.max(1, points.length - 1);
  const y = (v: number) => h - 4 - (v / max) * (h - 8);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const label = (v: number) => (money ? formatNaira(v) : n(v));
  const total = points.reduce((s, p) => s + p.v, 0);
  return (
    <div className="mt-3">
      <p className="text-xs text-slate">Highest day {label(max)} · total {label(total)}</p>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1 h-40 w-full border-b border-rule" role="img"
        aria-label={`From ${short(points[0]?.day ?? "")} to ${short(points[points.length - 1]?.day ?? "")}: highest day ${label(max)}, total ${label(total)}`}>
        <line x1={0} x2={w} y1={y(max / 2)} y2={y(max / 2)} className="stroke-rule" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        <path d={`${line} L${w},${h} L0,${h} Z`} className="fill-crimson/10" />
        <path d={line} fill="none" className="stroke-crimson" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate"><span>{short(points[0]?.day ?? "")}</span><span>{short(points[points.length - 1]?.day ?? "")}</span></div>
    </div>
  );
}

function Locked({ what, plan }: { what: string; plan: string }) {
  return (
    <div className="card border-dashed p-5 text-sm text-slate">
      <p><strong className="text-ink">{what}</strong> come{what.endsWith("s") ? "" : "s"} with {plan}.</p>
      <Link href="/pricing" className="mt-2 inline-block font-semibold text-crimson underline">See plans</Link>
    </div>
  );
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [days, setDays] = useState(7);
  const [as, setAs] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [metric, setMetric] = useState<"earned" | "orders" | "visits">("earned");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const load = useCallback(async (u: User) => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/analytics?days=${days}${as ? `&as=${encodeURIComponent(as)}` : ""}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load your analytics.");
      setData(j);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your analytics."); }
    finally { setBusy(false); }
  }, [days, as]);
  useEffect(() => { if (user) void load(user); }, [user, load]);

  const r = data?.report;
  const points = useMemo(() => (r?.series ?? []).map((s) => ({ day: s.day, v: metric === "earned" ? s.earnedKobo : metric === "orders" ? s.orders : s.visits })), [r, metric]);
  function download() {
    if (!r) return;
    const blob = new Blob([salesCsv(r)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `sales-${r.from}-to-${r.to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (user === null) return <section className="mx-auto max-w-5xl px-4 py-10"><p className="text-sm text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to see your analytics.</p></section>;
  return (
    <>
      <PageHero compact max="max-w-5xl" eyebrow="My account" title={<>Analytics</>}>
        <p>How you&apos;re doing, in one place: what you earned, your orders and customers, what sells, and who visits.</p>
      </PageHero>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          {(data?.accounts.length ?? 0) > 1 && (
            <label className="text-xs text-slate">Account
              <select value={as || data!.accounts[0].uid} onChange={(e) => setAs(e.target.value)} className="mt-1 block border border-rule bg-card px-3 py-2 text-sm">
                {data!.accounts.map((a) => <option key={a.uid} value={a.uid}>{a.name} (@{a.username})</option>)}
              </select>
            </label>
          )}
          <div className="flex rounded-full border border-rule bg-card p-1 text-xs font-semibold" role="group" aria-label="Period">
            {RANGE_DAYS.map((d) => {
              const open = !data || data.ranges.includes(d);
              return (
                <button key={d} type="button" disabled={!open || busy} onClick={() => setDays(d)} title={open ? undefined : "Comes with Pro"}
                  className={`rounded-full px-3 py-1.5 ${days === d ? "bg-crimson text-paper" : "text-ink"} disabled:opacity-50`}>
                  Last {d} days{open ? "" : " 🔒"}
                </button>
              );
            })}
          </div>
          {r && (data!.can.download
            ? <button type="button" onClick={download} className="ml-auto rounded-full border border-rule px-4 py-2 text-xs font-semibold text-ink">⬇ Download sales</button>
            : <span className="ml-auto text-xs text-slate">Download sales: <Link href="/pricing" className="text-crimson underline">Pro</Link></span>)}
        </div>
        {error && <p className="mt-4 text-sm text-crimson" role="alert">{error}</p>}
        {!r ? <p className="mt-8 text-sm text-slate">{busy || user === undefined ? "Loading…" : ""}</p> : (
          <>
            <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-rule text-sm" aria-label="Analytics">
              {TABS.map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-3 py-2 ${tab === id ? "border-crimson font-semibold text-ink" : "border-transparent text-slate"}`}>{label}</button>
              ))}
            </nav>
            <p className="mt-3 text-xs text-slate">{short(r.from)} to {short(r.to)}{busy ? " · updating…" : ""}</p>

            {tab === "overview" && (
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="You earned" value={formatNaira(r.totals.earnedKobo)} now={r.totals.earnedKobo} before={r.before.earnedKobo} note="After our fee, from everything you sell" />
                  <Stat label="Orders paid" value={n(r.totals.ordersPaid)} now={r.totals.ordersPaid} before={r.before.ordersPaid}
                    note={r.totals.checkouts ? `${Math.round((r.totals.ordersPaid / Math.max(r.totals.ordersPaid, r.totals.checkouts)) * 100)}% of ${n(Math.max(r.totals.ordersPaid, r.totals.checkouts))} checkouts started` : undefined} />
                  <Stat label="Average order" value={formatNaira(r.totals.avgOrderKobo)} now={r.totals.avgOrderKobo} before={r.before.avgOrderKobo} />
                  <Stat label="Visits" value={n(r.totals.visits)} now={r.totals.visits} before={r.before.visits} note="Your profile, site, journals, items and courses" />
                </div>
                <div className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-ui text-sm font-bold text-ink">{metric === "earned" ? "Earned" : metric === "orders" ? "Orders paid" : "Visits"}, day by day</p>
                    <div className="flex gap-1 text-xs">
                      {(["earned", "orders", "visits"] as const).map((m) => <button key={m} type="button" onClick={() => setMetric(m)} className={`rounded-full px-3 py-1 ${metric === m ? "bg-ink text-paper" : "border border-rule text-ink"}`}>{m === "earned" ? "Earned" : m === "orders" ? "Orders" : "Visits"}</button>)}
                    </div>
                  </div>
                  <Chart points={points} money={metric === "earned"} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="card p-4">
                    <p className="font-ui text-sm font-bold text-ink">Selling best</p>
                    {r.bestSellers.length ? <ul className="mt-2 space-y-1.5 text-sm">{r.bestSellers.map((b) => <li key={b.itemId} className="flex justify-between gap-3"><span className="truncate">{b.title}</span><span className="shrink-0 rounded-full bg-green-50 px-2 text-xs font-semibold text-green-800">{n(b.sold)} sold</span></li>)}</ul> : <p className="mt-2 text-sm text-slate">No store sales in this period.</p>}
                  </div>
                  <div className="card p-4">
                    <p className="font-ui text-sm font-bold text-ink">Running low</p>
                    <p className="text-xs text-slate">{LOW_STOCK} or fewer left: restock before they sell out.</p>
                    {r.lowStock.length ? <ul className="mt-2 space-y-1.5 text-sm">{r.lowStock.map((i) => <li key={i.itemId} className="flex justify-between gap-3"><Link href={`/shop/${i.itemId}`} className="truncate hover:text-crimson">{i.title}</Link><span className={`shrink-0 text-xs font-semibold ${i.stock ? "text-amber-700" : "text-crimson"}`}>{i.stock ? `${i.stock} left` : "Sold out"}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate">Nothing running low.</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === "sales" && (
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="You earned" value={formatNaira(r.totals.earnedKobo)} now={r.totals.earnedKobo} before={r.before.earnedKobo} />
                  <Stat label="Store sales" value={formatNaira(r.totals.salesKobo)} now={r.totals.salesKobo} before={r.before.salesKobo} note="What buyers paid, with delivery" />
                  <Stat label="Sessions booked" value={n(r.totals.bookings)} now={r.totals.bookings} before={r.before.bookings} />
                  <Stat label="Refunded" value={formatNaira(r.totals.refundedKobo)} />
                </div>
                <div className="card p-4">
                  <p className="font-ui text-sm font-bold text-ink">Where your earnings came from</p>
                  {r.byKind.length ? <ul className="mt-2 divide-y divide-rule text-sm">{r.byKind.map((k) => <li key={k.kind} className="flex justify-between py-2"><span>{KIND[k.kind] ?? k.kind}</span><b>{formatNaira(k.netKobo)}</b></li>)}</ul> : <p className="mt-2 text-sm text-slate">Nothing earned in this period yet.</p>}
                  <p className="mt-2 text-xs text-slate">After our fee. When each is paid to your bank is on <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>.</p>
                </div>
              </div>
            )}

            {tab === "orders" && (
              <div className="card mt-3 overflow-x-auto p-0">
                {r.orders.length ? (
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs text-slate"><tr><th className="p-3">Paid</th><th className="p-3">Item</th><th className="p-3">Qty</th><th className="p-3">Paid in total</th><th className="p-3">Buyer</th><th className="p-3">Status</th></tr></thead>
                    <tbody className="divide-y divide-rule">{r.orders.map((o) => <tr key={o.id}><td className="p-3">{when(o.paidAt)}</td><td className="p-3">{o.itemTitle}</td><td className="p-3">{o.quantity}</td><td className="p-3">{formatNaira(o.amountKobo)}</td><td className="p-3">{o.name}<span className="block text-xs text-slate">{[o.city, o.state].filter(Boolean).join(", ")}</span></td><td className="p-3">{ORDER_STATUS[o.status] ?? o.status}</td></tr>)}</tbody>
                  </table>
                ) : <p className="p-4 text-sm text-slate">No orders in this period. <Link href="/orders" className="text-crimson underline">All your orders</Link></p>}
              </div>
            )}

            {tab === "products" && (
              <div className="card mt-3 overflow-x-auto p-0">
                {r.items.length ? (
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs text-slate"><tr><th className="p-3">Item</th><th className="p-3">Views (all time)</th><th className="p-3">Sold</th><th className="p-3">Sales</th><th className="p-3">In stock</th></tr></thead>
                    <tbody className="divide-y divide-rule">{r.items.map((i) => <tr key={i.itemId}><td className="p-3"><Link href={`/shop/${i.itemId}`} className="hover:text-crimson">{i.title}</Link></td><td className="p-3">{n(i.views)}</td><td className="p-3">{n(i.sold)}</td><td className="p-3">{formatNaira(i.salesKobo)}</td><td className="p-3">{i.kind === "digital" ? "Download" : n(i.stock)}</td></tr>)}</tbody>
                  </table>
                ) : <p className="p-4 text-sm text-slate">No store items yet. <Link href="/shop" className="text-crimson underline">Your store</Link></p>}
              </div>
            )}

            {tab === "customers" && (
              <div className="mt-3">
                {!r.customers ? <Locked what="Your customers" plan="Pro and above" /> : r.customers.length ? (
                  <div className="card overflow-x-auto p-0">
                    <p className="p-3 text-xs text-slate">Everyone who has bought from you, most valuable first. Their details are for running your orders only.</p>
                    {/* Phones: one card per customer; wider screens: the table. */}
                    <ul className="divide-y divide-rule sm:hidden">{r.customers.map((c) => (
                      <li key={c.key} className="flex items-start justify-between gap-3 p-3 text-sm">
                        <span className="min-w-0"><b className="block truncate text-ink">{c.name || c.email || "—"}</b><span className="block text-xs text-slate">{n(c.orders)} order{c.orders === 1 ? "" : "s"} · last {when(c.lastAt)}</span><span className="block truncate text-xs text-slate">{[c.phone, c.place].filter(Boolean).join(" · ")}</span></span>
                        <b className="shrink-0 text-ink">{formatNaira(c.spentKobo)}</b>
                      </li>
                    ))}</ul>
                    <table className="hidden w-full min-w-[640px] text-left text-sm sm:table">
                      <thead className="text-xs text-slate"><tr><th className="p-3">Customer</th><th className="p-3">Orders</th><th className="p-3">Spent</th><th className="p-3">Last order</th><th className="p-3">Contact</th></tr></thead>
                      <tbody className="divide-y divide-rule">{r.customers.map((c) => <tr key={c.key}><td className="p-3">{c.name || "—"}<span className="block text-xs text-slate">{c.place}</span></td><td className="p-3">{n(c.orders)}</td><td className="p-3">{formatNaira(c.spentKobo)}</td><td className="p-3">{when(c.lastAt)}</td><td className="p-3 text-xs">{c.phone}<span className="block text-slate">{c.email}</span></td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <p className="card p-4 text-sm text-slate">No customers yet.</p>}
              </div>
            )}

            {tab === "visits" && (
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="Visits" value={n(r.totals.visits)} now={r.totals.visits} before={r.before.visits} />
                </div>
                {!r.pages || !r.sources ? <Locked what="Visits by page and where visitors came from" plan="Business and Enterprise" /> : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="card p-4">
                      <p className="font-ui text-sm font-bold text-ink">Visits by page</p>
                      {r.pages.length ? <ul className="mt-2 divide-y divide-rule text-sm">{r.pages.map((p) => <li key={p.key} className="flex justify-between gap-3 py-1.5"><span className="truncate">{p.label}</span><b>{n(p.visits)}</b></li>)}</ul> : <p className="mt-2 text-sm text-slate">No visits counted yet.</p>}
                    </div>
                    <div className="card p-4">
                      <p className="font-ui text-sm font-bold text-ink">Where visitors came from</p>
                      {r.sources.length ? <ul className="mt-2 divide-y divide-rule text-sm">{r.sources.map((s) => <li key={s.source} className="flex justify-between gap-3 py-1.5"><span>{SOURCE_LABEL[s.source]}</span><b>{n(s.visits)}</b></li>)}</ul> : <p className="mt-2 text-sm text-slate">No visits counted yet.</p>}
                      <p className="mt-2 text-xs text-slate">Add <code>?utm_source=whatsapp</code> (or instagram, facebook…) to links you share, so visits from apps that hide where they came from are counted right.</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate">Visits are counted once per visitor per page every 30 minutes (store items and courses once a day), not counting your own, and only from the day analytics started.</p>
              </div>
            )}

            {tab === "promotion" && (
              <div className="mt-3">
                {r.promos.length ? (
                  <div className="card overflow-x-auto p-0">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs text-slate"><tr><th className="p-3">Boost or advert</th><th className="p-3">Spent</th><th className="p-3">Seen</th><th className="p-3">Clicks</th><th className="p-3">Status</th></tr></thead>
                      <tbody className="divide-y divide-rule">{r.promos.map((p) => <tr key={p.id}><td className="p-3">{p.type === "boost" ? "🚀 " : "📣 "}{p.label}</td><td className="p-3">{formatNaira(p.spentKobo)}</td><td className="p-3">{n(p.impressions)}</td><td className="p-3">{n(p.clicks)}</td><td className="p-3 capitalize">{p.status.replace(/_/g, " ")}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <p className="card p-4 text-sm text-slate">No boosts or adverts yet. <Link href="/boost" className="text-crimson underline">Boost a post or item</Link> or <Link href="/advertise" className="text-crimson underline">advertise</Link>.</p>}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
