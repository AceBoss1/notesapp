"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import { MERCH_BATCH } from "@/lib/merch";

type Order = {
  reference: string;
  email: string;
  itemName: string;
  logoLabel: string;
  size?: string;
  quantity: number;
  amountKobo: number;
  status: "preordered" | "printed" | "shipped" | "delivered" | "refunded";
  batchId: string;
  createdAt: string;
  address: { fullName: string; phone: string; street: string; city: string; state: string };
};

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  preordered: { to: "printed", label: "Mark printed" },
  printed: { to: "shipped", label: "Mark shipped" },
  shipped: { to: "delivered", label: "Mark delivered" },
};

export default function AdminMerchPage() {
  const { user, loading } = useAdminAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const snap = await getDocs(query(collection(db, "merchOrders"), orderBy("createdAt", "desc")));
    setOrders(snap.docs.map((d) => d.data() as Order));
  }
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user]);

  async function advance(o: Order) {
    const step = NEXT[o.status];
    if (!step || !user) return;
    setBusy(o.reference);
    setError("");
    try {
      const res = await fetch("/api/admin/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ reference: o.reference, status: step.to }),
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

  // What to print for the current batch: one line per item/logo/size.
  const production = useMemo(() => {
    const m = new Map<string, number>();
    (orders ?? [])
      .filter((o) => o.status === "preordered" && o.batchId === MERCH_BATCH.id)
      .forEach((o) => {
        const k = `${o.itemName}${o.size ? ` (${o.size})` : ""} — ${o.logoLabel}`;
        m.set(k, (m.get(k) ?? 0) + o.quantity);
      });
    return [...m.entries()].sort();
  }, [orders]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;

  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-4xl">Merch orders</h1>
      <p className="mt-2 text-sm text-slate">
        {MERCH_BATCH.label} closes {MERCH_BATCH.closesOn}. Refunds are done from Payments, and only before an order is printed.
      </p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      <div className="card mt-8 p-5">
        <p className="font-ui text-sm font-bold">To print — {MERCH_BATCH.label} (paid, not yet printed)</p>
        {production.length === 0 ? (
          <p className="mt-2 text-sm text-slate">Nothing waiting.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {production.map(([k, n]) => (
              <li key={k}><span className="font-mono text-crimson-bright">{n}×</span> {k}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {orders === null ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate">No orders yet.</p>
        ) : (
          orders.map((o) => (
            <div key={o.reference} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">
                  {o.quantity} × {o.itemName}{o.size ? ` (${o.size})` : ""} · {o.logoLabel}
                  <span className="ml-2 font-mono text-xs text-slate">{formatNaira(o.amountKobo)}</span>
                </p>
                <span className="rounded-full bg-paper px-3 py-0.5 font-mono text-[11px] uppercase">{o.status}</span>
              </div>
              <p className="mt-1 text-slate">
                {o.address.fullName} · {o.address.phone} · {o.address.street}, {o.address.city}, {o.address.state}
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate">{o.email} · {o.reference} · {new Date(o.createdAt).toLocaleDateString("en-NG")}</p>
              {NEXT[o.status] && (
                <button disabled={busy === o.reference} onClick={() => advance(o)} className="mt-2 rounded-full border border-rule px-3 py-1 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40">
                  {NEXT[o.status]!.label}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
