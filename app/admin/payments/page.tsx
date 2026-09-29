"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import type { LedgerEntry, PaymentRecord } from "@/lib/payments";

export default function AdminPaymentsPage() {
  const { user, loading } = useAdminAuth();
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [conflicts, setConflicts] = useState<PaymentRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const [l, c] = await Promise.all([
      getDocs(query(collection(db, "ledger"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "payments"), where("status", "==", "paid_slot_conflict"))),
    ]);
    setLedger(l.docs.map((d) => d.data() as LedgerEntry));
    setConflicts(c.docs.map((d) => d.data() as PaymentRecord));
  }

  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user]);

  async function act(action: "release" | "refund" | "dispute", reference: string) {
    if (action === "refund" && !confirm("Refund this payment to the payer?")) return;
    if (action === "release" && !confirm("Send this payout to the publisher's bank now?")) return;
    setBusy(reference + action);
    setError("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` },
        body: JSON.stringify({ action, reference }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;

  const btn = "rounded-full border border-rule px-3 py-1 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40";
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-4xl">Payments & payouts</h1>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      {conflicts.length > 0 && (
        <div className="card mt-8 p-6">
          <p className="eyebrow">Needs refund — slot double-booked</p>
          {conflicts.map((c) => (
            <div key={c.reference} className="mt-3 flex items-center justify-between text-sm">
              <span>{c.email} · {formatNaira(c.amountKobo)} · {c.booking?.date} {c.booking?.slot} · {c.reference}</span>
              <button className={btn} disabled={!!busy} onClick={() => act("refund", c.reference)}>Refund</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate">
            <tr><th className="py-2">Date</th><th>Publisher</th><th>Type</th><th>Gross</th><th>Net to publisher</th><th>Status</th><th>Releasable</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {(ledger || []).map((l) => {
              const ready = new Date(l.releaseAfter).getTime() <= Date.now();
              const open = l.status === "held" || l.status === "disputed";
              return (
                <tr key={l.reference}>
                  <td className="py-2">{l.createdAt.slice(0, 10)}</td>
                  <td>@{l.publisherUsername}</td>
                  <td>{l.kind}</td>
                  <td>{formatNaira(l.grossKobo)}</td>
                  <td>{formatNaira(l.netKobo)}</td>
                  <td>{l.status.replace("_", " ")}{l.failureReason ? ` — ${l.failureReason}` : ""}</td>
                  <td>{l.releaseAfter.slice(0, 10)}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    {open && <button className={btn} disabled={!ready || !!busy} onClick={() => act("release", l.reference)}>Release</button>}
                    {l.status === "held" && <button className={btn} disabled={!!busy} onClick={() => act("dispute", l.reference)}>Dispute</button>}
                    {open && <button className={btn} disabled={!!busy} onClick={() => act("refund", l.reference)}>Refund</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ledger && ledger.length === 0 && <p className="mt-6 text-sm text-slate">No payments yet.</p>}
      </div>
    </section>
  );
}
