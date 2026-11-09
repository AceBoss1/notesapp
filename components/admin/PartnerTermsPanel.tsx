"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { DEFAULT_TERMS, MONTHS_MAX, MONTHS_MIN, SHARE_MAX, SHARE_MIN, TIERS, TIER_LABEL, isTierTerms, type Tier, type TierTerms } from "@/lib/partner-network";

// Admin → Limits → Partner Network (lib/partner-network.ts): each tier's share of the plan payments of members a partner brings, and for
// how many months. Super admins only (the API refuses everyone else). Applies to new plan payments at once, sitewide: the /partners page,
// the portal, and the earnings. Earnings already made don't change.
export default function PartnerTermsPanel({ user }: { user: User }) {
  const [terms, setTerms] = useState<Record<Tier, TierTerms> | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/partners", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  useEffect(() => { call().then((j) => setTerms(j.terms)).catch((e) => setMsg(e.message)); }, [call]);
  if (!terms) return msg ? <p className="mt-6 text-sm text-crimson">{msg}</p> : null;
  const ok = TIERS.every((t) => isTierTerms(terms[t]));
  const set = (t: Tier, k: keyof TierTerms, v: string) => setTerms({ ...terms, [t]: { ...terms[t], [k]: v === "" ? NaN : Number(v) } });
  const save = async () => {
    setBusy(true); setMsg("");
    try { const j = await call({ action: "terms", terms }); setTerms(j.terms); setMsg("Saved: new plan payments use these shares, everywhere."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save it."); }
    finally { setBusy(false); }
  };
  const num = "w-16 rounded border border-rule px-2 py-1";
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">Partner Network</h2>
      <p className="mt-1 text-sm text-slate">Each tier&apos;s share of the plan payments of members a partner brings, and for how many months from each member&apos;s first payment. Shares {SHARE_MIN}–{SHARE_MAX}%, {MONTHS_MIN}–{MONTHS_MAX} months. Applies to new payments at once; earnings already made don&apos;t change. Super admins only.</p>
      <div className="mt-3 space-y-2 text-sm">
        {TIERS.map((t) => (
          <div key={t} className="flex flex-wrap items-center gap-3 text-ink">
            <span className="w-24 font-semibold">{TIER_LABEL[t]}</span>
            <label className="flex items-center gap-1"><input type="number" min={SHARE_MIN} max={SHARE_MAX} value={Number.isNaN(terms[t].percent) ? "" : terms[t].percent} onChange={(e) => set(t, "percent", e.target.value)} className={num} aria-label={`${TIER_LABEL[t]} share`} />%</label>
            <label className="flex items-center gap-1">for <input type="number" min={MONTHS_MIN} max={MONTHS_MAX} value={Number.isNaN(terms[t].months) ? "" : terms[t].months} onChange={(e) => set(t, "months", e.target.value)} className={num} aria-label={`${TIER_LABEL[t]} months`} /> months</label>
            <span className="text-xs text-slate">default {DEFAULT_TERMS[t].percent}% for {DEFAULT_TERMS[t].months}</span>
          </div>
        ))}
      </div>
      <button type="button" disabled={busy || !ok} onClick={() => void save()} className="mt-3 rounded-full bg-crimson px-4 py-1.5 font-ui text-sm font-semibold text-paper disabled:opacity-40">Save</button>
      {msg && <p className="mt-2 text-sm text-ink" role="status">{msg}</p>}
    </section>
  );
}
