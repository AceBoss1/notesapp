"use client";

import { useEffect, useMemo, useState } from "react";
import { DEPT_KINDS, TARGETS, addDays, naira, nightsBetween, type TargetKind } from "@/lib/hotel";
import HotelNanaChat from "./HotelNanaChat";
import MonthCalendar, { dayLabel } from "@/components/MonthCalendar";

// The hotel's own pages on its site (/hotel; docs/HOTEL_KIT.md mockups 1 to 3 and 7): rooms with live availability and booking with a hold,
// then ordering from any department to a room, a table or for pick-up. Prices shown here are the hotel's; the server prices every booking
// and order again from its own records, and only a payment the provider confirms makes anything paid.
export type PublicHotel = {
  id: string; name: string; branch: string; city: string; address: string; phone: string; about: string; tier: string;
  policy: { checkIn: string; checkOut: string; cancellation: string; payAtDesk: boolean };
  rooms: { id: string; name: string; blurb: string; priceKobo: number; image: string; count: number }[];
  departments: { id: string; name: string; kind: string }[];
  menu: { id: string; deptId: string; name: string; note: string; priceKobo: number; group: string; image: string; soldOut: boolean }[];
  branches: { id: string; branch: string; city: string }[];
  pay: { online: boolean; transfer: boolean; desk: boolean }; roomBill: boolean; nana: boolean; holdMinutes: number;
};
const emoji = (k: string) => DEPT_KINDS.find((d) => d.id === k)?.emoji ?? "🍽";
const field = "w-full rounded-xl border border-rule bg-white px-3 py-2.5 text-sm text-ink";
const dayText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/public/hotel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}
const guestPage = (code: string, mainUrl: string) => `${mainUrl}/hotel/${code}`;

export default function HotelSite({ hotel, cover, base, mainUrl, today, startTab, stayCode }: { hotel: PublicHotel; cover: string; base: string; mainUrl: string; today: string; startTab: "rooms" | "order"; stayCode: string }) {
  const [tab, setTab] = useState<"rooms" | "order">(startTab);
  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [checkOut, setCheckOut] = useState(addDays(today, 3));
  const [showCal, setShowCal] = useState(false);
  const [guests, setGuests] = useState(2);
  const [left, setLeft] = useState<Record<string, number> | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const nights = nightsBetween(checkIn, checkOut);

  useEffect(() => {
    setLeft(null);
    if (nights < 1) return;
    const t = window.setTimeout(() => post({ action: "rooms", h: hotel.id, checkIn, checkOut }).then((j) => setLeft(Object.fromEntries(j.rooms.map((r: { id: string; left: number }) => [r.id, r.left])))).catch((e) => setErr(e.message)), 250);
    return () => window.clearTimeout(t);
  }, [hotel.id, checkIn, checkOut, nights]);

  const room = hotel.rooms.find((r) => r.id === picked) ?? null;
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <header className="relative overflow-hidden text-paper sm:mt-6 sm:rounded-3xl" style={{ background: cover ? `linear-gradient(180deg,rgba(26,18,16,.15),rgba(26,18,16,.85)),url(${cover}) center/cover` : "linear-gradient(160deg,#9a6a4f,#3b2019 60%,#1a1210)" }}>
        <div className="px-5 pb-6 pt-24 sm:px-8 sm:pt-32">
          <h1 className="font-display text-3xl sm:text-4xl">{hotel.name}{hotel.city ? `, ${hotel.city}` : ""}</h1>
          <p className="mt-1 text-sm text-paper/85">{["Rooms", ...hotel.departments.map((d) => d.name)].join(" · ")}</p>
          {hotel.branches.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hotel.branches.map((b) => <a key={b.id} href={`${base}/hotel?b=${b.id}`} className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.id === hotel.id ? "border-paper bg-paper text-ink" : "border-paper/50 text-paper"}`}>{b.branch || b.city || "Main"}</a>)}
            </div>
          )}
        </div>
      </header>

      <div className="px-4 pt-5 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setTab("rooms"); setPicked(null); }} className={`rounded-full py-3 font-ui text-sm font-bold ${tab === "rooms" ? "bg-crimson text-paper" : "border border-rule bg-white text-ink"}`}>Book a room</button>
          <button onClick={() => setTab("order")} className={`rounded-full py-3 font-ui text-sm font-bold ${tab === "order" ? "bg-crimson text-paper" : "border border-rule bg-white text-ink"}`}>Order food</button>
        </div>
        {err && <p className="mt-3 rounded-xl bg-crimson/10 px-3 py-2 text-sm text-crimson" role="alert">{err}</p>}

        {tab === "rooms" && !room && (
          <section className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-rule bg-white px-3 py-2.5 text-sm">
              <button type="button" onClick={() => setShowCal((v) => !v)} aria-expanded={showCal} className="flex items-center gap-2 rounded-lg px-1 py-1 text-left text-ink">
                <span aria-hidden>📅</span>
                <span>{dayLabel(checkIn, true)} → {dayLabel(checkOut, true)}</span>
                <span className="text-slate">· {nights} night{nights === 1 ? "" : "s"}</span>
                <span className="text-xs text-crimson underline">{showCal ? "Done" : "Change"}</span>
              </button>
              <label className="ml-auto flex items-center gap-1 text-slate"><select aria-label="Guests" value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="bg-transparent text-ink">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select> guest{guests === 1 ? "" : "s"}</label>
            </div>
            {showCal && (
              <MonthCalendar value={checkIn} min={today} onChange={(d) => { setCheckIn(d); setCheckOut(addDays(d, 1)); }} rangeEnd={checkOut} onRangeEnd={(d) => { setCheckOut(d); setShowCal(false); }} label="Your stay" />
            )}
            {hotel.rooms.length === 0 && <p className="text-sm text-slate">Rooms will be listed here soon. Call the front desk to book.</p>}
            {hotel.rooms.map((r) => {
              const n = left?.[r.id];
              const full = n === 0;
              return (
                <button key={r.id} disabled={full || nights < 1} onClick={() => { setErr(""); setPicked(r.id); }} className={`flex w-full gap-4 rounded-2xl border border-rule bg-white p-3 text-left transition ${full ? "opacity-50" : "hover:border-crimson"}`}>
                  <div className="h-20 w-24 shrink-0 rounded-xl bg-cover bg-center" style={{ background: r.image ? `url(${r.image}) center/cover` : "linear-gradient(135deg,#d2a27f,#8a5b45)" }} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-ui font-bold text-ink">{r.name}</p>
                    {r.blurb && <p className="text-sm text-slate">{r.blurb}</p>}
                    <p className="mt-1 text-sm"><b className="text-ink">{naira(r.priceKobo)}</b><span className="text-slate"> / night{n === undefined ? "" : full ? " · full for these dates" : ` · ${n} left`}</span></p>
                  </div>
                </button>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              {hotel.departments.map((d) => <button key={d.id} onClick={() => setTab("order")} className="rounded-full border border-rule bg-white px-3 py-1.5 text-sm">{emoji(d.kind)} {d.name}</button>)}
            </div>
            {hotel.about && <p className="whitespace-pre-line pt-2 text-sm text-slate">{hotel.about}</p>}
          </section>
        )}
        {tab === "rooms" && room && <BookForm hotel={hotel} room={room} checkIn={checkIn} checkOut={checkOut} guests={guests} nights={nights} mainUrl={mainUrl} onBack={() => setPicked(null)} />}
        {tab === "order" && <OrderForm hotel={hotel} mainUrl={mainUrl} stayCode={stayCode} />}
      </div>
      {hotel.nana && <HotelNanaChat hotelId={hotel.id} name={hotel.name} />}
    </div>
  );
}

function PayChoice({ value, onChange, pay, holdMinutes, desk }: { value: string; onChange: (v: string) => void; pay: PublicHotel["pay"]; holdMinutes: number; desk: boolean }) {
  const opts = [
    pay.online && { id: "online", icon: "💳", title: "Card, bank or USSD (online)", sub: "Paid now; it's confirmed at once." },
    pay.transfer && { id: "transfer", icon: "🏦", title: "Bank transfer to its own account", sub: "An account number just for this. It turns paid by itself when the money lands." },
    desk && pay.desk && { id: "desk", icon: "🛎", title: "Pay at the front desk", sub: `The room is held for ${holdMinutes} minutes.` },
  ].filter(Boolean) as { id: string; icon: string; title: string; sub: string }[];
  if (!opts.length) return <p className="text-sm text-slate">Online payment isn&apos;t available right now. Call the front desk.</p>;
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Pay with">
      {opts.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={`flex w-full gap-3 rounded-2xl border p-3 text-left ${value === o.id ? "border-crimson bg-crimson/5" : "border-rule bg-white"}`}>
          <span className="text-xl" aria-hidden>{o.icon}</span>
          <span><b className="block text-sm text-ink">{o.title}</b><span className="text-xs text-slate">{o.sub}</span></span>
        </button>
      ))}
    </div>
  );
}

function BookForm({ hotel, room, checkIn, checkOut, guests, nights, mainUrl, onBack }: { hotel: PublicHotel; room: PublicHotel["rooms"][number]; checkIn: string; checkOut: string; guests: number; nights: number; mainUrl: string; onBack: () => void }) {
  const [pay, setPay] = useState(hotel.pay.online ? "online" : hotel.pay.transfer ? "transfer" : "desk");
  const [who, setWho] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const total = room.priceKobo * nights;
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const b = await post({ action: "book", h: hotel.id, roomId: room.id, checkIn, checkOut, guests, ...who, pay });
      if (pay === "online") { const p = await post({ action: "pay", target: "booking", id: b.id, code: b.code, method: "online", email: who.email }); window.location.href = p.url; return; }
      window.location.href = `${guestPage(b.code, mainUrl)}${pay === "transfer" ? "?pay=transfer" : ""}`;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <section className="mt-4 space-y-3">
      <button onClick={onBack} className="text-sm font-semibold text-crimson">← Rooms</button>
      <h2 className="font-display text-2xl text-ink">Book · {room.name}</h2>
      <div className="divide-y divide-rule rounded-2xl border border-rule bg-white px-4 text-sm">
        <p className="flex justify-between py-2.5"><span className="text-slate">Check-in</span><b>{dayText(checkIn)}, from {hotel.policy.checkIn}</b></p>
        <p className="flex justify-between py-2.5"><span className="text-slate">Check-out</span><b>{dayText(checkOut)}, by {hotel.policy.checkOut}</b></p>
        <p className="flex justify-between py-2.5"><span className="text-slate">{nights} night{nights === 1 ? "" : "s"} × {naira(room.priceKobo)}</span><b>{naira(total)}</b></p>
        <p className="flex justify-between py-2.5 text-base"><b>Total</b><b>{naira(total)}</b></p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={field} placeholder="Full name" autoComplete="name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} aria-label="Full name" />
        <input className={field} placeholder="Email" type="email" autoComplete="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} aria-label="Email" />
        <input className={field} placeholder="Phone" type="tel" autoComplete="tel" value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} aria-label="Phone" />
      </div>
      <p className="font-ui text-sm font-bold text-ink">Pay with</p>
      <PayChoice value={pay} onChange={setPay} pay={hotel.pay} holdMinutes={hotel.holdMinutes} desk />
      <p className="text-xs text-slate">Cancellation: {hotel.policy.cancellation}</p>
      {err && <p className="text-sm text-crimson" role="alert">{err}</p>}
      <button disabled={busy || !who.name || !who.email || !who.phone} onClick={go} className="w-full rounded-full bg-crimson py-3 font-ui text-sm font-bold text-paper disabled:opacity-50">{busy ? "One moment…" : pay === "desk" ? `Hold the room · ${naira(total)}` : `Pay ${naira(total)}`}</button>
    </section>
  );
}

function OrderForm({ hotel, mainUrl, stayCode }: { hotel: PublicHotel; mainUrl: string; stayCode: string }) {
  const [dept, setDept] = useState(hotel.departments[0]?.id ?? "");
  const [kind, setKind] = useState<TargetKind>(stayCode ? "room" : "room");
  const [where, setWhere] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [bill, setBill] = useState(!!stayCode && hotel.roomBill);
  const [code, setCode] = useState(stayCode);
  const [pay, setPay] = useState(hotel.pay.online ? "online" : "transfer");
  const [who, setWho] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const items = hotel.menu.filter((m) => m.deptId === dept);
  const chosen = useMemo(() => items.filter((m) => (qty[m.id] ?? 0) > 0), [items, qty]);
  const count = chosen.reduce((n, m) => n + qty[m.id], 0);
  const total = chosen.reduce((n, m) => n + qty[m.id] * m.priceKobo, 0);
  const onBill = bill && kind === "room" && hotel.roomBill;
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const o = await post({ action: "order", h: hotel.id, deptId: dept, lines: chosen.map((m) => ({ itemId: m.id, qty: qty[m.id] })), target: { kind, value: where }, ...who, pay: onBill ? "room_bill" : pay, stayCode: code });
      if (!onBill && pay === "online") { const p = await post({ action: "pay", target: "order", id: o.id, code: o.code, method: "online", email: who.email }); window.location.href = p.url; return; }
      window.location.href = `${guestPage(o.code, mainUrl)}${!onBill && pay === "transfer" ? "?pay=transfer" : ""}`;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  if (!hotel.departments.length) return <p className="mt-4 text-sm text-slate">Menus will be here soon.</p>;
  return (
    <section className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where it goes">
        {TARGETS.map((x) => <button key={x.id} role="radio" aria-checked={kind === x.id} onClick={() => setKind(x.id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${kind === x.id ? "bg-crimson text-paper" : "border border-rule bg-white text-ink"}`}>{x.emoji} {x.label}</button>)}
      </div>
      {kind !== "pickup" && <input className={field} value={where} onChange={(e) => setWhere(e.target.value)} placeholder={kind === "room" ? "Room number, like 204" : "Table number"} aria-label={kind === "room" ? "Room number" : "Table number"} />}
      {hotel.departments.length > 1 && (
        <div className="flex flex-wrap gap-2">{hotel.departments.map((d) => <button key={d.id} onClick={() => { setDept(d.id); setQty({}); }} className={`rounded-full px-3 py-1.5 text-sm ${dept === d.id ? "bg-ink text-paper" : "border border-rule bg-white"}`}>{emoji(d.kind)} {d.name}</button>)}</div>
      )}
      {items.length === 0 && <p className="text-sm text-slate">Nothing on this menu yet.</p>}
      {items.map((m) => (
        <div key={m.id} className={`flex items-center gap-3 rounded-2xl border border-rule bg-white p-3 ${m.soldOut ? "opacity-50" : ""}`}>
          <div className="h-14 w-14 shrink-0 rounded-xl" style={{ background: m.image ? `url(${m.image}) center/cover` : "linear-gradient(135deg,#e7a15a,#b5612e)" }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-ui text-sm font-bold text-ink">{m.name}</p>
            {m.soldOut ? <p className="text-xs text-slate">Sold out today</p> : <>{m.note && <p className="truncate text-xs text-slate">{m.note}</p>}<p className="text-sm font-bold">{naira(m.priceKobo)}</p></>}
          </div>
          {!m.soldOut && (
            <div className="flex items-center gap-2">
              <button aria-label={`One less ${m.name}`} onClick={() => setQty({ ...qty, [m.id]: Math.max(0, (qty[m.id] ?? 0) - 1) })} className="h-8 w-8 rounded-full border border-rule">−</button>
              <span className="w-4 text-center text-sm font-bold" aria-live="polite">{qty[m.id] ?? 0}</span>
              <button aria-label={`One more ${m.name}`} onClick={() => setQty({ ...qty, [m.id]: Math.min(50, (qty[m.id] ?? 0) + 1) })} className="h-8 w-8 rounded-full border border-rule">+</button>
            </div>
          )}
        </div>
      ))}
      {count > 0 && (
        <div className="space-y-3 rounded-2xl border border-rule bg-white p-4">
          <p className="flex justify-between text-sm"><span>{count} item{count === 1 ? "" : "s"}</span><b>{naira(total)}</b></p>
          {hotel.roomBill && kind === "room" && (
            <label className="flex items-center justify-between gap-3 border-t border-rule pt-3 text-sm">
              <span>Put on my room bill</span>
              <input type="checkbox" checked={bill} onChange={(e) => setBill(e.target.checked)} className="h-5 w-5 accent-crimson" />
            </label>
          )}
          {onBill ? (
            <input className={field} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Room-bill code (from check-in)" aria-label="Room-bill code" />
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={field} placeholder="Your name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} aria-label="Your name" />
                <input className={field} placeholder="Phone" type="tel" value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} aria-label="Phone" />
                <input className={field} placeholder="Email (for the receipt)" type="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} aria-label="Email" />
              </div>
              <PayChoice value={pay} onChange={setPay} pay={hotel.pay} holdMinutes={hotel.holdMinutes} desk={false} />
            </>
          )}
        </div>
      )}
      {err && <p className="text-sm text-crimson" role="alert">{err}</p>}
      <button disabled={busy || !count || (kind !== "pickup" && !where) || (onBill ? !code : !who.name || !who.phone || (pay === "online" && !who.email))} onClick={go} className="w-full rounded-full bg-crimson py-3 font-ui text-sm font-bold text-paper disabled:opacity-50">{busy ? "One moment…" : `Place order · ${naira(total)}`}</button>
    </section>
  );
}
