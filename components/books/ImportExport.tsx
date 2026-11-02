"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BOOKS_IMPORT_MAX_BYTES, BOOKS_IMPORT_MAX_ROWS, BOOKS_UNDO_HOURS } from "@/lib/books";
import { FIELDS, IMPORT_KINDS, type ImportKind } from "@/lib/books-import";
import { Icon, download, field, pill, type Api } from "./shared";

// Bring in your existing records (docs/BUSINESS-BOOKS.md section 3): choose where it's from and what it is, upload a CSV, check the
// columns we matched from its headings, see the dry run (new, updates, duplicates skipped, rows to fix), then import. Undo for 24 hours.
// And export everything as CSV.
type Plan = { kind: ImportKind; headers: string[]; mapping: string[]; samples: string[]; rows: number; counts: { fresh: number; updates: number; dupes: number; problems: number }; problems: { row: number; message: string }[]; notes: { row: number; message: string }[]; missing: string[] };
type Imp = { id: string; kind: string; fileName: string; rows: number; at: string; undoUntil: string; status: string; canUndo: boolean; created: { entries: number; items: number; parties: number; updates: number } };
const SOURCES = [
  { id: "csv", label: "Excel or CSV", hint: "Stock list, sales, expenses, customers, debtors", badge: "Most used", icon: "" },
  { id: "sheets", label: "Google Sheets", hint: "File → Download → CSV, then upload", icon: "GS" },
  { id: "tralo", label: "Tralo", hint: "Its inventory and sales CSV exports", icon: "TR" },
];
const LATER = [
  { label: "Shopify or WooCommerce", hint: "Products CSV export" }, { label: "Paystack", hint: "Transactions → Export CSV" },
  { label: "Bank statement", hint: "CSV from your bank app" }, { label: "Photo of a paper ledger", hint: "Nana reads it; you check each line" },
];

export default function ImportExport({ api, maxRows, inventory }: { api: Api; maxRows: number; inventory: boolean }) {
  const [source, setSource] = useState("csv");
  const [kind, setKind] = useState<ImportKind>("stock");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [imports, setImports] = useState<Imp[]>([]);
  const [exp, setExp] = useState<{ name: string; csv: string }[] | null>(null);
  const preset = source === "tralo" ? (kind === "sales" ? "tralo-sales" : "tralo-stock") : undefined;
  const kinds = source === "tralo" ? IMPORT_KINDS.filter((k) => k.id === "stock" || k.id === "sales") : IMPORT_KINDS;

  const loadImports = useCallback(() => api<{ imports: Imp[] }>("view=imports").then((r) => setImports(r.imports)).catch(() => {}), [api]);
  useEffect(() => { loadImports(); }, [loadImports]);
  const runPlan = useCallback(async (f: { name: string; text: string }, mapping?: string[]) => {
    setBusy(true); setMsg(null);
    try { setPlan(await api<Plan>("", { action: "importPlan", kind, csv: f.text, ...(mapping ? { mapping } : {}), ...(preset ? { preset } : {}) })); }
    catch (e) { setPlan(null); setMsg({ text: (e as Error).message, bad: true }); }
    finally { setBusy(false); }
  }, [api, kind, preset]);
  useEffect(() => { if (file) runPlan(file); }, [kind, source]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null); setPlan(null);
    if (/\.(xlsx|xls|numbers|ods)$/i.test(f.name)) return setMsg({ text: "Save it as CSV first: in Excel, File → Save As → CSV; in Google Sheets, File → Download → CSV.", bad: true });
    if (f.size > BOOKS_IMPORT_MAX_BYTES) return setMsg({ text: `That file is over 5 MB. Split it, a year at a time.`, bad: true });
    const text = await f.text();
    setFile({ name: f.name, text });
    runPlan({ name: f.name, text });
  };
  const doImport = async () => {
    if (!file || !plan) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ created: Imp["created"] }>("", { action: "importApply", kind, csv: file.text, mapping: plan.mapping, fileName: file.name, ...(preset ? { preset } : {}) });
      setMsg({ text: `Imported: ${[r.created.entries && `${r.created.entries} entries`, r.created.items && `${r.created.items} new items`, r.created.updates && `${r.created.updates} items updated`, r.created.parties && `${r.created.parties} customers`].filter(Boolean).join(", ") || "nothing new"}. You can undo it for ${BOOKS_UNDO_HOURS} hours.` });
      setPlan(null); setFile(null); loadImports();
    } catch (e) { setMsg({ text: (e as Error).message, bad: true }); } finally { setBusy(false); }
  };
  const undo = async (id: string) => {
    if (!window.confirm("Undo this import? Everything it added is removed and what it changed goes back.")) return;
    try { await api("", { action: "importUndo", importId: id }); setMsg({ text: "Import undone." }); loadImports(); } catch (e) { setMsg({ text: (e as Error).message, bad: true }); }
  };
  const exportAll = async () => { try { setExp((await api<{ files: { name: string; csv: string }[] }>("view=export")).files); } catch (e) { setMsg({ text: (e as Error).message, bad: true }); } };
  const step = !file ? 2 : !plan ? 2 : plan.missing.length ? 3 : 4;
  const toImport = plan ? plan.counts.fresh + plan.counts.updates : 0;

  return (
    <div>
      <p className="eyebrow">Import and export</p>
      <h1 className="mt-1 font-display text-4xl text-ink">Bring in your existing records</h1>
      <p className="mt-2 max-w-3xl text-[15px] text-slate">From a spreadsheet or another app. You see every row before anything is saved, and you can undo an import for {BOOKS_UNDO_HOURS} hours.</p>
      <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {["Source", "Upload", "Match columns", "Preview", "Import"].map((s, i) => (
          <li key={s} className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${i + 1 < step ? "bg-crimson text-paper" : i + 1 === step ? "bg-ink text-paper" : "bg-field text-slate"}`}>{i + 1 < step ? "✓" : i + 1}</span><span className={i + 1 === step ? "font-semibold text-ink" : "text-slate"}>{s}</span>{i < 4 && <span className="hidden h-px w-6 bg-rule sm:block" />}</li>
        ))}
      </ol>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">1 · Where is it coming from?</p>
          <div className="mt-2 space-y-2">
            {SOURCES.map((s) => (
              <button key={s.id} onClick={() => { setSource(s.id); if (s.id === "tralo" && kind !== "stock" && kind !== "sales") setKind("stock"); }} className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left ${source === s.id ? "border-crimson ring-1 ring-crimson" : "border-rule"}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-field font-ui text-xs font-bold text-crimson">{s.icon || <Icon name="card" />}</span>
                <span className="min-w-0 flex-1"><span className="block font-ui font-bold text-ink">{s.label}</span><span className="block text-[13px] text-slate">{s.hint}</span></span>
                {s.badge && <span className="rounded-full bg-crimson/10 px-2.5 py-0.5 text-xs font-semibold text-crimson">{s.badge}</span>}
              </button>
            ))}
            {LATER.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-dashed border-rule p-4 opacity-60">
                <span className="min-w-0 flex-1"><span className="block font-ui font-bold text-ink">{s.label}</span><span className="block text-[13px] text-slate">{s.hint}</span></span>
                <span className="text-xs text-slate">Not yet: use CSV</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-ink">Templates</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {IMPORT_KINDS.map((k) => <a key={k.id} href={`/api/books?view=template&kind=${k.id}`} download className={pill}><Icon name="download" className="h-4 w-4" />{k.label}</a>)}
          </div>
          {source === "sheets" && <p className="mt-3 rounded-2xl bg-field p-3 text-sm text-slate">In Google Sheets: File → Download → Comma-separated values (.csv). Then upload that file here.</p>}
        </div>

        <div className="min-w-0 space-y-4">
          <section className="card p-5">
            <p className="text-sm font-semibold text-ink">2 · What is it, and the file</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {kinds.map((k) => <button key={k.id} onClick={() => setKind(k.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${kind === k.id ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink"}`} title={k.hint}>{k.label}</button>)}
            </div>
            {kind === "stock" && !inventory && <p className="mt-2 text-xs text-slate">Stock lists need <Link href="/profile/inventory" className="text-crimson underline">Inventory</Link>, which counts your stock.</p>}
            <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-rule p-4 hover:border-crimson">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-field text-crimson"><Icon name="download" /></span>
              <span className="min-w-0 flex-1"><span className="block font-ui font-bold text-ink">{file ? file.name : "Choose a CSV file"}</span><span className="block text-[13px] text-slate">{plan ? `${plan.rows} rows · ${plan.headers.length} columns` : `Up to ${maxRows.toLocaleString("en-NG")} rows${maxRows < BOOKS_IMPORT_MAX_ROWS ? " on Free Basic" : ""}, 5 MB`}</span></span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </section>

          {plan && (
            <section className="card p-5">
              <p className="text-sm font-semibold text-ink">3 · Match your columns to ours</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead><tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-slate"><th className="py-2 font-semibold">Your column</th><th className="py-2 font-semibold">Example</th><th className="py-2 font-semibold">Goes into</th></tr></thead>
                  <tbody className="divide-y divide-rule">
                    {plan.headers.map((h, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-2 font-semibold text-ink">{h || `Column ${i + 1}`}</td>
                        <td className="max-w-[10rem] truncate py-2 pr-2 font-mono text-xs text-slate">{plan.samples[i]}</td>
                        <td className="py-1.5"><select aria-label={`Where ${h} goes`} value={plan.mapping[i]} onChange={(e) => { const m = [...plan.mapping]; const j = m.indexOf(e.target.value); if (j >= 0 && e.target.value) m[j] = ""; m[i] = e.target.value; runPlan(file!, m); }} className={`${field} !py-1.5`}>
                          <option value="">Don&apos;t import</option>
                          {FIELDS[plan.kind].map((f) => <option key={f.id} value={f.id}>{f.label}{f.required ? " *" : ""}</option>)}
                        </select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate">We guessed these from your headings{preset ? " (and Tralo's export)" : ""}. Saved for next time you upload a file with the same headings.</p>
              {plan.missing.length > 0 && <p className="mt-2 text-sm text-red-700">Choose a column for: {plan.missing.join(", ")}.</p>}
            </section>
          )}

          {plan && !plan.missing.length && (
            <section className="card p-5">
              <p className="text-sm font-semibold text-ink">4 · Preview (a dry run: nothing saved yet)</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[[plan.counts.fresh, plan.kind === "stock" ? "new items" : plan.kind === "customers" ? "new customers" : "new entries"], [plan.counts.updates, "updates"], [plan.counts.dupes, "duplicates skipped"], [plan.counts.problems, "to fix"]].map(([n, l], i) => (
                  <div key={String(l)} className="rounded-2xl bg-field p-3"><p className={`font-ui text-2xl font-bold ${i === 3 && Number(n) > 0 ? "text-red-700" : "text-ink"}`}>{n}</p><p className="text-xs text-slate">{l}</p></div>
                ))}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {plan.problems.slice(0, 20).map((p, i) => <li key={`p${i}`} className="flex gap-2"><span className="h-fit shrink-0 rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Row {p.row}</span><span className="text-ink">{p.message}</span></li>)}
                {plan.notes.slice(0, 10).map((p, i) => <li key={`n${i}`} className="flex gap-2">{p.row > 0 && <span className="h-fit shrink-0 rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-slate">Row {p.row}</span>}<span className="text-slate">{p.message}</span></li>)}
              </ul>
              {plan.counts.problems > 0 && <p className="mt-2 text-xs text-slate">Fix those rows in your file (or take them out) and upload it again.</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-slate"><Icon name="undo" className="h-4 w-4" />Undo for {BOOKS_UNDO_HOURS} hours · up to {BOOKS_IMPORT_MAX_ROWS.toLocaleString("en-NG")} rows, 5 MB</p>
                <button onClick={doImport} disabled={busy || plan.counts.problems > 0 || !toImport} className="btn-primary">{busy ? "Working…" : `Import ${toImport} ${toImport === 1 ? "row" : "rows"}`}</button>
              </div>
              {plan.kind === "stock" && <p className="mt-3 text-xs text-slate">Items already in your store get their stock, cost price and SKU updated through Inventory (their online price stays as it is). New items are kept as Books-only items, not for sale online.</p>}
              {plan.kind === "sales" && <p className="mt-3 text-xs text-slate">Imported sales are marked “imported”: they don&apos;t move stock, send receipts or reminders, or count toward the monthly limit.</p>}
            </section>
          )}
          {busy && !plan && <p className="text-sm text-slate">Reading the file…</p>}
          {msg && <p className={`rounded-2xl p-3 text-sm ${msg.bad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role="status">{msg.text}</p>}

          {imports.length > 0 && (
            <section className="card p-5">
              <h2 className="font-ui text-lg font-bold text-ink">Recent imports</h2>
              <ul className="mt-2 divide-y divide-rule text-sm">
                {imports.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span><span className="block font-semibold text-ink">{i.fileName}</span><span className="text-xs text-slate">{IMPORT_KINDS.find((k) => k.id === i.kind)?.label} · {i.rows} rows · {new Date(i.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}{i.status === "undone" ? " · undone" : ""}</span></span>
                    {i.canUndo && <button onClick={() => undo(i.id)} className={pill}><Icon name="undo" className="h-4 w-4" />Undo</button>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-ui text-lg font-bold text-ink">Export everything</h2>
            <p className="mt-1 text-sm text-slate">Your sales, expenses, payments, money owed both ways and stock, as CSV files that open in Excel and Google Sheets.</p>
            {!exp ? <button onClick={exportAll} className={`${pill} mt-3`}><Icon name="download" className="h-4 w-4" />Prepare the files</button> : (
              <div className="mt-3 flex flex-wrap gap-2">{exp.map((f) => <button key={f.name} onClick={() => download(f.name, f.csv)} className={pill}><Icon name="download" className="h-4 w-4" />{f.name}</button>)}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
