"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { formatNaira } from "@/lib/booking-time";
import MerchPreorders from "@/components/MerchPreorders";
import DigitalPurchases from "@/components/DigitalPurchases";
import { HOLDER_LABEL, HolderType, ORDER_STATUS_LABEL, StoreOrder } from "@/lib/orders";

type Order = Omit<StoreOrder, "buyerEmail">;
type TrackView = { custody: { id: string; holderType: HolderType; holderName: string; holderPhone?: string; location: string; at: string; status: string }[] };
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

async function api(user: User, body: Record<string, unknown>) {
  const res = await fetch("/api/store/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Something went wrong.");
  return j;
}

function BuyerCard({ o, user, onDone }: { o: Order; user: User; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api(user, { reference: o.reference, ...body });
      setReporting(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="card p-4 text-sm">
      <p className="font-semibold text-ink">{o.quantity} × {o.itemTitle} <span className="font-mono text-xs text-slate">· {formatNaira(o.amountKobo)}</span></p>
      <p className="text-xs text-slate">{ORDER_STATUS_LABEL[o.status]} · parcel <Link href={`/track/${o.parcelId}`} className="font-mono text-crimson underline">{o.parcelId}</Link> · from @{o.sellerUsername}</p>
      {o.status === "delivered" && o.autoReleaseAt && <p className="mt-1 text-xs text-slate">If you say nothing, the seller is paid on {o.autoReleaseAt.slice(0, 10)}.</p>}
      {error && <p className="mt-2 text-xs text-crimson">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
        {["dispatched", "delivered"].includes(o.status) && <button disabled={busy} onClick={() => confirm("Confirm the parcel arrived? The seller is paid once you do.") && run({ action: "confirm" })} className="text-crimson">It arrived — confirm delivery</button>}
        {["paid", "dispatched", "delivered"].includes(o.status) && <button onClick={() => setReporting((v) => !v)} className="text-slate hover:text-crimson">Report a problem</button>}
        <Link href={`/track/${o.parcelId}`} className="text-slate hover:text-crimson">Track</Link>
      </div>
      {reporting && (
        <div className="mt-3">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="What went wrong?" className={field} />
          <button disabled={busy || reason.trim().length < 10} onClick={() => run({ action: "dispute", reason })} className="btn-primary mt-2 !px-4 !py-2 text-xs">Send to #NotesApp</button>
          <span className="ml-3 text-xs text-slate">Your money stays held while we look into it.</span>
        </div>
      )}
    </li>
  );
}

function SellerCard({ o, user, onDone }: { o: Order; user: User; onDone: () => void }) {
  const [track, setTrack] = useState<TrackView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [courier, setCourier] = useState({ name: "", trackingNumber: "", trackingUrl: "" });
  const [hand, setHand] = useState({ holderType: "bike" as HolderType, holderName: "", holderPhone: "", location: "", consent: false });
  const [showAddr, setShowAddr] = useState(false);

  const loadTrack = useCallback(async () => {
    const res = await fetch(`/api/track?id=${o.parcelId}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (res.ok) setTrack(await res.json());
  }, [o.parcelId, user]);
  useEffect(() => {
    loadTrack();
  }, [loadTrack, o.status]);

  async function run(body: Record<string, unknown>, after?: (j: Record<string, string>) => void) {
    setBusy(true);
    setError("");
    try {
      const j = await api(user, { reference: o.reference, ...body });
      after?.(j);
      onDone();
      await loadTrack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  const open = ["paid", "dispatched"].includes(o.status);
  return (
    <li className="card p-4 text-sm">
      <p className="font-semibold text-ink">{o.quantity} × {o.itemTitle} <span className="font-mono text-xs text-slate">· {formatNaira(o.amountKobo)} · your payout {formatNaira(o.amountKobo - o.commissionKobo)}</span></p>
      <p className="text-xs text-slate">{ORDER_STATUS_LABEL[o.status]} · parcel <Link href={`/track/${o.parcelId}`} className="font-mono text-crimson underline">{o.parcelId}</Link></p>
      <button onClick={() => setShowAddr((v) => !v)} className="mt-1 text-xs font-semibold text-crimson">{showAddr ? "Hide" : "Show"} delivery address</button>
      {showAddr && <p className="mt-1 text-xs text-ink">{o.address.fullName} · {o.address.phone}<br />{o.address.street}, {o.address.city}, {o.address.state}</p>}
      {error && <p className="mt-2 text-xs text-crimson">{error}</p>}

      {o.mode === "courier" && o.courier && (
        <p className="mt-2 text-xs text-ink">Courier: {o.courier.name} · {o.courier.trackingNumber}</p>
      )}
      {track && track.custody.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-ink">
          {track.custody.map((c) => (
            <li key={c.id}>
              {HOLDER_LABEL[c.holderType]}: {c.holderName}{c.holderPhone ? ` (${c.holderPhone})` : ""} — {c.location} <span className="text-slate">· {c.status === "pending" ? "waiting for them to confirm" : new Date(c.at).toLocaleString()}</span>
              {open && o.mode === "handoff" && (
                <button disabled={busy} onClick={() => run({ action: "holder_link", entryId: c.id }, (j) => setLink(j.url))} className="ml-2 font-semibold text-crimson">Get their update link</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {link && (
        <p className="mt-2 break-all text-xs text-ink">
          Send this to the holder (it works until the next holder confirms): <span className="font-mono">{link}</span>{" "}
          <button onClick={() => navigator.clipboard?.writeText(link)} className="font-semibold text-crimson">Copy</button>
        </p>
      )}

      {open && o.mode !== "handoff" && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-crimson">Sending by courier? Add the tracking</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-slate">Courier<input value={courier.name} onChange={(e) => setCourier({ ...courier, name: e.target.value })} className={field} placeholder="GIG Logistics" /></label>
            <label className="text-xs text-slate">Tracking number<input value={courier.trackingNumber} onChange={(e) => setCourier({ ...courier, trackingNumber: e.target.value })} className={field} /></label>
            <label className="text-xs text-slate">Tracking link (https://…)<input value={courier.trackingUrl} onChange={(e) => setCourier({ ...courier, trackingUrl: e.target.value })} className={field} /></label>
          </div>
          <button disabled={busy} onClick={() => run({ action: "set_courier", ...courier })} className="btn-primary mt-2 !px-4 !py-2 text-xs">Save &amp; mark dispatched</button>
        </details>
      )}
      {open && o.mode !== "courier" && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-crimson">Sending by bike, bus or park? Record who holds it</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate">Holder
              <select value={hand.holderType} onChange={(e) => setHand({ ...hand, holderType: e.target.value as HolderType })} className={field}>
                {(["seller", "bike", "bus", "park"] as HolderType[]).map((t) => <option key={t} value={t}>{HOLDER_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate">Holder&apos;s name<input value={hand.holderName} onChange={(e) => setHand({ ...hand, holderName: e.target.value })} className={field} /></label>
            <label className="text-xs text-slate">Their phone (optional)<input value={hand.holderPhone} onChange={(e) => setHand({ ...hand, holderPhone: e.target.value })} className={field} placeholder="08012345678" /></label>
            <label className="text-xs text-slate">Where the parcel is<input value={hand.location} onChange={(e) => setHand({ ...hand, location: e.target.value })} className={field} placeholder="Ojota motor park, Lagos" /></label>
            <label className="flex items-start gap-2 text-xs text-slate sm:col-span-2">
              <input type="checkbox" checked={hand.consent} onChange={(e) => setHand({ ...hand, consent: e.target.checked })} className="mt-0.5" />
              <span>The holder agrees to their phone number being shown to the buyer (needed if you add a number).</span>
            </label>
          </div>
          <button disabled={busy} onClick={() => run({ action: "add_custody", ...hand }, () => setHand({ ...hand, holderName: "", holderPhone: "", location: "" }))} className="btn-primary mt-2 !px-4 !py-2 text-xs">Add to the parcel&apos;s log</button>
          <p className="mt-1 text-xs text-slate">Add a new entry each time it changes hands, or give each holder an update link so they can do it themselves.</p>
        </details>
      )}
      {o.status === "dispatched" && (
        <button disabled={busy} onClick={() => confirm("Mark this parcel as delivered? The buyer is asked to confirm; if they say nothing you're paid after 7 days.") && run({ action: "mark_delivered" })} className="mt-3 text-xs font-semibold text-crimson">Mark delivered</button>
      )}
    </li>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"buying" | "selling">("buying");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (u: User, t: "buying" | "selling") => {
      try {
        const res = await fetch(`/api/store/orders?role=${t}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Couldn't load orders.");
        setOrders(j.orders);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load orders.");
      }
    },
    []
  );
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        load(u, "buying");
      }),
    [router, load]
  );

  function switchTab(t: "buying" | "selling") {
    setTab(t);
    setOrders(null);
    setError("");
    if (user) load(user, t);
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl text-ink">Orders</h1>
      <p className="mt-2 text-sm text-slate">
        Track parcels with the <Link href="/track" className="text-crimson underline">parcel ID</Link>. Money for store orders is held until the buyer confirms delivery, or 7 days after it is marked delivered.
      </p>
      <div className="mt-5 flex gap-3 text-sm">
        {(["buying", "selling"] as const).map((t) => (
          <button key={t} onClick={() => switchTab(t)} className={`rounded-full border px-4 py-1.5 ${tab === t ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{t === "buying" ? "My purchases" : "Sales from my store"}</button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {orders === null && !error && <p className="mt-6 text-sm text-slate">Loading…</p>}
      {orders?.length === 0 && <p className="mt-6 text-sm text-slate">{tab === "buying" ? "You haven't bought any physical items from a store yet." : "No physical orders yet. Add an item you can sell here from your store page."}</p>}
      <ul className="mt-6 space-y-3">
        {user && orders?.map((o) => (tab === "buying" ? <BuyerCard key={o.reference} o={o} user={user} onDone={() => load(user, tab)} /> : <SellerCard key={o.reference} o={o} user={user} onDone={() => load(user, tab)} />))}
      </ul>
      {user && tab === "buying" && <DigitalPurchases user={user} as="buyer" />}
      {user && tab === "selling" && <DigitalPurchases user={user} as="seller" />}
      {user && tab === "buying" && <MerchPreorders uid={user.uid} />}
    </section>
  );
}
