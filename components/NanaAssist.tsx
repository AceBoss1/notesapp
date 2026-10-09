"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/firebase";

// Nana's writing help as a small button beside a text box: pick what you want, read what she wrote, then use it (or not). It never changes
// your text on its own. It needs an AI account (your own, connected on the Nana page, or #NotesApp's while that is switched on).
export type Surface = "draft" | "social" | "chat";
type Task = "improve" | "shorten" | "expand" | "friendlier" | "professional" | "draft" | "social" | "reply";

const LABELS: Record<Task, string> = {
  improve: "Improve my writing", shorten: "Make it shorter", expand: "Expand it", friendlier: "Friendlier tone", professional: "More professional",
  draft: "Turn my notes into a draft", social: "Write the post", reply: "Suggest a reply",
};
const MENU: Record<Surface, Task[]> = {
  draft: ["improve", "shorten", "expand", "friendlier", "professional", "draft"],
  social: ["social", "improve", "shorten", "friendlier"],
  chat: ["reply", "improve", "friendlier", "professional", "shorten"],
};

export default function NanaAssist({ surface, getText, onApply, platform, getContext, label = "Nana", className = "", align = "left" }: {
  surface: Surface; getText: () => string; onApply: (text: string) => void; platform?: "linkedin" | "x"; getContext?: () => string; label?: string; className?: string; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Task | null>(null);
  const [result, setResult] = useState<{ task: Task; text: string } | null>(null);
  const [error, setError] = useState<{ message: string; connect: boolean } | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

  async function run(task: Task) {
    const user = auth.currentUser;
    setError(null); setResult(null); setUndo(null);
    if (!user) return setError({ message: "Sign in to use Nana's writing help.", connect: false });
    const text = getText();
    if (!text.trim() && task !== "reply") return setError({ message: surface === "chat" ? "Write a few words first, or ask for a suggested reply." : "There's no text to work on yet.", connect: false });
    setBusy(task);
    try {
      const r = await fetch("/api/nana/assist", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ task, surface, text, platform, context: getContext?.() ?? "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setError({ message: j.error || "Something went wrong. Please try again.", connect: r.status === 403 || r.status === 429 || /AI account/i.test(j.error ?? "") });
      setResult({ task, text: j.text });
    } catch {
      setError({ message: "Couldn't reach Nana. Check your connection and try again.", connect: false });
    } finally {
      setBusy(null);
    }
  }
  const use = () => { if (!result) return; setUndo(getText()); onApply(result.text); setResult(null); setOpen(false); };

  return (
    <span className={`relative inline-block ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" className="inline-flex items-center gap-1.5 rounded border border-rule px-2.5 py-1 font-ui text-xs font-semibold text-ink hover:border-crimson hover:text-crimson">
        <Image src="/images/nana/nana-sm.webp" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full" />✨ {label}
      </button>
      {undo !== null && !open && <button type="button" onClick={() => { onApply(undo); setUndo(null); }} className="ml-2 font-ui text-xs text-slate underline">Undo Nana&apos;s change</button>}
      {open && (
        <div role="region" aria-label="Nana's writing help" className={`fixed inset-x-3 bottom-3 z-50 max-h-[75dvh] overflow-y-auto rounded-lg border border-rule bg-card p-3 text-sm shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto ${align === "right" ? "sm:right-0" : "sm:left-0"} sm:top-full sm:z-30 sm:mt-1 sm:max-h-none sm:w-[22rem]`}>
          {!result && (
            <>
              <p className="text-xs text-slate">{surface === "chat" ? "I'll read the last few messages to suggest a reply. You read it and send it yourself." : "Pick what you'd like, and I'll show you before anything changes."}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MENU[surface].map((t) => (
                  <button key={t} type="button" disabled={!!busy} onClick={() => run(t)} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson hover:text-crimson disabled:opacity-50">
                    {busy === t ? "Writing…" : t === "social" && platform ? `Write it for ${platform === "x" ? "X" : "LinkedIn"}` : LABELS[t]}
                  </button>
                ))}
              </div>
            </>
          )}
          {result && (
            <>
              <p className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded border border-rule bg-paper p-2 text-sm text-ink" data-testid="nana-result">{result.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={use} className="btn-primary !px-3 !py-1.5 text-xs">{surface === "chat" ? "Use in my message" : "Use this"}</button>
                <button type="button" disabled={!!busy} onClick={() => run(result.task)} className="rounded border border-rule px-3 py-1.5 text-xs font-semibold hover:border-crimson">Try again</button>
                <button type="button" onClick={() => setResult(null)} className="px-2 py-1.5 text-xs text-slate underline">Back</button>
              </div>
            </>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-700" role="alert">{error.message} {error.connect && <Link href="/nana#connect" className="font-semibold underline">Connect your AI account</Link>}</p>
          )}
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs text-slate underline">Close</button>
        </div>
      )}
    </span>
  );
}
