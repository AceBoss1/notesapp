"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HOLDER_LABEL, HolderType, ORDER_STATUS_LABEL, OrderStatus } from "@/lib/orders";
import { MERCH_STEPS, MerchOrderStatus } from "@/lib/merch";
import { isErrand, shipmentStatusLabel } from "@/lib/shipments";

type View = {
  parcelId: string;
  itemTitle: string;
  quantity: number;
  status: OrderStatus | "cancelled";
  kind: "store" | "merch" | "shipment";
  merchStatus: MerchOrderStatus | null;
  seller: { name: string; username: string };
  destination: string;
  shipment: { serviceId: string; service: string; pickup: string } | null;
  mode: "courier" | "handoff" | null;
  courier: { name: string; trackingNumber: string; trackingUrl: string } | null;
  custody: { id: string; holderType: HolderType; holderName: string; holderPhone?: string; location: string; at: string; status: "confirmed" | "pending" }[];
  hasPhones: boolean;
  phonesUnlocked: boolean;
  phoneError: string;
};

// One parcel's tracking page: on #NotesApp (/track/<id>) for store orders, merch and shipments, and on a logistics business's own
// site (Track section), where `site` limits it to that business's shipments and keeps every link on their site.
export default function ParcelView({ id, site }: { id: string; site?: { base: string; username: string; contact: boolean } }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [last4, setLast4] = useState("");
  const lookup = site ? `${site.base}/track` : "/track";
  const seller = site?.username; // a primitive, so a new `site` object each render doesn't reload

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setToken(u ? await u.getIdToken() : null);
        setAuthReady(true);
      }),
    []
  );

  const load = useCallback(
    async (digits?: string) => {
      setError("");
      const q = `id=${encodeURIComponent(id)}${seller ? `&seller=${encodeURIComponent(seller)}` : ""}${digits ? `&last4=${digits}` : ""}`;
      const res = await fetch(`/api/track?${q}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      const j = await res.json();
      if (!res.ok) {
        setView(null);
        return setError(j.error || "Couldn't look that up.");
      }
      setView(j);
    },
    [id, token, seller]
  );
  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  if (error && !view) return <div className="mx-auto max-w-md px-4 py-24 text-center text-slate">{error} <Link href={lookup} className="text-crimson underline">Try another number</Link></div>;
  if (!view) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const latest = [...view.custody].reverse().find((c) => c.status === "confirmed");
  const merch = view.kind === "merch";
  const shipment = view.kind === "shipment";
  const merchStep = merch ? MERCH_STEPS.findIndex((s) => s.status === view.merchStatus) : -1;
  // A logistics business's own office or warehouse is the "Seller" entry of a hand-off chain.
  const holder = (t: HolderType) => (shipment && t === "seller" ? "Office" : HOLDER_LABEL[t]);
  const statusLabel = shipment ? shipmentStatusLabel(view.status, view.shipment?.serviceId) : ORDER_STATUS_LABEL[view.status as OrderStatus];
  const errand = shipment && isErrand(view.shipment?.serviceId ?? "");

  return (
    <section className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <span className="eyebrow">{shipment ? "Tracking number" : "Parcel"} {view.parcelId}</span>
      {/* A shipment's description often carries its own count ("2 cartons of shoes"), so its quantity goes on the line below. */}
      <h1 className="mt-3 font-display text-3xl text-ink">{shipment ? view.itemTitle : `${view.quantity} × ${view.itemTitle}`}</h1>
      <p className="mt-1 text-sm text-slate">
        {shipment && view.shipment ? <>{view.shipment.service}{view.quantity > 1 ? ` · ${view.quantity} pieces` : ""} · from {view.shipment.pickup}{!site && <> · by {view.seller.username ? <Link href={`/u/${view.seller.username}`} className="text-crimson underline">{view.seller.name}</Link> : view.seller.name}</>}</>
          : <>From {view.seller.username ? <Link href={`/u/${view.seller.username}/store`} className="text-crimson underline">{view.seller.name}</Link> : view.seller.name}</>}
        {" "}· to {view.destination}
      </p>
      {merch ? (
        view.merchStatus === "refunded" ? (
          <p className="mt-4 inline-block border border-rule px-3 py-1 font-mono text-xs uppercase tracking-wideish text-ink">Refunded</p>
        ) : (
          <ol className="mt-5 grid grid-cols-4 gap-1 text-center text-[11px]">
            {MERCH_STEPS.map((s, i) => (
              <li key={s.status} className={i <= merchStep ? "text-crimson" : "text-slate/60"}>
                <span className={`mx-auto mb-1 block h-1.5 rounded-full ${i <= merchStep ? "bg-crimson" : "bg-rule"}`} />
                <span className="font-semibold">{s.label}</span>
              </li>
            ))}
          </ol>
        )
      ) : (
        <p className="mt-4 inline-block border border-rule px-3 py-1 font-mono text-xs uppercase tracking-wideish text-ink">{statusLabel}</p>
      )}

      {view.mode === "courier" && view.courier && (
        <div className="card mt-6 p-5 text-sm">
          <p className="font-ui font-bold text-ink">With {view.courier.name}</p>
          <p className="mt-1 text-slate">Tracking number: <span className="font-mono text-ink">{view.courier.trackingNumber}</span></p>
          {view.courier.trackingUrl && (
            <a href={view.courier.trackingUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-primary mt-3 inline-block !px-4 !py-2 text-xs">Open tracking ↗</a>
          )}
          <p className="mt-2 text-xs text-slate">The courier&apos;s own tracking page opens in a new tab. Paste the number there if it asks for it.</p>
        </div>
      )}

      {view.mode === "handoff" && (
        <div className="card mt-6 p-5 text-sm">
          {latest ? (
            <>
              <p className="font-ui font-bold text-ink">Right now: {holder(latest.holderType)} — {latest.holderName}</p>
              <p className="mt-1 text-slate">{latest.location} · updated {new Date(latest.at).toLocaleString("en-NG", { hour12: true })}</p>
              {latest.holderPhone && <p className="mt-1 text-ink">Call: <a href={`tel:${latest.holderPhone}`} className="font-mono text-crimson">{latest.holderPhone}</a></p>}
            </>
          ) : (
            <p className="text-slate">{shipment ? "Nobody has been recorded as holding it yet." : "The seller hasn't recorded who holds the parcel yet."}</p>
          )}
          {view.hasPhones && !view.phonesUnlocked && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                load(last4);
              }}
              className="mt-4 border-t border-rule pt-4"
            >
              <p className="text-xs text-slate">{shipment
                ? "To see the rider's phone number, enter the last 4 digits of the receiver's phone number."
                : "To see the holder's phone number, enter the last 4 digits of the receiver's phone number (the one given at checkout) — or sign in as the buyer."}</p>
              <div className="mt-2 flex gap-2">
                <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1234" aria-label="Last 4 digits of the receiver's phone number" className="w-24 border border-rule bg-card px-3 py-2 font-mono text-sm outline-none focus:border-crimson" />
                <button disabled={last4.length !== 4} className="btn-primary !px-4 !py-2 text-xs">Show phone numbers</button>
              </div>
              {view.phoneError && <p className="mt-2 text-xs text-crimson">{view.phoneError}</p>}
            </form>
          )}
          {view.custody.length > 1 && (
            <ol className="mt-4 space-y-2 border-t border-rule pt-4 text-xs text-slate">
              {[...view.custody].reverse().map((c) => (
                <li key={c.id}>
                  <span className="text-ink">{holder(c.holderType)} — {c.holderName}</span>{c.holderPhone ? ` · ${c.holderPhone}` : ""} · {c.location} · {c.status === "pending" ? "handed on, not yet confirmed" : new Date(c.at).toLocaleString("en-NG", { hour12: true })}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {!view.mode && view.status === "paid" && (
        <p className="mt-6 text-sm text-slate">
          {merch ? "Official merch is printed after the batch closes, then shipped. This page updates at every step." : shipment ? (view.shipment?.serviceId === "warehouse" ? "It's in storage. This page updates when it's despatched and at every hand-off." : errand ? "A runner will pick it up soon. This page updates at every step." : "It hasn't been picked up yet. This page updates at every hand-off.") : "The seller hasn't dispatched this yet."}
        </p>
      )}
      {shipment ? (
        <p className="mt-8 text-xs text-slate">
          {view.seller.name} keeps this record up to date at every hand-off.{" "}
          {site ? site.contact && <>Questions? <Link href={`${site.base}/contact`} className="text-crimson underline">Contact {view.seller.name}</Link> and quote {view.parcelId}.</> : <>Questions? Contact {view.seller.name} and quote {view.parcelId}.</>}
          {" "}<Link href={lookup} className="text-crimson underline">Track another parcel</Link>
        </p>
      ) : merch ? (
        <p className="mt-8 text-xs text-slate">Official #NotesApp merch, fulfilled by #NotesApp. Questions? Use the <Link href="/contact" className="text-crimson underline">Contact</Link> page and quote parcel {view.parcelId}.</p>
      ) : (
        <p className="mt-8 text-xs text-slate">
          #NotesApp holds the buyer&apos;s payment until delivery is confirmed but isn&apos;t the seller or the carrier — the seller keeps this record up to date.
          Buyers can confirm delivery or report a problem under <Link href="/orders" className="text-crimson underline">My orders</Link>.
        </p>
      )}
    </section>
  );
}
