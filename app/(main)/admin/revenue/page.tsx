"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import { STREAMS, StreamId, RevenueReport } from "@/lib/revenue";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
  { days: 0, label: "All time" },
];

export default function AdminRevenuePage() {
  const { user, loading } = useAdminAuth();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [asOf, setAsOf] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setReport(null);
    setError("");
    user.getIdToken().then((t) =>
      fetch(`/api/admin/revenue?days=${days}`, { headers: { Authorization: `Bearer ${t}` } })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || "Failed");
          setReport(j.report);
          setAsOf(j.asOf);
        })
        .catch((e) => setError(e.message))
    );
  }, [user, days]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;

  const max = Math.max(1, ...(report?.series.map((s) => s.revenueKobo) ?? [1]));
  const ids = Object.keys(STREAMS) as StreamId[];
  const card = "card p-5";

  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-4xl">Revenue</h1>
      <p className="mt-2 text-sm text-slate">
        Platform revenue across every stream. Commission streams count only the commission; boosts, plans, badges, gold, merch and ads
        count in full. Paystack fees are paid by customers (not deducted); merch is before cost of goods.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-full border px-4 py-1.5 text-xs ${days === r.days ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-crimson">{error}</p>}
      {!report && !error && <p className="mt-8 text-sm text-slate">Loading…</p>}

      {report && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className={card}><p className="eyebrow">Platform revenue</p><p className="mt-2 font-display text-2xl text-ink">{formatNaira(report.totals.revenueKobo)}</p></div>
            <div className={card}><p className="eyebrow">Money processed</p><p className="mt-2 font-display text-2xl text-ink">{formatNaira(report.totals.grossKobo)}</p></div>
            <div className={card}><p className="eyebrow">Payments</p><p className="mt-2 font-display text-2xl text-ink">{report.totals.count.toLocaleString()}</p></div>
            <div className={card}><p className="eyebrow">Refunded</p><p className="mt-2 font-display text-2xl text-ink">{formatNaira(report.totals.refundedKobo)}</p><p className="text-xs text-slate">{report.totals.refundedCount} payment(s)</p></div>
          </div>

          <div className="card mt-8 overflow-x-auto p-5">
            <p className="font-ui text-sm font-bold text-ink">By stream</p>
            <table className="mt-3 w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs text-slate">
                  <th className="py-2 pr-4 font-normal">Stream</th>
                  <th className="px-2 font-normal">Payments</th>
                  <th className="px-2 font-normal">Processed</th>
                  <th className="px-2 font-normal">Revenue</th>
                  <th className="pl-2 font-normal">Share</th>
                </tr>
              </thead>
              <tbody>
                {ids.map((id) => {
                  const s = report.streams[id];
                  const share = report.totals.revenueKobo ? Math.round((s.revenueKobo / report.totals.revenueKobo) * 100) : 0;
                  return (
                    <tr key={id} className="border-t border-rule">
                      <td className="py-2 pr-4 text-ink">
                        {STREAMS[id].label}
                        {!STREAMS[id].live && <span className="ml-2 font-mono text-[10px] uppercase text-slate">not live yet</span>}
                        {STREAMS[id].model === "commission" && <span className="ml-2 font-mono text-[10px] uppercase text-slate">commission</span>}
                      </td>
                      <td className="px-2 text-slate">{s.count}</td>
                      <td className="px-2 text-slate">{formatNaira(s.grossKobo)}</td>
                      <td className="px-2 font-semibold text-ink">{formatNaira(s.revenueKobo)}</td>
                      <td className="pl-2 text-slate">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card mt-8 p-5">
            <p className="font-ui text-sm font-bold text-ink">Revenue by {report.seriesUnit}</p>
            {report.series.length === 0 ? (
              <p className="mt-3 text-sm text-slate">No revenue in this period.</p>
            ) : (
              <>
                <p className="mt-3 font-mono text-[10px] text-slate">Tallest bar: {formatNaira(max)}</p>
                {/* Each column is as tall as the chart (h-full) so the bar's percentage height has something to measure against. */}
                <div className="mt-2 flex h-40 items-end gap-1 overflow-x-auto border-b border-rule" role="img" aria-label="Revenue chart">
                  {report.series.map((s) => (
                    <div key={s.key} className="flex h-full min-w-[10px] max-w-[56px] flex-1 flex-col justify-end" title={`${s.key}: ${formatNaira(s.revenueKobo)}`}>
                      <div className="w-full rounded-t bg-crimson" style={{ height: `${Math.max(2, (s.revenueKobo / max) * 100)}%` }} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {report.series.length > 0 && (
              <p className="mt-2 flex justify-between font-mono text-[10px] text-slate">
                <span>{report.series[0].key}</span>
                <span>{report.series[report.series.length - 1].key}</span>
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate">Updated {asOf ? new Date(asOf).toLocaleTimeString("en-NG") : ""} · refreshed every ~2 minutes.</p>
        </>
      )}
    </section>
  );
}
