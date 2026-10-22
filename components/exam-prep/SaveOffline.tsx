"use client";
import { useState } from "react";
import { EXAMS, type ExamId } from "@/lib/exam-prep";
import { prepApi, shortDate, useOnline, usePrepHref } from "@/lib/exam-prep-client";
import { cachePages, forgetPack, keepPack, type SavedPack } from "@/lib/exam-prep-local";
import { btnLine, btnNavy, card, Note } from "./ui";

// Keep this exam's questions on the phone (free ones, plus the pack's with a signed offline pass), and the pages that use them.
export default function SaveOffline({ exam, saved, onSaved, uid }: { exam: ExamId; saved: SavedPack | null | undefined; onSaved: (p: SavedPack | null) => void; uid: string | null }) {
  const online = useOnline();
  const h = usePrepHref();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  async function save() {
    setBusy(true); setMsg(null);
    try {
      const p = await prepApi<SavedPack>(`save?exam=${exam}`);
      const pack = { ...p, uid };
      await keepPack(pack);
      await cachePages([h("/"), h("/saved"), h(`/${exam}`), h(`/${exam}/practice`), h(`/${exam}/mock`), h("/progress")]);
      onSaved(pack);
      setMsg({ tone: "ok", text: `Saved ${p.questions.length} questions. They work with no data${p.pass ? ` until ${shortDate(p.pass.exp)}; save again online to renew` : ""}.` });
    } catch (e) { setMsg({ tone: "error", text: (e as Error).message }); } finally { setBusy(false); }
  }
  async function remove() { await forgetPack(exam); onSaved(null); setMsg(null); }
  return (
    <div className={card}>
      <p className="font-semibold">Use {EXAMS[exam].short} offline</p>
      {saved ? (
        <p className="mt-1 text-sm text-[#0F2747]/70">{saved.questions.length} questions saved on this phone on {shortDate(saved.savedAt)}.{saved.pass ? ` Pack questions open offline until ${shortDate(saved.pass.exp)}.` : ""}</p>
      ) : (
        <p className="mt-1 text-sm text-[#0F2747]/70">Save the questions to this phone and practise with no data. Your answers sync when you're back online.</p>
      )}
      {msg && <div className="mt-2"><Note tone={msg.tone}>{msg.text}</Note></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={save} disabled={busy || !online} className={btnNavy}>{busy ? "Saving…" : saved ? "Update saved pack" : "Save for offline"}</button>
        {saved && <button onClick={remove} className={btnLine}>Remove</button>}
      </div>
    </div>
  );
}
