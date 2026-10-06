"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";

type Diag = { configured: boolean; mode: string; webhookKeySet: boolean; encryptionKeySet: boolean; ok: boolean; httpStatus: number; summary: string; body: string };
type Ev = { id: string; event: string; status: string; amount: string; trx: string; reference: string; receivedAt: string; handled: boolean };

// Paylony: does our key work, which keys are set, and the webhook events received. Payouts and virtual accounts run through
// Paylony only once they are switched on; until then Paystack does everything.
export default function AdminPaylonyPage() {
  const { user, loading } = useAdminAuth();
  const [diag, setDiag] = useState<Diag | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/paylony", { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      setDiag(j.diagnostics);
      setEvents(j.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [user]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const key = (set: boolean, name: string) => <li className="font-mono text-xs">{name}: <span className={set ? "text-emerald-800" : "text-crimson"}>{set ? "set" : "not set"}</span></li>;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Paylony</h1>
      <p className="mt-2 text-sm text-slate">Bank payouts and virtual accounts are being added through Paylony. Paystack stays the main provider for card checkout, refunds, plans and subscriptions.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      <h2 className="mt-10 font-display text-2xl">Connection</h2>
      {diag && (
        <div className={`card mt-3 p-4 text-sm ${diag.ok ? "border-emerald-300" : "border-crimson"}`}>
          <p className="font-ui font-bold text-ink">{diag.ok ? "Connected" : "Not working"} · {diag.mode === "unset" ? "no key" : `${diag.mode} key`}</p>
          <p className="mt-1 text-slate">{diag.summary}{diag.httpStatus ? ` (HTTP ${diag.httpStatus})` : ""}</p>
          <ul className="mt-2 space-y-0.5">
            {key(diag.configured, "PAYLONY_SECRET_KEY")}
            {key(diag.webhookKeySet, "PAYLONY_WEBHOOK_KEY")}
            {key(diag.encryptionKeySet, "PAYLONY_ENCRYPTION_KEY (payouts)")}
          </ul>
          {diag.body && <pre className="mt-3 max-h-48 overflow-auto bg-card p-2 font-mono text-[11px] text-slate">{diag.body}</pre>}
        </div>
      )}
      <button onClick={load} disabled={busy} className="btn-ghost mt-3 !px-4 !py-2 text-xs">{busy ? "Checking…" : "Test connection"}</button>

      <h2 className="mt-10 font-display text-2xl">Webhook</h2>
      <p className="mt-2 text-sm text-slate">Give Paylony this webhook address: <code>https://www.notesapp.name.ng/api/paylony/webhook</code>, with the webhook key set in Vercel as PAYLONY_WEBHOOK_KEY. Events arrive for money paid into a virtual account and for payouts that change state.</p>
      {events.length === 0 ? <p className="mt-3 text-sm text-slate">No events received yet.</p> : (
        <ul className="card mt-3 divide-y divide-rule text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span><strong className="text-ink">{e.event}</strong> · ₦{Number(e.amount || 0).toLocaleString("en-NG")} · status {e.status} <span className="font-mono text-xs text-slate">· {e.reference || e.trx}</span></span>
              <span className="font-mono text-[11px] text-slate">{new Date(e.receivedAt).toLocaleString("en-NG")}{e.handled ? "" : " · not acted on"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
