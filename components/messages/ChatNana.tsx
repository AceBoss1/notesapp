"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "firebase/auth";

// Nana in a conversation: a summary of what you missed, and a message translated into English, Pidgin, Yorùbá, Igbo or Hausa. Both use
// /api/nana/assist (your own AI account if connected, else #NotesApp's daily allowance); nothing is stored.
export const LANGS = [
  { key: "en", label: "English" }, { key: "pcm", label: "Pidgin" }, { key: "yo", label: "Yorùbá" }, { key: "ig", label: "Igbo" }, { key: "ha", label: "Hausa" },
] as const;

export async function askNana(user: User, body: Record<string, unknown>): Promise<string> {
  const r = await fetch("/api/nana/assist", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ surface: "chat", ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Nana couldn't do that right now.");
  return String(j.text ?? "");
}

const Shell = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => createPortal(
  <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><span aria-hidden="true">✨</span>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-paper">×</button>
      </div>
      {children}
    </div>
  </div>,
  document.body,
);

// The summary of what you missed.
export function SummaryDialog({ user, context, count, onClose }: { user: User; context: string; count: number; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    askNana(user, { task: "summarise", context }).then((t) => alive && setText(t)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [user, context]);
  return (
    <Shell title="What you missed" onClose={onClose}>
      <p className="mt-1 text-xs text-slate">Nana&apos;s summary of {count} message{count === 1 ? "" : "s"}. Check the chat for anything important.</p>
      <div className="mt-4 max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-[15px] leading-relaxed text-ink" aria-live="polite">
        {error ? <span className="text-red-700">{error}</span> : text ?? <span className="text-slate">Reading the chat…</span>}
      </div>
    </Shell>
  );
}

// Choosing the language for a translation (remembered on this device).
export function TranslateDialog({ onPick, onClose }: { onPick: (lang: string, label: string) => void; onClose: () => void }) {
  let last = "";
  try { last = localStorage.getItem("notesapp:translateTo") ?? ""; } catch {}
  return (
    <Shell title="Translate into" onClose={onClose}>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {LANGS.map((l) => (
          <button key={l.key} type="button" onClick={() => { try { localStorage.setItem("notesapp:translateTo", l.key); } catch {} onPick(l.key, l.label); onClose(); }}
            className={`rounded-xl border px-4 py-3 text-left font-ui text-sm font-semibold ${last === l.key ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink hover:bg-paper"}`}>{l.label}</button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate">Translated by Nana. Machine translation can miss nuance.</p>
    </Shell>
  );
}
