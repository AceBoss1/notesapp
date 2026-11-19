"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatNaira } from "@/lib/booking-time";
import dynamic from "next/dynamic";
import { LOGO_OPTIONS, MERCH_STEPS, choiceText, colourOf, getMerchDesign, getMerchItem, type MerchOrder } from "@/lib/merch";
import MerchMockup from "@/components/MerchMockup";

const Merch3D = dynamic(() => import("@/components/merch/Merch3D"), { ssr: false });

// The design as it was chosen (Merch in 3D, v0.186.0): a picture, and "Turn it" to see it in 3D. Older orders have no picture.
function Design({ o }: { o: MerchOrder }) {
  const [turn, setTurn] = useState(false);
  const design = o.designId ? getMerchDesign(o.designId) : undefined;
  const item = !design && o.product?.startsWith("item:") ? getMerchItem(o.product.slice(5)) : undefined;
  if (!design && !item) return null;
  const logo = LOGO_OPTIONS.find((l) => l.label === o.logoLabel) ?? LOGO_OPTIONS[0];
  const hex = design ? design.base : colourOf(o.colour)?.hex ?? "#1d1b1c";
  // eslint-disable-next-line @next/next/no-img-element
  const flat = design ? <img src={design.image} alt="" className="h-full w-full object-contain" /> : <MerchMockup item={item!} logoSrc={logo.image} logoAlt={logo.label} colour={hex} />;
  if (turn) return <div className="mt-3"><Merch3D look={{ shape: design ? "design" : item!.shape, colour: hex, logo: item ? logo.image : undefined, place: o.place, name: o.backName, design }} height={260} fallback={flat} label={`Your ${o.itemName}, in 3D`} /></div>;
  return (
    <button type="button" onClick={() => setTurn(true)} className="group relative mt-3 block h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-paper" aria-label={`Turn your ${o.itemName} in 3D`}>
      {flat}<span className="absolute inset-x-0 bottom-0 bg-ink/60 py-0.5 text-center text-[10px] font-semibold text-white">Turn it</span>
    </button>
  );
}

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
                {o.quantity} × {o.itemName} · {o.product ? choiceText({ colourName: o.colourName, logoLabel: o.designId ? undefined : o.logoLabel, place: o.place, size: o.size, backName: o.backName }) : `${o.size ? `${o.size} · ` : ""}${o.logoLabel}`}
                <span className="ml-2 font-mono text-xs text-slate">{formatNaira(o.amountKobo)}</span>
              </p>
              <Design o={o} />
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
              <p className="mt-2 font-mono text-[11px] text-slate">
                {o.parcelId ? <><Link href={`/track/${o.parcelId}`} className="font-semibold text-crimson underline">Track {o.parcelId}</Link> · </> : null}{o.reference}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
