"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { naira } from "@/lib/hotel";

// A till on its counter (Hotel Standard and up; mockup 6): opened with the till's own PIN, it sells only its department's menu. Cash and
// keyed-in card sales are recorded under the till and the cashier; with the card-machine link, a card sale is sent to the counter's
// Moniepoint machine for the exact amount and settles only when the machine says it was approved. End of day: the cash-up compares the cash
// counted with the till's cash sales, and its card sales with what the card machine says. Every sale goes into Business books by itself.
type Item = { id: string; name: string; priceKobo: number; group: string; soldOut: boolean };
type Session = { token: string; till: { id: string; name: string; dept: string; deptId: string }; cashier: string };
type Day = { sales: { number: string; totalKobo: number; method: string; at: string }[]; machineKobo: number | null };
const KEY = "hotel-till";
async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/hotel/till", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "The till couldn't do that."), { status: r.status });
  return j;
}

export default function HotelTill() {
  const [tillId, setTillId] = useState("");
  const [s, setS] = useState<Session | null>(null);
  const [pin, setPin] = useState("");
  const [cashier, setCashier] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [machine, setMachine] = useState({ on: false, addon: false });
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [waiting, setWaiting] = useState<{ id: string; totalKobo: number } | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState<Day | null>(null);
  const [counted, setCounted] = useState("");
  const [typedMachine, setTypedMachine] = useState("");
  const [result, setResult] = useState<{ cashGapKobo: number; cardGapKobo: number | null } | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    setTillId(t);
    try { const saved = JSON.parse(sessionStorage.getItem(`${KEY}:${t}`) ?? "null"); if (saved?.token) setS(saved); } catch { /* none */ }
  }, []);
  const loadMenu = useCallback(async (sess: Session) => {
    try {
      const j = await call({ action: "menu", token: sess.token });
      setItems(j.items); setMachine({ on: j.machine, addon: j.machineAddon });
    } catch (e) { if ((e as { status?: number }).status === 401) { setS(null); try { sessionStorage.removeItem(`${KEY}:${tillId}`); } catch { /* fine */ } } setErr((e as Error).message); }
  }, [tillId]);
  const loadDay = useCallback(async (sess: Session) => { try { setDay(await call({ action: "day", token: sess.token })); } catch { /* shown on the next try */ } }, []);
  useEffect(() => { if (s) { loadMenu(s); loadDay(s); } }, [s, loadMenu, loadDay]);
  // Waiting on the card machine: ask every 3 seconds; three minutes without an answer and the sale is released.
  useEffect(() => {
    if (!waiting || !s) return;
    const t = window.setInterval(async () => {
      try {
        const j = await call({ action: "status", token: s.token, id: waiting.id });
        if (j.status === "paid" || j.status === "completed") { setNote(`Approved: ${naira(waiting.totalKobo)} on the card machine.`); setWaiting(null); setBasket({}); loadDay(s); }
        else if (j.status === "cancelled" || j.status === "expired" || j.expired) { setNote("The card machine didn't approve it, so nothing was charged. Try again or take cash."); setWaiting(null); }
      } catch { /* keep waiting */ }
    }, 3000);
    return () => window.clearInterval(t);
  }, [waiting, s, loadDay]);

  const lines = useMemo(() => Object.entries(basket).filter(([, q]) => q > 0).map(([id, qty]) => ({ itemId: id, qty })), [basket]);
  const total = lines.reduce((n, l) => n + l.qty * (items.find((i) => i.id === l.itemId)?.priceKobo ?? 0), 0);
  const open = async () => {
    setBusy(true); setErr("");
    try { const j = await call({ action: "open", till: tillId, pin, cashier }); setS(j); setPin(""); try { sessionStorage.setItem(`${KEY}:${tillId}`, JSON.stringify(j)); } catch { /* fine */ } }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const sell = async (how: "cash" | "pos" | "transfer" | "machine") => {
    if (!s || !lines.length) return;
    setBusy(true); setErr(""); setNote("");
    try {
      if (how === "machine") {
        const j = await call({ action: "machine", token: s.token, lines });
        setWaiting({ id: j.order.id, totalKobo: j.order.totalKobo });
        setNote(`Sent ${naira(j.order.totalKobo)} to the ${s.till.dept} card machine… waiting for the card. The items are held until it's approved or 3 minutes pass.`);
      } else {
        const j = await call({ action: "cash", token: s.token, lines, method: how });
        setNote(`${j.order.number}: ${naira(j.order.totalKobo)} ${how === "cash" ? "in cash" : how === "pos" ? "by card" : "by transfer"}. Recorded.`); setBasket({}); loadDay(s);
      }
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const doCashUp = async () => {
    if (!s) return;
    setBusy(true); setErr("");
    try { const j = await call({ action: "cashup", token: s.token, countedKobo: Math.round(Number(counted) * 100), ...(typedMachine ? { machineKobo: Math.round(Number(typedMachine) * 100) } : {}) }); setResult(j); loadDay(s); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  if (!tillId) return <p className="mx-auto max-w-md p-8 text-slate">Open a till from its link in Your hotel → Tills.</p>;
  if (!s) return (
    <div className="mx-auto max-w-sm space-y-3 p-8">
      <h1 className="font-display text-3xl text-ink">Open the till</h1>
      <input value={cashier} onChange={(e) => setCashier(e.target.value)} placeholder="Your name" aria-label="Your name" className="w-full rounded-xl border border-rule bg-white px-3 py-2.5" />
      <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" placeholder="Till PIN" aria-label="Till PIN" className="w-full rounded-xl border border-rule bg-white px-3 py-2.5 text-center text-2xl tracking-[0.5em]" />
      {err && <p className="text-sm text-crimson" role="alert">{err}</p>}
      <button disabled={busy || pin.length < 4} onClick={open} className="w-full rounded-full bg-crimson py-3 font-ui font-bold text-paper disabled:opacity-50">Open</button>
    </div>
  );
  const sum = (m: string[]) => (day?.sales ?? []).filter((x) => m.includes(x.method)).reduce((n, x) => n + x.totalKobo, 0);
  return (
    <div className="mx-auto max-w-4xl px-4 py-5">
      <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-paper" style={{ backgroundImage: "linear-gradient(90deg,#4E0119,#A6093D)" }}>
        <p className="font-ui font-bold">Till · {s.till.dept} · {s.cashier}</p>
        <button onClick={() => { setS(null); try { sessionStorage.removeItem(`${KEY}:${tillId}`); } catch { /* fine */ } }} className="text-sm underline">Lock</button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((i) => (
            <button key={i.id} disabled={i.soldOut || !!waiting} onClick={() => setBasket({ ...basket, [i.id]: (basket[i.id] ?? 0) + 1 })} className="rounded-2xl border border-rule bg-white p-3 text-left disabled:opacity-40">
              <p className="font-ui text-sm font-bold">{i.name}</p><p className="text-sm text-slate">{i.soldOut ? "Sold out" : naira(i.priceKobo)}</p>
            </button>
          ))}
          {items.length === 0 && <p className="text-sm text-slate">This department&apos;s menu is empty. Add items in Your hotel → Menus.</p>}
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-rule bg-white p-3 text-sm">
            {lines.length === 0 ? <p className="text-slate">Tap items to add them.</p> : (
              <p className="flex justify-between gap-2"><span>{lines.map((l) => `${items.find((i) => i.id === l.itemId)?.name} ×${l.qty}`).join(", ")}</span><b>{naira(total)}</b></p>
            )}
            {lines.length > 0 && !waiting && <button onClick={() => setBasket({})} className="mt-1 text-xs text-crimson">Clear</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy || !lines.length || !!waiting} onClick={() => sell("cash")} className="rounded-full border border-rule bg-white py-3 font-ui text-sm font-bold disabled:opacity-40">💵 Cash</button>
            {machine.on ? <button disabled={busy || !lines.length || !!waiting} onClick={() => sell("machine")} className="rounded-full bg-crimson py-3 font-ui text-sm font-bold text-paper disabled:opacity-40">💳 Send to card machine</button>
              : <button disabled={busy || !lines.length || !!waiting} onClick={() => sell("pos")} className="rounded-full bg-crimson py-3 font-ui text-sm font-bold text-paper disabled:opacity-40">💳 Card (machine)</button>}
          </div>
          <button disabled={busy || !lines.length || !!waiting} onClick={() => sell("transfer")} className="w-full text-xs font-semibold text-slate underline disabled:opacity-40">Paid by transfer (seen in the account)</button>
          {machine.addon && !machine.on && <p className="text-xs text-slate">The card-machine link isn&apos;t set up yet for this till, so key the amount into the machine and choose Card (machine).</p>}
          {note && <p className={`rounded-xl px-3 py-2 text-sm ${waiting ? "border border-[#F1D48A] bg-[#FFF4D6] text-[#5a4300]" : "bg-[#D6F0E4] text-[#17694a]"}`} role="status">{note}</p>}
          {err && <p className="text-sm text-crimson" role="alert">{err}</p>}

          <div className="rounded-2xl border border-rule bg-white p-3 text-sm">
            <p className="font-ui font-bold">End of day · cash-up</p>
            <label className="mt-2 flex items-center justify-between gap-2 border-t border-rule pt-2">Cash counted, ₦<input value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="w-28 rounded-lg border border-rule px-2 py-1 text-right" aria-label="Cash counted in naira" /></label>
            <p className="flex justify-between border-t border-rule py-2"><span>Cash sales on this till</span><b>{naira(sum(["cash"]))}</b></p>
            <p className="flex justify-between border-t border-rule py-2"><span>Card sales on this till</span><b>{naira(sum(["pos", "machine"]))}</b></p>
            {day?.machineKobo !== null && day?.machineKobo !== undefined ? <p className="flex justify-between border-t border-rule py-2"><span>Card machine says</span><b>{naira(day.machineKobo)} {day.machineKobo === sum(["pos", "machine"]) ? "✓" : ""}</b></p>
              : <label className="flex items-center justify-between gap-2 border-t border-rule py-2">Card machine says, ₦<input value={typedMachine} onChange={(e) => setTypedMachine(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="w-28 rounded-lg border border-rule px-2 py-1 text-right" aria-label="Card machine total in naira" /></label>}
            <p className="flex justify-between border-t border-rule py-2"><span>Transfers</span><b>{naira(sum(["transfer"]))}</b></p>
            <button disabled={busy || counted === ""} onClick={doCashUp} className="mt-1 w-full rounded-full bg-ink py-2.5 font-ui text-sm font-bold text-paper disabled:opacity-40">Cash up</button>
            {result && <p className={`mt-2 rounded-xl px-3 py-2 ${result.cashGapKobo === 0 && (result.cardGapKobo ?? 0) === 0 ? "bg-[#D6F0E4] text-[#17694a]" : "bg-[#FFF4D6] text-[#5a4300]"}`}>Cash {result.cashGapKobo === 0 ? "matches" : result.cashGapKobo > 0 ? `is ${naira(result.cashGapKobo)} over` : `is ${naira(-result.cashGapKobo)} short`}.{result.cardGapKobo === null ? "" : result.cardGapKobo === 0 ? " Card matches the machine." : ` Card is ${naira(Math.abs(result.cardGapKobo))} ${result.cardGapKobo > 0 ? "more on the machine" : "less on the machine"}.`}</p>}
            <p className="mt-2 text-xs text-slate">Each till has its own PIN and is locked to one department. Sales also go into Business books by themselves.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
