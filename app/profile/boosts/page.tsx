"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { formatNaira } from "@/lib/booking-time";

type Boost = {
  reference: string;
  title: string;
  slug?: string;
  itemId?: string;
  image?: string;
  amountKobo: number;
  impressionsPurchased: number;
  impressionsDelivered: number;
  clicks: number;
  maxPerDay?: number;
  daily?: Record<string, number>;
  startsAt: string;
  endsAt: string;
  status: string;
  refundedKobo?: number;
  createdAt: string;
};

const isLive = (b: Boost) => b.status === "active" && new Date(b.endsAt).getTime() > Date.now() && b.impressionsDelivered < b.impressionsPurchased;
const pct = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);
const ctr = (b: Boost) => (b.impressionsDelivered > 0 ? ((b.clicks / b.impressionsDelivered) * 100).toFixed(1) + "%" : "—");

function Daily({ daily }: { daily?: Record<string, number> }) {
  const rows = Object.entries(daily || {}).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-14);
  if (rows.length === 0) return <p className="mt-3 text-xs text-slate">No impressions counted yet.</p>;
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="mt-3">
      <div className="flex h-16 items-end gap-1" role="img" aria-label="Impressions per day">
        {rows.map(([d, n]) => (
          <div key={d} className="flex-1" title={`${d}: ${n} impressions`}>
            <div className="w-full rounded-t bg-crimson" style={{ height: `${Math.max(4, (n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <p className="mt-1 flex justify-between font-mono text-[10px] text-slate"><span>{rows[0][0]}</span><span>{rows[rows.length - 1][0]}</span></p>
    </div>
  );
}

export default function BoostPerformancePage() {
  const router = useRouter();
  const [boosts, setBoosts] = useState<Boost[] | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return router.replace("/login");
        getDocs(query(collection(db, "boosts"), where("publisherUid", "==", u.uid)))
          .then((s) => setBoosts(s.docs.map((d) => d.data() as Boost).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))))
          .catch(() => setBoosts([]));
      }),
    [router]
  );

  const totals = useMemo(() => {
    const list = boosts ?? [];
    const delivered = list.reduce((s, b) => s + b.impressionsDelivered, 0);
    const clicks = list.reduce((s, b) => s + b.clicks, 0);
    return {
      spent: list.reduce((s, b) => s + b.amountKobo - (b.refundedKobo || 0), 0),
      delivered,
      clicks,
      ctr: delivered ? ((clicks / delivered) * 100).toFixed(1) + "%" : "—",
      active: list.filter(isLive).length,
    };
  }, [boosts]);

  if (boosts === null) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const active = boosts.filter(isLive);
  const ended = boosts.filter((b) => !isLive(b));

  const row = (b: Boost) => {
    const live = isLive(b);
    const left = Math.max(0, Math.ceil((new Date(b.endsAt).getTime() - Date.now()) / 86_400_000));
    return (
      <li key={b.reference} className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-ui text-sm font-bold text-ink">{b.title}</p>
            <p className="font-mono text-[11px] text-slate">
              {formatNaira(b.amountKobo)} · started {b.startsAt.slice(0, 10)} ·{" "}
              {live ? `${left} day${left === 1 ? "" : "s"} left (ends ${b.endsAt.slice(0, 10)})` : `ended ${b.endsAt.slice(0, 10)}`}
            </p>
          </div>
          <span className={`rounded-full px-3 py-0.5 font-mono text-[11px] uppercase ${live ? "bg-green-100 text-green-800" : "bg-paper text-slate"}`}>
            {live ? "Active" : b.refundedKobo ? "Ended · refunded" : "Ended"}
          </span>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-paper">
          <div className="h-full bg-crimson" style={{ width: `${pct(b.impressionsDelivered, b.impressionsPurchased)}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <p><span className="block font-mono text-[10px] uppercase text-slate">Delivered</span>{b.impressionsDelivered.toLocaleString()} / {b.impressionsPurchased.toLocaleString()}</p>
          <p><span className="block font-mono text-[10px] uppercase text-slate">Clicks</span>{b.clicks.toLocaleString()}</p>
          <p><span className="block font-mono text-[10px] uppercase text-slate">Click rate</span>{ctr(b)}</p>
          <p><span className="block font-mono text-[10px] uppercase text-slate">Refunded</span>{b.refundedKobo ? formatNaira(b.refundedKobo) : "—"}</p>
        </div>
        <Daily daily={b.daily} />
        {b.itemId ? <Link href={`/shop/${b.itemId}`} className="mt-3 inline-block text-xs text-crimson underline">View item</Link> : b.slug && <Link href={`/journals/${b.slug}`} className="mt-3 inline-block text-xs text-crimson underline">View post</Link>}
      </li>
    );
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Boosts</p>
      <h1 className="mt-3 font-display text-4xl text-ink">Boost performance</h1>
      <p className="mt-2 text-sm text-slate">
        An impression counts once a real visitor has seen your boosted post. Undelivered impressions are refunded when a boost ends.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Active now", String(totals.active)],
          ["Impressions", totals.delivered.toLocaleString()],
          ["Clicks", `${totals.clicks.toLocaleString()} (${totals.ctr})`],
          ["Spent", formatNaira(totals.spent)],
        ].map(([k, v]) => (
          <div key={k} className="card p-4"><p className="eyebrow">{k}</p><p className="mt-2 font-display text-xl text-ink">{v}</p></div>
        ))}
      </div>

      {boosts.length === 0 ? (
        <p className="mt-10 text-sm text-slate">
          No boosts yet. <Link href="/boost" className="text-crimson underline">Boost a post</Link> to see its impressions and clicks here. A boost
          appears only after its payment is confirmed — if you just paid and nothing shows, reopen the confirmation link from your payment
          or contact us with the payment reference.
        </p>
      ) : (
        <>
          <h2 className="mt-10 font-ui text-sm font-bold text-ink">Active ({active.length})</h2>
          <ul className="mt-3 space-y-4">{active.length ? active.map(row) : <li className="text-sm text-slate">No active boosts.</li>}</ul>
          {ended.length > 0 && (
            <>
              <h2 className="mt-10 font-ui text-sm font-bold text-ink">Ended ({ended.length})</h2>
              <ul className="mt-3 space-y-4">{ended.map(row)}</ul>
            </>
          )}
        </>
      )}
      <p className="mt-10"><Link href="/boost" className="btn-primary">Boost another post</Link></p>
    </section>
  );
}
