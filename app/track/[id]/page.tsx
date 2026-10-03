"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HOLDER_LABEL, HolderType, ORDER_STATUS_LABEL, OrderStatus } from "@/lib/orders";
import { MERCH_STEPS, MerchOrderStatus } from "@/lib/merch";

type View = {
  parcelId: string;
  itemTitle: string;
  quantity: number;
  status: OrderStatus;
  kind: "store" | "merch";
  merchStatus: MerchOrderStatus | null;
  seller: { name: string; username: string };
  destination: string;
  mode: "courier" | "handoff" | null;
  courier: { name: string; trackingNumber: string; trackingUrl: string } | null;
  custody: { id: string; holderType: HolderType; holderName: string; holderPhone?: string; location: string; at: string; status: "confirmed" | "pending" }[];
  hasPhones: boolean;
  phonesUnlocked: boolean;
  phoneError: string;
};

export default function TrackParcelPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [last4, setLast4] = useState("");

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
      const res = await fetch(`/api/track?id=${encodeURIComponent(id)}${digits ? `&last4=${digits}` : ""}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      const j = await res.json();
      if (!res.ok) {
        setView(null);
        return setError(j.error || "Couldn't look that up.");
      }
      setView(j);
    },
    [id, token]
  );
  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  if (error && !view) return <div className="mx-auto max-w-md px-4 py-24 text-center text-slate">{error} <Link href="/track" className="text-crimson underline">Try another ID</Link></div>;
  if (!view) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const latest = [...view.custody].reverse().find((c) => c.status === "confirmed");
  const merch = view.kind === "merch";
  const merchStep = merch ? MERCH_STEPS.findIndex((s) => s.status === view.merchStatus) : -1;

  return (
    <section className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Parcel {view.parcelId}</span>
      <h1 className="mt-3 font-display text-3xl text-ink">{view.quantity} × {view.itemTitle}</h1>
      <p className="mt-1 text-sm text-slate">
        From {view.seller.username ? <Link href={`/u/${view.seller.username}/store`} className="text-crimson underline">{view.seller.name}</Link> : view.seller.name} · to {view.destination}
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
        <p className="mt-4 inline-block border border-rule px-3 py-1 font-mono text-xs uppercase tracking-wideish text-ink">{ORDER_STATUS_LABEL[view.status]}</p>
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
              <p className="font-ui font-bold text-ink">Right now: {HOLDER_LABEL[latest.holderType]} — {latest.holderName}</p>
              <p className="mt-1 text-slate">{latest.location} · updated {new Date(latest.at).toLocaleString()}</p>
              {latest.holderPhone && <p className="mt-1 text-ink">Call: <a href={`tel:${latest.holderPhone}`} className="font-mono text-crimson">{latest.holderPhone}</a></p>}
            </>
          ) : (
            <p className="text-slate">The seller hasn&apos;t recorded who holds the parcel yet.</p>
          )}
          {view.hasPhones && !view.phonesUnlocked && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                load(last4);
              }}
              className="mt-4 border-t border-rule pt-4"
            >
              <p className="text-xs text-slate">To see the holder&apos;s phone number, enter the last 4 digits of the receiver&apos;s phone number (the one given at checkout) — or sign in as the buyer.</p>
              <div className="mt-2 flex gap-2">
                <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1234" className="w-24 border border-rule bg-card px-3 py-2 font-mono text-sm outline-none focus:border-crimson" />
                <button disabled={last4.length !== 4} className="btn-primary !px-4 !py-2 text-xs">Show phone numbers</button>
              </div>
              {view.phoneError && <p className="mt-2 text-xs text-crimson">{view.phoneError}</p>}
            </form>
          )}
          {view.custody.length > 1 && (
            <ol className="mt-4 space-y-2 border-t border-rule pt-4 text-xs text-slate">
              {[...view.custody].reverse().map((c) => (
                <li key={c.id}>
                  <span className="text-ink">{HOLDER_LABEL[c.holderType]} — {c.holderName}</span>{c.holderPhone ? ` · ${c.holderPhone}` : ""} · {c.location} · {c.status === "pending" ? "handed on, not yet confirmed" : new Date(c.at).toLocaleString()}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {!view.mode && view.status === "paid" && (
        <p className="mt-6 text-sm text-slate">
          {merch ? "Official merch is printed after the batch closes, then shipped. This page updates at every step." : "The seller hasn't dispatched this yet."}
        </p>
      )}
      {merch ? (
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
