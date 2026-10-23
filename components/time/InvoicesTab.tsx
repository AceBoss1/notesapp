"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useAdminCall } from "@/lib/useAdminCall";
import { naira } from "@/lib/finance";
import { clock } from "@/lib/time";
import { PAY_DAYS, PAY_LABEL, VAT_RATE, monthLabel, overdue, type Invoice } from "@/lib/invoices";

type Data = {
  month: string; invoices: Invoice[]; unpaid: Invoice[];
  settings: { vatOn: boolean; bankName: string; accountName: string; accountNumber: string };
  billableProjects: { id: string; name: string; client: string; clientEmail: string; rateKobo: number }[];
};
const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm";
const btn = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-bold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule bg-card px-3 py-1.5 font-ui text-xs font-semibold text-ink hover:border-crimson disabled:opacity-50";
const addMonth = (m: string, n: number) => { const d = new Date(`${m}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const PILL: Record<string, string> = { draft: "bg-amber-50 text-amber-800", sent: "bg-sky-50 text-sky-800", paid: "bg-emerald-50 text-emerald-700", void: "bg-rule text-slate" };

// Team hub → Time → Invoices (finance and super admins): one invoice per billable project and month from approved billable hours.
export default function InvoicesTab({ user, today }: { user: User; today: string }) {
  const call = useAdminCall(user, "/api/admin/invoices");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Data["settings"] | null>(null);

  const load = useCallback(async () => {
    try { const d: Data = await call(undefined, `?month=${month}`); setData(d); setSettings(d.settings); setError(""); } catch (e) { setError((e as Error).message); }
  }, [call, month]);
  useEffect(() => { void load(); }, [load]);
  const run = async (body: Record<string, unknown>, ok: (r: Record<string, unknown>) => string) => {
    setBusy(true); setError(""); setNote("");
    try { const r = await call(body); setNote(ok(r)); await load(); return r; } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  };

  const row = (i: Invoice) => (
    <tr key={i.id} className="border-t border-rule align-top">
      <td className="py-3 font-mono text-xs">{i.number || "—"}<br /><span className="font-sans text-[11px] text-slate">{monthLabel(i.month)}</span></td>
      <td className="py-3"><b className="font-ui">{i.client || "No client name"}</b><br /><span className="text-xs text-slate">{i.project}</span></td>
      <td className="py-3 text-center">{clock(i.minutes)}</td>
      <td className="py-3 text-center">{naira(i.rateKobo)}/h</td>
      <td className="py-3 text-center font-bold">{naira(i.totalKobo)}{i.vatKobo ? <><br /><span className="text-[10px] font-normal text-slate">incl. VAT {naira(i.vatKobo)}</span></> : null}</td>
      <td className="py-3 text-center">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${PILL[i.status]}`}>{i.status === "sent" ? (overdue(i, today) ? `Overdue · due ${i.dueOn}` : `Sent · due ${i.dueOn}`) : i.status === "paid" ? `Paid${i.paidVia ? ` · ${PAY_LABEL[i.paidVia]}` : ""}` : i.status === "void" ? "Void" : "Draft"}</span>
      </td>
      <td className="py-3 text-right">
        {i.status === "draft" && (
          <span className="flex flex-col items-end gap-1.5">
            <input className="w-56 rounded-lg border border-rule px-2 py-1 text-xs" placeholder="Client's email" value={emails[i.id] ?? i.clientEmail} onChange={(e) => setEmails({ ...emails, [i.id]: e.target.value })} aria-label="Client's email" />
            <span className="flex gap-1.5">
              <button className={ghost} disabled={busy} onClick={() => run({ action: "refresh", id: i.id }, () => "Updated from the approved hours.")}>Refresh</button>
              <button className={btn} disabled={busy} onClick={() => { if (confirm(`Send ${naira(i.totalKobo)} to ${emails[i.id] ?? i.clientEmail}? Its hours lock once sent.`)) void run({ action: "send", id: i.id, clientEmail: emails[i.id] ?? i.clientEmail }, (r) => `Invoice ${r.number} sent${r.emailSent ? "" : ", but the email didn't go: copy the link and send it yourself"}.`); }}>Send</button>
            </span>
          </span>
        )}
        {i.status === "sent" && (
          <span className="flex justify-end gap-1.5">
            <button className={ghost} disabled={busy} onClick={async () => { const r = await run({ action: "link", id: i.id }, () => "Link copied."); if (r?.link) await navigator.clipboard?.writeText(String(r.link)).catch(() => {}); }}>Copy link</button>
            <button className={ghost} disabled={busy} onClick={() => { const n = prompt("Paid by bank transfer: add a note (the bank reference, the date)"); if (n !== null) void run({ action: "paid", id: i.id, note: n }, () => "Marked paid and recorded as money in on the ledger."); }}>Mark paid</button>
            <button className={ghost} disabled={busy} onClick={() => { const n = prompt("Why are you voiding it? Its hours unlock."); if (n) void run({ action: "void", id: i.id, reason: n }, () => "Voided."); }}>Void</button>
          </span>
        )}
        {i.status === "paid" && <span className="text-xs text-slate">{i.ledgerEntryId ? "In the money ledger" : "Add it to the ledger"}</span>}
        {i.status === "void" && <span className="text-xs text-slate">{i.voidReason}</span>}
      </td>
    </tr>
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className={ghost} onClick={() => setMonth(addMonth(month, -1))}>‹ {monthLabel(addMonth(month, -1)).split(" ")[0]}</button>
          <h2 className="font-display text-3xl text-ink">Invoices for {monthLabel(month)}</h2>
          <button className={ghost} disabled={addMonth(month, 1) > today.slice(0, 7)} onClick={() => setMonth(addMonth(month, 1))}>{monthLabel(addMonth(month, 1)).split(" ")[0]} ›</button>
        </div>
        <button className={btn} disabled={busy} onClick={() => run({ action: "drafts", month }, (r) => (Number(r.made) ? `${r.made} draft${Number(r.made) === 1 ? "" : "s"} made.` : "No new drafts: every billable project with approved hours already has one, or none has approved hours yet."))}>Make {monthLabel(month).split(" ")[0]}&apos;s drafts</button>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-slate">One invoice per billable project and month, from <b>approved</b> billable hours × the project&apos;s rate, a line per week. Due {PAY_DAYS} days after it&apos;s sent. The client pays with Paylony (a transfer account or CardTap), by card through Paystack, or by bank transfer, which you mark paid. Paid invoices go into the money ledger as money in. A sent invoice locks its hours.</p>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-3 text-sm text-green-700" role="status">{note}</p>}
      {!data ? <p className="mt-6 text-slate">Loading…</p> : (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr className="text-xs text-slate"><th className="py-2 text-left">Invoice</th><th className="text-left">Client · project</th><th>Hours</th><th>Rate</th><th>Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.invoices.map(row)}
                {!data.invoices.length && <tr><td colSpan={7} className="py-6 text-center text-slate">No invoices for {monthLabel(month)} yet.{data.billableProjects.length ? " Make the drafts once the month's timesheets are approved." : " Add a billable project (with its client and rate) under Setup first."}</td></tr>}
              </tbody>
            </table>
          </div>
          {data.unpaid.length > 0 && (
            <div className="mt-6"><p className="font-ui text-sm font-bold text-ink">Still unpaid from earlier months</p>
              <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><tbody>{data.unpaid.map(row)}</tbody></table></div></div>
          )}
          {settings && (
            <form className="mt-8 grid max-w-3xl gap-3 rounded-2xl border border-rule bg-card p-4 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); await run({ action: "settings", ...settings }, () => "Saved."); }}>
              <p className="font-ui text-sm font-bold text-ink sm:col-span-3">Invoice settings</p>
              <label className="flex items-start gap-2 text-sm sm:col-span-3"><input type="checkbox" className="mt-1" checked={settings.vatOn} onChange={(e) => setSettings({ ...settings, vatOn: e.target.checked })} /><span><b>Add VAT at {VAT_RATE}%</b><br /><span className="text-xs text-slate">Only once NotesApp Technologies is registered for VAT. It applies to drafts made (or refreshed) after you switch it.</span></span></label>
              <label className="text-xs">Bank for transfers<input className={field} value={settings.bankName} onChange={(e) => setSettings({ ...settings, bankName: e.target.value })} /></label>
              <label className="text-xs">Account name<input className={field} value={settings.accountName} onChange={(e) => setSettings({ ...settings, accountName: e.target.value })} /></label>
              <label className="text-xs">Account number<input className={field} inputMode="numeric" value={settings.accountNumber} onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })} /></label>
              <div className="sm:col-span-3"><button className={btn} disabled={busy}>Save settings</button> <span className="ml-2 text-xs text-slate">The account shows on invoices as the plain bank-transfer option, after Paylony and card.</span></div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
