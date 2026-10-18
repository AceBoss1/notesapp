"use client";

import { useEffect } from "react";
import { fmtN } from "@/lib/life/catalog";
import { CARDTAP, type TapCharge } from "@/lib/life/cardtap";

// Paylony CardTap (partner) in Notes Life: the merchant's phone shows what you're paying, you tap your CardTap card on it, it beeps and
// approves. Only Notesville Naira moves (the server charges it); buying N$ with NotesApp Credit never comes through here.
export type TapPhase = "ready" | "reading" | "approved" | "declined";
export type TapState = { charge: TapCharge; phase: TapPhase; message?: string };

const BLUE = "#1d4ed8";

function Waves({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M8.5 8.5a5 5 0 0 1 0 7" /><path d="M12 6a8.5 8.5 0 0 1 0 12" /><path d="M15.5 3.5a12 12 0 0 1 0 17" />
    </svg>
  );
}

// The player's card: CardTap's colours, their name and the last four digits (made from their account; not a real card).
export function CardTapCard({ holder, last4, small = false }: { holder: string; last4: string; small?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#4c1d95] text-white shadow-xl ${small ? "h-24 w-40 p-2.5" : "h-36 w-60 p-4"}`}>
      <span className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#7c3aed]/40 blur-xl" aria-hidden />
      <div className="relative flex items-start justify-between">
        <b className={small ? "text-xs" : "text-base"}>CardTap</b>
        <Waves className={small ? "h-4 w-4" : "h-6 w-6"} />
      </div>
      <span className={`relative mt-1.5 block rounded-md bg-gradient-to-br from-amber-200 to-amber-500 ${small ? "h-4 w-6" : "h-7 w-10"}`} aria-hidden />
      <p className={`relative font-mono tracking-widest ${small ? "mt-1 text-[9px]" : "mt-2 text-sm"}`}>•••• •••• •••• {last4}</p>
      <div className={`relative flex items-end justify-between gap-2 ${small ? "text-[8px]" : "text-[10px]"}`}>
        <b className="min-w-0 truncate uppercase tracking-wide">{holder}</b>
        <span className="shrink-0 uppercase opacity-75">N$ debit</span>
      </div>
    </div>
  );
}

export default function CardTap({ tap, holder, last4, onTap, onCancel }: { tap: TapState; holder: string; last4: string; onTap: () => void; onCancel: () => void }) {
  const { charge, phase, message } = tap;
  // Esc cancels before the tap and closes after a decline; once the card is read, the payment finishes on its own.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && (phase === "ready" || phase === "declined")) onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [phase, onCancel]);
  const tapped = phase !== "ready";

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 p-3 lg:items-center" role="dialog" aria-modal="true" aria-label={`Pay ${fmtN(charge.amount)} to ${charge.payee} with CardTap`}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b from-[#eef3fb] to-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <img src={CARDTAP.logo} alt="CardTap by Lony Tech Solutions" className="h-8 w-auto rounded-md" />
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: BLUE }}>PARTNER</span>
        </div>

        {/* the merchant's phone, taking the payment */}
        <div className="mx-auto mt-4 w-52 rounded-[2rem] border-[6px] border-slate-900 bg-slate-900 shadow-lg">
          <div className="rounded-[1.5rem] bg-white px-4 pb-5 pt-4 text-center">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate">{charge.payee}</p>
            <p className="truncate text-[11px] text-slate">{charge.what}</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{fmtN(charge.amount)}</p>
            <div className="relative mx-auto mt-3 flex h-16 w-16 items-center justify-center">
              {phase === "approved" ? <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl text-white">✓</span>
                : phase === "declined" ? <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-3xl text-white">✕</span>
                : <>
                  <span className={`absolute inset-0 rounded-full ${phase === "reading" ? "animate-ping bg-blue-300/60" : "animate-pulse bg-blue-100"}`} aria-hidden />
                  <Waves className="relative h-10 w-10 text-[#1d4ed8]" />
                </>}
            </div>
            <p className={`mt-2 text-sm font-bold ${phase === "approved" ? "text-emerald-700" : phase === "declined" ? "text-red-700" : "text-ink"}`} aria-live="polite">
              {phase === "ready" ? "Tap your card to pay" : phase === "reading" ? "Reading card…" : phase === "approved" ? "Approved" : "Declined"}
            </p>
            {phase === "declined" && message && <p className="mt-1 text-[11px] text-red-700">{message}</p>}
          </div>
        </div>

        {/* your card: tap it (or press Enter) and it moves onto the phone while it's read, then back down for the result */}
        <button type="button" onClick={onTap} disabled={tapped} aria-label={`Tap your CardTap card to pay ${fmtN(charge.amount)}`}
          className={`mx-auto -mt-3 block transition-all duration-500 ease-out ${phase === "reading" ? "-translate-y-14 rotate-[-4deg] scale-90" : tapped ? "translate-y-3 scale-95 opacity-60" : "translate-y-3 hover:-translate-y-1"}`}>
          <CardTapCard holder={holder} last4={last4} />
        </button>

        <div className="mt-5 grid gap-2">
          {phase === "ready" && <button type="button" onClick={onCancel} className="rounded-full border py-2.5 text-sm font-bold">Cancel</button>}
          {phase === "declined" && <button type="button" onClick={onCancel} className="rounded-full bg-ink py-2.5 text-sm font-bold text-white">Close</button>}
        </div>
        <p className="mt-3 text-center text-[10px] text-slate">Game money only: Notesville Naira. {CARDTAP.tagline}: <a href={CARDTAP.site} target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: BLUE }}>paylony.com ↗</a></p>
      </div>
    </div>
  );
}
