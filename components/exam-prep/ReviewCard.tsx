"use client";
import { useState } from "react";
import { EXAMS, type Question } from "@/lib/exam-prep";
import { btnGo, btnLine, card, input, Note, Pill } from "./ui";

// One question as a reviewer sees it: everything, the correct answer marked, its history, and approve or ask for changes.
export default function ReviewCard({ q, onReview, actions }: { q: Question; onReview?: (decision: "approve" | "changes", note: string) => Promise<void>; actions?: React.ReactNode }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(d: "approve" | "changes") {
    if (!onReview) return;
    setBusy(true); setErr("");
    try { await onReview(d, note); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Pill>{EXAMS[q.exam]?.short}</Pill><Pill tone="grey">{q.subject} · {q.topic}</Pill><Pill tone={q.access === "free" ? "green" : "gold"}>{q.access}</Pill>
        <Pill tone="grey">difficulty {q.difficulty}</Pill><Pill tone="grey">{q.provenance.by === "ai-draft" ? "Nana AI-assisted draft" : `by ${q.provenance.authorName ?? "editor"}`}</Pill>
        <span className="ml-auto font-mono text-[11px] text-[#0F2747]/50">{q.id}</span>
      </div>
      {q.context && <div className="mt-3 whitespace-pre-line rounded-xl bg-[#0F2747]/5 p-3 text-sm">{q.context}</div>}
      <p className="mt-3 whitespace-pre-line font-semibold">{q.stem}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {q.options.map((o) => <li key={o.key} className={`rounded-lg px-2 py-1.5 ${o.key === q.answer ? "bg-[#1E8E5A]/12 font-semibold" : ""}`}><b>{o.key}.</b> {o.text}{o.key === q.answer ? " ✓" : ""}{q.whyNot?.[o.key] ? <span className="block pl-5 text-xs font-normal text-[#0F2747]/65">Why not: {q.whyNot[o.key]}</span> : null}</li>)}
      </ul>
      <p className="mt-2 whitespace-pre-line rounded-xl border border-[#0F2747]/10 p-3 text-sm"><b>Explanation:</b> {q.explanation || <i>none yet</i>}</p>
      {q.reviews.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-[#0F2747]/65">{q.reviews.map((r, i) => <li key={i}>{r.decision === "approve" ? "✓ Approved" : "↺ Changes asked"} by {r.name} · {r.at.slice(0, 10)}{r.note ? `: ${r.note}` : ""}</li>)}</ul>}
      {err && <div className="mt-2"><Note tone="error">{err}</Note></div>}
      {onReview && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed when asking for changes)" maxLength={1000} />
          <button onClick={() => go("approve")} disabled={busy} className={`${btnGo} whitespace-nowrap`}>Approve</button>
          <button onClick={() => go("changes")} disabled={busy} className={`${btnLine} whitespace-nowrap`}>Ask for changes</button>
        </div>
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
