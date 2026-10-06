"use client";

import AppLink, { useAppPush } from "@/components/AppLink";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDocs, getDoc, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import { NIGERIAN_STATES, validateAddress } from "@/lib/merch";
import { STORE_MAX_QTY } from "@/lib/orders";
import { digitalReady, isViewOnly, variantCombos, variantKey, type StoreItem } from "@/lib/store";
import { fmtSize } from "@/lib/store-files";
import NotifyWhenBack from "@/components/NotifyWhenBack";
import BoostNudge from "@/components/BoostNudge";
import { isMainHost } from "@/lib/host";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

export default function ShopItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const push = useAppPush(); // a full page load on a member's own domain
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [item, setItem] = useState<(StoreItem & { ownerUid: string }) | null | undefined>(undefined);
  const [seller, setSeller] = useState<{ username: string; displayName: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selection, setSelection] = useState<string[]>([]); // one choice per option (Size, Colour …); "" = not chosen yet
  const [shown, setShown] = useState(0); // which photo is large
  const [addr, setAddr] = useState({ fullName: "", phone: "", street: "", city: "", state: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [owned, setOwned] = useState(false); // this buyer already bought this download
  // On a seller's own domain (Enterprise) we only show the item; signing in and paying happen on the main site.
  const [customHost, setCustomHost] = useState(false);
  const [backTo, setBackTo] = useState<{ host: string; username: string } | null>(null);
  useEffect(() => {
    setCustomHost(!isMainHost(window.location.hostname));
    const from = new URLSearchParams(window.location.search).get("from");
    if (from) {
      fetch(`/api/public/domain-resolve?host=${encodeURIComponent(from)}`)
        .then((r) => r.json())
        .then((d) => d.found && setBackTo({ host: d.host, username: d.username }))
        .catch(() => {});
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  useEffect(() => {
    if (!user) return setOwned(false);
    getDocs(query(collection(db, "digitalPurchases"), where("buyerUid", "==", user.uid), where("itemId", "==", itemId), limit(1)))
      .then((s) => setOwned(!s.empty))
      .catch(() => setOwned(false));
  }, [user, itemId]);
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

  const digital = item.kind === "digital";
  const viewOnly = isViewOnly(item);
  const unit = item.priceKobo ?? 0;
  const delivery = item.deliveryKobo ?? 0;
  const options = digital ? [] : item.options ?? [];
  const vs = item.variantStock ?? {};
  const chosen = options.length > 0 && options.every((_, i) => selection[i]);
  const selectedStock = chosen ? Number(vs[variantKey(selection)]) || 0 : null;
  // A choice can be picked if some combination with it (and with what's already chosen) is in stock.
  const available = (i: number, choice: string) =>
    variantCombos(options).some((c) => c[i] === choice && c.every((x, j) => j === i || !selection[j] || selection[j] === x) && (Number(vs[variantKey(c)]) || 0) > 0);
  const inStock = item.stock ?? 0; // total across options
  const maxQty = Math.max(1, Math.min(STORE_MAX_QTY, selectedStock ?? inStock));
  const photos = item.images?.length ? item.images : item.image ? [item.image] : [];
  const unitsLeft = selectedStock ?? inStock;
  const qty = Math.min(quantity, maxQty);
  const total = unit * qty + delivery;
  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  async function payDigital() {
    setError("");
    if (!user) return push("/login");
    if (!agreed) return setError("Tick the box to confirm you understand a download is final.");
    setBusy(true);
    try {
      await startCheckout(user, { kind: "digital", itemId, acceptFinal: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) return push("/login");
    if (options.length && !chosen) return setError(`Choose ${options.map((o) => o.name.toLowerCase()).join(" and ")} first.`);
    if (selectedStock !== null && selectedStock <= 0) return setError("That option is sold out — pick another.");
    const problem = validateAddress(addr);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await startCheckout(user, { kind: "store", itemId, quantity: qty, ...(options.length ? { variant: selection } : {}), address: addr });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      {backTo && (
        <a href={`https://${backTo.host}/store`} className="mb-3 inline-block text-sm text-crimson underline">← Back to the store</a>
      )}
      <span className="eyebrow">Store</span>
      <h1 className="mt-3 font-display text-3xl text-ink">{item.title}</h1>
      {seller && <p className="mt-1 text-sm text-slate">Sold by <Link href={`/u/${seller.username}/store`} className="text-crimson underline">{seller.displayName}</Link></p>}
      <div className="mt-6">
        {photos.length > 0 && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[Math.min(shown, photos.length - 1)]} alt="" className="max-h-[28rem] w-full border border-rule object-contain" />
            {photos.length > 1 && (
              <div className="mt-2 flex gap-2">
                {photos.map((src, i) => (
                  <button key={src} type="button" onClick={() => setShown(i)} aria-label={`Photo ${i + 1}`} className={`border ${i === shown ? "border-crimson" : "border-rule"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-16 w-14 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="mt-4 text-sm text-slate">{item.subtitle}</p>
      </div>

      {options.map((o, i) => (
        <div key={o.name} className="mt-6">
          <p className="font-ui text-xs font-bold text-ink">{o.name}{selection[i] ? <span className="ml-1 font-normal text-slate">: {selection[i]}</span> : null}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {o.choices.map((c) => {
              const ok = available(i, c);
              const on = selection[i] === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={!ok && !on}
                  aria-pressed={on}
                  onClick={() => setSelection((cur) => { const n = options.map((_, j) => cur[j] || ""); n[i] = on ? "" : c; return n; })}
                  className={`min-w-[3rem] border px-3 py-2 text-sm ${on ? "border-ink bg-ink text-paper" : "border-rule text-ink"} ${!ok && !on ? "cursor-not-allowed text-slate/50 line-through opacity-60" : "hover:border-crimson"}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {customHost && !user ? (
        <div className="card mt-8 p-5 text-sm">
          <p className="font-ui font-bold text-ink">{digital ? (viewOnly ? "View-only" : "Digital download") : "Buy this item"} · {formatNaira(unit)}</p>
          <p className="mt-1 text-slate">Sign in to buy. You&apos;ll be brought straight back here, then pay securely with Paystack.</p>
          <a href="/login" className="btn-primary mt-4 inline-block">Sign in to buy</a>
        </div>
      ) : digital ? (
        !digitalReady(item) ? (
          <p className="card mt-8 p-5 text-sm text-slate">The seller is still finishing setting this {viewOnly ? "up" : "download up"}. Check back soon.</p>
        ) : owned ? (
          <div className="card mt-8 p-5 text-sm">
            <p className="font-ui font-bold text-ink">{viewOnly ? "You own this" : "You own this download"}</p>
            <p className="mt-1 text-slate">Find it under My orders → My purchases.</p>
            <AppLink href="/orders" className="btn-primary mt-3 inline-block !px-4 !py-2 text-xs">{viewOnly ? "Open it" : "Go to my downloads"}</AppLink>
          </div>
        ) : (
          <div className="card mt-8 p-5 text-sm">
            {viewOnly ? (
              <>
                <p className="font-ui font-bold text-ink">{(item.lessonCount ?? 0) > 1 ? `Course · ${item.lessonCount} lessons` : "View-only"} · watch or read online</p>
                <p className="mt-1 text-slate">Instant access after payment. There is nothing to download: you watch the videos and read the PDFs here on #NotesApp, on up to <strong>2 devices</strong> (as many times as you like on those two).</p>
                {item.lessons && item.lessons.length > 0 && (
                  <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-xs text-slate">
                    {item.lessons.map((l) => <li key={l.id}>{l.title} <span className="font-mono">· {l.kind === "video" ? "video" : "PDF"}</span></li>)}
                  </ol>
                )}
              </>
            ) : (
              <>
                <p className="font-ui font-bold text-ink">Digital download · {item.fileName}{item.fileSize ? ` (${fmtSize(item.fileSize)})` : ""}</p>
                <p className="mt-1 text-slate">Instant access after payment: no shipping, nothing to wait for.</p>
              </>
            )}
            <p className="mt-3 text-ink">Price: <strong>{formatNaira(unit)}</strong></p>
            <label className="mt-3 flex items-start gap-2 text-xs text-slate">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
              <span>{viewOnly ? "I understand this is view-only, works on 2 devices, and once I open it the purchase is final and can't be refunded." : "I understand this is a digital download: once I download it the purchase is final and can't be refunded."} See <Link href="/terms" className="text-crimson underline">Terms 5g</Link>.</span>
            </label>
            {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
            <button onClick={payDigital} disabled={busy} className="btn-primary mt-4">{busy ? "Please wait…" : user ? `Pay ${formatNaira(unit)}` : "Sign in to buy"}</button>
          </div>
        )
      ) : inStock <= 0 ? (
        <div className="card mt-8 p-5 text-sm">
          <p className="font-ui font-bold text-ink">Sold out</p>
          <p className="mt-1 text-slate">This item is out of stock right now. We&apos;ll put an alert in your bell the moment the seller restocks it.</p>
          <div className="mt-3"><NotifyWhenBack itemId={itemId} /></div>
        </div>
      ) : (
      <form onSubmit={pay} className="mt-8 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate">Quantity
          <input type="number" min={1} max={maxQty} value={qty} onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))} className={field} />
        </label>
        <div className="self-end text-sm text-ink">
          {formatNaira(unit)} × {qty}{delivery ? ` + ${formatNaira(delivery)} delivery` : " · delivery arranged by the seller"} = <strong>{formatNaira(total)}</strong>
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
          {unitsLeft <= 5 && <>Only {unitsLeft} left{selectedStock !== null ? " in that option" : ""} — we reserve your quantity for 30 minutes while you pay. </>}Your payment is held by #NotesApp until you confirm the parcel arrived (or 7 days after it&apos;s marked delivered). You get a parcel ID to track it, and you can report a problem.
          #NotesApp is not the seller or the carrier — see <Link href="/terms" className="text-crimson underline">Terms 5g</Link>.
        </p>
        {error && <p className="sm:col-span-2 text-sm text-crimson">{error}</p>}
        <button disabled={busy} className="btn-primary sm:col-span-2">{busy ? "Please wait…" : user ? `Pay ${formatNaira(total)}` : "Sign in to buy"}</button>
      </form>
      )}
      <BoostNudge itemId={itemId} title={item.title} author={seller?.displayName || "Your store"} image={item.image} authorUid={item.ownerUid} />
    </section>
  );
}
