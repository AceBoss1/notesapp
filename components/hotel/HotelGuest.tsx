"use client";

import { useCallback, useEffect, useState } from "react";
import { STATUS_LABEL, naira, type OrderStatus } from "@/lib/hotel";

// What a guest's link shows (app/hotel/[code]): their booking, order or room bill, and the ways to pay for it. The server confirms every
// payment with the provider; this page only asks it to check.
type View = {
  kind: "booking" | "order" | "stay"; id: string; code: string; username: string; hotel: string; status?: string; held?: boolean; late?: boolean;
  room?: string; checkIn?: string; checkOut?: string; nights?: number; totalKobo?: number; holdUntil?: string; policy?: string; checkInTime?: string; checkOutTime?: string; payMethod?: string;
  number?: string; dept?: string; target?: string; lines?: { name: string; qty: number; unitKobo: number }[];
  open?: boolean; unit?: string; guest?: string; owedKobo?: number; roomBill?: boolean; orders?: { number: string; dept: string; totalKobo: number; status: string }[];
};
type Account = { accountNumber: string; bankName: string; accountName: string; expiresAt?: string };
const BOOKING_LABEL: Record<string, string> = { held: "Held while you pay", confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Checked out", expired: "The hold ran out", cancelled: "Cancelled" };
async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/public/hotel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

export default function HotelGuest({ initial, pay, returnRef, wantTransfer }: { initial: View; pay: { online: boolean; transfer: boolean }; returnRef: string; wantTransfer: boolean }) {
  const [v, setV] = useState<View>(initial);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<(Account & { ref: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(!!returnRef);
  const payable = (v.kind === "booking" && v.status === "held" && v.held && v.payMethod !== "desk") || (v.kind === "order" && v.status === "awaiting_payment") || (v.kind === "stay" && v.open && v.roomBill && (v.owedKobo ?? 0) > 0);
  const amount = v.kind === "stay" ? v.owedKobo ?? 0 : v.totalKobo ?? 0;

  const check = useCallback(async (ref: string) => { try { setV(await post({ action: "check", code: v.code, ref })); } catch { /* try again later */ } }, [v.code]);
  useEffect(() => { if (returnRef) check(returnRef).finally(() => setChecking(false)); }, [returnRef, check]);
  // Waiting on a transfer: ask every 10 seconds whether it has landed (the provider's webhook usually gets there first).
  useEffect(() => { if (!account) return; const t = window.setInterval(() => check(account.ref), 10_000); return () => window.clearInterval(t); }, [account, check]);
  const start = async (method: "online" | "transfer") => {
    setBusy(true); setErr("");
    try {
      const target = v.kind === "stay" ? "stay" : v.kind;
      const r = await post({ action: "pay", target, id: v.id, code: v.code, method, email: email || undefined });
      if (r.url) { window.location.href = r.url; return; }
      if (r.account) setAccount({ ...r.account, ref: r.reference });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const status = v.kind === "order" ? STATUS_LABEL[v.status as OrderStatus] ?? v.status : v.kind === "booking" ? BOOKING_LABEL[v.status ?? ""] ?? v.status : v.open ? "Staying" : "Checked out";
  const good = v.status === "confirmed" || v.status === "paid" || v.status === "preparing" || v.status === "ready" || v.status === "completed" || v.status === "on_bill";
  return (
    <article className="mx-auto max-w-md rounded-3xl border border-[#E7DAD3] bg-white p-6 text-[#1A1210] sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A6093D]">{v.hotel}</p>
      <h1 className="mt-1 font-display text-3xl">{v.kind === "booking" ? v.room : v.kind === "order" ? `Order ${v.number}` : `Room ${v.unit} bill`}</h1>
      <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${good ? "bg-[#D6F0E4] text-[#17694a]" : "bg-[#F3ECE7] text-[#5C534E]"}`}>{checking ? "Checking your payment…" : status}</p>
      {v.late && <p className="mt-3 rounded-xl bg-[#FFF4D6] px-3 py-2.5 text-sm text-[#5a4300]">Your payment arrived after the hold ran out. It&apos;s safe: the hotel has it and will rebook you or refund you.</p>}

      {v.kind === "booking" && (
        <ul className="mt-4 divide-y divide-[#E7DAD3] text-sm">
          <li className="flex justify-between py-2"><span className="text-[#5C534E]">Check-in</span><b>{v.checkIn}, from {v.checkInTime}</b></li>
          <li className="flex justify-between py-2"><span className="text-[#5C534E]">Check-out</span><b>{v.checkOut}, by {v.checkOutTime}</b></li>
          <li className="flex justify-between py-2"><span className="text-[#5C534E]">{v.nights} night{v.nights === 1 ? "" : "s"}</span><b>{naira(v.totalKobo ?? 0)}</b></li>
        </ul>
      )}
      {v.kind === "order" && (
        <ul className="mt-4 divide-y divide-[#E7DAD3] text-sm">
          <li className="py-2 text-[#5C534E]">{v.dept} · {v.target}</li>
          {v.lines?.map((l, i) => <li key={i} className="flex justify-between py-2"><span>{l.qty} × {l.name}</span><span>{naira(l.qty * l.unitKobo)}</span></li>)}
          <li className="flex justify-between py-2 font-bold"><span>Total</span><span>{naira(v.totalKobo ?? 0)}</span></li>
        </ul>
      )}
      {v.kind === "stay" && (
        <>
          <ul className="mt-4 divide-y divide-[#E7DAD3] text-sm">
            {v.orders?.map((o, i) => <li key={i} className="flex justify-between py-2"><span>{o.number} · {o.dept}</span><span>{naira(o.totalKobo)}</span></li>)}
            <li className="flex justify-between py-2 font-bold"><span>Still to pay</span><span>{naira(v.owedKobo ?? 0)}</span></li>
          </ul>
          {v.open && v.username && <a href={`/s/${v.username}/hotel?stay=${v.code}`} className="mt-4 block rounded-full border border-[#E7DAD3] py-2.5 text-center text-sm font-semibold">Order to my room</a>}
          {v.open && <p className="mt-2 text-xs text-[#5C534E]">Your room-bill code is <b className="font-mono">{v.code}</b>. It&apos;s settled at checkout.</p>}
        </>
      )}
      {v.kind === "booking" && v.status === "held" && v.payMethod === "desk" && v.held && <p className="mt-4 rounded-xl bg-[#F3ECE7] px-3 py-2.5 text-sm">Your room is held for you. Pay at the front desk before the hold runs out at {new Date(v.holdUntil ?? "").toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</p>}

      {payable && !account && (
        <div className="mt-5 space-y-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for the receipt" aria-label="Email for the receipt" className="w-full rounded-xl border border-[#E7DAD3] px-3 py-2.5 text-sm" />
          {pay.online && <button disabled={busy} onClick={() => start("online")} className="w-full rounded-full bg-[#7A0328] py-3 font-ui text-sm font-bold text-white disabled:opacity-50">Pay {naira(amount)} by card, bank or USSD</button>}
          {pay.transfer && <button disabled={busy} onClick={() => start("transfer")} className={`w-full rounded-full py-3 font-ui text-sm font-bold disabled:opacity-50 ${wantTransfer ? "bg-[#7A0328] text-white" : "border border-[#E7DAD3]"}`}>Get an account number to pay {naira(amount)}</button>}
          {v.holdUntil && v.kind !== "stay" && <p className="text-xs text-[#5C534E]">Held until {new Date(v.holdUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Pay before then.</p>}
        </div>
      )}
      {account && (
        <div className="mt-5 rounded-2xl border border-[#7A0328] bg-[#fbf0f3] p-4 text-sm">
          <p>Transfer exactly <b>{naira(amount)}</b> to:</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-wider">{account.accountNumber}</p>
          <p>{account.bankName} · {account.accountName}</p>
          <p className="mt-2 text-xs text-[#5C534E]">This account is just for this payment. This page turns paid by itself when the money lands; no need to send a receipt.</p>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
      {v.policy && <p className="mt-5 text-xs text-[#5C534E]">Cancellation: {v.policy}</p>}
      <p className="mt-6 text-xs text-[#5C534E]">Keep this link: it&apos;s your {v.kind === "stay" ? "room bill" : v.kind}. Powered by #NotesApp.</p>
    </article>
  );
}
