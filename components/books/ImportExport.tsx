"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BOOKS_IMPORT_MAX_BYTES, BOOKS_IMPORT_MAX_ROWS, BOOKS_UNDO_HOURS, DEFAULT_CATEGORIES, naira } from "@/lib/books";
import { FIELDS, IMPORT_KINDS, SOURCES, detectSource, presetFor, readSheet, sourceOf, statementFromPdfLines, type ImportKind, type SourceId } from "@/lib/books-import";
import { Icon, download, field, pill, type Api } from "./shared";

// Bring in your existing records (docs/BUSINESS-BOOKS.md section 3): choose where it's from and what it is (or let the headings tell us),
// upload a CSV, check the columns we matched, see the dry run (new, updates, duplicates skipped, left out, rows to fix), then import.
// A bank statement comes back line by line to tick and label. Undo for 24 hours. And export everything as CSV.
type BankLine = { row: number; on: string; narration: string; ref: string; inKobo: number; outKobo: number; as: "sale" | "expense" | "skip"; category: string; tick: boolean; why: string; dupe: boolean };
type Plan = {
  kind: ImportKind; source: string; headers: string[]; mapping: string[]; samples: string[]; rows: number;
  counts: { fresh: number; updates: number; dupes: number; problems: number; skipped: number };
  problems: { row: number; message: string }[]; notes: { row: number; message: string }[]; skipped: { row: number; message: string }[]; missing: string[]; bank?: BankLine[];
};
type Imp = { id: string; kind: string; source?: string; fileName: string; rows: number; at: string; undoUntil: string; status: string; canUndo: boolean; created: { entries: number; items: number; parties: number; updates: number } };
type Choice = { tick: boolean; as: "sale" | "expense"; category: string };
const LATER = [{ label: "Photo of a paper ledger", hint: "Nana reads it; you check each line" }];

// A bank PDF's text, line by line (pdfjs-dist, as components/PdfViewer.tsx loads it). Pieces on the same height are one line.
async function pdfLines(f: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  const out: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 80); n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as { str?: string; transform?: number[] }[]) {
      if (!it.str?.trim() || !it.transform) continue;
      const y = Math.round(it.transform[5] / 3);
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str.trim() }]);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, parts]) => out.push(parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ")));
  }
  doc.destroy();
  return out;
}

export default function ImportExport({ api, maxRows, inventory }: { api: Api; maxRows: number; inventory: boolean }) {
  const [source, setSource] = useState<SourceId>("csv");
  const [kind, setKind] = useState<ImportKind>("stock");
  const [file, setFile] = useState<{ name: string; text: string; pdf?: boolean } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [imports, setImports] = useState<Imp[]>([]);
  const [exp, setExp] = useState<{ name: string; csv: string }[] | null>(null);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [showDupes, setShowDupes] = useState(false);
  const [allCols, setAllCols] = useState(false);
  const guide = sourceOf(source) ?? SOURCES[0];
  const kinds = IMPORT_KINDS.filter((k) => guide.kinds.includes(k.id));
  const preset = presetFor(source, kind)?.id;
  const checked = guide.verified === "yes";

  const loadImports = useCallback(() => api<{ imports: Imp[] }>("view=imports").then((r) => setImports(r.imports)).catch(() => {}), [api]);
  useEffect(() => { loadImports(); }, [loadImports]);
  const runPlan = useCallback(async (f: { name: string; text: string }, mapping?: string[]) => {
    setBusy(true); setMsg(null);
    try {
      const p = await api<Plan>("", { action: "importPlan", kind, csv: f.text, ...(mapping ? { mapping } : {}), ...(preset ? { preset } : {}) });
      setPlan(p);
      if (p.bank) setChoices(Object.fromEntries(p.bank.filter((l) => !l.dupe).map((l) => [l.row, { tick: l.tick, as: l.inKobo ? "sale" : "expense", category: l.category || "other" } satisfies Choice])));
    } catch (e) { setPlan(null); setMsg({ text: (e as Error).message, bad: true }); } finally { setBusy(false); }
  }, [api, kind, preset]);
  useEffect(() => { if (file) runPlan(file); }, [file, kind, source]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseSource = (id: SourceId) => {
    const g = sourceOf(id)!;
    setSource(id); setNotice("");
    if (!g.kinds.includes(kind)) setKind(g.kinds[0]);
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null); setPlan(null); setNotice("");
    if (/\.(xlsx|xls|numbers|ods)$/i.test(f.name)) return setMsg({ text: guide.excel ?? "Save it as CSV first: in Excel, File → Save As → CSV; in Google Sheets, File → Download → CSV.", bad: true });
    if (f.size > BOOKS_IMPORT_MAX_BYTES) return setMsg({ text: "That file is over 5 MB. Split it, a year at a time.", bad: true });
    if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
      if (source !== "bank") return setMsg({ text: "A PDF works for bank statements only. For this, export CSV.", bad: true });
      setBusy(true);
      try {
        const csv = statementFromPdfLines(await pdfLines(f));
        if (!csv) return setMsg({ text: "We couldn't read the lines in this PDF (it may be a scan or a photo). Export CSV from your bank app and upload that instead.", bad: true });
        setNotice("Read from your PDF: check every line against the statement before you import.");
        setFile({ name: f.name, text: csv, pdf: true });
      } catch { setMsg({ text: "We couldn't open this PDF. Export CSV from your bank app and upload that instead.", bad: true }); } finally { setBusy(false); }
      return;
    }
    const text = await f.text();
    // The headings tell us where it's from: switch to that source and kind.
    const sheet = readSheet(text);
    const found = "error" in sheet ? null : detectSource(sheet.headers);
    if (found && (found.source !== source || found.kind !== kind)) {
      setSource(found.source); setKind(found.kind);
      setNotice(`This looks like a ${found.label}, so we switched to it.`);
    }
    setFile({ name: f.name, text });
  };
  const chosen = useMemo(() => (plan?.bank ?? []).filter((l) => !l.dupe && choices[l.row]?.tick), [plan, choices]);
  const doImport = async () => {
    if (!file || !plan) return;
    setBusy(true); setMsg(null);
    try {
      const extra = plan.kind === "bank" ? { choices: chosen.map((l) => ({ row: l.row, as: choices[l.row].as, category: choices[l.row].category })) } : {};
      const r = await api<{ created: Imp["created"] }>("", { action: "importApply", kind, csv: file.text, mapping: plan.mapping, fileName: file.name, ...(preset ? { preset } : {}), ...extra });
      setMsg({ text: `Imported: ${[r.created.entries && `${r.created.entries} entries`, r.created.items && `${r.created.items} new items`, r.created.updates && `${r.created.updates} updated`, r.created.parties && `${r.created.parties} customers`].filter(Boolean).join(", ") || "nothing new"}. You can undo it for ${BOOKS_UNDO_HOURS} hours.` });
      setPlan(null); setFile(null); setNotice(""); loadImports();
    } catch (e) { setMsg({ text: (e as Error).message, bad: true }); } finally { setBusy(false); }
  };
  const undo = async (id: string) => {
    if (!window.confirm("Undo this import? Everything it added is removed and what it changed goes back.")) return;
    try { await api("", { action: "importUndo", importId: id }); setMsg({ text: "Import undone." }); loadImports(); } catch (e) { setMsg({ text: (e as Error).message, bad: true }); }
  };
  const exportAll = async () => { try { setExp((await api<{ files: { name: string; csv: string }[] }>("view=export")).files); } catch (e) { setMsg({ text: (e as Error).message, bad: true }); } };
  const step = !file ? 2 : !plan ? 2 : plan.missing.length ? 3 : 4;
  const toImport = plan ? (plan.kind === "bank" ? chosen.length : plan.counts.fresh + plan.counts.updates) : 0;
  const setChoice = (row: number, c: Partial<Choice>) => setChoices((x) => ({ ...x, [row]: { ...x[row], ...c } }));
  const bankLines = (plan?.bank ?? []).filter((l) => showDupes || !l.dupe);

  return (
    <div>
      <p className="eyebrow">Import and export</p>
      <h1 className="mt-1 font-display text-4xl text-ink">Bring in your existing records</h1>
      <p className="mt-2 max-w-3xl text-[15px] text-slate">From a spreadsheet, your online shop, Paystack or your bank. You see every row before anything is saved, and you can undo an import for {BOOKS_UNDO_HOURS} hours.</p>
      <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {["Source", "Upload", "Match columns", "Preview", "Import"].map((s, i) => (
          <li key={s} className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${i + 1 < step ? "bg-crimson text-paper" : i + 1 === step ? "bg-ink text-paper" : "bg-field text-slate"}`}>{i + 1 < step ? "✓" : i + 1}</span><span className={i + 1 === step ? "font-semibold text-ink" : "text-slate"}>{s}</span>{i < 4 && <span className="hidden h-px w-6 bg-rule sm:block" />}</li>
        ))}
      </ol>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">1 · Where is it coming from?</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {SOURCES.map((s) => (
              <button key={s.id} onClick={() => chooseSource(s.id)} aria-pressed={source === s.id} className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left ${source === s.id ? "border-crimson ring-1 ring-crimson" : "border-rule"}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-field font-ui text-xs font-bold text-crimson">{s.icon || <Icon name="card" />}</span>
                <span className="min-w-0 flex-1"><span className="block font-ui text-[15px] font-bold text-ink">{s.label}</span><span className="block text-[12px] leading-snug text-slate">{s.hint}</span></span>
              </button>
            ))}
            {LATER.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-dashed border-rule p-3 opacity-60">
                <span className="min-w-0 flex-1"><span className="block font-ui text-[15px] font-bold text-ink">{s.label}</span><span className="block text-[12px] text-slate">{s.hint} · not yet</span></span>
              </div>
            ))}
          </div>

          <section className="mt-4 rounded-2xl bg-field p-4" aria-labelledby="howto">
            <h2 id="howto" className="font-ui text-[15px] font-bold text-ink">{source === "csv" || source === "sheets" ? `From ${guide.label}` : source === "bank" ? "How to get your bank statement" : `How to export from ${guide.label}`}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink">{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            {guide.note && <p className="mt-2 text-[13px] text-slate">{guide.note}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${checked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{checked ? "Columns known" : "We match your columns; check them"}</span>
              {guide.url && <a href={guide.url} target="_blank" rel="noopener noreferrer" className="text-crimson underline">{guide.label}&apos;s help</a>}
            </p>
          </section>

          <p className="mt-4 text-sm font-semibold text-ink">Templates</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {IMPORT_KINDS.filter((k) => k.id !== "bank").map((k) => <a key={k.id} href={`/api/books?view=template&kind=${k.id}`} download className={pill}><Icon name="download" className="h-4 w-4" />{k.label}</a>)}
          </div>
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
              <span className="min-w-0 flex-1"><span className="block truncate font-ui font-bold text-ink">{file ? file.name : source === "bank" ? "Choose a CSV or PDF statement" : "Choose a CSV file"}</span><span className="block text-[13px] text-slate">{plan ? `${plan.rows} rows · ${plan.headers.length} columns` : `Up to ${maxRows.toLocaleString("en-NG")} rows${maxRows < BOOKS_IMPORT_MAX_ROWS ? " on Free Basic" : ""}, 5 MB`}</span></span>
              <input type="file" accept={source === "bank" ? ".csv,text/csv,.pdf,application/pdf" : ".csv,text/csv"} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {notice && <p className="mt-3 rounded-xl bg-crimson/5 px-3 py-2 text-sm text-ink" role="status">{notice}</p>}
          </section>

          {plan && (
            <section className="card p-5">
              <p className="text-sm font-semibold text-ink">3 · Match your columns to ours</p>
              {!checked && <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">We matched your columns from their headings: check them before you import.</p>}
              <div className="mt-2 max-h-[26rem] overflow-auto">
                <table className="w-full text-sm sm:min-w-[420px]">
                  <thead><tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-slate"><th className="py-2 font-semibold">Your column</th><th className="hidden py-2 font-semibold sm:table-cell">Example</th><th className="py-2 font-semibold">Goes into</th></tr></thead>
                  <tbody className="divide-y divide-rule">
                    {plan.headers.map((h, i) => [h, i] as const).filter(([, i]) => allCols || plan.headers.length <= 10 || plan.mapping[i]).map(([h, i]) => (
                      <tr key={i} className={plan.mapping[i] ? "" : "opacity-60"}>
                        <td className="max-w-[9rem] py-2 pr-2 font-semibold text-ink sm:max-w-none"><span className="block break-words">{h || `Column ${i + 1}`}</span><span className="block truncate font-mono text-[11px] font-normal text-slate sm:hidden">{plan.samples[i]}</span></td>
                        <td className="hidden max-w-[10rem] truncate py-2 pr-2 font-mono text-xs text-slate sm:table-cell">{plan.samples[i]}</td>
                        <td className="py-1.5"><select aria-label={`Where ${h} goes`} value={plan.mapping[i]} onChange={(e) => { const m = [...plan.mapping]; const j = m.indexOf(e.target.value); if (j >= 0 && e.target.value) m[j] = ""; m[i] = e.target.value; runPlan(file!, m); }} className={`${field} !py-1.5`}>
                          <option value="">Don&apos;t import</option>
                          {FIELDS[plan.kind].map((f) => <option key={f.id} value={f.id}>{f.label}{f.required ? " *" : ""}</option>)}
                        </select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.headers.length > 10 && <button onClick={() => setAllCols((x) => !x)} className="mt-2 text-xs font-semibold text-crimson underline">{allCols ? "Show only the columns we use" : `Show all ${plan.headers.length} columns (${plan.mapping.filter((m) => !m).length} not imported)`}</button>}
              <p className="mt-2 text-xs text-slate">{preset && source !== "bank" ? `We know ${guide.label}'s export${checked ? "" : " as well as we can"}; the rest we guessed from your headings.` : "We guessed these from your headings."} Saved for next time you upload a file with the same headings.</p>
              {plan.missing.length > 0 && <p className="mt-2 text-sm text-red-700">Choose a column for: {plan.missing.join(", ")}.</p>}
            </section>
          )}

          {plan && !plan.missing.length && (
            <section className="card p-5">
              <p className="text-sm font-semibold text-ink">4 · Preview (a dry run: nothing saved yet)</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {([[plan.counts.fresh, plan.kind === "stock" ? "new items" : plan.kind === "customers" ? "new customers" : plan.kind === "bank" ? "new lines" : "new entries"], [plan.counts.updates, plan.kind === "sales" ? "refunds since" : "updates"], [plan.counts.dupes, "already in your books"], [plan.counts.skipped, "left out"], [plan.counts.problems, "to fix"]] as [number, string][]).map(([n, l], i) => (
                  <div key={l} className="rounded-2xl bg-field p-3"><p className={`font-ui text-2xl font-bold ${i === 4 && n > 0 ? "text-red-700" : "text-ink"}`}>{n}</p><p className="text-xs text-slate">{l}</p></div>
                ))}
              </div>

              {plan.bank && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-ink">Tick each line to bring in, and say what it is. We guessed from the narration.</p>
                    {plan.counts.dupes > 0 && <label className="flex items-center gap-2 text-xs text-slate"><input type="checkbox" checked={showDupes} onChange={(e) => setShowDupes(e.target.checked)} />Show lines already in your books</label>}
                  </div>
                  <ul className="mt-2 max-h-[28rem] divide-y divide-rule overflow-auto rounded-2xl border border-rule">
                    {bankLines.map((l) => {
                      const c = choices[l.row];
                      return (
                        <li key={l.row} className={`grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1 p-3 ${l.dupe ? "opacity-50" : ""}`}>
                          <input type="checkbox" aria-label={`Bring in ${l.narration}`} className="mt-1 h-4 w-4 accent-crimson" disabled={l.dupe} checked={!!c?.tick} onChange={(e) => setChoice(l.row, { tick: e.target.checked })} />
                          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink" title={l.narration}>{l.narration}</span><span className="block text-xs text-slate">{l.on}{l.dupe ? " · already in your books" : ` · ${l.why}`}</span></span>
                          <span className={`text-right font-ui text-sm font-bold ${l.inKobo ? "text-emerald-700" : "text-ink"}`}>{l.inKobo ? `+${naira(l.inKobo)}` : `−${naira(l.outKobo)}`}</span>
                          {!l.dupe && c && (
                            <div className="col-start-2 col-end-4 flex flex-wrap gap-2">
                              {l.inKobo ? (
                                <select aria-label="What it is" value={c.tick ? "sale" : "skip"} onChange={(e) => setChoice(l.row, { tick: e.target.value === "sale" })} className={`${field} !w-auto !py-1 text-xs`}>
                                  <option value="sale">A sale (money in)</option>
                                  <option value="skip">Not a sale: a loan, a reversal, my own money</option>
                                </select>
                              ) : (
                                <select aria-label="Expense category" value={c.tick ? c.category : "skip"} onChange={(e) => setChoice(l.row, e.target.value === "skip" ? { tick: false } : { tick: true, category: e.target.value })} className={`${field} !w-auto !py-1 text-xs`}>
                                  {DEFAULT_CATEGORIES.map((x) => <option key={x.id} value={x.id}>Expense: {x.label}</option>)}
                                  <option value="skip">Not an expense: leave it out</option>
                                </select>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-slate">Money in that isn&apos;t a sale (a loan, a transfer from your own account) isn&apos;t counted in Books, so leave it out. {chosen.length} of {plan.counts.fresh} lines ticked.</p>
                </div>
              )}

              <ul className="mt-3 space-y-2 text-sm">
                {plan.problems.slice(0, 20).map((p, i) => <li key={`p${i}`} className="flex gap-2"><span className="h-fit shrink-0 rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Row {p.row}</span><span className="text-ink">{p.message}</span></li>)}
                {plan.notes.slice(0, 12).map((p, i) => <li key={`n${i}`} className="flex gap-2">{p.row > 0 && <span className="h-fit shrink-0 rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-slate">Row {p.row}</span>}<span className="text-slate">{p.message}</span></li>)}
              </ul>
              {plan.skipped.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-ink">{plan.counts.skipped} {plan.counts.skipped === 1 ? "row is" : "rows are"} left out (not paid, or already ours)</summary>
                  <ul className="mt-2 space-y-1.5">{plan.skipped.slice(0, 40).map((p, i) => <li key={i} className="flex gap-2"><span className="h-fit shrink-0 rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-slate">Row {p.row}</span><span className="text-slate">{p.message}</span></li>)}</ul>
                </details>
              )}
              {plan.counts.problems > 0 && <p className="mt-2 text-xs text-slate">Fix those rows in your file (or take them out) and upload it again.</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-slate"><Icon name="undo" className="h-4 w-4" />Undo for {BOOKS_UNDO_HOURS} hours · up to {BOOKS_IMPORT_MAX_ROWS.toLocaleString("en-NG")} rows, 5 MB</p>
                <button onClick={doImport} disabled={busy || plan.counts.problems > 0 || !toImport} className="btn-primary">{busy ? "Working…" : `Import ${toImport} ${plan.kind === "bank" ? (toImport === 1 ? "line" : "lines") : toImport === 1 ? "row" : "rows"}`}</button>
              </div>
              {plan.kind === "stock" && <p className="mt-3 text-xs text-slate">Items already in your store get their stock, cost price and SKU updated through Inventory (their online price stays as it is). New items are kept as Books-only items, not for sale online.</p>}
              {plan.kind === "sales" && <p className="mt-3 text-xs text-slate">Imported sales are marked “imported”: they don&apos;t move stock, send receipts or reminders, or count toward the monthly limit.{source !== "csv" && source !== "sheets" && source !== "tralo" ? " Each order is matched by its own number, so importing the same export again adds nothing." : ""}</p>}
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
                    <span className="min-w-0"><span className="block truncate font-semibold text-ink">{i.fileName}</span><span className="text-xs text-slate">{[sourceOf(i.source)?.id !== "csv" ? sourceOf(i.source)?.label : "", IMPORT_KINDS.find((k) => k.id === i.kind)?.label].filter(Boolean).join(" ")} · {i.rows} rows · {new Date(i.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}{i.status === "undone" ? " · undone" : ""}</span></span>
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
