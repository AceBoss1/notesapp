"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { naira } from "@/lib/finance";
import type { PayLine, PayRun, PayStaff } from "@/lib/payroll";

type Data = { staff: PayStaff[]; runs: (PayRun & { totals: { total: number; paid: number; people: number; open: number } })[]; cryptoReady: boolean; monthlyTotalKobo: number };
const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm";
const btn = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const blank = { name: "", role: "", monthly: "", payDay: "28", startedOn: "", bankName: "", accountName: "", accountNumber: "", note: "" };
const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).slice(0, 7);
const monthLabel = (p: string) => new Date(`${p}-15T12:00:00Z`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });

// Payroll, under Accounts: who is paid and how much, a monthly run, and "Mark paid" one person at a time (which writes a Payroll entry into the
// money ledger). Finance and super admins only. Transfers are made by hand; the account number is shown only when asked for, and logged.
export default function PayrollPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/payroll");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [period, setPeriod] = useState(thisMonth());
  const [adj, setAdj] = useState<{ key: string; adjust: string; note: string } | null>(null);
  const [shown, setShown] = useState<{ id: string; accountNumber: string; bankName: string; accountName: string } | null>(null);

  const load = useCallback(() => call().then(setData).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);
  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(""); setNote("");
    try { const r = await call(body); setNote(ok); await load(); return r; } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  };

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const lineRow = (r: PayRun, l: PayLine) => {
    const key = `${r.period}:${l.staffId}`;
    return (
      <li key={key} className="py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-ui text-sm font-bold text-ink">{l.name}{l.role ? <span className="font-normal text-slate"> · {l.role}</span> : null}</p>
            <p className="text-xs text-slate">{l.adjustKobo ? `${naira(l.baseKobo)} ${l.adjustKobo > 0 ? "+" : "−"} ${naira(Math.abs(l.adjustKobo))} (${l.adjustNote})` : "Monthly pay"}{l.paidOn ? ` · paid ${l.paidOn}` : ""}</p>
          </div>
          <p className="font-display text-lg text-ink">{naira(l.amountKobo)}</p>
          {l.status === "paid" ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-ui text-[11px] font-semibold text-emerald-800">paid</span> : (
            <span className="flex gap-2">
              <button className={ghost} disabled={busy} onClick={() => setAdj(adj?.key === key ? null : { key, adjust: l.adjustKobo ? String(l.adjustKobo / 100) : "", note: l.adjustNote })}>Adjust</button>
              <button className={ghost} disabled={busy} onClick={() => { if (confirm(`Record ${naira(l.amountKobo)} as paid to ${l.name}? This writes a Payroll entry into the money ledger.`)) run({ action: "paid", period: r.period, staffId: l.staffId }, `${l.name} is marked paid and recorded in the money ledger.`); }}>Mark paid</button>
              <button className={ghost} disabled={busy} onClick={() => { if (confirm(`Take ${l.name} out of the ${monthLabel(r.period)} run?`)) run({ action: "removeLine", period: r.period, staffId: l.staffId }, "Removed from this run."); }}>Remove</button>
            </span>
          )}
        </div>
        {adj?.key === key && (
          <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "adjust", period: r.period, staffId: l.staffId, adjust: adj.adjust || "0", note: adj.note }, "Saved.")) setAdj(null); }}>
            <label className="text-xs">Change, ₦ <span className="text-slate">(minus for a deduction)</span><input className={field} inputMode="decimal" value={adj.adjust} onChange={(e) => setAdj({ ...adj, adjust: e.target.value })} /></label>
            <label className="text-xs">Why<input className={field} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></label>
            <button className={btn} disabled={busy}>Save</button>
          </form>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/admin/team" className="font-ui text-xs font-semibold text-crimson">← Team hub</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Payroll</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        Staff pay, a monthly run, and who has been paid. Only finance and super admins see this page. Marking someone paid writes a Payroll entry into the <Link href="/admin/team/finance" className="text-crimson underline">money ledger</Link>;
        the bank transfer itself is made by hand for now. Account numbers are stored encrypted and shown only when you ask, and each time is logged.
      </p>
      {error && <p className="mt-4 whitespace-pre-line text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}
      {!data ? <p className="mt-8 text-slate">Loading…</p> : (
        <>
          {!data.cryptoReady && <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink">Account numbers can&apos;t be saved yet: <code>ACCOUNT_DATA_KEY</code> isn&apos;t set. Everything else works.</p>}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="card p-4"><p className="eyebrow">People on payroll</p><p className="mt-2 font-display text-xl text-ink">{data.staff.filter((s) => s.active).length}</p></div>
            <div className="card p-4"><p className="eyebrow">Monthly pay</p><p className="mt-2 font-display text-xl text-ink">{naira(data.monthlyTotalKobo)}</p></div>
            <div className="card p-4"><p className="eyebrow">Latest run</p><p className="mt-2 font-display text-xl text-ink">{data.runs[0] ? `${monthLabel(data.runs[0].period)}: ${data.runs[0].totals.open ? `${data.runs[0].totals.open} to pay` : "all paid"}` : "None yet"}</p></div>
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">Monthly runs</h2>
              <form className="flex items-end gap-2" onSubmit={async (e) => { e.preventDefault(); await run({ action: "startRun", period }, `The ${monthLabel(period)} run is ready.`); }}>
                <label className="text-xs">Month<input className={field} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required /></label>
                <button className={btn} disabled={busy}>Start the run</button>
              </form>
            </div>
            {data.runs.length === 0 && <p className="mt-4 text-sm text-slate">No runs yet. Add your staff below, then start a month.</p>}
            {data.runs.map((r) => (
              <div key={r.id} className="card mt-4 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-xl text-ink">{monthLabel(r.period)}</h3>
                  <p className="text-xs text-slate">{r.totals.people} people · {naira(r.totals.total)} · paid {naira(r.totals.paid)}</p>
                </div>
                <ul className="mt-3 divide-y divide-rule">{r.lines.map((l) => lineRow(r, l))}</ul>
              </div>
            ))}
          </section>

          <section className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">Staff</h2>
              {!form && <button className={ghost} onClick={() => setForm({ ...blank, startedOn: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) })}>Add a person</button>}
            </div>
            {form && (
              <form className="mt-4 grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-2" onSubmit={async (e) => {
                e.preventDefault();
                const { id, ...staff } = form;
                const ok = await run(id ? { action: "updateStaff", id, staff } : { action: "addStaff", staff }, id ? "Saved." : "Added.");
                if (ok) setForm(null);
              }}>
                <label className="text-xs">Name<input className={field} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="text-xs">Role<input className={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></label>
                <label className="text-xs">Monthly pay, ₦<input className={field} required inputMode="decimal" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} /></label>
                <label className="text-xs">Pay day (1 to 28)<input className={field} type="number" min={1} max={28} value={form.payDay} onChange={(e) => setForm({ ...form, payDay: e.target.value })} /></label>
                <label className="text-xs">Started on<input className={field} type="date" required value={form.startedOn} onChange={(e) => setForm({ ...form, startedOn: e.target.value })} /></label>
                <label className="text-xs">Bank<input className={field} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></label>
                <label className="text-xs">Name on the account<input className={field} value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></label>
                <label className="text-xs">Account number <span className="text-slate">{form.id ? "(leave empty to keep the saved one)" : "(10 digits)"}</span><input className={field} inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></label>
                <label className="text-xs sm:col-span-2">Note<input className={field} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                <div className="flex gap-2 sm:col-span-2"><button className={btn} disabled={busy}>{form.id ? "Save" : "Add"}</button><button type="button" className={ghost} onClick={() => setForm(null)}>Cancel</button></div>
              </form>
            )}
            <ul className="mt-4 divide-y divide-rule">
              {data.staff.map((s) => (
                <li key={s.id} className={`py-3 ${s.active ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-ui text-sm font-bold text-ink">{s.name}{s.role ? <span className="font-normal text-slate"> · {s.role}</span> : null}{!s.active && <span className="ml-2 text-xs font-normal text-slate">(not on payroll)</span>}</p>
                      <p className="text-xs text-slate">Paid on the {s.payDay}th · since {s.startedOn}{s.bankName ? ` · ${s.bankName}` : ""}{s.hasAccount ? ` · account ending ${s.accountLast4}` : " · no account saved"}</p>
                    </div>
                    <p className="font-display text-lg text-ink">{naira(s.monthlyKobo)}</p>
                    <span className="flex gap-2">
                      {s.hasAccount && <button className={ghost} disabled={busy} onClick={async () => { const r = await run({ action: "reveal", id: s.id }, "Shown below. This was logged."); if (r) setShown({ id: s.id, ...r }); }}>Show account</button>}
                      <button className={ghost} onClick={() => setForm({ id: s.id, name: s.name, role: s.role, monthly: String(s.monthlyKobo / 100), payDay: String(s.payDay), startedOn: s.startedOn, bankName: s.bankName, accountName: s.accountName, accountNumber: "", note: s.note })}>Edit</button>
                      <button className={ghost} disabled={busy} onClick={() => run({ action: "updateStaff", id: s.id, staff: {}, active: !s.active }, s.active ? "Taken off payroll. Past runs are unchanged." : "Back on payroll.")}>{s.active ? "Take off payroll" : "Put back"}</button>
                    </span>
                  </div>
                  {shown?.id === s.id && <p className="mt-2 rounded-lg bg-paper p-2 font-mono text-xs text-ink">{shown.bankName} · {shown.accountName} · {shown.accountNumber} <button className="ml-3 text-crimson underline" onClick={() => setShown(null)}>Hide</button></p>}
                </li>
              ))}
              {data.staff.length === 0 && <li className="py-3 text-sm text-slate">No one yet.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
