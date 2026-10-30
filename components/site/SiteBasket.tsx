"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import { NIGERIAN_STATES, validateAddress, type DeliveryAddress } from "@/lib/merch";
import { STORE_MAX_QTY } from "@/lib/orders";
import { lineKey } from "@/lib/cart";
import { useBasket } from "@/lib/cart-client";
import { useSite } from "./SiteContext";
import DiscountCodeField from "@/components/DiscountCodeField";

const field = "mt-1 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink";

// The basket (lib/cart.ts): what's in it, quantities, the delivery to the buyer's address (one for the whole basket, priced like the
// checkout prices it: lib/cart-server.ts), and one card payment. Each item then becomes its own order on My orders.
export default function SiteBasket() {
  const { uid, base, displayName, username } = useSite();
  const { lines, setQuantity, remove, clear, count, subtotalKobo } = useBasket(uid);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [addr, setAddr] = useState<DeliveryAddress>({ fullName: "", phone: "", street: "", city: "", state: "" });
  const [ship, setShip] = useState<{ deliveryKobo: number; carrier: { name: string } | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disc, setDisc] = useState<{ code: string; discountKobo: number } | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  // The delivery for this basket and address (asked again when either changes).
  const items = lines.map((l) => `${l.itemId}:${l.quantity}`).join(",");
  useEffect(() => {
    if (!items) { setShip(null); return; }
    let gone = false;
    const t = window.setTimeout(() => {
      fetch(`/api/logistics?${new URLSearchParams({ view: "basket", items, city: addr.city, state: addr.state })}`).then((r) => r.json())
        .then((j) => { if (!gone) setShip({ deliveryKobo: Number(j.deliveryKobo) || 0, carrier: j.carrier ?? null }); }).catch(() => {});
    }, 400);
    return () => { gone = true; window.clearTimeout(t); };
  }, [items, addr.city, addr.state]);

  const delivery = ship?.deliveryKobo ?? 0;
  const total = subtotalKobo + delivery;
  const toPay = Math.max(0, total - (disc?.discountKobo ?? 0));
  const set = (k: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) return;
    const problem = validateAddress(addr);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await startCheckout(user, { kind: "store_cart", lines: lines.map(({ itemId, quantity, variant }) => ({ itemId, quantity, ...(variant ? { variant } : {}) })), address: addr, ...(disc ? { code: disc.code } : {}) }, { amountKobo: toPay, payWith: "card" });
      clear(); // on its way to the payment page: the orders are made, with the stock held for 30 minutes
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="eyebrow">{displayName}</p>
      <h1 className="mt-1 font-display text-4xl text-ink">Your basket</h1>
      {!lines.length ? (
        <div className="card mt-8 p-6">
          <p className="text-sm text-slate">Your basket is empty.</p>
          <Link href={`${base}/shop`} className="btn-primary mt-4 inline-block !px-5 !py-2 text-sm">Shop now</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
            {lines.map((l) => {
              const k = lineKey(l);
              return (
                <li key={k} className="flex gap-4 p-4">
                  <Link href={`${base}/shop/${l.itemId}`} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.image} alt="" loading="lazy" decoding="async" className="h-24 w-20 rounded-xl object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/shop/${l.itemId}`} className="font-ui text-sm font-semibold text-ink hover:text-crimson">{l.title}</Link>
                    {l.variantLabel && <p className="text-xs text-slate">{l.variantLabel}</p>}
                    <p className="mt-1 font-ui text-sm font-bold text-ink">{l.price}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full border border-rule" role="group" aria-label={`Quantity of ${l.title}`}>
                        <button type="button" onClick={() => setQuantity(k, l.quantity - 1)} disabled={l.quantity <= 1} className="h-8 w-8 text-lg text-ink disabled:opacity-30" aria-label="One fewer">−</button>
                        <span className="w-6 text-center font-ui text-sm">{l.quantity}</span>
                        <button type="button" onClick={() => setQuantity(k, l.quantity + 1)} disabled={l.quantity >= STORE_MAX_QTY} className="h-8 w-8 text-lg text-ink disabled:opacity-30" aria-label="One more">+</button>
                      </span>
                      <button type="button" onClick={() => remove(k)} className="text-xs text-slate underline">Remove</button>
                    </div>
                  </div>
                  <p className="shrink-0 font-ui text-sm font-bold text-ink">{formatNaira(l.priceKobo * l.quantity)}</p>
                </li>
              );
            })}
          </ul>
          <form onSubmit={pay} className="card h-fit p-5">
            <p className="flex justify-between text-sm text-ink"><span>{count} {count === 1 ? "item" : "items"}</span><span>{formatNaira(subtotalKobo)}</span></p>
            <p className="mt-1 flex justify-between text-sm text-ink"><span>Delivery{ship?.carrier ? ` by ${ship.carrier.name}` : ""}</span><span>{addr.state ? formatNaira(delivery) : "Add your address"}</span></p>
            <p className="mt-3 flex justify-between border-t border-rule pt-3 font-ui text-base font-bold text-ink"><span>Total</span><span>{formatNaira(total)}</span></p>
            <p className="mt-5 font-ui text-sm font-bold text-ink">Deliver to</p>
            <label className="mt-2 block text-xs text-slate">Full name<input value={addr.fullName} onChange={set("fullName")} className={field} /></label>
            <label className="mt-2 block text-xs text-slate">Phone<input value={addr.phone} onChange={set("phone")} placeholder="08012345678" className={field} /></label>
            <label className="mt-2 block text-xs text-slate">Street address<input value={addr.street} onChange={set("street")} className={field} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="mt-2 block text-xs text-slate">City / town<input value={addr.city} onChange={set("city")} className={field} /></label>
              <label className="mt-2 block text-xs text-slate">State
                <select value={addr.state} onChange={set("state")} className={field}><option value="">Choose…</option>{NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
            </div>
            {user && <DiscountCodeField target="store" seller={username} itemIds={lines.map((l) => l.itemId)} subtotalKobo={subtotalKobo} extraKobo={delivery} onChange={setDisc} className="mt-3" />}
            {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
            {user === null ? (
              <Link href={`/login?next=${encodeURIComponent(`${base}/cart`)}`} className="btn-primary mt-4 block text-center">Sign in to pay</Link>
            ) : (
              <button disabled={busy || user === undefined} className="btn-primary mt-4 w-full">{busy ? "Please wait…" : `Pay ${formatNaira(toPay)}`}</button>
            )}
            <p className="mt-3 text-xs text-slate">One payment by card or bank for the whole basket, with one delivery. Your money is held by #NotesApp until you confirm each item arrived. Each item becomes its own order you can follow on My orders.</p>
          </form>
        </div>
      )}
    </div>
  );
}
