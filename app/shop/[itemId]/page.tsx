"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import { NIGERIAN_STATES, validateAddress } from "@/lib/merch";
import { STORE_MAX_QTY } from "@/lib/orders";
import type { StoreItem } from "@/lib/store";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

export default function ShopItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [item, setItem] = useState<(StoreItem & { ownerUid: string }) | null | undefined>(undefined);
  const [seller, setSeller] = useState<{ username: string; displayName: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addr, setAddr] = useState({ fullName: "", phone: "", street: "", city: "", state: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  useEffect(() => {
    getDoc(doc(db, "storeItems", itemId))
      .then(async (s) => {
        const d = s.data() as (StoreItem & { ownerUid: string }) | undefined;
        if (!d || !d.sellable) return setItem(null);
        setItem({ ...d, id: s.id });
        const u = await getDoc(doc(db, "users", d.ownerUid));
        const ud = u.data();
        if (ud) setSeller({ username: ud.username, displayName: ud.displayName });
      })
      .catch(() => setItem(null));
  }, [itemId]);

  if (item === undefined || user === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!item) return <div className="px-6 py-24 text-center text-slate">This item isn&apos;t for sale here.</div>;

  const unit = item.priceKobo ?? 0;
  const delivery = item.deliveryKobo ?? 0;
  const total = unit * quantity + delivery;
  const maxQty = Math.min(STORE_MAX_QTY, item.stock ?? STORE_MAX_QTY);
  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) return router.push("/login");
    const problem = validateAddress(addr);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await startCheckout(user, { kind: "store", itemId, quantity, address: addr });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Store</span>
      <h1 className="mt-3 font-display text-3xl text-ink">{item.title}</h1>
      {seller && <p className="mt-1 text-sm text-slate">Sold by <Link href={`/u/${seller.username}/store`} className="text-crimson underline">{seller.displayName}</Link></p>}
      <div className="mt-6 flex gap-4">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-28 w-28 shrink-0 border border-rule object-cover" />
        )}
        <p className="text-sm text-slate">{item.subtitle}</p>
      </div>

      <form onSubmit={pay} className="mt-8 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate">Quantity
          <input type="number" min={1} max={maxQty} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))} className={field} />
        </label>
        <div className="self-end text-sm text-ink">
          {formatNaira(unit)} × {quantity}{delivery ? ` + ${formatNaira(delivery)} delivery` : " · delivery arranged by the seller"} = <strong>{formatNaira(total)}</strong>
        </div>
        <p className="sm:col-span-2 mt-2 font-ui text-sm font-bold text-ink">Deliver to</p>
        <label className="text-xs text-slate">Full name<input value={addr.fullName} onChange={set("fullName")} className={field} /></label>
        <label className="text-xs text-slate">Phone (the seller and carriers may call this)<input value={addr.phone} onChange={set("phone")} placeholder="08012345678" className={field} /></label>
        <label className="text-xs text-slate sm:col-span-2">Street address<input value={addr.street} onChange={set("street")} className={field} /></label>
        <label className="text-xs text-slate">City / town<input value={addr.city} onChange={set("city")} className={field} /></label>
        <label className="text-xs text-slate">State
          <select value={addr.state} onChange={set("state")} className={field}>
            <option value="">Choose…</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <p className="sm:col-span-2 text-xs text-slate">
          Your payment is held by #NotesApp until you confirm the parcel arrived (or 7 days after it&apos;s marked delivered). You get a parcel ID to track it, and you can report a problem.
          #NotesApp is not the seller or the carrier — see <Link href="/terms" className="text-crimson underline">Terms 5g</Link>.
        </p>
        {error && <p className="sm:col-span-2 text-sm text-crimson">{error}</p>}
        <button disabled={busy} className="btn-primary sm:col-span-2">{busy ? "Please wait…" : user ? `Pay ${formatNaira(total)}` : "Sign in to buy"}</button>
      </form>
    </section>
  );
}
