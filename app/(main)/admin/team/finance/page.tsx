"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import {
  BACKDATE_DAYS, CATEGORIES, CSV_HEADER, KIND_LABEL, MAX_RECEIPTS, RECEIPT_EXTENSIONS, RECEIPT_MAX_BYTES, categoryLabel, cleanEntry, csvCell, csvToInputs, isBackdated, naira,
  type CategoryRow, type EntryKind, type FinanceEntry, type FinanceInput, type Month,
} from "@/lib/finance";

type Data = {
  me: { owner: boolean; canWrite: boolean; seesPayroll: boolean };
  window: { start: string; today: string };
  entries: FinanceEntry[];
  months: Month[];
  categories: CategoryRow[];
  log: { id: string; at: string; byEmail: string; action: string; detail: string }[];
  asOf: string;
};
type Range = "month" | "3" | "12" | "all";
const RANGES: { id: Range; label: string }[] = [{ id: "month", label: "This month" }, { id: "3", label: "Last 3 months" }, { id: "12", label: "Last 12 months" }, { id: "all", label: "All time" }];
const field = "mt-1 block w-full border border-rule bg-card px-2 py-1.5 text-sm";
const btn = "bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
const blank = (today: string): FinanceInput => ({ kind: "expense", category: "hosting", amount: "", occurredOn: today, party: "", description: "", period: "" });

function Card({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">{label}</p>
      <p className={`mt-1 font-display text-2xl ${tone === "bad" ? "text-crimson" : tone === "good" ? "text-emerald-800" : "text-ink"}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate">{note}</p>}
    </div>
  );
}

// The team hub's money ledger: expenses, payroll and money in that isn't platform revenue, with receipts, next to the platform's own
// revenue. Finance records; product reads (payroll lines stay with finance); only the owner enters old entries, edits and imports.
export default function MoneyLedgerPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<Range>("month");
  const [kindFilter, setKindFilter] = useState<"all" | EntryKind>("all");
  const [q, setQ] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [form, setForm] = useState<FinanceInput>(blank(""));
  const [files, setFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [csv, setCsv] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const call = useCallback(async (body?: Record<string, unknown>, qs = "") => {
    const r = await fetch(`/api/admin/finance${qs}`, body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify(body) }
      : { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => call().then((d: Data) => { setData(d); setForm((f) => (f.occurredOn ? f : blank(d.window.today))); }).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const today = data?.window.today ?? "";
  const owner = !!data?.me.owner;

  // ---- numbers for the chosen range
  const shown = useMemo(() => {
    if (!data) return null;
    const cur = today.slice(0, 7);
    const take = range === "month" ? 1 : range === "3" ? 3 : range === "12" ? 12 : 9999;
    const from = (() => { if (range === "all") return "0000-00"; const d = new Date(`${cur}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - (take - 1)); return d.toISOString().slice(0, 7); })();
    const months = data.months.filter((m) => m.month >= from && m.month <= cur);
    const sum = (k: keyof Month) => months.reduce((n, m) => n + (m[k] as number), 0);
    const cats = new Map<string, CategoryRow>();
    for (const e of data.entries) {
      if (e.status !== "active" || e.occurredOn.slice(0, 7) < from) continue;
      const key = `${e.kind}:${e.category}`;
      const c = cats.get(key) ?? { kind: e.kind, category: e.category, label: categoryLabel(e.kind, e.category), kobo: 0, count: 0 };
      c.kobo += e.amountKobo; c.count += 1; cats.set(key, c);
    }
    // People who can't see payroll lines still get the payroll total from the monthly numbers.
    let rows = [...cats.values()];
    if (!data.me.seesPayroll && sum("payrollKobo")) rows.push({ kind: "payroll", category: "payroll", label: "Payroll", kobo: sum("payrollKobo"), count: 0 });
    rows = rows.sort((a, b) => b.kobo - a.kobo);
    return { from, months, platform: sum("platformKobo"), other: sum("otherIncomeKobo"), expense: sum("expenseKobo"), payroll: sum("payrollKobo"), net: sum("netKobo"), rows };
  }, [data, range, today]);

  const list = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.entries.filter((e) => (showVoided || e.status === "active") && (kindFilter === "all" || e.kind === kindFilter)
      && (!needle || `${e.party} ${e.description} ${categoryLabel(e.kind, e.category)}`.toLowerCase().includes(needle)));
  }, [data, kindFilter, q, showVoided]);

  // ---- actions
  async function run(fn: () => Promise<string | void>) {
    setBusy(true); setError(""); setNote("");
    try { const m = await fn(); if (m) setNote(m); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  async function uploadReceipts(id: string, picked: File[]) {
    const failed: string[] = [];
    for (const f of picked) {
      try {
        const s = await call({ action: "receiptStart", id, file: { name: f.name, size: f.size } });
        const put = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": s.contentType }, body: f });
        if (!put.ok) throw new Error("upload");
        await call({ action: "receiptAttach", id, file: { key: s.key, name: f.name } });
      } catch (e) { failed.push(`${f.name}${e instanceof Error && e.message !== "upload" ? ` (${e.message})` : ""}`); }
    }
    return failed;
  }
  const save = () => run(async () => {
    if (editing) { await call({ action: "edit", id: editing, entry: form }); setEditing(null); setForm(blank(today)); return "Entry updated."; }
    const j = await call({ action: "create", entry: form });
    const failed = files.length ? await uploadReceipts(j.entry.id, files) : [];
    setForm(blank(today)); setFiles([]); if (fileRef.current) fileRef.current.value = "";
    return failed.length ? `Saved, but these files didn't upload: ${failed.join(", ")}. Add them again from the entry.` : "Saved.";
  });
  const addTo = (id: string, picked: FileList | null) => picked?.length && run(async () => {
    const failed = await uploadReceipts(id, [...picked]);
    return failed.length ? `These files didn't upload: ${failed.join(", ")}` : "Receipt added.";
  });
  async function openReceipt(id: string, i: number) {
    const w = window.open("", "_blank");
    try { const j = await call(undefined, `?receipt=${id}&i=${i}`); if (w) w.location.href = j.url; }
    catch (e) { w?.close(); setError(e instanceof Error ? e.message : "Couldn't open the file"); }
  }
  const doVoid = (id: string) => run(async () => { await call({ action: "void", id, reason }); setVoiding(null); setReason(""); return "Entry voided. It stays in the list for the record."; });
  const edit = (e: FinanceEntry) => { setEditing(e.id); setForm({ kind: e.kind, category: e.category, amountKobo: undefined, amount: String(e.amountKobo / 100), occurredOn: e.occurredOn, party: e.party, description: e.description, period: e.period ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ---- import (owner)
  const parsed = useMemo(() => {
    if (!csv.trim() || !today) return null;
    const rows = csvToInputs(csv);
    const ok: FinanceInput[] = [], bad: string[] = [];
    rows.forEach((r, i) => { try { cleanEntry(r, today); ok.push(r); } catch (e) { bad.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "not valid"}`); } });
    return { total: rows.length, ok, bad };
  }, [csv, today]);
  const importNow = () => run(async () => { const r = await call({ action: "import", rows: parsed!.ok }); setCsv(""); return `${r.added} added${r.skipped ? `, ${r.skipped} already there` : ""}.`; });
  const template = () => {
    const sample = [CSV_HEADER, "expense,2026-01-10,12500.50,Hosting and software,Vercel,January plan,", "income,2026-01-12,500000,Grant or funding,Seed Co,First tranche,", "payroll,2026-01-31,250000,Salary,Ada Obi,January,2026-01"].join("\n");
    download("ledger-import-template.csv", sample);
  };
  const exportCsv = () => download(`ledger-${today}.csv`, [CSV_HEADER + ",status,receipts", ...list.map((e) => [e.kind, e.occurredOn, e.amountKobo / 100, categoryLabel(e.kind, e.category), e.party, e.description, e.period ?? "", e.status, e.receipts.length].map(csvCell).join(","))].join("\n"));
  function download(name: string, text: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  const kind = (form.kind as EntryKind) || "expense";
  const old = !!form.occurredOn && !!today && isBackdated(String(form.occurredOn), today);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/admin/team" className="font-ui text-xs font-semibold text-crimson">← Team hub</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Money ledger</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        What the company spends and receives, with receipts, next to what the platform earns by itself. Finance records entries; product reads them
        {data && !data.me.seesPayroll ? " (payroll shows as a total only)" : ""}. Entries are dated up to {BACKDATE_DAYS} days back; older dates, changes to existing entries and bulk imports are the owner&apos;s. Nothing is deleted, only voided with a reason.
      </p>
      {error && <p className="mt-4 whitespace-pre-line text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}
      {!data ? <p className="mt-8 text-slate">Loading…</p> : shown && (
        <>
          {/* ── Numbers ─────────────────────────────── */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {RANGES.map((r) => <button key={r.id} type="button" onClick={() => setRange(r.id)} aria-pressed={range === r.id} className={`border px-3 py-1.5 font-ui text-xs font-semibold ${range === r.id ? "border-ink bg-ink text-paper" : "border-rule hover:border-crimson"}`}>{r.label}</button>)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Card label="Platform revenue" value={naira(shown.platform)} note="Automatic, from Revenue" />
            <Card label="Other money in" value={naira(shown.other)} />
            <Card label="Expenses" value={naira(shown.expense)} />
            <Card label="Payroll" value={naira(shown.payroll)} />
            <Card label="Net" value={naira(shown.net)} tone={shown.net < 0 ? "bad" : "good"} note="Money in minus expenses and payroll" />
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-xl text-ink">Month by month</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead><tr className="border-b border-rule text-left text-xs text-slate"><th className="py-2 pr-2">Month</th><th className="px-2 text-right">In</th><th className="px-2 text-right">Out</th><th className="pl-2 text-right">Net</th></tr></thead>
                  <tbody>
                    {[...shown.months].reverse().map((m) => (
                      <tr key={m.month} className="border-b border-rule">
                        <td className="py-2 pr-2">{monthLabel(m.month)}</td>
                        <td className="px-2 text-right">{naira(m.platformKobo + m.otherIncomeKobo)}</td>
                        <td className="px-2 text-right">{naira(m.expenseKobo + m.payrollKobo)}</td>
                        <td className={`pl-2 text-right font-semibold ${m.netKobo < 0 ? "text-crimson" : ""}`}>{naira(m.netKobo)}</td>
                      </tr>
                    ))}
                    {!shown.months.length && <tr><td colSpan={4} className="py-4 text-slate">Nothing in this period yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2 className="font-display text-xl text-ink">By category</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {shown.rows.map((r) => {
                  const max = Math.max(1, ...shown.rows.map((x) => x.kobo));
                  return (
                    <li key={`${r.kind}:${r.category}`}>
                      <div className="flex justify-between gap-2"><span>{r.label} <span className="text-xs text-slate">· {KIND_LABEL[r.kind].toLowerCase()}</span></span><span>{naira(r.kobo)}</span></div>
                      <div className="mt-1 h-1.5 bg-rule"><div className={`h-1.5 ${r.kind === "income" ? "bg-emerald-700" : "bg-crimson"}`} style={{ width: `${(r.kobo / max) * 100}%` }} /></div>
                    </li>
                  );
                })}
                {!shown.rows.length && <li className="text-slate">Nothing recorded in this period yet.</li>}
              </ul>
            </div>
          </div>

          {/* ── Record ─────────────────────────────── */}
          {data.me.canWrite && (
            <section className="card mt-10 p-5">
              <h2 className="font-display text-xl text-ink">{editing ? "Change this entry" : "Record an entry"}</h2>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {(["expense", "payroll", "income"] as EntryKind[]).map((k) => (
                  <label key={k}><input type="radio" name="kind" checked={kind === k} onChange={() => setForm({ ...form, kind: k, category: CATEGORIES[k][0].key })} /> {KIND_LABEL[k]}</label>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate">Date the money moved
                  <input type="date" value={String(form.occurredOn ?? "")} min={owner ? undefined : data.window.start} max={today} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} className={field} />
                </label>
                <label className="text-xs text-slate">Amount (₦)
                  <input inputMode="decimal" value={String(form.amount ?? "")} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="12,500.50" className={field} />
                </label>
                <label className="text-xs text-slate">Category
                  <select value={String(form.category)} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>{CATEGORIES[kind].map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                </label>
                <label className="text-xs text-slate">{kind === "income" ? "From" : kind === "payroll" ? "Who was paid" : "Paid to (vendor)"}
                  <input value={String(form.party ?? "")} onChange={(e) => setForm({ ...form, party: e.target.value })} maxLength={120} className={field} />
                </label>
                {kind === "payroll" && (
                  <label className="text-xs text-slate">Pay period (month)
                    <input type="month" value={String(form.period ?? "")} onChange={(e) => setForm({ ...form, period: e.target.value })} className={field} />
                  </label>
                )}
                <label className="text-xs text-slate sm:col-span-2">Note (optional)
                  <input value={String(form.description ?? "")} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} className={field} />
                </label>
                {!editing && (
                  <label className="text-xs text-slate sm:col-span-2">Receipts or invoices (up to {MAX_RECEIPTS}; {RECEIPT_EXTENSIONS.join(", ")}; {RECEIPT_MAX_BYTES / 1024 / 1024} MB each)
                    <input ref={fileRef} type="file" multiple accept={RECEIPT_EXTENSIONS.map((x) => `.${x}`).join(",")} onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, MAX_RECEIPTS))} className="mt-1 block w-full text-sm" />
                  </label>
                )}
              </div>
              {old && <p className="mt-3 text-xs text-amber-800">This date is older than {BACKDATE_DAYS} days, so it is recorded as a backdated entry{owner ? " (you are the owner)" : ", which only the owner can enter"}.</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={busy} onClick={save} className={btn}>{busy ? "Saving…" : editing ? "Save changes" : "Save entry"}</button>
                {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank(today)); }} className={ghost}>Cancel</button>}
              </div>
            </section>
          )}

          {/* ── Entries ─────────────────────────────── */}
          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-xl text-ink">Entries</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "all" | EntryKind)} aria-label="Type" className="border border-rule bg-card px-2 py-1.5 text-sm">
                  <option value="all">All types</option>
                  {(["income", "expense", ...(data.me.seesPayroll ? ["payroll"] : [])] as EntryKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search entries" className="border border-rule bg-card px-2 py-1.5 text-sm" />
                <label className="text-xs"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Show voided</label>
                <button type="button" onClick={exportCsv} className={ghost}>Export CSV</button>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-rule border border-rule">
              {list.slice(0, 200).map((e) => (
                <li key={e.id} className={`p-4 ${e.status === "voided" ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        <span className={e.kind === "income" ? "text-emerald-800" : ""}>{e.kind === "income" ? "+" : "−"}{naira(e.amountKobo)}</span>{" "}
                        <span className={e.status === "voided" ? "line-through" : ""}>{e.party}</span>
                      </p>
                      <p className="text-xs text-slate">
                        {dayLabel(e.occurredOn)} · {KIND_LABEL[e.kind]} · {categoryLabel(e.kind, e.category)}{e.period ? ` · for ${monthLabel(e.period)}` : ""}
                        {e.backdated && " · backdated"}{e.seeded && " · imported"} · by {e.createdByEmail}
                      </p>
                      {e.description && <p className="mt-1 text-sm text-ink">{e.description}</p>}
                      {e.status === "voided" && <p className="mt-1 text-xs text-crimson">Voided by {e.voidedByEmail}: {e.voidReason}</p>}
                      {e.receipts.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-2 text-xs">
                          {e.receipts.map((r, i) => <button key={r.key} type="button" onClick={() => openReceipt(e.id, i)} className="text-crimson underline">{r.name}</button>)}
                        </p>
                      )}
                    </div>
                    {e.status === "active" && data.me.canWrite && (
                      <div className="flex flex-wrap gap-2">
                        {e.receipts.length < MAX_RECEIPTS && (
                          <label className={`${ghost} cursor-pointer`}>Add receipt
                            <input type="file" className="sr-only" accept={RECEIPT_EXTENSIONS.map((x) => `.${x}`).join(",")} disabled={busy} onChange={(ev) => { addTo(e.id, ev.target.files); ev.target.value = ""; }} />
                          </label>
                        )}
                        {owner && <button type="button" onClick={() => edit(e)} className={ghost}>Edit</button>}
                        {(owner || !isBackdated(e.occurredOn, today)) && <button type="button" onClick={() => { setVoiding(voiding === e.id ? null : e.id); setReason(""); }} className={ghost}>Void</button>}
                      </div>
                    )}
                  </div>
                  {voiding === e.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Why is this being voided?" aria-label="Reason" className="min-w-[14rem] flex-1 border border-rule bg-card px-2 py-1.5 text-sm" />
                      <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => doVoid(e.id)} className={btn}>Confirm void</button>
                    </div>
                  )}
                </li>
              ))}
              {!list.length && <li className="p-4 text-sm text-slate">No entries match.</li>}
            </ul>
            {list.length > 200 && <p className="mt-2 text-xs text-slate">Showing the latest 200 of {list.length}. Search or export to see the rest.</p>}
          </section>

          {/* ── Owner: import ─────────────────────────────── */}
          {owner && (
            <section className="card mt-10 p-5">
              <h2 className="font-display text-xl text-ink">Import past records (owner)</h2>
              <p className="mt-1 text-sm text-slate">Paste or open a CSV with the columns <code>{CSV_HEADER}</code>. Every row is checked first and nothing is saved if any row is wrong. Rows already in the ledger are skipped, so importing a file twice is safe. Up to 500 rows at a time.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} className="text-sm" />
                <button type="button" onClick={template} className={ghost}>Download a template</button>
              </div>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} placeholder={CSV_HEADER} aria-label="CSV rows" className="mt-3 block w-full border border-rule bg-card p-2 font-mono text-xs" />
              {parsed && (
                <div className="mt-3 text-sm">
                  <p>{parsed.ok.length} of {parsed.total} rows are ready.</p>
                  {parsed.bad.length > 0 && <ul className="mt-1 list-disc pl-5 text-red-700">{parsed.bad.slice(0, 8).map((b) => <li key={b}>{b}</li>)}{parsed.bad.length > 8 && <li>…and {parsed.bad.length - 8} more</li>}</ul>}
                  <button type="button" disabled={busy || parsed.bad.length > 0 || !parsed.ok.length} onClick={importNow} className={`${btn} mt-3`}>Import {parsed.ok.length} rows</button>
                </div>
              )}
            </section>
          )}

          {data.log.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-xl text-ink">Recent activity</h2>
              <ul className="mt-3 space-y-1 text-sm text-slate">
                {data.log.map((l) => <li key={l.id}>{new Date(l.at).toLocaleString("en-NG")} · {l.byEmail} · {l.action}{l.detail ? `: ${l.detail}` : ""}</li>)}
              </ul>
            </section>
          )}
          <p className="mt-8 text-xs text-slate">Platform revenue as of {new Date(data.asOf).toLocaleTimeString("en-NG")}; see <Link href="/admin/revenue" className="underline">Revenue</Link> for the stream-by-stream view.</p>
        </>
      )}
    </div>
  );
}
