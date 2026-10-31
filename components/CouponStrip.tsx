"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { auth } from "@/lib/firebase";
import { couponPath, type PublicCoupon } from "@/lib/discounts";

// The coupons a publisher chose to show in their shop (lib/discounts-server.ts shopCoupons), on their store and product pages:
// Copy the code, or Save it to My coupons (Nana applies the best one at checkout). Nothing shows when there are none.
export default function CouponStrip({ seller, itemId, className = "" }: { seller: string; itemId?: string; className?: string }) {
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => {
    const q = `seller=${encodeURIComponent(seller)}${itemId ? `&item=${encodeURIComponent(itemId)}` : ""}`;
    fetch(`/api/coupons?${q}`).then((r) => r.json()).then((r) => setCoupons(r.coupons ?? [])).catch(() => setCoupons([]));
  }, [seller, itemId]);
  if (!coupons.length) return null;

  async function save(c: PublicCoupon) {
    if (!auth.currentUser) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; }
    try { await api("/api/coupons", { body: { action: "save", seller, code: c.code } }); setNote(`${c.code} saved. Nana applies it at checkout when it's your best coupon.`); }
    catch (e) { setNote(e instanceof Error ? e.message : "Couldn't save it."); }
  }
  async function copy(c: PublicCoupon) {
    try { await navigator.clipboard.writeText(c.code); setNote(`Copied ${c.code}. Use it under "Have a discount code?" at checkout.`); } catch { window.prompt("Copy", c.code); }
  }

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-2">
        {coupons.map((c) => (
          <li key={c.code} className="flex items-center gap-2 rounded-xl border-2 border-dashed border-crimson/40 bg-crimson/5 px-3 py-2 text-sm">
            <span className="text-lg" aria-hidden>🏷️</span>
            <span>
              <b className="text-crimson">{c.label}</b> with <Link href={couponPath(seller, c.code)} className="font-mono font-bold text-ink underline decoration-dotted">{c.code}</Link>
              {c.minOrderKobo ? <span className="text-slate"> · over ₦{(c.minOrderKobo / 100).toLocaleString("en-NG")}</span> : null}
              {c.firstOrderOnly ? <span className="text-slate"> · first order</span> : null}
            </span>
            <button type="button" onClick={() => copy(c)} className="rounded-full border border-rule bg-card px-2.5 py-1 font-ui text-xs font-semibold text-ink hover:border-crimson">Copy</button>
            <button type="button" onClick={() => save(c)} className="rounded-full bg-crimson px-2.5 py-1 font-ui text-xs font-semibold text-white">Save</button>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs text-moss" role="status">{note}</p>}
    </div>
  );
}
