"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import { NIGERIAN_STATES } from "@/lib/merch";
import { ALL_STATES, WEIGHT_BANDS_KG, ZONES, cleanProfile, type ProviderAccess, type ProviderProfile, type Zone } from "@/lib/logistics";
import { SHIPMENT_SERVICES } from "@/lib/shipments";

// A provider's side of the logistics network on /shipments: how they have access (their plan, the add-on, or its free trial) and their
// listing (where they deliver, a few words, their rate card), which is what stores see on /logistics/network.
export type Me = { access: ProviderAccess; profile: (ProviderProfile & { uid: string }) | null; price: number; trialDays: number; tier: string; payouts: boolean };
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const cell = "w-20 border border-rule bg-card px-2 py-1.5 text-right text-sm outline-none focus:border-crimson";
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "");

async function post(user: User, body: Record<string, unknown>) {
  const res = await fetch("/api/logistics", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Something went wrong.");
  return j;
}

// Starting prices for a new rate card, in naira, so the form isn't blank. The provider changes them all.
const STARTER: Record<Zone, number[]> = { city: [1500, 2000, 3000, 4500, 6000], state: [2500, 3000, 4000, 5500, 7500], region: [3500, 4000, 5500, 7500, 10000], national: [5000, 5500, 7500, 10000, 13000] };
const STARTER_EXTRA: Record<Zone, number> = { city: 200, state: 250, region: 350, national: 450 };

type Form = { listed: boolean; about: string; areas: string; coverage: string[]; services: string[]; city: string; state: string; prices: Record<Zone, string[]>; extra: Record<Zone, string>; sameDay: string };
function toForm(p: ProviderProfile | null): Form {
  const z = (f: (id: Zone) => string[] | string) => Object.fromEntries(ZONES.map((x) => [x.id, f(x.id)]));
  return {
    listed: p?.listed ?? true, about: p?.about ?? "", areas: p?.areas ?? "", coverage: p?.coverage ?? [], services: p?.services ?? ["delivery"],
    city: p?.rateCard.base.city ?? "", state: p?.rateCard.base.state ?? "",
    prices: z((id) => (p ? p.rateCard.prices[id].map((k) => String(k / 100)) : STARTER[id].map(String))) as Record<Zone, string[]>,
    extra: z((id) => String(p ? p.rateCard.extraPerKgKobo[id] / 100 : STARTER_EXTRA[id])) as Record<Zone, string>,
    sameDay: String(p ? p.rateCard.sameDayKobo / 100 : 0),
  };
}
const toProfile = (f: Form) => ({
  listed: f.listed, about: f.about, areas: f.areas, coverage: f.coverage, services: f.services,
  rateCard: {
    base: { city: f.city, state: f.state },
    prices: Object.fromEntries(ZONES.map((z) => [z.id, f.prices[z.id].map((v) => Math.round(Number(v) * 100))])),
    extraPerKgKobo: Object.fromEntries(ZONES.map((z) => [z.id, Math.round(Number(f.extra[z.id]) * 100)])),
    sameDayKobo: Math.round(Number(f.sameDay) * 100),
  },
});

export function AccessCard({ me, user, onChange }: { me: Me; user: User; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const a = me.access;
  async function trial() {
    setBusy(true); setError("");
    try { await post(user, { action: "start_trial" }); onChange(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't start the trial."); } finally { setBusy(false); }
  }
  async function pay() {
    setBusy(true); setError("");
    try { await startCheckout(user, { kind: "logistics_addon" }, { amountKobo: me.price }); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't start payment."); setBusy(false); }
  }
  const payBtn = <button disabled={busy} onClick={pay} className="btn-primary !px-4 !py-2 text-xs">{a.ok ? "Add a month" : "Get the add-on"} · {formatNaira(me.price)}</button>;
  return (
    <section className="card mb-6 p-5 text-sm">
      {a.ok && a.via === "plan" && <p className="text-ink"><b>Logistics tools:</b> included in your plan. You&apos;re in the network once your listing is saved and payouts are set up.</p>}
      {a.ok && a.via === "trial" && <><p className="text-ink"><b>Logistics add-on: free trial</b> until {day(a.until)}. Add the add-on to carry on after that: {formatNaira(me.price)} a month, and paying early loses nothing.</p><div className="mt-3">{payBtn}</div></>}
      {a.ok && a.via === "addon" && <><p className="text-ink"><b>Logistics add-on</b> paid until {day(a.until)}.</p><div className="mt-3">{payBtn}</div></>}
      {!a.ok && (
        <>
          <p className="font-display text-xl text-ink">Run deliveries? Join the logistics network</p>
          <p className="mt-1 text-slate">Book shipments for your customers, hand them rider to rider, and be listed where stores choose a delivery partner: their buyers pay your prices at checkout. Business and Enterprise include it; on Free Basic and Pro it&apos;s the logistics add-on, {formatNaira(me.price)} a month.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {a.canTrial && <button disabled={busy} onClick={trial} className="btn-primary !px-4 !py-2 text-xs">Start the free {me.trialDays}-day trial (no card)</button>}
            {(me.tier === "basic" || me.tier === "pro") && payBtn}
            {me.tier === "standard" && <Link href="/profile/publishing" className="btn-primary !px-4 !py-2 text-xs">Start publishing (Free Basic) first</Link>}
            <Link href="/pricing" className="rounded-full border border-rule px-4 py-2 text-xs font-semibold text-ink">Or Business, with your own site</Link>
          </div>
        </>
      )}
      {a.ok && !me.payouts && <p className="mt-2 text-crimson">Set up payouts under <Link href="/profile/publishing" className="underline">Rates &amp; payouts</Link>: stores can only choose you once you can be paid.</p>}
      {error && <p className="mt-2 text-crimson" role="alert">{error}</p>}
    </section>
  );
}

export function ListingCard({ me, user, onSaved }: { me: Me; user: User; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => toForm(me.profile));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => setF(toForm(me.profile)), [me.profile]);
  const all = f.coverage.includes(ALL_STATES);
  const toggle = (k: "coverage" | "services", v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  async function save() {
    const body = toProfile(f);
    const check = cleanProfile(body);
    if (!check.ok) return setMsg(check.error);
    setBusy(true); setMsg("");
    try { await post(user, { action: "save_profile", profile: body }); setMsg("Saved. Stores see it on the network."); onSaved(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <details className="card mb-6 p-5" open={!me.profile}>
      <summary className="cursor-pointer font-display text-lg text-ink">Your listing in the logistics network {me.profile ? <span className="font-ui text-xs font-normal text-slate">· {me.profile.listed ? "listed" : "paused"}</span> : null}</summary>
      <p className="mt-2 text-xs text-slate">Stores find you by the states you cover, read your listing and message you; when one chooses you as its delivery partner, its buyers pay your price at checkout and the orders come to you here. #NotesApp&apos;s commission comes out of what you earn on each delivery; buyers and stores pay nothing extra. <Link href="/logistics/network" className="text-crimson underline">See the network</Link></p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate">Where you&apos;re based: city<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={field} placeholder="Ikeja" /></label>
        <label className="text-xs text-slate">State
          <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className={field}><option value="">Choose…</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="text-xs text-slate sm:col-span-2">About you (a few lines stores read)<textarea value={f.about} maxLength={400} rows={2} onChange={(e) => setF({ ...f, about: e.target.value })} className={field} placeholder="Same-day dispatch in Lagos, waybills to every park in the South West." /></label>
      </div>

      <p className="mt-4 text-xs font-semibold text-ink">Coverage: the states you deliver to</p>
      <label className="mt-1 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={() => setF((x) => ({ ...x, coverage: all ? [] : [ALL_STATES] }))} /> All of Nigeria</label>
      {!all && <div className="mt-2 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">{NIGERIAN_STATES.map((s) => <label key={s} className="flex items-center gap-1.5"><input type="checkbox" checked={f.coverage.includes(s)} onChange={() => toggle("coverage", s)} />{s}</label>)}</div>}
      <label className="mt-3 block text-xs text-slate">Areas, parks or routes you run (optional)<input value={f.areas} maxLength={300} onChange={(e) => setF({ ...f, areas: e.target.value })} className={field} placeholder="Ikeja, Lekki, Yaba · Jibowu and Ojota parks" /></label>

      <p className="mt-4 text-xs font-semibold text-ink">Services</p>
      <div className="mt-1 flex flex-wrap gap-2">{SHIPMENT_SERVICES.map((s) => <label key={s.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${f.services.includes(s.id) ? "border-crimson" : "border-rule"}`}><input type="checkbox" checked={f.services.includes(s.id)} onChange={() => toggle("services", s.id)} />{s.name}</label>)}</div>

      <p className="mt-4 text-xs font-semibold text-ink">Rate card (₦), by distance from where you&apos;re based and the parcel&apos;s weight</p>
      <div className="mt-2 overflow-x-auto">
        <table className="text-xs">
          <thead><tr className="text-left text-slate"><th className="pr-3 font-normal" />{WEIGHT_BANDS_KG.map((b) => <th key={b} className="px-1 font-normal">up to {b} kg</th>)}<th className="px-1 font-normal">each kg after</th></tr></thead>
          <tbody>
            {ZONES.map((z) => (
              <tr key={z.id}>
                <td className="py-1 pr-3"><b className="block text-ink">{z.name}</b><span className="text-[10px] text-slate">{z.blurb}</span></td>
                {WEIGHT_BANDS_KG.map((_, i) => <td key={i} className="px-1"><input inputMode="numeric" aria-label={`${z.name}, up to ${WEIGHT_BANDS_KG[i]} kg`} value={f.prices[z.id][i]} onChange={(e) => setF((x) => ({ ...x, prices: { ...x.prices, [z.id]: x.prices[z.id].map((v, j) => (j === i ? e.target.value : v)) } }))} className={cell} /></td>)}
                <td className="px-1"><input inputMode="numeric" aria-label={`${z.name}, each kg after 20`} value={f.extra[z.id]} onChange={(e) => setF((x) => ({ ...x, extra: { ...x.extra, [z.id]: e.target.value } }))} className={cell} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-3 block max-w-xs text-xs text-slate">Same-day in your city, extra (₦, 0 = none)<input inputMode="numeric" value={f.sameDay} onChange={(e) => setF({ ...f, sameDay: e.target.value })} className={field} /></label>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.listed} onChange={(e) => setF({ ...f, listed: e.target.checked })} /> Listed in the network (untick to pause; stores already using you carry on)</label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={save} className="btn-primary !px-5 !py-2 text-xs">{busy ? "Saving…" : "Save listing"}</button>
        {msg && <span className="text-xs text-ink" role="status">{msg}</span>}
      </div>
    </details>
  );
}
