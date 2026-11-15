"use client";
import { useEffect, useState } from "react";
import type { OptionKey, StudentQuestion } from "@/lib/exam-prep";
import { FOLLOW_UP_MAX, type LiteLang } from "@/lib/nana-lite";
import { prepApi } from "@/lib/exam-prep-client";

// "Still unsure? Ask Nana Lite" under a marked question (lib/nana-lite.ts): our own small model explains it another way, from the
// question's reviewed explanation, in English or Pidgin. Shown only when Nana Lite is switched on and the student is online.
let onCache: Promise<{ on: boolean; model: string | null }> | null = null;
const status = () => (onCache ??= prepApi<{ on: boolean; model: string | null }>("lite").catch(() => ({ on: false, model: null })));

export default function AskNanaLite({ q, chosen }: { q: StudentQuestion; chosen: OptionKey | null }) {
  const [on, setOn] = useState(false);
  const [llama, setLlama] = useState(false); // the Llama licence asks for "Built with Llama" where it's used
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [lang, setLang] = useState<LiteLang>("en");
  const [answers, setAnswers] = useState<{ ask: string; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (navigator.onLine) status().then((r) => { setOn(r.on); setLlama(/llama/i.test(r.model ?? "")); }); }, []);
  useEffect(() => { setOpen(false); setAnswers([]); setText(""); setErr(""); }, [q.id]);
  if (!on) return null;

  async function ask(follow: string) {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await prepApi<{ text: string }>("lite", { body: { questionId: q.id, chosen, followUp: follow, lang } });
      setAnswers((a) => [...a, { ask: follow || "Explain it another way", text: r.text }]);
      setText("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!open) return (
    <button onClick={() => { setOpen(true); void ask(""); }} className="mt-3 rounded-full border border-[#0F2747]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0F2747]">
      Still unsure? Ask Nana Lite
    </button>
  );
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[#0F2747]/15 bg-white p-3 text-[15px]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-[#0F2747]">Nana Lite</p>
        <label className="text-xs text-[#0F2747]/70">Language{" "}
          <select value={lang} onChange={(e) => setLang(e.target.value as LiteLang)} className="rounded-md border border-[#0F2747]/20 px-1 py-0.5">
            <option value="en">English</option><option value="pcm">Pidgin</option>
          </select>
        </label>
      </div>
      {answers.map((a, i) => (
        <div key={i}>
          <p className="text-xs font-semibold text-[#0F2747]/60">{a.ask}</p>
          <p className="mt-1 whitespace-pre-line leading-relaxed">{a.text}</p>
        </div>
      ))}
      {busy && <p className="text-sm text-[#0F2747]/60">Nana Lite is thinking…</p>}
      {err && <p className="text-sm text-[#B3261E]" role="alert">{err}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void ask(text.trim()); }} className="flex gap-2">
        <input value={text} maxLength={FOLLOW_UP_MAX} onChange={(e) => setText(e.target.value)} placeholder="Ask about this question…" className="min-w-0 flex-1 rounded-lg border border-[#0F2747]/20 px-3 py-2 text-sm" />
        <button disabled={busy || !text.trim()} className="rounded-lg bg-[#0F2747] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Ask</button>
      </form>
      <p className="text-[11px] text-[#0F2747]/60">A small AI model that explains from this question’s reviewed explanation. It can be wrong: your teacher has the last word. What you type isn’t saved.{llama ? " Built with Llama." : ""}</p>
    </div>
  );
}
