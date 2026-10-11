"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { CATEGORIES, naira } from "@/lib/finance";
import { daysLeft } from "@/lib/grants";
import type { Due } from "@/lib/dues";

const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm";
const ghost = "rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

// "Expenses due": what the company has to pay and when (bills, renewals, free plans turning paid), soonest first. Shown on the team hub and the
// money ledger. Finance adds items and marks them paid (that writes the expense into the ledger); reminders are sent ahead of each date.
export default function DuesPanel({ user, onPaid }: { user: User; onPaid?: () => void }) {
  const [data, setData] = useState<{ dues: Due[]; today: string; canWrite: boolean } | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/dues", body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) }
      : { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => call().then(setData).catch((e) => setError(e.message)), [call]);
  useEffect(() => { load(); }, [load]);
  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(""); setNote("");
    try { await call(body); setNote(ok); await load(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };

  if (!data) return error ? <p className="mt-6 text-sm text-crimson">{error}</p> : null;
  const soon = data.dues.filter((d) => daysLeft(d.dueOn, data.today) <= 30);
  const soonTotal = soon.reduce((s, d) => s + d.amountKobo, 0);
  const unknown = soon.some((d) => !d.amountKobo);

  return (
    <section className="card mt-6 p-5" aria-labelledby="dues-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="dues-h" className="font-display text-2xl text-ink">Expenses due</h2>
          <p className="text-xs text-slate">{soon.length ? `${soon.length} in the next 30 days · ${naira(soonTotal)}${unknown ? " + amounts not known yet" : ""}` : "Nothing due in the next 30 days."} Reminders are sent ahead of each date.</p>
        </div>
        {data.canWrite && !form && <button type="button" className={ghost} onClick={() => setForm({ title: "", party: "", amount: "", dueOn: data.today, category: "hosting", note: "" })}>Add expense due</button>}
      </div>
      {note && <p className="mt-2 text-sm text-green-700" role="status">{note}</p>}
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}

      {form && (
        <form className="mt-4 grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "add", due: form }, "Added. You will be reminded before it is due.")) setForm(null); }}>
          <label className="text-xs sm:col-span-2">What is due<input className={field} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="For example: Vercel Pro renewal" /></label>
          <label className="text-xs">To whom<input className={field} value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></label>
          <label className="text-xs">Amount, ₦ <span className="text-slate">(blank if not known)</span><input className={field} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="text-xs">Due on<input className={field} type="date" required value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} /></label>
          <label className="text-xs">Kind of expense<select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.expense.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label className="text-xs sm:col-span-2">Note<input className={field} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-full bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50">Add</button><button type="button" className={ghost} onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {data.dues.length > 0 && (
        <ul className="mt-4 divide-y divide-rule">
          {data.dues.map((d) => {
            const left = daysLeft(d.dueOn, data.today);
            const tone = left < 0 ? "bg-crimson text-paper" : left <= 7 ? "bg-amber-100 text-amber-900" : "bg-slate/10 text-slate";
            return (
              <li key={d.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 font-ui text-[11px] font-semibold ${tone}`}>{left < 0 ? `${-left} day${left === -1 ? "" : "s"} overdue` : left === 0 ? "due today" : `in ${left} day${left === 1 ? "" : "s"}`}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-sm font-bold text-ink">{d.title}</p>
                    <p className="text-xs text-slate">{dayLabel(d.dueOn)}{d.party ? ` · ${d.party}` : ""}{d.note ? ` · ${d.note}` : ""}</p>
                  </div>
                  <p className="font-display text-lg text-ink">{d.amountKobo ? naira(d.amountKobo) : "Amount?"}</p>
                  {d.source === "grant" ? <Link href="/admin/team/grants" className={ghost}>Open grant</Link> : data.canWrite && (
                    <span className="flex gap-2">
                      <button type="button" className={ghost} disabled={busy} onClick={() => { setPaying(paying === d.id ? null : d.id); setPayAmount(d.amountKobo ? String(d.amountKobo / 100) : ""); }}>Mark paid</button>
                      <button type="button" className={ghost} disabled={busy} onClick={() => run({ action: "cancel", id: d.id }, "Removed.")}>Remove</button>
                    </span>
                  )}
                </div>
                {paying === d.id && (
                  <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "paid", id: d.id, amount: payAmount }, "Recorded in the money ledger.")) { setPaying(null); onPaid?.(); } }}>
                    <label className="text-xs">Amount paid, ₦<input className={field} inputMode="decimal" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label>
                    <button disabled={busy} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-semibold text-paper disabled:opacity-50">Record as an expense</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
