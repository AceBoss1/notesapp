"use client";
import { useState } from "react";
import type { OptionKey, StudentQuestion } from "@/lib/exam-prep";
import { prepApi } from "@/lib/exam-prep-client";
import { btnLine, input, Note } from "./ui";

// One question: the passage (if any), the stem and the options. With `chosen` set and `reveal`, it shows right and wrong and why.
export function QuestionBody({ q, chosen, reveal, onChoose, disabled }: { q: Pick<StudentQuestion, "context" | "stem" | "options"> & Partial<Pick<StudentQuestion, "answer">>; chosen: OptionKey | null; reveal: boolean; onChoose: (k: OptionKey) => void; disabled?: boolean }) {
  return (
    <>
      {q.context && <div className="mb-3 max-h-72 overflow-auto whitespace-pre-line rounded-xl bg-[#0F2747]/5 p-3 text-[15px] leading-relaxed">{q.context}</div>}
      <p className="whitespace-pre-line text-[17px] font-semibold leading-snug">{q.stem}</p>
      <div className="mt-4 space-y-2" role="radiogroup">
        {q.options.map((o) => {
          const right = reveal && q.answer === o.key;
          const wrong = reveal && chosen === o.key && q.answer !== o.key;
          const picked = chosen === o.key;
          return (
            <button key={o.key} role="radio" aria-checked={picked} disabled={disabled} onClick={() => onChoose(o.key)}
              className={`flex min-h-[52px] w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-[15px] transition ${right ? "border-[#1E8E5A] bg-[#1E8E5A]/10" : wrong ? "border-[#B3261E] bg-[#B3261E]/8" : picked ? "border-[#0F2747] bg-[#0F2747]/5" : "border-[#0F2747]/15 bg-white hover:border-[#0F2747]/40"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${right ? "bg-[#1E8E5A] text-white" : wrong ? "bg-[#B3261E] text-white" : picked ? "bg-[#0F2747] text-white" : "bg-[#0F2747]/8"}`}>{o.key}</span>
              <span className="pt-0.5">{o.text}{right ? " ✓" : wrong ? " ✗" : ""}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function Explanation({ q, chosen }: { q: StudentQuestion; chosen: OptionKey | null }) {
  const right = chosen === q.answer;
  return (
    <div className={`mt-4 rounded-xl border p-3 ${right ? "border-[#1E8E5A]/40 bg-[#1E8E5A]/8" : "border-[#B3261E]/30 bg-[#B3261E]/5"}`}>
      <p className="font-bold">{chosen ? (right ? "Correct!" : `Not quite. The answer is ${q.answer}.`) : `Not answered. The answer is ${q.answer}.`}</p>
      {chosen && !right && q.whyNot?.[chosen] && <p className="mt-1 text-sm"><span className="font-semibold">Why not {chosen}:</span> {q.whyNot[chosen]}</p>}
      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{q.explanation}</p>
      {q.reviewedBy && <p className="mt-2 text-xs text-[#0F2747]/60">Reviewed by {q.reviewedBy}</p>}
    </div>
  );
}

// "Report": wrong answer, unclear, typo or something else. Works signed out too.
export function ReportButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("wrong-answer");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  if (state === "done") return <p className="text-xs text-[#146b43]">Thanks, we'll check it.</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-semibold text-[#0F2747]/60 underline">Report a problem</button>;
  async function send() {
    setState("busy");
    try { await prepApi("report", { body: { questionId: id, reason, note } }); setState("done"); } catch (e) { setState((e as Error).message); }
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-[#0F2747]/15 bg-white p-3">
      <p className="text-sm font-semibold">What's wrong?</p>
      <div className="flex flex-wrap gap-2 text-sm">
        {[["wrong-answer", "Wrong answer"], ["unclear", "Unclear"], ["typo", "Typo"], ["other", "Something else"]].map(([k, l]) => (
          <label key={k} className={`cursor-pointer rounded-full border px-3 py-1 ${reason === k ? "border-[#0F2747] bg-[#0F2747] text-white" : "border-[#0F2747]/20"}`}><input type="radio" className="sr-only" checked={reason === k} onChange={() => setReason(k)} />{l}</label>
        ))}
      </div>
      <input className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Tell us more (optional)" />
      {state !== "idle" && state !== "busy" && <Note tone="error">{state}</Note>}
      <div className="flex gap-2"><button onClick={send} disabled={state === "busy"} className={btnLine}>Send report</button><button onClick={() => setOpen(false)} className="text-sm underline">Cancel</button></div>
    </div>
  );
}
