"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { api } from "@/lib/moments-client";
import { auth } from "@/lib/firebase";
import { naira, type DiscountTarget } from "@/lib/discounts";

// "Have a discount code?" at a checkout (lib/discounts.ts). Apply checks the code with the server and shows what it takes off;
// the checkout then sends the code along and the server prices the order itself. onChange(null) when the code is removed.
// Nana's pick: on any checkout, the coupon that takes the most off (the buyer's saved coupons and the ones on show, for this
// seller or #NotesApp; /api/coupons/best) is applied for them, marked as Nana's, and worked out again when the order changes.
// Removing it keeps it off; a code the buyer types always wins.
type Applied = { code: string; discountKobo: number; label: string; nana?: boolean };
export default function DiscountCodeField({ target, seller, itemId, itemIds, subtotalKobo, extraKobo, plan, onDark = false, autoPick = true, onChange, className = "" }: {
  target: DiscountTarget;
  seller?: string; // the publisher's username, for their products
  itemId?: string;
  itemIds?: string[];
  subtotalKobo: number; // the price the code works on (no delivery)
  extraKobo?: number;
  plan?: { tier: "pro" | "business"; interval: "monthly" | "annually" }; // a plan's checkout: the server prices it, and takes members' referral codes too
  onDark?: boolean; // on a dark panel (the pricing table): light text
  autoPick?: boolean; // false where something better already applies (a referred friend's free month)
  onChange: (applied: { code: string; discountKobo: number } | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [dismissed, setDismissed] = useState(false); // the buyer removed Nana's pick
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  const basket = (itemIds ?? []).join(",");
  const manual = !!applied && !applied.nana;
  useEffect(() => {
    if (!signedIn || !autoPick || dismissed || manual || (!plan && subtotalKobo <= 0)) return;
    let gone = false;
    api<{ best: { code: string; discountKobo: number; label: string; source: string } | null }>("/api/coupons/best", {
      body: { seller, target, itemId, itemIds: basket ? basket.split(",") : undefined, subtotalKobo, extraKobo, ...plan },
    }).then((r) => {
      if (gone) return;
      if (r.best) {
        setApplied({ code: r.best.code, discountKobo: r.best.discountKobo, label: `${r.best.label} · Nana's pick${r.best.source === "saved" ? " from your coupons" : ""}`, nana: true });
        onChange({ code: r.best.code, discountKobo: r.best.discountKobo });
      } else {
        setApplied((a) => { if (a?.nana) onChange(null); return a?.nana ? null : a; });
      }
    }).catch(() => {});
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, autoPick, dismissed, manual, seller, target, itemId, basket, subtotalKobo, extraKobo, plan?.tier, plan?.interval]);

  async function apply(codeText = text) {
    if (!codeText.trim()) return;
    setBusy(true); setError("");
    try {
      const r = await api<{ code: string; discountKobo: number; label: string }>("/api/discounts/check", {
        body: { code: codeText, target, seller, itemId, itemIds, subtotalKobo, extraKobo, ...plan },
      });
      setApplied(r);
      onChange({ code: r.code, discountKobo: r.discountKobo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work.");
      setOpen(true);
    } finally { setBusy(false); }
  }
  function remove() { if (applied?.nana) setDismissed(true); setApplied(null); setText(""); onChange(null); }

  if (applied && onDark) {
    return (
      <div className={`rounded-lg border border-white/30 bg-white/10 px-2.5 py-2 text-paper ${className}`}>
        <p><b className="font-mono">{applied.code}</b> · −{naira(applied.discountKobo)}</p>
        <p className="mt-0.5 leading-snug opacity-90">{applied.label}</p>
        <button type="button" onClick={remove} className="mt-1 font-ui font-semibold underline">Remove</button>
      </div>
    );
  }
  if (applied) {
    return (
      <div className={`flex items-center justify-between gap-2 rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-sm ${className}`}>
        <span><b className="font-mono text-crimson">{applied.code}</b> <span className="text-ink">· {applied.label} · −{naira(applied.discountKobo)}</span></span>
        <button type="button" onClick={remove} className="font-ui text-xs font-semibold text-slate underline">Remove</button>
      </div>
    );
  }
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={`font-ui text-sm font-semibold text-crimson underline ${className}`}>Have a discount code?</button>;
  }
  return (
    <div className={className}>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => { setText(e.target.value.toUpperCase()); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void apply(); } }}
          placeholder={plan ? "Discount or referral code" : "Discount code"} aria-label="Discount code" maxLength={40} autoCapitalize="characters"
          className="min-w-0 flex-1 rounded-lg border border-rule bg-card px-3 py-2 font-mono text-sm uppercase text-ink outline-none focus:border-crimson" />
        <button type="button" onClick={() => apply()} disabled={busy || !text.trim()} className="rounded-lg bg-crimson px-4 py-2 font-ui text-sm font-semibold text-white disabled:opacity-50">{busy ? "Checking…" : "Apply"}</button>
      </div>
      {error && <p className={`mt-1 text-xs ${onDark ? "text-paper" : "text-crimson"}`} role="alert">{error}</p>}
    </div>
  );
}
