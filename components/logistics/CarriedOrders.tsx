"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { formatNaira } from "@/lib/booking-time";
import { HOLDER_LABEL, ORDER_STATUS_LABEL, type HolderType, type OrderStatus } from "@/lib/orders";

// Store orders a provider delivers as a store's delivery partner (lib/logistics.ts): the buyer's address, what the provider earns once
// delivery is confirmed, and the same hand-off tools as the store (through /api/store/orders, which lets the partner act on these).
export type Carried = {
  reference: string; parcelId: string; sellerUsername: string; itemTitle: string; quantity: number; variantLabel: string | null;
  address: { fullName: string; phone: string; street: string; city: string; state: string }; status: OrderStatus; paidAt: string;
  feeKobo: number; earnKobo: number; custody: { id: string; holderType: HolderType; holderName: string; holderPhone?: string; location: string; at: string; status: string }[];
};
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const holder = (t: HolderType) => (t === "seller" ? "Office" : HOLDER_LABEL[t]);

function Card({ o, user, onDone }: { o: Carried; user: User; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [hand, setHand] = useState({ holderType: "bike" as HolderType, holderName: "", holderPhone: "", location: "", consent: false });
  const open = o.status === "paid" || o.status === "dispatched";
  async function run(body: Record<string, unknown>, after?: (j: { url?: string }) => void) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/store/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ reference: o.reference, ...body }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong.");
      after?.(j); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <li className="card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">{o.quantity} × {o.itemTitle}{o.variantLabel ? ` (${o.variantLabel})` : ""} <span className="font-normal text-slate">from @{o.sellerUsername}</span></p>
        <a href={`/track/${o.parcelId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-crimson underline">{o.parcelId}</a>
      </div>
      <p className="text-xs text-slate">{ORDER_STATUS_LABEL[o.status]} · you earn {formatNaira(o.earnKobo)} of the {formatNaira(o.feeKobo)} delivery once it&apos;s confirmed</p>
      <p className="mt-1 text-xs text-ink">Collect from @{o.sellerUsername} → <b>{o.address.fullName}</b> · {o.address.phone}<br />{o.address.street}, {o.address.city}, {o.address.state}</p>
      {error && <p className="mt-2 text-xs text-crimson">{error}</p>}
      {o.custody.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-rule pt-3 text-xs text-ink">
          {o.custody.map((c) => (
            <li key={c.id}>
              {holder(c.holderType)}: {c.holderName}{c.holderPhone ? ` (${c.holderPhone})` : ""} — {c.location} <span className="text-slate">· {c.status === "pending" ? "waiting for them to confirm" : new Date(c.at).toLocaleString("en-NG", { hour12: true })}</span>
              {open && <button disabled={busy} onClick={() => run({ action: "holder_link", entryId: c.id }, (j) => setLink(j.url || ""))} className="ml-2 font-semibold text-crimson">Get their update link</button>}
            </li>
          ))}
        </ul>
      )}
      {link && <p className="mt-2 break-all text-xs text-ink">Send this to the rider: <span className="font-mono">{link}</span> <button onClick={() => navigator.clipboard?.writeText(link)} className="font-semibold text-crimson">Copy</button></p>}
      {open && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-crimson">Record who has it now</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate">Who
              <select value={hand.holderType} onChange={(e) => setHand({ ...hand, holderType: e.target.value as HolderType })} className={field}>
                {(["bike", "bus", "park", "seller"] as HolderType[]).map((t) => <option key={t} value={t}>{holder(t)}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate">Their name<input value={hand.holderName} onChange={(e) => setHand({ ...hand, holderName: e.target.value })} className={field} /></label>
            <label className="text-xs text-slate">Their phone (optional)<input value={hand.holderPhone} onChange={(e) => setHand({ ...hand, holderPhone: e.target.value })} className={field} placeholder="08012345678" /></label>
            <label className="text-xs text-slate">Where the parcel is<input value={hand.location} onChange={(e) => setHand({ ...hand, location: e.target.value })} className={field} /></label>
            <label className="flex items-start gap-2 text-xs text-slate sm:col-span-2"><input type="checkbox" checked={hand.consent} onChange={(e) => setHand({ ...hand, consent: e.target.checked })} className="mt-0.5" /><span>They agree to their phone number being shown to the buyer (needed if you add a number).</span></label>
          </div>
          <button disabled={busy} onClick={() => run({ action: "add_custody", ...hand }, () => setHand({ ...hand, holderName: "", holderPhone: "", location: "", consent: false }))} className="btn-primary mt-2 !px-4 !py-2 text-xs">Add to the log</button>
        </details>
      )}
      {o.status === "dispatched" && <button disabled={busy} onClick={() => confirm(`Mark ${o.parcelId} as delivered to ${o.address.fullName}?`) && run({ action: "mark_delivered" })} className="mt-3 text-xs font-semibold text-crimson">Mark delivered</button>}
    </li>
  );
}

export default function CarriedOrders({ orders, user, onDone }: { orders: Carried[]; user: User; onDone: () => void }) {
  if (!orders.length) return null;
  return (
    <section className="mt-8" aria-labelledby="carried-h">
      <h2 id="carried-h" className="font-display text-xl text-ink">Deliveries for stores</h2>
      <p className="mt-1 text-xs text-slate">Orders from stores that chose you as their delivery partner. The buyer paid your price; you&apos;re paid once delivery is confirmed (by the buyer, or 7 days after it&apos;s marked delivered).</p>
      <ul className="mt-4 space-y-3">{orders.map((o) => <Card key={o.reference} o={o} user={user} onDone={onDone} />)}</ul>
    </section>
  );
}
