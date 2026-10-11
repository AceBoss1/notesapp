"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { naira } from "@/lib/finance";
import { TEMPLATES, daysLeft, kobo, monthlyAfter, remainingCents, usd, usedCents, type Grant, type GrantInput } from "@/lib/grants";

type Data = { grants: Grant[]; today: string; canWrite: boolean };
const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm";
const btn = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
type Form = Record<string, string | boolean>;
const blank: Form = { kind: "subscription", provider: "", title: "", seats: "", seatsUsed: "", rateCents: "", months: "", valueCents: "", fxNgn: "", startsOn: "", endsOn: "", becomesPaid: false, paidRateCents: "", notes: "" };
// Dollars in the form, cents on the wire.
const toForm = (g: GrantInput): Form => {
  const f: Form = { ...blank };
  for (const k of Object.keys(blank)) {
    const v = g[k as keyof Grant];
    if (v === undefined || v === null) continue;
    f[k] = typeof v === "boolean" ? v : ["rateCents", "valueCents", "paidRateCents"].includes(k) ? String(Number(v) / 100) : String(v);
  }
  return f;
};
const fromForm = (f: Form): GrantInput => {
  const c = (v: unknown) => (v === "" ? 0 : Math.round(Number(v) * 100));
  return { ...f, rateCents: c(f.rateCents), valueCents: c(f.valueCents), paidRateCents: c(f.paidRateCents), seats: Number(f.seats) || 0, seatsUsed: Number(f.seatsUsed) || 0, months: Number(f.months) || 0, fxNgn: Number(f.fxNgn) || 0 };
};

function Chip({ left, status }: { left: number; status: string }) {
  const tone = status !== "active" ? "bg-slate/15 text-slate" : left <= 7 ? "bg-crimson text-paper" : left <= 30 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900";
  const text = status !== "active" ? status : left < 0 ? "ended" : left === 0 ? "ends today" : `${left} day${left === 1 ? "" : "s"} left`;
  return <span className={`rounded-full px-2.5 py-0.5 font-ui text-[11px] font-semibold ${tone}`}>{text}</span>;
}

// The team hub's grants and subscriptions: free credits and free-period plans the company holds, what each is worth, how much is used,
// when it ends and what it costs afterwards. Reminders are sent automatically; "Add to ledger" puts the value on the grant side of the money ledger.
export default function GrantsPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [useFor, setUseFor] = useState<string | null>(null);
  const [use, setUse] = useState({ cents: "", note: "" });

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/grants", body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify(body) }
      : { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => call().then(setData).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(""); setNote("");
    try { await call(body); setNote(ok); await load(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };

  const totals = useMemo(() => {
    const live = (data?.grants ?? []).filter((g) => g.status === "active");
    const left = (g: Grant) => (g.kind === "credit" ? remainingCents(g) : g.valueCents);
    const next = live.filter((g) => daysLeft(g.endsOn, data!.today) >= 0)[0];
    return { live: live.length, worth: live.reduce((s, g) => s + g.valueCents, 0), left: live.reduce((s, g) => s + left(g), 0), after: live.reduce((s, g) => s + monthlyAfter(g), 0), next };
  }, [data]);

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...(f ?? blank), [k]: v }));
  const sub = form?.kind !== "credit";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/admin/team" className="font-ui text-xs font-semibold text-crimson">← Team hub</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Grants &amp; subscriptions</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        Free credits and free-period plans we hold, what each is worth, how much has been used, when it ends and what it costs afterwards. Everyone in
        finance and the owner get a reminder 30, 14, 7, 3 and 1 days before each ends, and on the day. Prices are list prices at the time of entry. Check them on the provider&apos;s invoice.
      </p>
      {error && <p className="mt-4 whitespace-pre-line text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}
      {!data ? <p className="mt-8 text-slate">Loading…</p> : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Running", String(totals.live), totals.next ? `Next ends ${dayLabel(totals.next.endsOn)}` : "Nothing running"],
              ["Total worth", usd(totals.worth), "Across running grants"],
              ["Still to use", usd(totals.left), "Credit left, plus plans' full value"],
              ["Costs after free", `${usd(totals.after)}/mo`, "If every plan turns paid"],
            ].map(([l, v, n]) => (
              <div key={l} className="card p-4"><p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">{l}</p><p className="mt-1 font-display text-2xl text-ink">{v}</p><p className="mt-1 text-xs text-slate">{n}</p></div>
            ))}
          </div>

          {data.canWrite && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="font-ui text-xs font-semibold text-slate">Add:</span>
              {TEMPLATES.map((t) => <button key={t.key} type="button" className={ghost} onClick={() => { setEditing(null); setForm(toForm({ ...t.input, startsOn: data.today })); }}>{t.label}</button>)}
              <button type="button" className={ghost} onClick={() => { setEditing(null); setForm({ ...blank, startsOn: data.today }); }}>Something else</button>
            </div>
          )}

          {form && (
            <form className="card mt-4 grid gap-3 p-5 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "save", id: editing, grant: fromForm(form) }, editing ? "Saved." : "Added.")) { setForm(null); setEditing(null); } }}>
              <label className="text-xs">Type<select className={field} value={String(form.kind)} onChange={(e) => set("kind", e.target.value)}><option value="subscription">Plan or subscription</option><option value="credit">Credit (usage is deducted)</option></select></label>
              <label className="text-xs">From<input className={field} required value={String(form.provider)} onChange={(e) => set("provider", e.target.value)} /></label>
              <label className="text-xs sm:col-span-2">Name<input className={field} required value={String(form.title)} onChange={(e) => set("title", e.target.value)} /></label>
              {sub && <>
                <label className="text-xs">Seats<input className={field} inputMode="numeric" value={String(form.seats)} onChange={(e) => set("seats", e.target.value)} /></label>
                <label className="text-xs">Seats in use<input className={field} inputMode="numeric" value={String(form.seatsUsed)} onChange={(e) => set("seatsUsed", e.target.value)} /></label>
                <label className="text-xs">List price, $ per seat per month<input className={field} inputMode="decimal" value={String(form.rateCents)} onChange={(e) => set("rateCents", e.target.value)} /></label>
                <label className="text-xs">Free months<input className={field} inputMode="numeric" value={String(form.months)} onChange={(e) => set("months", e.target.value)} /></label>
              </>}
              <label className="text-xs">Worth in total, $ {sub && <span className="text-slate">(blank = seats × price × months)</span>}<input className={field} inputMode="decimal" value={String(form.valueCents)} onChange={(e) => set("valueCents", e.target.value)} /></label>
              <label className="text-xs">Naira per US dollar <span className="text-slate">(needed to add it to the ledger)</span><input className={field} inputMode="decimal" value={String(form.fxNgn)} onChange={(e) => set("fxNgn", e.target.value)} /></label>
              <label className="text-xs">Starts<input className={field} type="date" value={String(form.startsOn)} onChange={(e) => set("startsOn", e.target.value)} /></label>
              <label className="text-xs">Ends <span className="text-slate">(blank = {sub ? "after the free months" : "180 days after the start"})</span><input className={field} type="date" value={String(form.endsOn)} onChange={(e) => set("endsOn", e.target.value)} /></label>
              {sub && <>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!form.becomesPaid} onChange={(e) => set("becomesPaid", e.target.checked)} /> Becomes paid when the free period ends</label>
                {!!form.becomesPaid && <label className="text-xs">Price after, $ per seat per month <span className="text-slate">(blank = list price)</span><input className={field} inputMode="decimal" value={String(form.paidRateCents)} onChange={(e) => set("paidRateCents", e.target.value)} /></label>}
              </>}
              <label className="text-xs sm:col-span-2">Notes<textarea className={field} rows={2} value={String(form.notes)} onChange={(e) => set("notes", e.target.value)} /></label>
              <div className="flex gap-2 sm:col-span-2"><button className={btn} disabled={busy}>{editing ? "Save changes" : "Add"}</button><button type="button" className={ghost} onClick={() => { setForm(null); setEditing(null); }}>Cancel</button></div>
            </form>
          )}

          <div className="mt-8 space-y-4">
            {data.grants.length === 0 && <p className="text-sm text-slate">Nothing here yet. Add the Claude credit, Moda and Granola above.</p>}
            {data.grants.map((g) => {
              const left = daysLeft(g.endsOn, data.today);
              const used = usedCents(g);
              const pct = g.valueCents ? Math.min(100, Math.round((used / g.valueCents) * 100)) : 0;
              return (
                <div key={g.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="font-display text-xl text-ink">{g.title}</p><p className="text-xs text-slate">{g.provider} · {dayLabel(g.startsOn)} to {dayLabel(g.endsOn)}</p></div>
                    <Chip left={left} status={g.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div><dt className="text-xs text-slate">Worth</dt><dd>{usd(g.valueCents)}{g.fxNgn > 0 && <span className="block text-xs text-slate">{naira(kobo(g.valueCents, g.fxNgn))}</span>}</dd></div>
                    {g.kind === "subscription" ? <>
                      <div><dt className="text-xs text-slate">Seats</dt><dd>{g.seatsUsed} of {g.seats} in use</dd></div>
                      <div><dt className="text-xs text-slate">Rate</dt><dd>{usd(g.rateCents)} per seat/month</dd></div>
                      <div><dt className="text-xs text-slate">After free period</dt><dd>{g.becomesPaid ? `${usd(monthlyAfter(g))}/month` : "Stops"}</dd></div>
                    </> : <>
                      <div><dt className="text-xs text-slate">Used</dt><dd>{usd(used)} ({pct}%)</dd></div>
                      <div><dt className="text-xs text-slate">Left</dt><dd>{usd(remainingCents(g))}</dd></div>
                    </>}
                  </dl>
                  {g.kind === "credit" && <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule" aria-hidden><div className="h-full bg-crimson" style={{ width: `${pct}%` }} /></div>}
                  {g.becomesPaid && g.status === "active" && left >= 0 && left <= 30 && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Charges start after {dayLabel(g.endsOn)}. Cancel before then if you won&apos;t keep it.</p>}
                  {g.notes && <p className="mt-3 text-xs text-slate">{g.notes}</p>}
                  {g.usage.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-slate">{g.usage.slice(-5).reverse().map((u, i) => <li key={i}>{dayLabel(u.on)}: {usd(u.cents)}{u.note ? `, ${u.note}` : ""}</li>)}</ul>}
                  {data.canWrite && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className={ghost} onClick={() => { setEditing(g.id); setForm(toForm(g)); }}>Edit</button>
                      {g.kind === "credit" && <button type="button" className={ghost} onClick={() => setUseFor(useFor === g.id ? null : g.id)}>Record usage</button>}
                      {g.ledgerEntryId ? <Link className={ghost} href="/admin/team/finance">In the ledger</Link> : <button type="button" className={ghost} disabled={busy || g.fxNgn <= 0} title={g.fxNgn <= 0 ? "Add the naira per dollar rate first (Edit)" : ""} onClick={() => run({ action: "ledger", id: g.id }, "Added to the ledger as an in-kind grant.")}>Add to ledger</button>}
                      {g.status === "active" ? <>
                        <button type="button" className={ghost} disabled={busy} onClick={() => run({ action: "status", id: g.id, status: "cancelled" }, "Marked cancelled. No more reminders.")}>Mark cancelled</button>
                        <button type="button" className={ghost} disabled={busy} onClick={() => run({ action: "status", id: g.id, status: "ended" }, "Marked ended.")}>Mark ended</button>
                      </> : <button type="button" className={ghost} disabled={busy} onClick={() => run({ action: "status", id: g.id, status: "active" }, "Active again.")}>Reactivate</button>}
                    </div>
                  )}
                  {useFor === g.id && (
                    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "usage", id: g.id, usage: { cents: Math.round(Number(use.cents) * 100), note: use.note } }, "Usage recorded.")) { setUse({ cents: "", note: "" }); setUseFor(null); } }}>
                      <label className="text-xs">Used, $<input className={field} inputMode="decimal" required value={use.cents} onChange={(e) => setUse({ ...use, cents: e.target.value })} /></label>
                      <label className="text-xs">What for<input className={field} value={use.note} onChange={(e) => setUse({ ...use, note: e.target.value })} /></label>
                      <button className={btn} disabled={busy}>Save</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
