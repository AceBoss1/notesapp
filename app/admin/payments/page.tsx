"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import type { LedgerEntry, PaymentRecord } from "@/lib/payments";

export default function AdminPaymentsPage() {
  const { user, loading } = useAdminAuth();
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [conflicts, setConflicts] = useState<PaymentRecord[]>([]);
  const [boosts, setBoosts] = useState<Record<string, any>[]>([]);
  const [all, setAll] = useState<PaymentRecord[] | null>(null);
  const [kindFilter, setKindFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const [l, c] = await Promise.all([
      getDocs(query(collection(db, "ledger"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "payments"), where("status", "==", "paid_slot_conflict"))),
    ]);
    setLedger(l.docs.map((d) => d.data() as LedgerEntry));
    getDocs(query(collection(db, "boosts"), orderBy("createdAt", "desc"))).then((b) => setBoosts(b.docs.map((d) => d.data()))).catch(() => {});
    setConflicts(c.docs.map((d) => d.data() as PaymentRecord));
    getDocs(query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(300))).then((p) => setAll(p.docs.map((d) => d.data() as PaymentRecord))).catch(() => setAll([]));
  }

  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user]);

  async function act(action: "release" | "refund" | "dispute" | "refund_boost", reference: string) {
    if (action === "refund_boost" && !confirm("Refund the undelivered impressions share of this boost?")) return;
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
                  <td>{l.kind}{l.sharePercent ? ` · ${l.sharePercent}% share` : ""}</td>
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

      <h2 className="mt-12 font-display text-2xl">All payments</h2>
      <p className="mt-1 text-sm text-slate">Every checkout across all products (latest 300). “pending” means the buyer started a payment that was never confirmed — check Paystack.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["", "booking", "subscription", "gift", "boost", "tier", "badge", "gold", "gold_deposit", "merch"].map((k) => (
          <button key={k || "all"} onClick={() => setKindFilter(k)} className={`rounded-full border px-3 py-1 text-xs ${kindFilter === k ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{k || "all"}</button>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate">
            <tr><th className="py-2">Date</th><th>Product</th><th>Payer</th><th>Amount</th><th>Status</th><th>Reference</th></tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {(all || []).filter((p) => !kindFilter || p.kind === kindFilter).map((p) => (
              <tr key={p.reference}>
                <td className="py-2">{(p.paidAt || p.createdAt || "").slice(0, 10)}</td>
                <td>{p.kind}</td>
                <td className="max-w-[180px] truncate">{p.email}</td>
                <td>{formatNaira(p.amountKobo)}</td>
                <td className={p.status === "paid" ? "text-green-700" : p.status === "pending" ? "text-amber-700" : ""}>{p.status.replace("_", " ")}</td>
                <td className="font-mono text-[11px] text-slate">{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {all === null && <p className="mt-4 text-sm text-slate">Loading…</p>}
        {all && all.length === 0 && <p className="mt-4 text-sm text-slate">No payments yet.</p>}
      </div>

      <h2 className="mt-12 font-display text-2xl">Boosts</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate">
            <tr><th className="py-2">Post</th><th>Paid</th><th>Delivered</th><th>Clicks</th><th>Ends</th><th>Status</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {boosts.map((b) => {
              const ended = new Date(b.endsAt).getTime() <= Date.now() || b.status === "completed";
              const shortfall = Math.max(0, b.impressionsPurchased - b.impressionsDelivered);
              return (
                <tr key={b.reference}>
                  <td className="py-2">{b.title}</td>
                  <td>{formatNaira(b.amountKobo)}</td>
                  <td>{b.impressionsDelivered.toLocaleString()} / {b.impressionsPurchased.toLocaleString()}</td>
                  <td>{b.clicks}</td>
                  <td>{String(b.endsAt).slice(0, 10)}</td>
                  <td>{b.status}{b.refundedKobo ? ` · refunded ${formatNaira(b.refundedKobo)}` : ""}</td>
                  <td>{ended && b.status !== "closed" && (
                    <button className={btn} disabled={!!busy} onClick={() => act("refund_boost", b.reference)}>
                      {shortfall > 0 ? "Refund undelivered" : "Close"}
                    </button>
                  )}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {boosts.length === 0 && <p className="mt-4 text-sm text-slate">No boosts yet.</p>}
      </div>
    </section>
  );
}
