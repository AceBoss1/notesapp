"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getTierConfig } from "@/lib/tiers";

type Rates = { session?: number; physical?: number; digital?: number; adShare?: number };
type Account = { uid: string; username: string; displayName: string; apiAccess: boolean; domain: string | null; customRates: Rates };

const FIELDS: { key: keyof Rates; label: string; hint: string }[] = [
  { key: "session", label: "Sessions, subscriptions & gifts", hint: "commission %" },
  { key: "physical", label: "Physical store items", hint: "commission %" },
  { key: "digital", label: "Digital downloads", hint: "commission %" },
  { key: "adShare", label: "Ad share", hint: "their share of ad revenue %" },
];
const pct = (v?: number) => (v === undefined ? "" : String(Math.round(v * 10000) / 100));

// The rates agreed with each Enterprise account. A blank box means "use the Enterprise default".
export default function AdminEnterprisePage() {
  const { user, loading } = useAdminAuth();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const cfg = getTierConfig("enterprise");
  const defaults: Record<keyof Rates, number> = {
    session: cfg.sessionAndUnlockCommissionFloor ?? 0.05,
    physical: cfg.physicalCommissionFloor ?? 0.03,
    digital: cfg.digitalCommissionFloor ?? 0.05,
    adShare: cfg.adRevenueShare ?? 0.75,
  };

  const call = useCallback(async (init?: RequestInit) => {
    const t = await user!.getIdToken();
    const r = await fetch("/api/admin/enterprise", { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => { call().then((j) => setAccounts(j.accounts)).catch((e) => setError(e.message)); }, [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function save(a: Account, values: Record<string, string>) {
    setError(""); setMsg("");
    try {
      await call({ method: "POST", body: JSON.stringify({ username: a.username, ...values }) });
      setMsg(`Rates saved for @${a.username}.`);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-display text-4xl">Enterprise accounts</h1>
      <p className="mt-2 text-sm text-slate">
        Rates are agreed per Enterprise account. Leave a box empty to use the Enterprise default
        ({(defaults.session * 100).toFixed(0)}% sessions, {(defaults.physical * 100).toFixed(0)}% store, {(defaults.digital * 100).toFixed(0)}% downloads, {(defaults.adShare * 100).toFixed(0)}% ad share).
        New rates apply to payments started after you save; payments already made keep the rate they were made at. To put an account on Enterprise, approve its request under Users.
      </p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {msg && <p className="mt-4 text-sm text-emerald-800">{msg}</p>}
      {accounts === null ? <p className="mt-6 text-sm text-slate">Loading…</p> : accounts.length === 0 ? (
        <p className="mt-6 text-sm text-slate">No Enterprise accounts yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {accounts.map((a) => <AccountCard key={a.uid} a={a} defaults={defaults} onSave={save} />)}
        </ul>
      )}
    </section>
  );
}

function AccountCard({ a, defaults, onSave }: { a: Account; defaults: Record<keyof Rates, number>; onSave: (a: Account, v: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>({ session: pct(a.customRates.session), physical: pct(a.customRates.physical), digital: pct(a.customRates.digital), adShare: pct(a.customRates.adShare) });
  return (
    <li className="card p-5">
      <p className="font-ui text-sm font-bold text-ink">{a.displayName} <span className="font-mono text-xs font-normal text-slate">@{a.username}</span></p>
      <p className="mt-1 text-xs text-slate">{a.domain ? `Domain: ${a.domain}` : "No custom domain"} · {a.apiAccess ? "API access on" : "API access off"}</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(a, v); }}>
        {FIELDS.map((f) => (
          <label key={f.key} className="text-xs text-slate">{f.label} <span className="text-slate/70">({f.hint})</span>
            <input
              type="number" min={0} max={f.key === "adShare" ? 100 : 50} step="0.01"
              value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
              placeholder={`default ${(defaults[f.key] * 100).toFixed(0)}`}
              className="mt-1 block w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson"
            />
          </label>
        ))}
        <div className="sm:col-span-2"><button className="btn-primary !px-4 !py-2 text-xs">Save rates</button></div>
      </form>
    </li>
  );
}
