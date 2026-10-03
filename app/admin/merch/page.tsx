"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import { MERCH_BATCH, MerchOrder } from "@/lib/merch";
import { HOLDER_LABEL, HolderType } from "@/lib/orders";

type Order = MerchOrder;

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  preordered: { to: "printed", label: "Mark printed" },
  printed: { to: "shipped", label: "Mark shipped" },
  shipped: { to: "delivered", label: "Mark delivered" },
};

export default function AdminMerchPage() {
  const { user, loading } = useAdminAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Which order is asking for courier details before being marked shipped.
  const [shipping, setShipping] = useState<{ reference: string; courier: string; trackingNumber: string; trackingUrl: string } | null>(null);
  // Hand-off log form (rider / bus / park) for one order at a time.
  const [hand, setHand] = useState<{ reference: string; holderType: string; holderName: string; holderPhone: string; location: string; consent: boolean } | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const snap = await getDocs(query(collection(db, "merchOrders"), orderBy("createdAt", "desc")));
    setOrders(snap.docs.map((d) => d.data() as Order));
  }
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user]);

  async function advance(o: Order, extra: Record<string, string> = {}) {
    const step = NEXT[o.status];
    if (!step || !user) return;
    setBusy(o.reference);
    setError("");
    try {
      const res = await fetch("/api/admin/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ reference: o.reference, status: step.to, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setShipping(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function addHolder() {
    if (!hand || !user) return;
    setBusy(hand.reference);
    setError("");
    try {
      const res = await fetch("/api/admin/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ action: "add_custody", ...hand }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setHand(null);
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
              {o.parcelId && (
                <p className="mt-1 text-xs text-slate">
                  Parcel <a href={`/track/${o.parcelId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-crimson underline">{o.parcelId}</a> — what the buyer sees at /track
                </p>
              )}
              {["printed", "shipped"].includes(o.status) && (
                hand?.reference === o.reference ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-slate">Who holds it
                      <select value={hand.holderType} onChange={(e) => setHand({ ...hand, holderType: e.target.value })} className="mt-1 block w-full border border-rule bg-card px-2 py-1 text-sm">
                        {(["seller", "bike", "bus", "park", "courier"] as HolderType[]).map((t) => <option key={t} value={t}>{HOLDER_LABEL[t]}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate">Name<input value={hand.holderName} onChange={(e) => setHand({ ...hand, holderName: e.target.value })} className="mt-1 block w-full border border-rule bg-card px-2 py-1 text-sm" /></label>
                    <label className="text-xs text-slate">Phone (optional)<input value={hand.holderPhone} onChange={(e) => setHand({ ...hand, holderPhone: e.target.value })} className="mt-1 block w-full border border-rule bg-card px-2 py-1 text-sm" placeholder="08012345678" /></label>
                    <label className="text-xs text-slate">Where the parcel is<input value={hand.location} onChange={(e) => setHand({ ...hand, location: e.target.value })} className="mt-1 block w-full border border-rule bg-card px-2 py-1 text-sm" placeholder="Ojota motor park, Lagos" /></label>
                    <label className="flex items-start gap-2 text-xs text-slate sm:col-span-2">
                      <input type="checkbox" checked={hand.consent} onChange={(e) => setHand({ ...hand, consent: e.target.checked })} className="mt-0.5" />
                      <span>The holder agrees to their number being shown to the buyer (needed if you add a number).</span>
                    </label>
                    <div className="flex gap-3 sm:col-span-2">
                      <button disabled={busy === o.reference} onClick={addHolder} className="rounded-full border border-crimson px-3 py-1 text-xs text-crimson disabled:opacity-40">Add to the buyer&apos;s tracking</button>
                      <button onClick={() => setHand(null)} className="text-xs text-slate">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setHand({ reference: o.reference, holderType: "bike", holderName: "", holderPhone: "", location: "", consent: false })} className="mt-2 mr-2 text-xs font-semibold text-crimson">Record who holds it (rider / bus / park)</button>
                )
              )}
              {o.status === "shipped" && (o.courier || o.trackingNumber) && (
                <p className="mt-1 text-xs text-ink">Courier: {[o.courier, o.trackingNumber].filter(Boolean).join(" · ")}</p>
              )}
              {NEXT[o.status] && shipping?.reference === o.reference ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-slate">Courier (optional)
                    <input value={shipping.courier} onChange={(e) => setShipping({ ...shipping, courier: e.target.value })} className="mt-1 block border border-rule bg-card px-2 py-1 text-sm" placeholder="GIG Logistics" />
                  </label>
                  <label className="text-xs text-slate">Tracking number (optional)
                    <input value={shipping.trackingNumber} onChange={(e) => setShipping({ ...shipping, trackingNumber: e.target.value })} className="mt-1 block border border-rule bg-card px-2 py-1 text-sm" />
                  </label>
                  <label className="text-xs text-slate">Tracking link (optional, https://…)
                    <input value={shipping.trackingUrl} onChange={(e) => setShipping({ ...shipping, trackingUrl: e.target.value })} className="mt-1 block border border-rule bg-card px-2 py-1 text-sm" />
                  </label>
                  <button disabled={busy === o.reference} onClick={() => advance(o, { courier: shipping.courier, trackingNumber: shipping.trackingNumber, trackingUrl: shipping.trackingUrl })} className="rounded-full border border-crimson px-3 py-1 text-xs text-crimson disabled:opacity-40">Mark shipped &amp; email buyer</button>
                  <button onClick={() => setShipping(null)} className="text-xs text-slate">Cancel</button>
                </div>
              ) : (
                NEXT[o.status] && (
                  <button disabled={busy === o.reference} onClick={() => (o.status === "printed" ? setShipping({ reference: o.reference, courier: "", trackingNumber: "", trackingUrl: "" }) : advance(o))} className="mt-2 rounded-full border border-rule px-3 py-1 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40">
                    {NEXT[o.status]!.label}
                  </button>
                )
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
