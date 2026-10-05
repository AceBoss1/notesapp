"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import { AD_FOOTER } from "@/lib/ads";
import { AD_SHARE_HOLD_DAYS, AD_SHARE_MIN_KOBO, AdRevenueEntry, AdShareStatement, monthLabel } from "@/lib/ad-share";

type Data = { entries: AdRevenueEntry[]; totalImpressions: number; revenueKobo: number; rpmKobo: number; statements: AdShareStatement[] };

const lastMonth = () => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const btn = "rounded-full border border-rule px-3 py-1 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40";

export default function AdminAdSharePage() {
  const { user, loading } = useAdminAuth();
  const [month, setMonth] = useState(lastMonth());
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [rev, setRev] = useState({ source: "notesapp", label: "", amountNaira: "", note: "" });

  const call = useCallback(
    async (method: "GET" | "POST", body?: Record<string, unknown>) => {
      const token = await user!.getIdToken();
      const res = await fetch(method === "GET" ? `/api/admin/ad-share?month=${month}` : "/api/admin/ad-share", {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    [user, month]
  );

  const load = useCallback(async () => {
    setData(null);
    try {
      setData(await call("GET"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [call]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function act(body: Record<string, unknown>, doneMsg?: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await call("POST", body);
      if (doneMsg) setInfo(doneMsg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const pending = data?.statements.filter((s) => s.status === "pending_review") ?? [];
  const owed = data?.statements.filter((s) => ["pending_review", "approved", "rolled_over", "paid"].includes(s.status)).reduce((n, s) => n + s.shareKobo, 0) ?? 0;

  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-4xl">Ad share</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        Each month: record the ad revenue you actually received, compute statements (revenue ÷ all valid impressions = revenue per impression, then each
        opted-in paid publisher earns impressions on their pages × that rate × their plan&apos;s share), review the flags, approve. Approved amounts go
        to the payout ledger and are held {AD_SHARE_HOLD_DAYS} days before release in Payments. Under {formatNaira(AD_SHARE_MIN_KOBO)} rolls over.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="text-xs text-slate">Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
        </label>
        {data && (
          <p className="pb-2 text-sm text-ink">
            {monthLabel(month)}: {formatNaira(data.revenueKobo)} received · {data.totalImpressions.toLocaleString()} valid impressions
            {data.totalImpressions ? ` · ₦${(data.rpmKobo / 100 * 1000).toFixed(2)} per 1,000` : ""}
          </p>
        )}
      </div>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {info && <p className="mt-4 text-sm text-green-700">{info}</p>}

      <div className="card mt-8 p-5">
        <p className="font-ui text-sm font-bold text-ink">1 · Ad revenue received for {monthLabel(month)}</p>
        {data && data.entries.length > 0 && (
          <ul className="mt-3 divide-y divide-rule text-sm">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-ink">{e.label} <span className="text-xs text-slate">· {AD_FOOTER[e.source]}{e.note ? ` · ${e.note}` : ""}</span></span>
                <span className="flex items-center gap-3"><strong>{formatNaira(e.amountKobo)}</strong>
                  <button className="text-xs text-slate underline" disabled={busy} onClick={() => act({ action: "delete_revenue", id: e.id }, undefined, "Remove this revenue entry?")}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-[150px,1fr,140px,auto] sm:items-end">
          <label className="text-xs text-slate">Source
            <select value={rev.source} onChange={(e) => setRev({ ...rev, source: e.target.value })} className={field}>
              <option value="notesapp">NotesApp Ads (house)</option>
              <option value="google">Google Ads</option>
              <option value="meta">Meta Ads</option>
              <option value="admob">AdMob</option>
            </select>
          </label>
          <label className="text-xs text-slate">Advertiser / network & campaign
            <input value={rev.label} onChange={(e) => setRev({ ...rev, label: e.target.value })} className={field} maxLength={120} />
          </label>
          <label className="text-xs text-slate">Amount received (₦)
            <input type="number" min={1} value={rev.amountNaira} onChange={(e) => setRev({ ...rev, amountNaira: e.target.value })} className={field} />
          </label>
          <button
            disabled={busy || !rev.label.trim() || !rev.amountNaira}
            onClick={() => act({ action: "add_revenue", month, ...rev }, "Revenue recorded.").then(() => setRev({ ...rev, label: "", amountNaira: "", note: "" }))}
            className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50"
          >Add</button>
        </div>
        <p className="mt-2 text-[11px] text-slate">Record money that has actually arrived (bank transfer from an advertiser, a network payout). Nothing collects ad money automatically yet.</p>
      </div>

      <div className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-ui text-sm font-bold text-ink">2 · Statements</p>
          <div className="flex gap-2">
            <button className={btn} disabled={busy} onClick={() => act({ action: "compute", month }, "Statements computed.", `Compute statements for ${monthLabel(month)}? Pending ones are recalculated; decided ones stay locked.`)}>Compute statements</button>
            <button className={btn} disabled={busy || pending.every((s) => s.flags.length)} onClick={() => act({ action: "approve_unflagged", month }, "Unflagged statements approved.", "Approve every pending statement with no fraud flags?")}>Approve all unflagged</button>
          </div>
        </div>
        {data && data.statements.length === 0 ? (
          <p className="mt-3 text-sm text-slate">No statements yet for this month.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="text-xs text-slate"><th className="py-1 pr-3 font-normal">Publisher</th><th className="font-normal">Views</th><th className="font-normal">Clicks</th><th className="font-normal">Gross</th><th className="font-normal">Share</th><th className="font-normal">Status</th><th className="font-normal">Flags</th><th /></tr></thead>
              <tbody>
                {data?.statements.map((s) => (
                  <tr key={s.id} className="border-t border-rule">
                    <td className="py-1.5 pr-3 text-ink">@{s.username} <span className="text-xs text-slate">{Math.round(s.rate * 100)}%</span></td>
                    <td>{s.impressions.toLocaleString()}</td>
                    <td>{s.clicks.toLocaleString()}</td>
                    <td>{formatNaira(s.grossKobo)}</td>
                    <td className="font-semibold text-ink">{formatNaira(s.shareKobo)}{s.payableKobo && s.payableKobo !== s.shareKobo ? ` (payable ${formatNaira(s.payableKobo)})` : ""}</td>
                    <td className="text-slate">{s.status.replace("_", " ")}</td>
                    <td className={s.flags.length ? "text-crimson" : "text-slate"}>{s.flags.join(", ") || "ok"}</td>
                    <td className="space-x-2 whitespace-nowrap">
                      {s.status === "pending_review" && (
                        <>
                          <button className={btn} disabled={busy} onClick={() => act({ action: "approve", id: s.id }, "Approved.")}>Approve</button>
                          <button className={btn} disabled={busy} onClick={() => { const note = prompt("Reason for withholding (shown to the publisher):") ?? ""; if (note.trim()) act({ action: "withhold", id: s.id, note }, "Withheld."); }}>Withhold</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.statements.length > 0 && <p className="mt-3 text-xs text-slate">Owed to publishers this month: {formatNaira(owed)} of {formatNaira(data.revenueKobo)} received. Approved amounts are released from Payments after the hold.</p>}
      </div>
    </section>
  );
}
