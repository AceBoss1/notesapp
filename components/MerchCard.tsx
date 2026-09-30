"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import {
  MerchItem,
  LOGO_OPTIONS,
  MERCH_BATCH,
  MERCH_DELIVERY_KOBO,
  MERCH_MAX_QTY,
  NIGERIAN_STATES,
  DeliveryAddress,
  merchBatchOpen,
  validateAddress,
} from "@/lib/merch";
import MerchMockup from "@/components/MerchMockup";

const field = "mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 font-body text-sm focus:border-crimson outline-none";
const EMPTY: DeliveryAddress = { fullName: "", phone: "", street: "", city: "", state: "" };

export default function MerchCard({ item }: { item: MerchItem }) {
  const [logoId, setLogoId] = useState(LOGO_OPTIONS[0].id);
  const logo = LOGO_OPTIONS.find((l) => l.id === logoId) || LOGO_OPTIONS[0];
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(item.sizes?.[1] ?? "");
  const [qty, setQty] = useState(1);
  const [addr, setAddr] = useState<DeliveryAddress>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const batchOpen = merchBatchOpen();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const total = item.priceKobo * qty + MERCH_DELIVERY_KOBO;

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const problem = validateAddress(addr);
    if (problem) return setError(problem);
    if (!user) return;
    setBusy(true);
    try {
      await startCheckout(user, { kind: "merch", itemId: item.id, logoId, size: size || undefined, quantity: qty, address: addr });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <MerchMockup item={item} logoSrc={logo.image} logoAlt={logo.label} />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-ui text-base font-bold text-ink">{item.name}</h3>
        <p className="mt-1 font-mono text-sm text-crimson-bright">{formatNaira(item.priceKobo)}</p>

        <label className="mt-4 block">
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Logo</span>
          <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className={field}>
            {LOGO_OPTIONS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </label>

        {!open ? (
          <>
            <button onClick={() => setOpen(true)} disabled={!batchOpen} className="btn-primary mt-4 !py-2 text-xs disabled:opacity-50">
              {batchOpen ? "Pre-order" : "Batch closed"}
            </button>
            <p className="mt-2 text-[11px] text-slate">
              {MERCH_BATCH.label} closes {MERCH_BATCH.closesOn}. Plus {formatNaira(MERCH_DELIVERY_KOBO)} delivery (Nigeria).
            </p>
          </>
        ) : !user ? (
          <p className="mt-4 text-sm text-slate">
            <Link href="/login" className="text-crimson underline">Sign in</Link> to pre-order.
          </p>
        ) : (
          <form onSubmit={pay} className="mt-4 grid gap-2">
            {item.sizes && (
              <label className="text-xs text-slate">Size
                <select value={size} onChange={(e) => setSize(e.target.value)} className={field}>
                  {item.sizes.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            )}
            <label className="text-xs text-slate">Quantity
              <input type="number" min={1} max={MERCH_MAX_QTY} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(MERCH_MAX_QTY, Number(e.target.value) || 1)))} className={field} />
            </label>
            <label className="text-xs text-slate">Recipient name
              <input value={addr.fullName} onChange={(e) => setAddr({ ...addr, fullName: e.target.value })} className={field} autoComplete="name" />
            </label>
            <label className="text-xs text-slate">Phone
              <input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} placeholder="08012345678" className={field} autoComplete="tel" />
            </label>
            <label className="text-xs text-slate">Street address
              <input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} className={field} autoComplete="street-address" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate">City / town
                <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} className={field} />
              </label>
              <label className="text-xs text-slate">State
                <select value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} className={field}>
                  <option value="">Choose…</option>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <button disabled={busy} className="btn-primary mt-1 !py-2 text-xs">
              {busy ? "Starting…" : `Pay ${formatNaira(total)}`}
            </button>
            <p className="text-[11px] text-slate">
              {formatNaira(item.priceKobo)} × {qty} + {formatNaira(MERCH_DELIVERY_KOBO)} delivery. {MERCH_BATCH.deliveryNote} Refunds are available until the batch is printed.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
