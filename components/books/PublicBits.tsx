"use client";

import { useEffect, useState } from "react";

// The receipt's Save as PDF button (the browser's print dialog, as certificates and giving receipts do), the statement's "stop reminders"
// switch, and its Pay now.
export function PrintButton() {
  return <button onClick={() => window.print()} className="rounded-full border border-[#E7DAD3] px-5 py-2.5 text-sm font-semibold text-[#1A1210] hover:border-[#7A0328] print:hidden">Save as PDF</button>;
}
export function StopReminders({ code, off }: { code: string; off: boolean }) {
  const [state, setState] = useState(off);
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    const r = await fetch("/api/books/statement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, off: !state }) }).catch(() => null);
    if (r?.ok) setState(!state);
    setBusy(false);
  };
  return (
    <p className="text-sm text-[#5C534E]">
      {state ? "You've asked not to get reminders about this. " : "Don't want reminders about this? "}
      <button onClick={flip} disabled={busy} className="font-semibold text-[#7A0328] underline">{state ? "Turn reminders back on" : "Stop reminders"}</button>
    </p>
  );
}

// Pay now on a customer's statement (lib/books-debt-server.ts): all of it or a part, by card or bank transfer through Paystack. No sign-in.
// Back from Paystack (?ref=…), it checks the payment and shows the receipt link.
const naira = (k: number) => `₦${Math.floor(k / 100).toLocaleString("en-NG")}${k % 100 ? `.${String(k % 100).padStart(2, "0")}` : ""}`;
export function PayDebt({ code, owesKobo, shop, returnRef }: { code: string; owesKobo: number; shop: string; returnRef?: string }) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState(false);
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [back, setBack] = useState<{ status: string; amountKobo: number; receiptUrl: string | null } | null>(null);
  const [checking, setChecking] = useState(!!returnRef);
  const post = (body: Record<string, unknown>) => fetch("/api/books/debt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; });
  useEffect(() => {
    if (!returnRef) return;
    let tries = 0;
    const check = () => post({ action: "check", code, reference: returnRef }).then((r) => { setBack(r); if (r.status === "pending" && ++tries < 6) setTimeout(check, 2500); else setChecking(false); }).catch((e) => { setErr(e.message); setChecking(false); });
    check();
  }, [returnRef, code]); // eslint-disable-line react-hooks/exhaustive-deps
  const kobo = part ? Math.round(Number(amount.replace(/[₦,\s]/g, "")) * 100) : owesKobo;
  const pay = async () => {
    setErr("");
    if (part && (!Number.isFinite(kobo) || kobo <= 0)) return setErr("Enter how much you'd like to pay.");
    if (kobo > owesKobo) return setErr(`You owe ${naira(owesKobo)}. Enter that or less.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr("Enter your email address, for Paystack and your receipt.");
    setBusy(true);
    try { const r = await post({ action: "start", code, amount: kobo / 100, email }); window.location.href = r.url; }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  if (returnRef && (checking || back)) {
    return (
      <div className="mt-4 rounded-2xl border border-[#E7DAD3] bg-[#F3ECE7] p-4 text-sm text-[#1A1210]" role="status">
        {checking && !back?.receiptUrl ? <p>Checking your payment with Paystack…</p> : back?.status === "paid" ? (
          <><p className="font-semibold">Thank you! {shop} has received {naira(back.amountKobo)}.</p>{back.receiptUrl && <a href={back.receiptUrl} className="mt-2 inline-block font-semibold text-[#7A0328] underline">See your receipt</a>}</>
        ) : <p>We haven&apos;t had word from Paystack yet. If money left your account, it&apos;s safe: this page updates by itself once it&apos;s confirmed, usually within minutes.</p>}
      </div>
    );
  }
  if (!open) return <button onClick={() => setOpen(true)} className="mt-4 w-full rounded-full bg-[#7A0328] px-5 py-3.5 text-[15px] font-bold text-white hover:bg-[#A6093D]">Pay now</button>;
  return (
    <div className="mt-4 rounded-2xl border border-[#E7DAD3] p-4">
      <p className="text-sm font-semibold text-[#1A1210]">How much would you like to pay?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => setPart(false)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${!part ? "border-[#7A0328] bg-[#7A0328]/10 text-[#7A0328]" : "border-[#E7DAD3] text-[#1A1210]"}`}>All of it · {naira(owesKobo)}</button>
        <button onClick={() => setPart(true)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${part ? "border-[#7A0328] bg-[#7A0328]/10 text-[#7A0328]" : "border-[#E7DAD3] text-[#1A1210]"}`}>Part of it</button>
      </div>
      {part && <label className="mt-3 block text-sm text-[#5C534E]">Amount (₦)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10,000" className="mt-1 w-full rounded-xl border border-[#E7DAD3] px-3 py-2.5 text-base text-[#1A1210] outline-none focus:border-[#7A0328]" /></label>}
      <label className="mt-3 block text-sm text-[#5C534E]">Your email (for Paystack and your receipt)<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-[#E7DAD3] px-3 py-2.5 text-base text-[#1A1210] outline-none focus:border-[#7A0328]" /></label>
      {err && <p className="mt-2 text-sm text-red-700" role="alert">{err}</p>}
      <button onClick={pay} disabled={busy} className="mt-3 w-full rounded-full bg-[#7A0328] px-5 py-3.5 text-[15px] font-bold text-white hover:bg-[#A6093D] disabled:opacity-50">{busy ? "Opening Paystack…" : `Pay ${part ? (Number.isFinite(kobo) && kobo > 0 ? naira(kobo) : "") : naira(owesKobo)} by card or transfer`}</button>
      <p className="mt-2 text-xs text-[#5C534E]">Paid securely through Paystack. {shop} sees it straight away and it comes off what you owe, oldest first.</p>
    </div>
  );
}
