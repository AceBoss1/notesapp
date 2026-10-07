"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { LIMITS, LIMIT_TIERS, LIMIT_TIER_LABEL, type LimitTable } from "@/lib/limits";

// Size and count limits by plan (message files, moments). Saved numbers apply sitewide within about 30 seconds; "Reset" puts the
// built-in defaults back in the boxes (nothing changes until you save).
export default function AdminLimitsPage() {
  const { user, loading } = useAdminAuth();
  const [table, setTable] = useState<LimitTable | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (init?: RequestInit) => {
    const r = await fetch("/api/admin/limits", { ...init, headers: { Authorization: `Bearer ${await user!.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j as { limits: LimitTable };
  }, [user]);
  useEffect(() => { if (user) call().then((j) => setTable(j.limits)).catch((e) => setError(e.message)); }, [user, call]);

  const set = (key: string, tier: string, v: string) => setTable((t) => t && ({ ...t, [key]: { ...t[key as keyof LimitTable], [tier]: v === "" ? NaN : Number(v) } }));
  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try { setTable((await call({ method: "POST", body: JSON.stringify({ limits: table }) })).limits); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  const reset = () => setTable((t) => t && (Object.fromEntries(LIMITS.map((l) => [l.key, { ...l.defaults }])) as LimitTable));

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Limits by plan</h1>
      <p className="mt-2 text-sm text-slate">Sizes and counts for each plan. A saved change applies sitewide within about 30 seconds; people already over a new, lower limit just can&apos;t add more until they&apos;re under it. Whole numbers only.</p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {saved && <p className="mt-4 text-sm text-green-700" role="status">Saved. It&apos;s live.</p>}
      {table && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="py-2 pr-4">Limit</th>
                {LIMIT_TIERS.map((t) => <th key={t} className="px-2 py-2">{LIMIT_TIER_LABEL[t]}</th>)}
              </tr>
            </thead>
            <tbody>
              {LIMITS.map((l, i) => (
                <Fragment key={l.key}>
                  {(i === 0 || LIMITS[i - 1].group !== l.group) && <tr><td colSpan={6} className="pt-5 font-mono text-xs uppercase tracking-wide text-slate">{l.group}</td></tr>}
                  <tr className="border-b border-rule">
                    <td className="py-2 pr-4">{l.label} <span className="text-slate">({l.unit}, {l.min}–{l.max})</span></td>
                    {LIMIT_TIERS.map((t) => (
                      <td key={t} className="px-2 py-2">
                        <input type="number" inputMode="numeric" min={l.min} max={l.max} step={1} value={Number.isNaN(table[l.key][t]) ? "" : table[l.key][t]}
                          onChange={(e) => set(l.key, t, e.target.value)} aria-label={`${l.label}, ${LIMIT_TIER_LABEL[t]}`} className="w-20 rounded border border-rule px-2 py-1" />
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <button onClick={save} disabled={busy || !table} className="btn-primary disabled:opacity-50">Save limits</button>
        <button onClick={reset} disabled={!table} className="btn-ghost">Reset to defaults</button>
      </div>
    </div>
  );
}
