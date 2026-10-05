"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";

type Member = { uid: string; username: string; displayName: string; tier: string };
type Domain = { host: string; uid: string; username: string; status: "pending" | "active"; home: string; note?: string; vercel: boolean; createdAt: string };

// Who may use the API / Console, and every custom domain. API access is off by default and switched on per account.
export default function AdminApiAccessPage() {
  const { user, loading } = useAdminAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [username, setUsername] = useState("");
  const [autoConnect, setAutoConnect] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const call = useCallback(async (init?: RequestInit) => {
    const t = await user!.getIdToken();
    const r = await fetch("/api/admin/api-access", { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);

  const load = useCallback(() => {
    call().then((j) => { setMembers(j.enabled); setDomains(j.domains); setAutoConnect(!!j.autoConnect); }).catch((e) => setError(e.message));
  }, [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function post(body: Record<string, unknown>, ok: string) {
    setError(""); setMsg("");
    try { await call({ method: "POST", body: JSON.stringify(body) }); setMsg(ok); load(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-display text-4xl">API &amp; domains</h1>
      <p className="mt-2 text-sm text-slate">API access (Console keys, webhooks, <span className="font-mono">/api/v1</span>) is off for everyone and switched on per account. Turning it off revokes the account&apos;s keys and pauses its webhooks.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {msg && <p className="mt-4 text-sm text-emerald-800">{msg}</p>}

      <form className="card mt-6 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); post({ action: "set_access", username, enabled: true }, `API access enabled for @${username.replace(/^@/, "")}.`); setUsername(""); }}>
        <label className="text-xs text-slate">Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="precheks" className="mt-1 block w-56 border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson" />
        </label>
        <button disabled={!username.trim()} className="btn-primary !px-4 !py-2 text-xs">Enable API access</button>
      </form>

      <h2 className="mt-10 font-display text-2xl">Accounts with API access</h2>
      {members.length === 0 ? <p className="mt-3 text-sm text-slate">None yet.</p> : (
        <ul className="card mt-3 divide-y divide-rule">
          {members.map((m) => (
            <li key={m.uid} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span><span className="font-semibold text-ink">{m.displayName}</span> <span className="font-mono text-xs text-slate">@{m.username} · {m.tier}</span></span>
              <button className="text-xs text-crimson underline" onClick={() => confirm(`Turn off API access for @${m.username}? Their keys are revoked.`) && post({ action: "set_access", username: m.username, enabled: false }, "API access turned off.")}>Turn off</button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-display text-2xl">Custom domains</h2>
      {autoConnect === null ? null : autoConnect ? (
        <p className="mt-1 text-xs text-emerald-800">Automatic connection is on: domains are added to the Vercel project when a member saves them, and members check their own DNS in the Console. Use Activate or Pause only if one gets stuck. (Live check: Custom domains on the <a href="/status" className="underline">status page</a>.)</p>
      ) : (
        <p className="mt-1 text-xs text-slate">Automatic connection is off — set VERCEL_API_TOKEN and VERCEL_PROJECT_ID (and VERCEL_TEAM_ID for a team project) in Vercel and redeploy. Until then, add each domain to the Vercel project yourself, then press Activate.</p>
      )}
      {domains.length === 0 ? <p className="mt-3 text-sm text-slate">None yet.</p> : (
        <ul className="card mt-3 divide-y divide-rule">
          {domains.map((d) => (
            <li key={d.host} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-mono text-ink">{d.host}</span> <span className="text-xs text-slate">@{d.username} · front page: {d.home} · {d.vercel ? "registered on Vercel" : "needs adding on Vercel"}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${d.status === "active" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{d.status}</span>
              </span>
              <span className="flex gap-3 text-xs">
                {d.status === "pending"
                  ? <button className="text-crimson underline" onClick={() => post({ action: "set_domain", host: d.host, status: "active" }, `${d.host} is live.`)}>Activate</button>
                  : <button className="text-slate underline" onClick={() => post({ action: "set_domain", host: d.host, status: "pending" }, `${d.host} paused.`)}>Pause</button>}
                <button className="text-slate underline" onClick={() => confirm(`Remove ${d.host}?`) && post({ action: "remove_domain", host: d.host }, "Domain removed.")}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
