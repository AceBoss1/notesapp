"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ADDONS, COUNTER_METHODS, DEPT_KINDS, STAFF_ROLES, TIER_INFO, UNIT_STATUSES, naira, type HotelTier } from "@/lib/hotel";
import { startCheckout } from "@/lib/checkout";
import { useHotelApi, usePulse } from "./staff";

// Your hotel (/profile/hotel): set up the hotel and run it. Rooms, departments and menus, bookings with check-in and the room bill, late
// money, staff roles, tills, Housekeeping, and for Grand: branches in one view, monthly reports and Conversations. Plans and add-ons at the
// end. What a role can't use isn't shown; what the plan doesn't cover shows what it needs.
type Room = { id: string; name: string; blurb: string; priceKobo: number; units: string[]; image: string; order: number; on: boolean };
type Menu = { id: string; deptId: string; name: string; note: string; priceKobo: number; group: string; image: string; soldOut: boolean; stockItemId: string };
type Dept = { id: string; name: string; kind: string; prefix: string; open: boolean };
type Home = {
  hotel: { id: string; name: string; branch: string; city: string; address: string; phone: string; about: string; departments: Dept[]; policy: { checkIn: string; checkOut: string; cancellation: string; payAtDesk: boolean; lateMinutes: number | null }; staff: Record<string, { role: string; depts: string[]; name: string }>; whatsappNumberId?: string };
  role: string; tier: HotelTier; features: Record<string, boolean>; limits: { departments: number; branches: number };
  rooms: Room[]; menu: Menu[]; team: { uid: string; name: string; username: string }[]; tills: { id: string; name: string; deptId: string; machineSerial: string }[];
  stock: { id: string; title: string; stock: number }[]; username: string;
  addons: { id: string; name: string; emoji: string; blurb: string; priceKobo: number; until: string | null; on: boolean }[]; setupFromKobo: number;
  ready: { paystack: boolean; paylony: boolean; moniepoint: boolean; whatsapp: boolean };
};
const TABS = [
  { id: "overview", label: "Overview" }, { id: "bookings", label: "Bookings" }, { id: "rooms", label: "Rooms" }, { id: "menus", label: "Menus" }, { id: "settings", label: "Hotel and departments" },
  { id: "staff", label: "Staff", needs: "staffRoles", owner: true }, { id: "tills", label: "Tills", needs: "tills" }, { id: "housekeeping", label: "Housekeeping" },
  { id: "branches", label: "Branches", needs: "branches" }, { id: "reports", label: "Reports", needs: "reports" }, { id: "chats", label: "Conversations", needs: "conversations" }, { id: "plans", label: "Plans and add-ons" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const field = "w-full rounded-xl border border-rule bg-white px-3 py-2 text-sm text-ink";
const btn = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-bold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule bg-white px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const kobo = (naira: string) => Math.round(Number(naira.replace(/[^\d.]/g, "")) * 100);
const needsText = (f: string) => (["branches", "nana", "conversations", "reports"].includes(f) ? "Hotel Grand (Enterprise)" : "Hotel Standard (Business)");

export default function HotelManage() {
  const { user, get, post } = useHotelApi();
  const [mine, setMine] = useState<{ hotels: { id: string; name: string; branch: string; role: string }[]; tier: HotelTier | null } | null>(null);
  const [h, setH] = useState<string>("");
  const [home, setHome] = useState<Home | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("tab")) setTab(sp.get("tab") as TabId);
    if (sp.get("h")) setH(sp.get("h")!);
  }, []);
  useEffect(() => { if (user) get({ view: "mine" }).then((m) => { setMine(m); setH((x) => x || m.hotels[0]?.id || ""); }).catch((e) => setErr(e.message)); }, [user, get]);
  const load = useCallback(() => { if (user && h) get({ view: "home", h }).then((x) => { setHome(x); setErr(""); }).catch((e) => setErr(e.message)); }, [user, h, get]);
  useEffect(() => { load(); }, [load]);
  const run = async (body: Record<string, unknown>, ok?: string) => {
    setErr(""); setMsg("");
    try { const r = await post({ h, ...body }); if (ok) setMsg(ok); load(); return r; } catch (e) { setErr((e as Error).message); return null; }
  };

  if (user === null) return <p className="mx-auto max-w-xl p-8 text-slate">Sign in to run your hotel. <Link href="/hotels" className="font-semibold text-crimson">What the Hotel kit does</Link></p>;
  if (!mine) return <p className="p-8 text-slate">Loading…</p>;
  if (!mine.hotels.length) return <Setup tier={mine.tier} onDone={(id) => { setH(id); get({ view: "mine" }).then(setMine); }} post={post} />;
  if (!home) return <p className="p-8 text-slate">{err || "Loading your hotel…"}</p>;
  const f = home.features;
  const owner = home.role === "owner";
  const manager = owner || home.role === "manager";
  const tabs = TABS.filter((t) => {
    if (t.id === "staff" && !owner) return false;
    if (["rooms", "menus", "settings", "tills", "branches", "reports", "chats", "plans"].includes(t.id) && !manager) return false;
    if (t.id === "bookings" && home.role === "department") return false;
    if (t.id === "housekeeping" && home.role === "department") return false;
    return true;
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{TIER_INFO[home.tier].emoji} {TIER_INFO[home.tier].name}</p>
          <h1 className="font-display text-4xl text-ink">{home.hotel.name}{home.hotel.branch ? ` · ${home.hotel.branch}` : ""}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {mine.hotels.length > 1 && <select aria-label="Hotel or branch" value={h} onChange={(e) => { setHome(null); setH(e.target.value); }} className="rounded-full border border-rule bg-white px-3 py-1.5 text-sm">{mine.hotels.map((x) => <option key={x.id} value={x.id}>{x.name}{x.branch ? ` · ${x.branch}` : ""}</option>)}</select>}
          {home.username && <a href={`/s/${home.username}/hotel${h.includes("_") ? `?b=${h}` : ""}`} target="_blank" rel="noopener noreferrer" className={ghost}>View the hotel&apos;s site</a>}
          {f.board && <Link href={`/profile/hotel/board?h=${h}`} className={ghost}>Staff board</Link>}
          {f.kitchen && <Link href={`/profile/hotel/kitchen?h=${h}`} className={ghost}>Kitchen screen</Link>}
        </div>
      </div>
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-rule pb-px" aria-label="Your hotel">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-t-lg px-3 py-2 font-ui text-sm font-semibold ${tab === t.id ? "border-b-2 border-crimson text-crimson" : "text-slate hover:text-ink"}`}>{t.label}{"needs" in t && t.needs && !f[t.needs] ? " 🔒" : ""}</button>)}
      </nav>
      {err && <p className="mt-3 rounded-xl bg-crimson/10 px-3 py-2 text-sm text-crimson" role="alert">{err}</p>}
      {msg && <p className="mt-3 rounded-xl bg-[#D6F0E4] px-3 py-2 text-sm text-[#17694a]" role="status">{msg}</p>}
      <div className="mt-5">
        {(() => { const t = TABS.find((x) => x.id === tab); return t && "needs" in t && t.needs && !f[t.needs] ? <Locked what={t.label} needs={needsText(t.needs)} /> : null; })()}
        {tab === "overview" && <Overview home={home} />}
        {tab === "bookings" && <Bookings h={h} get={get} run={run} />}
        {tab === "rooms" && <Rooms home={home} run={run} />}
        {tab === "menus" && <Menus home={home} run={run} />}
        {tab === "settings" && <Settings home={home} run={run} />}
        {tab === "staff" && f.staffRoles && <Staff home={home} run={run} />}
        {tab === "tills" && f.tills && <Tills home={home} run={run} />}
        {tab === "housekeeping" && <Housekeeping h={h} home={home} get={get} run={run} goPlans={() => setTab("plans")} />}
        {tab === "branches" && f.branches && <Branches h={h} get={get} run={run} limit={home.limits.branches} />}
        {tab === "reports" && f.reports && <Reports h={h} get={get} />}
        {tab === "chats" && f.conversations && <Chats h={h} get={get} />}
        {tab === "plans" && <Plans home={home} run={run} />}
      </div>
    </div>
  );
}

function Locked({ what, needs }: { what: string; needs: string }) {
  return <div className="card p-5"><p className="font-ui font-bold text-ink">🔒 {what} comes with {needs}.</p><p className="mt-1 text-sm text-slate">Your hotel moves up with your plan; nothing to set up again. <Link href="/pricing" className="font-semibold text-crimson">See the plans</Link></p></div>;
}

function Setup({ tier, onDone, post }: { tier: HotelTier | null; onDone: (id: string) => void; post: (b: Record<string, unknown>) => Promise<{ hotel: { id: string } }> }) {
  const [v, setV] = useState({ name: "", city: "", department: "Restaurant", phone: "" });
  const [err, setErr] = useState("");
  if (!tier) return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-4xl text-ink">🏨 Your hotel</h1>
      <p className="mt-3 text-slate">The Hotel kit comes with Pro (Hotel Starter), Business (Hotel Standard) and Enterprise (Hotel Grand). No extra subscription.</p>
      <div className="mt-4 flex gap-2"><Link href="/pricing" className={btn}>See the plans</Link><Link href="/hotels" className={ghost}>What it does</Link></div>
    </div>
  );
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="eyebrow">{TIER_INFO[tier].emoji} {TIER_INFO[tier].name}</p>
      <h1 className="font-display text-4xl text-ink">Set up your hotel</h1>
      <p className="mt-2 text-slate">Start with the basics; add rooms, menus and photos next. Then choose the Hotels kit on Your site.</p>
      <div className="mt-5 grid gap-3">
        <input className={field} placeholder="Hotel name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Hotel name" />
        <input className={field} placeholder="City or town" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} aria-label="City" />
        <input className={field} placeholder="Front desk phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} aria-label="Front desk phone" />
        <input className={field} placeholder="First department (Restaurant)" value={v.department} onChange={(e) => setV({ ...v, department: e.target.value })} aria-label="First department" />
        {err && <p className="text-sm text-crimson">{err}</p>}
        <button className={btn} onClick={() => post({ action: "setup", ...v }).then((r) => onDone(r.hotel.id)).catch((e) => setErr(e.message))}>Create my hotel</button>
        <p className="text-xs text-slate">Rather we did it? <Link href="/hotels#setup" className="font-semibold text-crimson">Set it up for me</Link></p>
      </div>
    </div>
  );
}

function Overview({ home }: { home: Home }) {
  const steps = [
    { done: home.rooms.length > 0, text: "Add your rooms and prices", tab: "rooms" },
    { done: home.menu.length > 0, text: "Add each department's menu", tab: "menus" },
    { done: !!home.username, text: "Choose the Hotels kit on Your site, with your photos", href: "/profile/site" },
    { done: home.ready.paystack, text: "Online payment is ready", tab: "" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card p-5">
        <h2 className="font-display text-2xl text-ink">Getting ready</h2>
        <ul className="mt-3 space-y-2 text-sm">{steps.map((s) => <li key={s.text}>{s.done ? "✅" : "⬜"} {s.href ? <Link href={s.href} className="font-semibold text-crimson">{s.text}</Link> : s.text}</li>)}</ul>
      </div>
      <div className="card p-5 text-sm">
        <h2 className="font-display text-2xl text-ink">How money works here</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate">
          <li>Rooms and orders are held while the guest pays, then go back on sale.</li>
          <li>Only a payment the provider confirms marks anything paid. Nobody can tick it by hand.</li>
          <li>Money that lands late is kept and flagged for you to rebook or refund.</li>
          <li>Every sale goes into Business books{home.features.inventory ? ", and stock linked to Inventory goes down" : ""}.</li>
        </ul>
        <Link href="/profile/books" className="mt-3 inline-block font-semibold text-crimson">Open Business books →</Link>
      </div>
    </div>
  );
}

type Run = (b: Record<string, unknown>, ok?: string) => Promise<unknown>;
type Get = (p: Record<string, string>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function Bookings({ h, get, run }: { h: string; get: Get; run: Run }) {
  type B = { id: string; roomName: string; roomId: string; checkIn: string; checkOut: string; guestName: string; phone: string; totalKobo: number; status: string; payMethod: string; holdUntil: string; late?: { state: string } };
  const [v, setV] = useState<{ bookings: B[]; stays: { id: string; unit: string; roomName: string; guestName: string; code: string; owedKobo: number; orders: { number: string; dept: string; totalKobo: number; settled: boolean }[] }[]; late: { kind: string; id: string; what: string; guest: string; amountKobo: number; provider: string; at: string }[]; roomBill: boolean } | null>(null);
  const [units, setUnits] = useState<Record<string, string[]>>({});
  const [how, setHow] = useState("cash");
  const load = useCallback(() => { get({ view: "bookings", h }).then(setV).catch(() => {}); get({ view: "home", h }).then((x: Home) => setUnits(Object.fromEntries(x.rooms.map((r) => [r.id, r.units])))).catch(() => {}); }, [get, h]);
  useEffect(() => { load(); }, [load]);
  usePulse(h, load, 60_000);
  const act = async (b: Record<string, unknown>, ok: string) => { await run(b, ok); load(); };
  if (!v) return <p className="text-slate">Loading bookings…</p>;
  return (
    <div className="space-y-6">
      {v.late.length > 0 && (
        <section className="card border-[#F1D48A] bg-[#FFF4D6] p-4">
          <h2 className="font-ui font-bold text-[#5a4300]">Money that landed late</h2>
          <p className="text-xs text-[#5a4300]">These guests paid after their hold ran out. The money is safe and held. Rebook them if you can, or refund them.</p>
          <ul className="mt-2 space-y-2 text-sm">{v.late.map((x) => <li key={x.id} className="flex flex-wrap items-center justify-between gap-2"><span><b>{x.what}</b> · {x.guest} · {naira(x.amountKobo)} by {x.provider}</span><span className="flex gap-2"><button className={ghost} onClick={() => act({ action: "rebook", kind: x.kind, id: x.id }, "Rebooked.")}>Rebook</button><button className={ghost} onClick={() => act({ action: "refund", kind: x.kind, id: x.id }, "Refund on its way.")}>Refund</button></span></li>)}</ul>
        </section>
      )}
      <label className="flex items-center gap-2 text-sm text-slate">Payments taken here are recorded as <select value={how} onChange={(e) => setHow(e.target.value)} className="rounded-lg border border-rule bg-white px-2 py-1 text-ink">{COUNTER_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <section>
        <h2 className="font-display text-2xl text-ink">In-house guests</h2>
        {v.stays.length === 0 && <p className="mt-1 text-sm text-slate">No one is checked in.</p>}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">{v.stays.map((s) => (
          <div key={s.id} className="card p-4 text-sm">
            <p className="font-bold">Room {s.unit} · {s.guestName}</p>
            <p className="text-xs text-slate">{s.roomName} · room-bill code <b className="font-mono">{s.code}</b></p>
            {s.orders.map((o) => <p key={o.number} className="flex justify-between text-xs"><span>{o.number} {o.dept}</span><span>{naira(o.totalKobo)}{o.settled ? " ✓" : ""}</span></p>)}
            <p className="mt-1 flex justify-between font-bold"><span>Room bill to pay</span><span>{naira(s.owedKobo)}</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {s.owedKobo > 0 && <button className={ghost} onClick={() => act({ action: "settle", target: "stay", id: s.id, method: how }, "Bill settled and recorded in Business books.")}>Settle the bill ({COUNTER_METHODS.find((m) => m.id === how)?.label})</button>}
              <button className={btn} disabled={s.owedKobo > 0} onClick={() => act({ action: "checkout", id: s.id }, "Checked out.")}>Check out</button>
            </div>
          </div>
        ))}</div>
      </section>
      <section>
        <h2 className="font-display text-2xl text-ink">Bookings</h2>
        {v.bookings.length === 0 && <p className="mt-1 text-sm text-slate">No bookings yet. They appear here as guests book on your site.</p>}
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-xs text-slate"><th className="py-1">Guest</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>
          {v.bookings.map((b) => {
            const live = b.status === "held" && Date.parse(b.holdUntil) > Date.now();
            return (
              <tr key={b.id} className="border-t border-rule align-top">
                <td className="py-2"><b>{b.guestName}</b><br /><span className="text-xs text-slate">{b.phone}</span></td>
                <td>{b.roomName}</td><td>{b.checkIn} → {b.checkOut}</td><td>{naira(b.totalKobo)}</td>
                <td>{b.status === "held" ? (live ? `Held${b.payMethod === "desk" ? " · pays at desk" : ""}` : "Hold ran out") : b.status.replace("_", " ")}</td>
                <td className="space-x-1 whitespace-nowrap py-2">
                  {live && b.payMethod === "desk" && <button className={ghost} onClick={() => act({ action: "settle", target: "booking", id: b.id, method: how }, "Payment recorded; booking confirmed.")}>Take payment</button>}
                  {(b.status === "confirmed" || (live && b.payMethod === "desk")) && (
                    <select aria-label="Check in to room" className="rounded-full border border-rule bg-white px-2 py-1 text-xs" defaultValue="" onChange={(e) => e.target.value && act({ action: "checkin", id: b.id, unit: e.target.value }, `Checked in to room ${e.target.value}.`)}>
                      <option value="">Check in…</option>{(units[b.roomId] ?? []).map((u) => <option key={u} value={u}>Room {u}</option>)}
                    </select>
                  )}
                  {(b.status === "confirmed" || live) && <button className="text-xs text-slate underline" onClick={() => window.confirm("Cancel this booking? A paid booking's money stays held; refund by your policy.") && act({ action: "cancel", id: b.id }, "Cancelled.")}>Cancel</button>}
                </td>
              </tr>
            );
          })}
        </tbody></table></div>
      </section>
    </div>
  );
}

function Rooms({ home, run }: { home: Home; run: Run }) {
  const blank = { id: "", name: "", blurb: "", price: "", units: "", image: "", on: true };
  const [v, setV] = useState(blank);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-2">
        {home.rooms.length === 0 && <p className="text-sm text-slate">No rooms yet. Add your first room type.</p>}
        {home.rooms.map((r) => (
          <div key={r.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
            <div><p className="font-bold">{r.name}{r.on ? "" : " (hidden)"}</p><p className="text-xs text-slate">{naira(r.priceKobo)} a night · rooms {r.units.join(", ")}</p></div>
            <button className={ghost} onClick={() => setV({ id: r.id, name: r.name, blurb: r.blurb, price: String(r.priceKobo / 100), units: r.units.join(", "), image: r.image, on: r.on })}>Edit</button>
          </div>
        ))}
      </div>
      <form className="card space-y-2 p-4" onSubmit={async (e) => { e.preventDefault(); await run({ action: "room", id: v.id || undefined, name: v.name, blurb: v.blurb, priceKobo: kobo(v.price), units: v.units, image: v.image, on: v.on }, "Room saved."); setV(blank); }}>
        <p className="font-ui font-bold">{v.id ? "Edit room type" : "Add a room type"}</p>
        <input className={field} placeholder="Name, like Deluxe double" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Room name" />
        <input className={field} placeholder="King bed · breakfast for 2 · Wi-Fi" value={v.blurb} onChange={(e) => setV({ ...v, blurb: e.target.value })} aria-label="What's in it" />
        <input className={field} placeholder="Price a night, ₦" inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} aria-label="Price a night in naira" />
        <input className={field} placeholder="Room numbers (201, 202) or how many" value={v.units} onChange={(e) => setV({ ...v, units: e.target.value })} aria-label="Room numbers" />
        <input className={field} placeholder="Photo address (https://…)" value={v.image} onChange={(e) => setV({ ...v, image: e.target.value })} aria-label="Photo address" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.on} onChange={(e) => setV({ ...v, on: e.target.checked })} /> Show on the site</label>
        <div className="flex gap-2"><button className={btn}>Save</button>{v.id && <button type="button" className={ghost} onClick={() => setV(blank)}>New</button>}</div>
      </form>
    </div>
  );
}

function Menus({ home, run }: { home: Home; run: Run }) {
  const depts = home.hotel.departments;
  const blank = { id: "", deptId: depts[0]?.id ?? "", name: "", note: "", price: "", group: "", image: "", stockItemId: "" };
  const [v, setV] = useState(blank);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {depts.map((d) => (
          <section key={d.id}>
            <h3 className="font-ui text-sm font-bold uppercase tracking-wider text-slate">{d.name}</h3>
            {home.menu.filter((m) => m.deptId === d.id).map((m) => (
              <div key={m.id} className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rule bg-white p-2.5 text-sm">
                <span><b>{m.name}</b> · {naira(m.priceKobo)}{m.stockItemId ? <span className="text-xs text-slate"> · stock {home.stock.find((s) => s.id === m.stockItemId)?.stock ?? "?"}</span> : null}</span>
                <span className="flex gap-1.5">
                  <button className={ghost} onClick={() => run({ action: "soldout", id: m.id, soldOut: !m.soldOut })}>{m.soldOut ? "Back on" : "Sold out"}</button>
                  <button className={ghost} onClick={() => setV({ id: m.id, deptId: m.deptId, name: m.name, note: m.note, price: String(m.priceKobo / 100), group: m.group, image: m.image, stockItemId: m.stockItemId })}>Edit</button>
                  <button className="text-xs text-slate underline" onClick={() => window.confirm(`Remove ${m.name}?`) && run({ action: "menu-remove", id: m.id })}>Remove</button>
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
      <form className="card space-y-2 p-4" onSubmit={async (e) => { e.preventDefault(); await run({ action: "menu", id: v.id || undefined, deptId: v.deptId, name: v.name, note: v.note, priceKobo: kobo(v.price), group: v.group, image: v.image, stockItemId: v.stockItemId }, "Saved."); setV(blank); }}>
        <p className="font-ui font-bold">{v.id ? "Edit item" : "Add a dish or drink"}</p>
        <select className={field} value={v.deptId} onChange={(e) => setV({ ...v, deptId: e.target.value })} aria-label="Department">{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <input className={field} placeholder="Name, like Suya platter" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Name" />
        <input className={field} placeholder="Beef, onions, yaji" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} aria-label="Short note" />
        <input className={field} placeholder="Price, ₦" inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} aria-label="Price in naira" />
        <input className={field} placeholder="Photo address (https://…)" value={v.image} onChange={(e) => setV({ ...v, image: e.target.value })} aria-label="Photo address" />
        {home.features.inventory && (
          <select className={field} value={v.stockItemId} onChange={(e) => setV({ ...v, stockItemId: e.target.value })} aria-label="Takes stock from">
            <option value="">No stock count</option>{home.stock.map((s) => <option key={s.id} value={s.id}>Stock: {s.title} ({s.stock})</option>)}
          </select>
        )}
        <div className="flex gap-2"><button className={btn}>Save</button>{v.id && <button type="button" className={ghost} onClick={() => setV(blank)}>New</button>}</div>
        {home.features.inventory && <p className="text-xs text-slate">Link a drink or dish to an Inventory item and each sale takes it off the shelf. <Link href="/profile/inventory" className="text-crimson">Inventory</Link></p>}
      </form>
    </div>
  );
}

function Settings({ home, run }: { home: Home; run: Run }) {
  const x = home.hotel;
  const [v, setV] = useState({ name: x.name, branch: x.branch, city: x.city, address: x.address, phone: x.phone, about: x.about, ...x.policy, lateMinutes: x.policy.lateMinutes ? String(x.policy.lateMinutes) : "" });
  const [depts, setDepts] = useState(x.departments);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form className="card space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); run({ action: "hotel", name: v.name, branch: v.branch, city: v.city, address: v.address, phone: v.phone, about: v.about, policy: { checkIn: v.checkIn, checkOut: v.checkOut, cancellation: v.cancellation, payAtDesk: v.payAtDesk, lateMinutes: v.lateMinutes ? Number(v.lateMinutes) : null } }, "Saved."); }}>
        <p className="font-ui font-bold">The hotel</p>
        {(["name", "branch", "city", "address", "phone"] as const).map((k) => <input key={k} className={field} placeholder={k[0].toUpperCase() + k.slice(1)} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} aria-label={k} />)}
        <textarea className={field} rows={3} placeholder="About the hotel" value={v.about} onChange={(e) => setV({ ...v, about: e.target.value })} aria-label="About" />
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate">Check-in from<input type="time" className={field} value={v.checkIn} onChange={(e) => setV({ ...v, checkIn: e.target.value })} /></label><label className="text-xs text-slate">Check-out by<input type="time" className={field} value={v.checkOut} onChange={(e) => setV({ ...v, checkOut: e.target.value })} /></label></div>
        <textarea className={field} rows={2} value={v.cancellation} onChange={(e) => setV({ ...v, cancellation: e.target.value })} aria-label="Cancellation policy" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.payAtDesk} onChange={(e) => setV({ ...v, payAtDesk: e.target.checked })} /> Guests may book and pay at the front desk (the room is held for a while)</label>
        {home.features.kitchen && <label className="flex items-center justify-between gap-2 text-sm">Kitchen orders turn late after (minutes; empty for our default)<input className="w-20 rounded-lg border border-rule px-2 py-1" inputMode="numeric" value={v.lateMinutes} onChange={(e) => setV({ ...v, lateMinutes: e.target.value.replace(/\D/g, "") })} /></label>}
        <button className={btn}>Save</button>
      </form>
      <div className="card space-y-2 p-4">
        <p className="font-ui font-bold">Departments</p>
        {home.limits.departments === 1 && <p className="text-xs text-slate">Hotel Starter has one department. Several come with Hotel Standard (Business).</p>}
        {depts.map((d, i) => (
          <div key={i} className="flex gap-2">
            <input className={field} value={d.name} onChange={(e) => setDepts(depts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Department name" />
            <select className="rounded-xl border border-rule bg-white px-2 text-sm" value={d.kind} onChange={(e) => setDepts(depts.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} aria-label="Kind">{DEPT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.emoji} {k.label}</option>)}</select>
            {depts.length > 1 && <button className="text-xs text-slate underline" onClick={() => setDepts(depts.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        <div className="flex gap-2">
          {depts.length < home.limits.departments && <button className={ghost} onClick={() => setDepts([...depts, { id: "", name: "", kind: "restaurant", prefix: "", open: true }])}>Add a department</button>}
          <button className={btn} onClick={() => run({ action: "departments", departments: depts.filter((d) => d.name.trim()).map((d) => (d.id ? d : { name: d.name, kind: d.kind })) }, "Departments saved.")}>Save departments</button>
        </div>
      </div>
    </div>
  );
}

function Staff({ home, run }: { home: Home; run: Run }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate">Give the people on your team a role here. They sign in as themselves; a department role sees only its own orders. Add people to your team first: Organisation team, or staff on <Link href="/profile/books" className="text-crimson">Business books</Link>.</p>
      {home.team.length === 0 && <p className="text-sm text-slate">No one on your team yet.</p>}
      {home.team.map((m) => {
        const s = home.hotel.staff[m.uid];
        return (
          <div key={m.uid} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><b>{m.name}</b> <span className="text-slate">@{m.username}</span></span>
            <span className="flex flex-wrap items-center gap-2">
              <select aria-label={`Role for ${m.name}`} className="rounded-full border border-rule bg-white px-2 py-1" value={s?.role ?? ""} onChange={(e) => e.target.value ? run({ action: "staff", uid: m.uid, role: e.target.value, depts: s?.depts.length ? s.depts : [home.hotel.departments[0]?.id] }, "Role saved.") : run({ action: "staff", uid: m.uid, remove: true }, "Removed.")}>
                <option value="">No role here</option>{STAFF_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              {s?.role === "department" && home.hotel.departments.map((d) => <label key={d.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.depts.includes(d.id)} onChange={(e) => run({ action: "staff", uid: m.uid, role: "department", depts: e.target.checked ? [...s.depts, d.id] : s.depts.filter((x) => x !== d.id) })} />{d.name}</label>)}
            </span>
          </div>
        );
      })}
      <ul className="text-xs text-slate">{STAFF_ROLES.map((r) => <li key={r.id}><b>{r.label}:</b> {r.blurb}</li>)}</ul>
    </div>
  );
}

function Tills({ home, run }: { home: Home; run: Run }) {
  const blank = { id: "", name: "", deptId: home.hotel.departments[0]?.id ?? "", pin: "", machineSerial: "" };
  const [v, setV] = useState(blank);
  const cardMachine = home.addons.find((a) => a.id === "cardMachine")?.on;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-2">
        {home.tills.length === 0 && <p className="text-sm text-slate">No tills yet. A till is a counter device (a tablet or phone) with its own PIN, locked to one department.</p>}
        {home.tills.map((t) => (
          <div key={t.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><b>{t.name}</b> · {home.hotel.departments.find((d) => d.id === t.deptId)?.name}{t.machineSerial ? ` · card machine ${t.machineSerial}` : ""}</span>
            <span className="flex gap-2"><a href={`/till?t=${t.id}`} target="_blank" rel="noopener noreferrer" className={ghost}>Open till</a><button className={ghost} onClick={() => setV({ ...t, pin: "" })}>Edit</button></span>
          </div>
        ))}
      </div>
      <form className="card space-y-2 p-4" onSubmit={async (e) => { e.preventDefault(); await run({ action: "till", ...v, id: v.id || undefined }, "Till saved."); setV(blank); }}>
        <p className="font-ui font-bold">{v.id ? "Edit till" : "Add a till"}</p>
        <input className={field} placeholder="Name, like Lounge 1" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Till name" />
        <select className={field} value={v.deptId} onChange={(e) => setV({ ...v, deptId: e.target.value })} aria-label="Department">{home.hotel.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <input className={field} placeholder={v.id ? "New PIN (leave empty to keep)" : "PIN, 4 to 6 digits"} inputMode="numeric" value={v.pin} onChange={(e) => setV({ ...v, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} aria-label="PIN" />
        {cardMachine && <input className={field} placeholder="Card machine serial (Moniepoint)" value={v.machineSerial} onChange={(e) => setV({ ...v, machineSerial: e.target.value })} aria-label="Card machine serial" />}
        <div className="flex gap-2"><button className={btn}>Save</button>{v.id && <button type="button" className={ghost} onClick={() => setV(blank)}>New</button>}</div>
      </form>
    </div>
  );
}

function Housekeeping({ h, home, get, run, goPlans }: { h: string; home: Home; get: Get; run: Run; goPlans: () => void }) {
  const on = home.addons.find((a) => a.id === "housekeeping")?.on;
  const [v, setV] = useState<{ rooms: { roomId: string; room: string; unit: string; status: string; occupied: boolean }[]; issues: { id: string; kind: string; text: string; unit: string; at: string }[] } | null>(null);
  const [issue, setIssue] = useState({ kind: "maintenance", text: "", unit: "" });
  const load = useCallback(() => { if (on) get({ view: "housekeeping", h }).then(setV).catch(() => {}); }, [on, get, h]);
  useEffect(() => { load(); }, [load]);
  if (!on) return <div className="card p-5"><p className="font-ui font-bold">🧹 Housekeeping is an add-on</p><p className="mt-1 text-sm text-slate">Rooms dirty, cleaning or ready; maintenance jobs; lost and found. Checkout marks the room dirty by itself.</p><button className={`${btn} mt-3`} onClick={goPlans}>See add-ons</button></div>;
  if (!v) return <p className="text-slate">Loading…</p>;
  const colour: Record<string, string> = { ready: "bg-[#D6F0E4]", dirty: "bg-[#FBD3DC]", cleaning: "bg-[#FFF4D6]", maintenance: "bg-[#E7DAD3]" };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{v.rooms.map((r) => (
        <div key={`${r.roomId}${r.unit}`} className={`rounded-xl p-2.5 text-sm ${colour[r.status] ?? "bg-white"}`}>
          <p className="font-bold">Room {r.unit}{r.occupied ? " · in use" : ""}</p><p className="text-xs text-slate">{r.room}</p>
          <select aria-label={`Room ${r.unit} state`} className="mt-1 w-full rounded-lg border border-rule bg-white px-1 py-0.5 text-xs" value={r.status} onChange={async (e) => { await run({ action: "unit", roomId: r.roomId, unit: r.unit, status: e.target.value }); load(); }}>{UNIT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </div>
      ))}</div>
      <form className="card flex flex-wrap gap-2 p-3" onSubmit={async (e) => { e.preventDefault(); await run({ action: "issue", ...issue }, "Added."); setIssue({ ...issue, text: "" }); load(); }}>
        <select className="rounded-xl border border-rule bg-white px-2 text-sm" value={issue.kind} onChange={(e) => setIssue({ ...issue, kind: e.target.value })} aria-label="Kind"><option value="maintenance">Maintenance</option><option value="lost">Lost and found</option></select>
        <input className="w-24 rounded-xl border border-rule px-2 text-sm" placeholder="Room" value={issue.unit} onChange={(e) => setIssue({ ...issue, unit: e.target.value })} aria-label="Room" />
        <input className="min-w-[12rem] flex-1 rounded-xl border border-rule px-3 py-2 text-sm" placeholder="Leaking tap / Black phone charger found" value={issue.text} onChange={(e) => setIssue({ ...issue, text: e.target.value })} aria-label="What" />
        <button className={btn}>Add</button>
      </form>
      <ul className="space-y-1 text-sm">{v.issues.map((i) => <li key={i.id} className="flex justify-between gap-2 rounded-xl border border-rule bg-white p-2.5"><span>{i.kind === "lost" ? "🧳" : "🔧"} {i.unit ? `Room ${i.unit}: ` : ""}{i.text}</span><button className="text-xs text-crimson" onClick={async () => { await run({ action: "issue-close", id: i.id }); load(); }}>Done</button></li>)}</ul>
    </div>
  );
}

function Branches({ h, get, run, limit }: { h: string; get: Get; run: Run; limit: number }) {
  const [v, setV] = useState<{ branches: { id: string; name: string; branch: string; city: string; occupancy: { pct: number }; takenKobo: number; openOrders: number }[]; totalKobo: number } | null>(null);
  const [b, setB] = useState({ branch: "", city: "", address: "" });
  const load = useCallback(() => { get({ view: "owner", h }).then(setV).catch(() => {}); }, [get, h]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      {v && <p className="font-display text-3xl text-ink">{naira(v.totalKobo)} <span className="font-ui text-sm text-slate">taken today, every branch</span></p>}
      <div className="grid gap-3 sm:grid-cols-2">{v?.branches.map((x) => <a key={x.id} href={`/profile/hotel?h=${x.id}`} className="card block p-4 text-sm hover:border-crimson"><p className="font-bold">{x.branch || x.name}{x.city ? `, ${x.city}` : ""}</p><p className="text-slate">{naira(x.takenKobo)} today · {x.occupancy.pct}% full tonight · {x.openOrders} open orders</p></a>)}</div>
      {v && v.branches.length < limit && (
        <form className="card flex flex-wrap gap-2 p-3" onSubmit={async (e) => { e.preventDefault(); await run({ action: "branch", ...b }, "Branch added. Open it to add its rooms and menus."); setB({ branch: "", city: "", address: "" }); load(); }}>
          <input className="flex-1 rounded-xl border border-rule px-3 py-2 text-sm" placeholder="Branch, like Ikeja" value={b.branch} onChange={(e) => setB({ ...b, branch: e.target.value })} aria-label="Branch name" />
          <input className="flex-1 rounded-xl border border-rule px-3 py-2 text-sm" placeholder="City" value={b.city} onChange={(e) => setB({ ...b, city: e.target.value })} aria-label="City" />
          <button className={btn}>Add a branch</button>
        </form>
      )}
    </div>
  );
}

function Reports({ h, get }: { h: string; get: Get }) {
  const { user } = useHotelApi();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [r, setR] = useState<{ rows: { branch: string; dept: string; orders: number; ordersKobo: number }[]; rooms: Record<string, { bookings: number; kobo: number }>; branches: Record<string, string>; totalKobo: number } | null>(null);
  useEffect(() => { get({ view: "report", h, month }).then(setR).catch(() => {}); }, [get, h, month]);
  const csv = async () => {
    if (!user) return;
    const res = await fetch(`/api/hotel?view=report&h=${h}&month=${month}&csv=1`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    const a = document.createElement("a"); a.href = URL.createObjectURL(await res.blob()); a.download = `hotel-report-${month}.csv`; a.click();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl border border-rule bg-white px-3 py-1.5 text-sm" aria-label="Month" /><button className={ghost} onClick={csv}>Download (CSV)</button></div>
      {r && <p className="font-display text-3xl text-ink">{naira(r.totalKobo)} <span className="font-ui text-sm text-slate">in {month}</span></p>}
      <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate"><th>Branch</th><th>Department</th><th>Orders</th><th className="text-right">Takings</th></tr></thead><tbody>
        {r?.rows.map((x, i) => <tr key={i} className="border-t border-rule"><td className="py-1.5">{x.branch}</td><td>{x.dept}</td><td>{x.orders}</td><td className="text-right">{naira(x.ordersKobo)}</td></tr>)}
        {r && Object.entries(r.rooms).map(([hid, x]) => <tr key={hid} className="border-t border-rule"><td className="py-1.5">{r.branches[hid]}</td><td>Rooms</td><td>{x.bookings}</td><td className="text-right">{naira(x.kobo)}</td></tr>)}
      </tbody></table>
    </div>
  );
}

function Chats({ h, get }: { h: string; get: Get }) {
  const [v, setV] = useState<{ id: string; channel: string; at: string; guest: string; messages: { role: string; text: string }[]; steps: { tool: string; input: string; result: string }[]; orderId?: string }[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { get({ view: "chats", h }).then((x) => setV(x.chats)).catch(() => {}); }, [get, h]);
  if (!v) return <p className="text-slate">Loading…</p>;
  if (!v.length) return <p className="text-sm text-slate">No chats yet. Guests chat with Nana from your site{" "}(and on WhatsApp, with the add-on).</p>;
  return (
    <div className="space-y-2">{v.map((c) => (
      <div key={c.id} className="card p-3 text-sm">
        <button className="flex w-full justify-between text-left" onClick={() => setOpen(open === c.id ? null : c.id)}><span><b>{c.guest}</b> · {c.channel === "whatsapp" ? "WhatsApp" : "Website"}{c.orderId ? " · placed an order" : ""}</span><span className="text-xs text-slate">{new Date(c.at).toLocaleString("en-GB")}</span></button>
        {open === c.id && (
          <div className="mt-2 space-y-1.5">
            {c.messages.map((m, i) => <p key={i} className={m.role === "user" ? "text-ink" : "text-crimson"}><b>{m.role === "user" ? c.guest : "Nana"}:</b> {m.text}</p>)}
            <details className="text-xs text-slate"><summary>Nana&apos;s steps ({c.steps.length})</summary>{c.steps.map((s, i) => <p key={i} className="mt-1 font-mono">{s.tool}({s.input}) → {s.result}</p>)}</details>
          </div>
        )}
      </div>
    ))}</div>
  );
}

function Plans({ home, run }: { home: Home; run: Run }) {
  const { user } = useHotelApi();
  const [err, setErr] = useState("");
  const [wa, setWa] = useState(home.hotel.whatsappNumberId ?? "");
  const owner = home.role === "owner";
  const outside: Record<string, { ready: boolean; what: string } | undefined> = {
    whatsapp: { ready: home.ready.whatsapp, what: "WhatsApp ordering isn't set up yet on #NotesApp. We'll let you know when you can connect your number." },
    cardMachine: { ready: home.ready.moniepoint, what: "The card-machine link isn't set up yet on #NotesApp. Tills take cards on the machine and record them by hand until then." },
    account: { ready: home.ready.paylony, what: "Account numbers per order aren't available yet. Guests pay by card, bank or USSD meanwhile." },
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(TIER_INFO) as HotelTier[]).map((t) => (
          <div key={t} className={`card p-4 text-sm ${t === home.tier ? "border-2 border-crimson" : ""}`}>
            <p className="flex justify-between font-ui font-bold"><span>{TIER_INFO[t].emoji} {TIER_INFO[t].name}</span><span className="text-xs text-slate">on {t === "starter" ? "Pro" : t === "standard" ? "Business" : "Enterprise"}</span></p>
            <p className="mt-1 text-slate">{t === "starter" ? "Hotel website · rooms and online booking · menus and orders for one department · pay online · booking and order bells · Business books" : t === "standard" ? "Everything in Starter · several departments · live staff board · kitchen screen · tills with PINs and cash-up · stock · charge to the room bill · own domain · staff roles" : "Everything in Standard · several branches, one owner view · Nana chat ordering on the website · Conversations · monthly reports by branch and department · priority help"}</p>
            {t === home.tier && <p className="mt-2 text-xs font-bold text-crimson">Your tier</p>}
          </div>
        ))}
      </div>
      <h2 className="font-display text-2xl text-ink">Add-ons (any tier, monthly)</h2>
      {err && <p className="text-sm text-crimson">{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{home.addons.map((a) => {
        const o = outside[a.id];
        return (
          <div key={a.id} className="card p-4 text-sm">
            <p className="font-ui font-bold">{a.emoji} {a.name}</p>
            <p className="mt-1 text-slate">{a.blurb}</p>
            {a.on && <p className="mt-1 text-xs font-semibold text-[#17694a]">On until {new Date(a.until!).toLocaleDateString("en-GB")}</p>}
            {o && !o.ready && <p className="mt-2 rounded-lg bg-[#FFF4D6] px-2 py-1.5 text-xs text-[#5a4300]">Not set up yet. {o.what}</p>}
            {owner && (!o || o.ready) && <button className={`${btn} mt-2`} onClick={() => user && startCheckout(user, { kind: "hotel_addon", addon: a.id }, { amountKobo: a.priceKobo }).catch((e) => setErr(e.message))}>{a.on ? "Add a month" : "Add it"} · {naira(a.priceKobo)} a month</button>}
            {a.id === "whatsapp" && a.on && owner && home.ready.whatsapp && (
              <div className="mt-2 flex gap-2"><input className={field} placeholder="WhatsApp phone number ID (from Meta)" value={wa} onChange={(e) => setWa(e.target.value.replace(/\D/g, ""))} aria-label="WhatsApp phone number ID" /><button className={ghost} onClick={() => run({ action: "whatsapp-number", numberId: wa }, "WhatsApp number connected.")}>Save</button></div>
            )}
          </div>
        );
      })}
        <div className="card p-4 text-sm">
          <p className="font-ui font-bold">🧰 Set it up for me</p>
          <p className="mt-1 text-slate">Our team fills in your Hotel kit: rooms, prices, menus, photos and words. From {naira(home.setupFromKobo)}.</p>
          <Link href="/hotels#setup" className={`${btn} mt-2 inline-block`}>Ask us</Link>
        </div>
      </div>
      <p className="text-xs text-slate">Each tier costs what its plan costs. Add-on prices are set by #NotesApp and shown here before you pay.</p>
    </div>
  );
}
