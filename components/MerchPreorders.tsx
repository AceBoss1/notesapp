"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatNaira } from "@/lib/booking-time";
import { MERCH_STEPS, MerchOrder } from "@/lib/merch";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");

// The signed-in buyer's official-merch pre-orders with a four-step status line.
// Firestore rules let an owner read only their own orders, hence the uid filter;
// sorting happens here so no composite index is needed.
export default function MerchPreorders({ uid }: { uid: string }) {
  const [orders, setOrders] = useState<MerchOrder[] | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, "merchOrders"), where("uid", "==", uid)))
      .then((s) => setOrders(s.docs.map((d) => d.data() as MerchOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setOrders([]));
  }, [uid]);

  if (!orders || orders.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="font-display text-2xl text-ink">Merch pre-orders</h2>
      <p className="mt-1 text-xs text-slate">Official #NotesApp merch is printed after each batch closes. We email you when it is printed, shipped and delivered.</p>
      <ul className="mt-4 space-y-3">
        {orders.map((o) => {
          const reached = MERCH_STEPS.findIndex((s) => s.status === o.status);
          return (
            <li key={o.reference} className="card p-4 text-sm">
              <p className="font-semibold text-ink">
                {o.quantity} × {o.itemName}{o.size ? ` (${o.size})` : ""} · {o.logoLabel}
                <span className="ml-2 font-mono text-xs text-slate">{formatNaira(o.amountKobo)}</span>
              </p>
              {o.status === "refunded" ? (
                <p className="mt-1 text-xs text-slate">Refunded — Paystack handles the rest of the refund and it can take a few business days to reach you.</p>
              ) : (
                <ol className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
                  {MERCH_STEPS.map((s, i) => (
                    <li key={s.status} className={i <= reached ? "text-crimson" : "text-slate/60"}>
                      <span className={`mx-auto mb-1 block h-1.5 rounded-full ${i <= reached ? "bg-crimson" : "bg-rule"}`} />
                      <span className="font-semibold">{s.label}</span>
                      <span className="block">{i <= reached ? day(o[s.at]) : ""}</span>
                    </li>
                  ))}
                </ol>
              )}
              {o.status === "shipped" && (o.courier || o.trackingNumber) && (
                <p className="mt-2 text-xs text-ink">Courier: {[o.courier, o.trackingNumber].filter(Boolean).join(" · ")}</p>
              )}
              <p className="mt-2 font-mono text-[11px] text-slate">{o.reference}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
