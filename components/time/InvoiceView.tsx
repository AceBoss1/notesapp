"use client";

import { useCallback, useEffect, useState } from "react";
import { naira } from "@/lib/finance";
import { clock } from "@/lib/time";
import { PAY_LABEL, monthLabel, type InvoiceLine, type PayMethod } from "@/lib/invoices";

type View = {
  invoice: { number: string; project: string; client: string; month: string; rateKobo: number; lines: InvoiceLine[]; minutes: number; subtotalKobo: number; vatTenths: number; vatKobo: number; totalKobo: number; status: string; issuedOn: string; dueOn: string; paidAt?: string; paidVia?: PayMethod };
  options: { paylony: boolean; cardtap: boolean; paystack: boolean };
  bank: { bankName: string; accountName: string; accountNumber: string } | null;
  company: { legalName: string; rcNumber: string; tin: string };
};
type Started = { method: PayMethod; reference: string; account?: { accountNumber?: unknown; bankName?: unknown; accountName?: unknown; expiresAt?: unknown }; code?: string; instruction?: string; url?: string };
const day = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "");
const weekLabel = (w: string) => `Week of ${new Date(`${w}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`;

// The invoice as the client sees it, with the ways to pay in the owner's order: Paylony (transfer account, then CardTap), card, bank.
export default function InvoiceView({ id }: { id: string }) {
  const [token, setToken] = useState("");
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState<Started | null>(null);
  const [state, setState] = useState("");

  const load = useCallback(async (t: string) => {
    const r = await fetch(`/api/invoices?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "That invoice link isn't valid.");
    setV(j);
  }, [id]);
  const post = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, t: token, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }, [id, token]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("t") ?? "", ref = sp.get("ref");
    setToken(t);
    load(t).catch((e) => setError(e.message));
    // Back from Paystack: check that payment straight away.
    if (ref) fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, t, action: "check", reference: ref }) })
      .then((r) => r.json()).then((j) => { setState(j.state ?? ""); return load(t); }).catch(() => {});
  }, [id, load]);

  // A transfer or CardTap payment: ask every 8 seconds for 15 minutes.
  useEffect(() => {
    if (!started || started.method === "paystack" || state === "paid") return;
    let n = 0;
    const i = setInterval(async () => {
      if (++n > 110) { clearInterval(i); return; }
      try { const j = await post({ action: "check", reference: started.reference }); setState(j.state); if (j.state === "paid") { clearInterval(i); await load(token); } } catch { /* keep asking */ }
    }, 8000);
    return () => clearInterval(i);
  }, [started, state, post, load, token]);

  const pay = async (method: PayMethod) => {
    setBusy(true); setError("");
    try {
      const r: Started = await post({ action: "pay", method });
      if (r.url) { window.location.href = r.url; return; }
      setStarted(r); setState("waiting");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (error && !v) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl text-ink">Invoice</h1><p className="mt-3 text-slate">{error}</p></div>;
  if (!v) return <div className="px-4 py-24 text-center text-slate">Loading…</div>;
  const i = v.invoice;
  const paid = i.status === "paid" || state === "paid";
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div><p className="font-display text-3xl text-crimson">#NotesApp</p><p className="mt-1 text-xs text-slate">{v.company.legalName}<br />RC {v.company.rcNumber} · TIN {v.company.tin}<br />hello@notesapp.name.ng</p></div>
          <div className="text-right"><p className="font-ui text-lg font-bold text-ink">INVOICE</p><p className="font-mono text-sm">{i.number}</p><p className="text-xs text-slate">{day(i.issuedOn)}<br />Due {day(i.dueOn)}</p></div>
        </div>
        <p className="mt-6 text-xs text-slate">Bill to</p><p className="font-bold text-ink">{i.client || "—"}</p>
        <table className="mt-5 w-full text-sm">
          <thead><tr className="text-xs text-slate"><th className="py-1 text-left">{monthLabel(i.month)} · {i.project}</th><th className="text-right">Hours</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {i.lines.map((l) => <tr key={l.week} className="border-t border-rule"><td className="py-2">{weekLabel(l.week)}</td><td className="text-right">{clock(l.minutes)}</td><td className="text-right">{naira(l.amountKobo)}</td></tr>)}
            {i.vatKobo > 0 && <tr className="border-t border-rule"><td className="py-2 text-slate">VAT {i.vatTenths / 10}%</td><td /><td className="text-right">{naira(i.vatKobo)}</td></tr>}
            <tr className="border-t-2 border-ink font-bold"><td className="py-2">Total</td><td className="text-right">{clock(i.minutes)}</td><td className="text-right">{naira(i.totalKobo)}</td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate">{naira(i.rateKobo)} an hour.</p>

        {paid ? (
          <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800" role="status">Paid{i.paidVia ? ` by ${PAY_LABEL[i.paidVia]}` : ""}. Thank you.</p>
        ) : i.status !== "sent" ? (
          <p className="mt-6 rounded-xl bg-paper p-4 text-sm text-slate">This invoice can&apos;t be paid. Please contact us.</p>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="font-ui text-sm font-bold text-ink">Pay {naira(i.totalKobo)}</p>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            {started?.method === "paylony" && started.account && (
              <div className="rounded-xl border border-crimson/30 bg-paper p-4 text-sm">
                <p>Transfer exactly <b>{naira(i.totalKobo)}</b> to this one-time account:</p>
                <p className="mt-2 font-mono text-lg font-bold">{String(started.account.accountNumber)}</p>
                <p>{String(started.account.bankName ?? "")} · {String(started.account.accountName ?? "")}</p>
                {started.account.expiresAt ? <p className="mt-1 text-xs text-slate">Use it before {String(started.account.expiresAt)}.</p> : null}
                <p className="mt-2 text-xs text-slate">{state === "failed" ? "That payment didn't go through. Try again." : "This page updates by itself once the transfer arrives."}</p>
              </div>
            )}
            {started?.method === "cardtap" && (
              <div className="rounded-xl border border-crimson/30 bg-paper p-4 text-sm">
                <p>Open the CardTap app and enter this code, then tap your card:</p>
                <p className="mt-2 font-mono text-2xl font-bold">{started.code}</p>
                {started.instruction && <p className="mt-1 text-xs text-slate">{started.instruction}</p>}
                <p className="mt-2 text-xs text-slate">This page updates by itself once it&apos;s paid.</p>
              </div>
            )}
            {!started && (
              <div className="grid gap-2 sm:grid-cols-2">
                {v.options.paylony && <button className="rounded-full bg-crimson px-4 py-3 font-ui text-sm font-bold text-paper disabled:opacity-50" disabled={busy} onClick={() => pay("paylony")}>Pay by bank transfer (Paylony)</button>}
                {v.options.cardtap && <button className="rounded-full border border-crimson px-4 py-3 font-ui text-sm font-bold text-crimson disabled:opacity-50" disabled={busy} onClick={() => pay("cardtap")}>Pay with CardTap</button>}
                {v.options.paystack && <button className="rounded-full border border-rule px-4 py-3 font-ui text-sm font-bold text-ink disabled:opacity-50" disabled={busy} onClick={() => pay("paystack")}>Pay by card (Paystack)</button>}
              </div>
            )}
            {v.bank && <p className="text-xs text-slate">Or transfer to {v.bank.accountName}, {v.bank.bankName}, {v.bank.accountNumber}, with <b>{i.number}</b> as the reference. We&apos;ll mark it paid when it arrives.</p>}
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-slate">Questions about this invoice? Reply to the email it came with.</p>
    </div>
  );
}
