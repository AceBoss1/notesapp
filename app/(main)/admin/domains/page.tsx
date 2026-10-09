"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";

type Part = { ok: true; data: unknown } | { ok: false; error: string };
type Diag = { configured: boolean; emailSet: boolean; keySet: boolean; ok: boolean; summary: string; version?: Part; credits?: Part; tlds?: Part; proxy?: boolean; outgoingIp?: string | null; proxyHost?: string | null; probes?: { name: string; state: "allowed" | "blocked" | "unreachable"; note: string }[] };

// Domain sales (Whogohost / go54 reseller API): is the connection up, which settings exist, our credit balance and the extensions offered.
export default function AdminDomainSalesPage() {
  const { user, loading } = useAdminAuth();
  const [diag, setDiag] = useState<Diag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scannedAt, setScannedAt] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(false);
  const [lookup, setLookup] = useState<{ lookup: { domain: string; state: string; source: string; httpStatus?: number; note?: string }; price: Part | null } | null>(null);

  const check = async () => {
    setChecking(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/domains?name=${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      setLookup(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setChecking(false);
    }
  };

  const scan = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/domains", { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      setDiag(j);
      setScannedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [user]);
  useEffect(() => { if (user) void scan(); }, [user, scan]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const flag = (set: boolean, name: string) => <li className="font-mono text-xs">{name}: <span className={set ? "text-emerald-800" : "text-crimson"}>{set ? "set" : "not set"}</span></li>;
  const part = (title: string, p?: Part) => p && (
    <div className="mt-4">
      <p className="font-ui text-sm font-bold text-ink">{title}</p>
      <pre className={`mt-1 max-h-56 overflow-auto bg-card p-2 font-mono text-[11px] ${p.ok ? "text-slate" : "text-crimson"}`}>{p.ok ? JSON.stringify(p.data, null, 2) : p.error}</pre>
    </div>
  );
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Domain sales</h1>
      <p className="mt-2 text-sm text-slate">Our Whogohost (go54) reseller connection. It also shows on the public <a href="/status" className="text-crimson underline">status page</a> once connected.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {diag && (
        <div className={`card mt-6 p-4 text-sm ${diag.ok ? "border-emerald-300" : "border-crimson"}`}>
          <p className="font-ui font-bold text-ink">{diag.ok ? "Connected" : diag.configured ? "Not working" : "Not set up"}</p>
          <p className="mt-1 text-slate">{diag.summary}</p>
          <ul className="mt-2 space-y-0.5">
            {flag(diag.emailSet, "WHOGOHOST_RESELLER_EMAIL")}
            {flag(diag.keySet, "WHOGOHOST_API_KEY")}
            <li className="font-mono text-xs">WHOGOHOST_PROXY_URL (optional): <span className={diag.proxy ? "text-emerald-800" : "text-slate"}>{diag.proxy ? "set" : "not set"}</span></li>
          </ul>
          {diag.configured && (
            <p className="mt-3 text-slate">
              Calls leave from <strong className="font-mono text-ink">{diag.outgoingIp || "an address we couldn't read"}</strong>{diag.proxy ? ` (through the proxy at ${diag.proxyHost})` : " (no proxy set: Vercel's address, which changes)"}. Whogohost must list this address under IP restrictions.
            </p>
          )}
          {diag.probes && (
            <div className="mt-4">
              <p className="font-ui text-sm font-bold text-ink">Which actions the service allows from this address</p>
              <ul className="mt-1 space-y-1 text-xs">
                {diag.probes.map((p) => (
                  <li key={p.name}><span className={p.state === "allowed" ? "text-emerald-800" : "text-crimson"}>{p.state === "allowed" ? "allowed" : p.state === "blocked" ? "REFUSED" : "NOT REACHED"}</span> · {p.name} <span className="block font-mono text-[11px] text-slate">{p.note}</span></li>
                ))}
              </ul>
            </div>
          )}
          {part("Service version", diag.version)}
          {part("Our credit with Whogohost", diag.credits)}
          {part("Extensions on offer", diag.tlds)}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button onClick={scan} disabled={busy} className="btn-ghost !px-4 !py-2 text-xs">{busy ? "Scanning…" : "Scan now"}</button>
        {scannedAt && <span className="font-mono text-[11px] text-slate">Last scan {scannedAt.toLocaleTimeString("en-NG")}</span>}
      </div>
      <h2 className="mt-10 font-display text-2xl">Check a name</h2>
      <p className="mt-2 text-sm text-slate">Whogohost has no lookup call, so availability comes from the registry (RDAP). Try names you know are taken and free, and compare. Shows the registry&apos;s answer and Whogohost&apos;s price call, exactly as received.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) void check(); }} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate">Domain<input value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com.ng" className="mt-1 block w-64 border border-rule bg-card px-2 py-1.5 text-sm" /></label>
        <button disabled={checking || !name.trim()} className="btn-ghost !px-4 !py-2 text-xs">{checking ? "Checking…" : "Check"}</button>
      </form>
      {lookup && (
        <div className="card mt-3 p-4 text-sm">
          <p className="font-ui font-bold text-ink">{lookup.lookup.domain}: {lookup.lookup.state === "available" ? "looks available" : lookup.lookup.state === "taken" ? "taken" : "couldn't tell"}</p>
          <p className="mt-1 font-mono text-[11px] text-slate">Registry: {lookup.lookup.source}{lookup.lookup.httpStatus ? ` · HTTP ${lookup.lookup.httpStatus}` : ""}{lookup.lookup.note ? ` · ${lookup.lookup.note}` : ""}</p>
          {part("Whogohost price (register)", lookup.price ?? undefined)}
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl">How members will pay</h2>
      <p className="mt-2 text-sm text-slate">Members pay us in Naira through Paystack, then we register the domain from our Whogohost credit. Our price is Whogohost&apos;s price plus 20%. Not built yet.</p>
    </section>
  );
}
