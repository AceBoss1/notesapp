"use client";
import { useState } from "react";
import { EXAM_IDS, EXAMS, OPTION_KEYS, type ExamId, type OptionKey, type Question, type Subject } from "@/lib/exam-prep";
import { btnGo, btnLine, input, Note } from "./ui";

// Writing or changing a question (Admin → Naija Exam Prep, Editorial). Saving sends it for review; "Save as draft" keeps it back.
export type Draft = { exam: ExamId; subject: string; topic: string; context: string; stem: string; options: string[]; answer: OptionKey; explanation: string; whyNot: Partial<Record<OptionKey, string>>; difficulty: number; access: "free" | "pack" };
export const draftOf = (q?: Question): Draft => q
  ? { exam: q.exam, subject: q.subject, topic: q.topic, context: q.context ?? "", stem: q.stem, options: q.options.map((o) => o.text).concat(["", "", "", ""]).slice(0, Math.max(4, q.options.length)), answer: q.answer, explanation: q.explanation, whyNot: q.whyNot ?? {}, difficulty: q.difficulty, access: q.access }
  : { exam: "jamb", subject: "", topic: "", context: "", stem: "", options: ["", "", "", ""], answer: "A", explanation: "", whyNot: {}, difficulty: 2, access: "pack" };

export default function QuestionEditor({ subjects, initial, onSave, onCancel }: { subjects: Subject[]; initial: Draft; onSave: (d: Draft, asDraft: boolean) => Promise<void>; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const subs = subjects.filter((s) => s.exam === d.exam);
  const topics = subs.find((s) => s.id === d.subject)?.topics ?? [];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  async function save(asDraft: boolean) { setBusy(true); setErr(""); try { await onSave(d, asDraft); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  const label = "block text-xs font-semibold text-[#0F2747]/70";
  return (
    <div className="space-y-3 rounded-2xl border border-[#0F2747]/15 bg-white p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className={label}>Exam<select className={input} value={d.exam} onChange={(e) => setD((x) => ({ ...x, exam: e.target.value as ExamId, subject: "", topic: "" }))}>{EXAM_IDS.map((x) => <option key={x} value={x}>{EXAMS[x].short}</option>)}</select></label>
        <label className={label}>Subject<select className={input} value={d.subject} onChange={(e) => setD((x) => ({ ...x, subject: e.target.value, topic: "" }))}><option value="">Choose…</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className={label}>Topic<select className={input} value={d.topic} onChange={(e) => set("topic", e.target.value)}><option value="">Choose…</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <label className={label}>Passage (optional)<textarea className={`${input} min-h-[70px] py-2`} value={d.context} onChange={(e) => set("context", e.target.value)} /></label>
      <label className={label}>Question<textarea className={`${input} min-h-[70px] py-2`} value={d.stem} onChange={(e) => set("stem", e.target.value)} /></label>
      <div className="space-y-2">
        {d.options.map((o, i) => {
          const k = OPTION_KEYS[i];
          return (
            <div key={k} className="grid gap-1 sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-2">
              <label className="flex items-center gap-1 text-sm font-bold"><input type="radio" checked={d.answer === k} onChange={() => set("answer", k)} aria-label={`${k} is correct`} />{k}</label>
              <input className={input} value={o} placeholder={`Option ${k}`} onChange={(e) => set("options", d.options.map((x, j) => (j === i ? e.target.value : x)))} />
              <input className={input} value={d.whyNot[k] ?? ""} disabled={d.answer === k} placeholder={d.answer === k ? "Correct answer" : `Why ${k} is wrong (optional)`} onChange={(e) => set("whyNot", { ...d.whyNot, [k]: e.target.value })} />
            </div>
          );
        })}
        {d.options.length < 5 && <button onClick={() => set("options", [...d.options, ""])} className="text-sm font-semibold underline">Add option E</button>}
      </div>
      <label className={label}>Explanation (needed to publish)<textarea className={`${input} min-h-[90px] py-2`} value={d.explanation} onChange={(e) => set("explanation", e.target.value)} /></label>
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">Difficulty <select className="rounded-lg border px-2 py-1" value={d.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}><option value={1}>1 easy</option><option value={2}>2</option><option value={3}>3 hard</option></select></label>
        <label className="flex items-center gap-2">Access <select className="rounded-lg border px-2 py-1" value={d.access} onChange={(e) => set("access", e.target.value as "free" | "pack")}><option value="free">Free</option><option value="pack">Pack</option></select></label>
      </div>
      {err && <Note tone="error">{err}</Note>}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => save(false)} disabled={busy} className={btnGo}>Save and send for review</button>
        <button onClick={() => save(true)} disabled={busy} className={btnLine}>Save as draft</button>
        <button onClick={onCancel} className="text-sm underline">Cancel</button>
      </div>
    </div>
  );
}
