"use client";

import { useEffect, useRef, useState } from "react";
import { SALE_METHODS, firstName, naira, shortDate, whatOf, type Method } from "@/lib/books";
import { DRAFT_LABEL, NANA_TEXT_MAX, type Draft } from "@/lib/books-nana";
import { Icon, Sheet, field, koboToInput, nairaInput, newClientId, pill, type Api } from "./shared";
import { saveOrQueue, useOutbox } from "./outbox";

// Tell Nana (docs/BUSINESS-BOOKS.md, step 7): type it, or say it with the phone's own speech-to-text, and Nana turns it into draft entries
// (lib/books-nana-server.ts). Nothing is saved until the seller checks a draft and taps Save; each draft then goes to /api/books like a
// typed entry. It uses a little of the Nana allowance; typing an entry yourself is always free.
type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type Card = Draft & { key: string; clientId: string; state: "draft" | "saving" | "saved" | "queued"; error?: string };
const EXAMPLES = ["Sold 3 bags of rice ₦45,000 to Mama Bisi on credit, due Friday", "Bought diesel 18k cash", "Chinedu paid 20k transfer", "Bought 10 bags garri at 52k each"];

export default function TellNana({ api, today, cashier, onClose, onSaved }: { api: Api; today: string; cashier?: boolean; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const outbox = useOutbox();
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => { const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }; setCanSpeak(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); }, []);

  const speak = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new R();
    r.lang = "en-NG"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const said = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" ").trim(); if (said) setText((t) => (t ? `${t} ${said}` : said).slice(0, NANA_TEXT_MAX)); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; setListening(true); r.start();
  };

  const read = async () => {
    setErr(""); setNote("");
    if (!text.trim()) return setErr("Say what happened first.");
    if (typeof navigator !== "undefined" && navigator.onLine === false) return setErr("Nana needs a connection. Type the entry with Record a sale or Add expense: those save on the phone and sync later.");
    setBusy(true);
    try {
      const r = await api<{ drafts: Draft[]; note?: string; via: string }>("", { action: "nana", text });
      setCards(r.drafts.map((d, i) => ({ ...d, key: `${Date.now()}-${i}`, clientId: newClientId(), state: "draft" })));
      setNote(r.note ?? (r.via === "standin" ? "Development: no AI key is set, so a simple reader stood in for Nana (nothing was charged)." : ""));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const set = (key: string, patch: Partial<Card>) => setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const save = async (c: Card) => {
    set(c.key, { state: "saving", error: undefined });
    try {
      const total = c.lines.reduce((n, l) => n + l.qty * l.unitKobo, 0) || c.totalKobo;
      const method: Method = c.method === "card" && c.kind === "sale" ? "pos" : c.method ?? "cash";
      let body: Record<string, unknown>;
      if (c.kind === "sale") {
        if (c.lines.some((l) => l.match === "unsure" && !l.ref)) throw new Error("Choose which item it was.");
        if (c.owes && !c.customer?.name) throw new Error("Who owes? Add the customer's name.");
        if (c.owes && c.customer?.match === "unsure" && !c.customer.partyId) throw new Error("Choose which customer it was.");
        body = {
          action: "sale", clientId: c.clientId, method, owes: c.owes, paidKobo: c.owes ? Math.min(c.paidKobo, total) : total, dueOn: c.owes ? c.dueOn ?? "" : "",
          ...(c.owes ? (c.customer?.partyId ? { partyId: c.customer.partyId, partyName: c.customer.name } : { party: { name: c.customer?.name } }) : {}),
          lines: c.lines.map((l) => ({ ...(l.ref ? { ref: l.ref } : { title: l.title }), qty: l.qty, unitKobo: l.unitKobo })),
        };
      } else if (c.kind === "payment") {
        if (!c.customer?.partyId) throw new Error(`${c.customer?.name ?? "They"} isn't in your customers, so there's nothing owed to pay back. Record it as a sale instead.`);
        body = { action: "payment", clientId: c.clientId, partyId: c.customer.partyId, partyName: c.customer.name, amountKobo: c.totalKobo, method: method === "card" ? "pos" : method };
      } else if (c.kind === "purchase") {
        body = { action: "purchase", clientId: c.clientId, method, lines: c.lines.map((l) => ({ ...(l.ref ? { ref: l.ref } : { title: l.title }), qty: l.qty, unitKobo: l.unitKobo })), note: c.note };
      } else body = { action: "expense", clientId: c.clientId, amountKobo: c.totalKobo, method, category: c.category ?? "other", note: c.note ?? "" };
      const label = c.kind === "expense" ? `Expense · ${c.note || c.category}` : c.kind === "payment" ? `${c.customer?.name} paid back` : `${DRAFT_LABEL[c.kind]} · ${whatOf(c.lines)}`;
      const r = await saveOrQueue(outbox, () => api("", body), c.kind, body, label, total);
      set(c.key, { state: r.queued ? "queued" : "saved" });
      onSaved();
    } catch (e) { set(c.key, { state: "draft", error: (e as Error).message }); }
  };

  return (
    <Sheet title="Tell Nana" eyebrow="New entry · from a sentence" onClose={onClose} wide>
      <p className="text-sm text-slate">Type it the way you&apos;d say it{canSpeak ? ", or tap the microphone and say it" : ""}. Nana writes the entries; you check them and tap Save. Nothing is saved before that.</p>
      <div className="mt-3 rounded-2xl border border-rule bg-card p-3 focus-within:border-crimson">
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, NANA_TEXT_MAX))} rows={3} aria-label="What happened" placeholder={EXAMPLES[0]} className="w-full resize-none bg-transparent text-base text-ink outline-none placeholder:text-slate" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate">{text.length}/{NANA_TEXT_MAX}</span>
          <div className="flex gap-2">
            {canSpeak && <button onClick={speak} className={`${pill} ${listening ? "!border-crimson !text-crimson" : ""}`} aria-pressed={listening}><Icon name="chat" className="h-4 w-4" />{listening ? "Listening… tap to stop" : "Say it"}</button>}
            <button onClick={read} disabled={busy || !text.trim()} className="btn-primary !px-5 !py-2.5"><Icon name="sparkle" className="h-4 w-4" />{busy ? "Reading…" : "Read it"}</button>
          </div>
        </div>
      </div>
      {!cards.length && !busy && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(cashier ? EXAMPLES.filter((e) => /sold|paid/i.test(e) && !/bought/i.test(e)) : EXAMPLES).map((e) => <button key={e} onClick={() => setText(e)} className="rounded-full bg-field px-3 py-1.5 text-left text-xs text-ink hover:text-crimson">{e}</button>)}
        </div>
      )}
      {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
      {note && <p className="mt-3 rounded-xl bg-field px-3 py-2 text-sm text-slate" role="status">{note}</p>}
      {cards.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="eyebrow">{cards.length} {cards.length === 1 ? "draft" : "drafts"} to check</p>
          {cards.map((c) => <DraftCard key={c.key} c={c} today={today} onChange={(p) => set(c.key, p)} onSave={() => save(c)} onDrop={() => setCards((cs) => cs.filter((x) => x.key !== c.key))} />)}
          {cards.some((c) => c.state === "draft") && cards.filter((c) => c.state === "draft").length > 1 && <button onClick={() => cards.filter((c) => c.state === "draft").forEach((c) => void save(c))} className="btn-primary w-full !py-3.5">Save all {cards.filter((c) => c.state === "draft").length}</button>}
        </div>
      )}
      <p className="mt-4 text-xs text-slate">Uses a little of your Nana allowance (Pearl). Nana sees your item names and prices and your customers&apos; first names, never balances or profit.</p>
    </Sheet>
  );
}

function DraftCard({ c, today, onChange, onSave, onDrop }: { c: Card; today: string; onChange: (p: Partial<Card>) => void; onSave: () => void; onDrop: () => void }) {
  const total = c.lines.length ? c.lines.reduce((n, l) => n + l.qty * l.unitKobo, 0) : c.totalKobo;
  const done = c.state === "saved" || c.state === "queued";
  const setLine = (i: number, p: Partial<Card["lines"][number]>) => onChange({ lines: c.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  return (
    <article className={`rounded-2xl border p-4 ${done ? "border-emerald-300 bg-emerald-50/60" : "border-rule bg-card"}`} aria-label={`${DRAFT_LABEL[c.kind]} draft`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">{DRAFT_LABEL[c.kind]}{c.kind === "sale" && c.owes ? " · on credit" : ""}</p>
          <p className="mt-0.5 font-ui text-2xl font-bold text-ink">{naira(total)}</p>
        </div>
        {done ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"><Icon name="check" className="h-4 w-4" />{c.state === "queued" ? "On this phone, waiting to sync" : "Saved"}</span>
          : <button onClick={onDrop} className="text-xs font-semibold text-slate hover:text-crimson">Remove</button>}
      </div>
      {c.lines.length > 0 && (
        <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule">
          {c.lines.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
              {l.match === "unsure" && l.options && !done ? (
                <select value={l.ref ?? ""} onChange={(e) => { const o = l.options!.find((x) => x.ref === e.target.value); setLine(i, o ? { ref: o.ref, title: o.title, match: "item" } : { ref: undefined }); }} className={`${field} !w-auto min-w-0 flex-1 !py-1.5`} aria-label="Which item">
                  <option value="">Which item? (“{l.title}”)</option>
                  {l.options.map((o) => <option key={o.ref} value={o.ref}>{o.title}</option>)}
                </select>
              ) : <span className="min-w-0 flex-1 font-ui font-semibold text-ink">{l.title}{l.match === "typed" && <span className="ml-1.5 text-xs font-normal text-slate">(not in your items)</span>}</span>}
              <label className="flex items-center gap-1 text-xs text-slate">Qty<input disabled={done} value={l.qty} onChange={(e) => { const q = Number(e.target.value); if (Number.isInteger(q) && q > 0) setLine(i, { qty: q }); }} inputMode="numeric" aria-label={`Quantity of ${l.title}`} className="w-14 rounded-lg border border-rule bg-card px-2 py-1 text-sm text-ink" /></label>
              <label className="flex items-center gap-1 text-xs text-slate">₦<input disabled={done} defaultValue={koboToInput(l.unitKobo)} onBlur={(e) => { const k = nairaInput(e.target.value); if (k !== null) setLine(i, { unitKobo: k }); }} inputMode="decimal" aria-label={`Price each of ${l.title}`} className="w-24 rounded-lg border border-rule bg-card px-2 py-1 text-sm text-ink" /> each</label>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {c.kind === "expense" && <div className="flex justify-between gap-2"><dt className="text-slate">For</dt><dd className="text-right text-ink">{c.note || c.category}</dd></div>}
        {c.customer && <div className="flex justify-between gap-2"><dt className="text-slate">{c.kind === "payment" ? "From" : "Customer"}</dt><dd className="text-right text-ink">
          {c.customer.match === "unsure" && c.customer.options && !done ? (
            <select value={c.customer.partyId ?? ""} onChange={(e) => { const o = c.customer!.options!.find((x) => x.id === e.target.value); onChange({ customer: { ...c.customer!, ...(o ? { partyId: o.id, name: o.name, match: "found" as const } : { partyId: undefined }) } }); }} className={`${field} !py-1`} aria-label="Which customer">
              <option value="">Which one?</option>{c.customer.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : <>{c.customer.name}{c.customer.match === "new" && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">new</span>}</>}
        </dd></div>}
        {c.kind === "sale" && c.owes && <>
          <div className="flex justify-between gap-2"><dt className="text-slate">Paid now</dt><dd className="text-ink">{naira(Math.min(c.paidKobo, total))}</dd></div>
          <div className="flex justify-between gap-2"><dt className="font-semibold text-ink">{c.customer ? `${firstName(c.customer.name)} owes` : "Owes"}</dt><dd className="font-ui font-bold text-amber-700">{naira(Math.max(0, total - c.paidKobo))}</dd></div>
          <div className="flex items-center justify-between gap-2"><dt className="text-slate">Due</dt><dd>{done ? <span className="text-ink">{c.dueOn ? shortDate(c.dueOn) : "—"}</span> : <input type="date" min={today} value={c.dueOn ?? ""} onChange={(e) => onChange({ dueOn: e.target.value || undefined })} className={`${field} !py-1`} aria-label="Due date" />}</dd></div>
        </>}
        <div className="flex items-center justify-between gap-2"><dt className="text-slate">Paid by</dt><dd>
          {done ? <span className="text-ink">{c.method ?? "cash"}</span> : (
            <select value={c.method ?? ""} onChange={(e) => onChange({ method: (e.target.value || null) as Method | null })} className={`${field} !py-1`} aria-label="How it was paid">
              <option value="">Cash (not said)</option>{[...SALE_METHODS, ...(c.kind === "expense" || c.kind === "purchase" ? [{ id: "card" as Method, label: "Card" }] : [])].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
        </dd></div>
      </dl>
      {c.unsure.length > 0 && !done && <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{c.unsure.map((u, i) => <li key={i}>⚑ {u}</li>)}</ul>}
      {c.error && <p className="mt-2 text-sm text-red-700" role="alert">{c.error}</p>}
      {!done && <button onClick={onSave} disabled={c.state === "saving"} className="btn-primary mt-3 w-full">{c.state === "saving" ? "Saving…" : `Save ${DRAFT_LABEL[c.kind].toLowerCase()} · ${naira(total)}`}</button>}
    </article>
  );
}
