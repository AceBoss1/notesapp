"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import type { Traction } from "@/lib/traction";
import { COMPLIANCE, STATUS_LABEL, type ComplianceStatus } from "@/lib/compliance";

const STATUS_STYLE: Record<ComplianceStatus, string> = {
  "not-required": "bg-emerald-100 text-emerald-900",
  "in-place": "bg-emerald-100 text-emerald-900",
  "in-progress": "bg-amber-100 text-amber-900",
  "to-do": "bg-crimson/10 text-crimson",
};

type Data = { traction: Traction; summary: string; csv: string };

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="card p-4">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-slate">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {note && <p className="mt-1 text-xs text-slate">{note}</p>}
    </div>
  );
}

// Platform-wide numbers for pitch decks and applications. Counts only; refreshes on load.
export default function AdminTractionPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((t) => fetch("/api/admin/traction", { headers: { Authorization: `Bearer ${t}` } }))
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't load");
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, [user]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const t = data?.traction;
  const k = (kobo: number) => formatNaira(kobo);

  function download() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data.csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `notesapp-traction-${data.traction.generatedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-4xl">Traction snapshot</h1>
      <p className="mt-2 text-sm text-slate">Live numbers for pitch decks and applications. Only counts and totals — nothing personal. Refunded payments are excluded from &ldquo;processed&rdquo;.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {!t ? (
        !error && <p className="mt-8 text-sm text-slate">Counting…</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => navigator.clipboard?.writeText(data!.summary).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} className="btn-primary !px-4 !py-2 text-xs">{copied ? "Copied ✓" : "Copy summary for a deck"}</button>
            <button onClick={download} className="btn-ghost !px-4 !py-2 text-xs">Download CSV</button>
          </div>
          <pre className="card mt-4 whitespace-pre-wrap p-4 font-body text-sm text-ink">{data!.summary}</pre>

          <h2 className="mt-10 font-display text-2xl">People</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Registered users" value={t.people.registered} note={`${t.people.newLast30Days.toLocaleString()} in the last 30 days`} />
            <Tile label="Publishers" value={t.people.publishers} />
            <Tile label="Sellers" value={t.people.sellers} note={`${t.people.itemsPhysical} physical · ${t.people.itemsDigital} digital items`} />
            <Tile label="Organisations" value={t.people.organisations} />
            <Tile label="Paid plans" value={t.people.paidPlans} />
            <Tile label="Gold-verified" value={t.people.goldBadges} />
          </div>

          <h2 className="mt-10 font-display text-2xl">Activity</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Store orders" value={t.activity.storeOrders} note={`${t.activity.storeOrdersDelivered} delivered`} />
            <Tile label="Digital sales" value={t.activity.digitalSales} />
            <Tile label="Sessions booked" value={t.activity.sessionsBooked} note={`${t.activity.sessionsCompleted} held`} />
            <Tile label="Merch pre-orders" value={t.activity.merchPreorders} />
            <Tile label="Boosts" value={t.activity.boosts} />
            <Tile label="Ad campaigns run" value={t.activity.adCampaigns} />
          </div>

          <h2 className="mt-10 font-display text-2xl">Money</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Total processed" value={k(t.money.processedKobo)} note={`${t.money.paidCount.toLocaleString()} paid transactions`} />
            <Tile label="Last 30 days" value={k(t.money.processedLast30DaysKobo)} />
            <Tile label="Paying customers" value={t.money.payingCustomers} />
            <Tile label="Paid out" value={k(t.money.payoutsKobo)} note={`${t.money.payoutsCount} payouts`} />
            <Tile label="Held in escrow" value={k(t.money.inEscrowKobo)} note={`${t.money.inEscrowCount} entries`} />
            <Tile label="Commission earned" value={k(t.money.commissionKobo)} note="on sessions, subscriptions, gifts, store" />
            <Tile label="Refunded" value={k(t.money.refundedKobo)} note={`${t.money.refundedCount} payments`} />
          </div>

          <h2 className="mt-10 font-display text-2xl">By type</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate"><tr><th className="py-1">Kind</th><th>Paid</th><th className="text-right">Processed</th></tr></thead>
            <tbody>{t.money.byKind.map((r) => <tr key={r.kind} className="border-t border-rule"><td className="py-1.5">{r.kind}</td><td>{r.count}</td><td className="text-right">{k(r.kobo)}</td></tr>)}</tbody>
          </table>

          <h2 className="mt-10 font-display text-2xl">Licences &amp; compliance</h2>
          <p className="mt-1 text-sm text-slate">What each regulated activity needs, on whose advice, and where it stands. It is part of the deck summary above. To change an entry, edit <code>lib/compliance.ts</code>.</p>
          <ul className="mt-3 space-y-3">
            {COMPLIANCE.map((c) => (
              <li key={c.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-ui font-bold text-ink">{c.area}</p>
                  <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                <p className="mt-1 text-slate">{c.question}</p>
                <p className="mt-1 text-ink"><strong>{c.position}</strong></p>
                <p className="mt-1 font-mono text-[11px] text-slate">Basis: {c.basis} · reviewed {c.reviewed}</p>
                {c.controls && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate">{c.controls.map((x) => <li key={x}>{x}</li>)}</ul>}
                {c.next && <p className="mt-2 text-xs text-ink"><strong>Next:</strong> {c.next}</p>}
              </li>
            ))}
          </ul>

          <h2 className="mt-10 font-display text-2xl">Last six months</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate"><tr><th className="py-1">Month</th><th>Signups</th><th className="text-right">Processed</th></tr></thead>
            <tbody>{t.months.map((m) => <tr key={m.month} className="border-t border-rule"><td className="py-1.5">{m.month}</td><td>{m.signups}</td><td className="text-right">{k(m.processedKobo)}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </section>
  );
}
