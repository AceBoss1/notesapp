"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { MERCH_COLOURS, MERCH_DESIGNS, MERCH_ITEMS, type MerchSettings } from "@/lib/merch";

// Admin → Merch → Settings (docs/MERCH_3D.md): the batch, delivery, each item's price, colours and on/off, the custom shirts and the
// extras. Merch is a section of the pricing settings, so this saves through /api/admin/pricing (owner and super admins), takes effect
// within 20 seconds everywhere (the store, checkout, receipts) and lands in the same change log. Orders already paid keep their price.
type Log = { id: string; at: string; byEmail: string; changes: string[] };
const naira = (kobo: number) => String(Math.round(kobo / 100));
const kobo = (v: string) => Math.round(Number(v.replace(/[,\s₦]/g, "")) * 100);
const field = "rounded-lg border border-rule bg-card px-2 py-1 text-sm";

export default function MerchSettingsPanel({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [m, setM] = useState<MerchSettings | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/pricing", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (r.status === 403) { setDenied(true); return; }
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Couldn't load the settings.");
    setConfig(j.config); setM(j.config.merch);
    setLog((j.log as Log[]).filter((l) => l.changes?.some((c) => c.startsWith("merch."))).slice(0, 6));
  }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (denied) return <p className="mt-8 text-sm text-slate">Prices, colours and batch dates are changed by the owner and super admins.</p>;
  if (!m || !config) return <p className="mt-8 text-sm text-slate">{msg || "Loading settings…"}</p>;
  const set = (next: Partial<MerchSettings>) => setM({ ...m, ...next });

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/pricing", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ config: { ...config, merch: m } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't save.");
      setMsg(`Saved: ${(j.changes as string[]).filter((c) => c.startsWith("merch.")).length} change(s). The store and checkout use them within 20 seconds.`);
      await load(); onSaved();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); } finally { setBusy(false); }
  }

  return (
    <div className="card mt-8 p-5">
      <p className="font-ui text-sm font-bold">Settings</p>
      <p className="mt-1 text-xs text-slate">Every price here is what the store, checkout and receipts use, within 20 seconds of saving. Orders already paid keep the price they paid. Each change is logged with who made it.</p>

      <h3 className="mt-5 text-sm font-bold">Batch</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate">Name<input className={`${field} mt-1 block w-full`} value={m.batch.label} onChange={(e) => set({ batch: { ...m.batch, label: e.target.value } })} placeholder="Batch 2" /></label>
        <label className="text-xs text-slate">Delivery anywhere in Nigeria, ₦<input className={`${field} mt-1 block w-full`} inputMode="numeric" value={naira(m.deliveryKobo)} onChange={(e) => set({ deliveryKobo: kobo(e.target.value) })} /></label>
        <label className="text-xs text-slate">Opens (leave empty to open now)<input type="date" className={`${field} mt-1 block w-full`} value={m.batch.opensOn} onChange={(e) => set({ batch: { ...m.batch, opensOn: e.target.value } })} /></label>
        <label className="text-xs text-slate">Last day to order<input type="date" className={`${field} mt-1 block w-full`} value={m.batch.closesOn} onChange={(e) => set({ batch: { ...m.batch, closesOn: e.target.value } })} /></label>
        <label className="text-xs text-slate sm:col-span-2">What buyers are told about delivery<input className={`${field} mt-1 block w-full`} value={m.batch.note} maxLength={200} onChange={(e) => set({ batch: { ...m.batch, note: e.target.value } })} /></label>
      </div>
      <p className="mt-1 text-xs text-slate">A new name starts a new batch: the print sheet and the orders list follow it.</p>

      <h3 className="mt-6 text-sm font-bold">Custom shirts</h3>
      <ul className="mt-2 space-y-2">
        {MERCH_DESIGNS.map((d) => {
          const x = m.designs.find((y) => y.id === d.id)!;
          const put = (n: Partial<typeof x>) => set({ designs: m.designs.map((y) => (y.id === d.id ? { ...y, ...n } : y)) });
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-rule p-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.image} alt="" className="h-10 w-10 object-contain" />
              <b className="flex-1">{d.name}</b>
              <label className="text-xs text-slate">₦ <input className={`${field} w-24`} inputMode="numeric" value={naira(x.priceKobo)} onChange={(e) => put({ priceKobo: kobo(e.target.value) })} aria-label={`${d.name} price`} /></label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={x.on} onChange={(e) => put({ on: e.target.checked })} /> On sale</label>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-sm font-bold">Items, prices and colours</h3>
      <ul className="mt-2 space-y-2">
        {MERCH_ITEMS.map((it) => {
          const x = m.items.find((y) => y.id === it.id)!;
          const put = (n: Partial<typeof x>) => set({ items: m.items.map((y) => (y.id === it.id ? { ...y, ...n } : y)) });
          return (
            <li key={it.id} className="rounded-xl border border-rule p-2 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <b className="flex-1">{it.name}</b>
                <label className="text-xs text-slate">₦ <input className={`${field} w-24`} inputMode="numeric" value={naira(x.priceKobo)} onChange={(e) => put({ priceKobo: kobo(e.target.value) })} aria-label={`${it.name} price`} /></label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={x.on} onChange={(e) => put({ on: e.target.checked })} /> On sale</label>
              </div>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${it.name} colours`}>
                {MERCH_COLOURS.map((c) => {
                  const on = x.colours.includes(c.id);
                  return (
                    <label key={c.id} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${on ? "border-ink" : "border-rule text-slate"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => put({ colours: on ? x.colours.filter((y) => y !== c.id) : [...x.colours, c.id] })} />
                      <i className="block h-3 w-3 rounded-full border border-rule" style={{ background: c.hex }} />{c.name}
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-sm font-bold">Extras</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {([["nameKobo", "Name on the back of a shirt"], ["backKobo", "T-shirt: front and back"], ["xxlKobo", "Shirts: XXL"], ["wrapKobo", "Mug or coffee cup: wrapped all round"]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-xs text-slate">{label}, ₦<input className={`${field} w-24`} inputMode="numeric" value={naira(m.extras[k])} onChange={(e) => set({ extras: { ...m.extras, [k]: kobo(e.target.value) } })} /></label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy ? "Saving…" : "Save merch settings"}</button>
        {msg && <p className="text-sm text-ink" role="status">{msg}</p>}
      </div>
      {log.length > 0 && (
        <details className="mt-4 text-xs text-slate">
          <summary className="cursor-pointer">Recent changes</summary>
          <ul className="mt-2 space-y-1">{log.map((l) => <li key={l.id}>{new Date(l.at).toLocaleString("en-GB")} · {l.byEmail}: {l.changes.filter((c) => c.startsWith("merch.")).join("; ")}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
