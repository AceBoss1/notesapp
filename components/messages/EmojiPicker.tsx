"use client";

import { useEffect, useRef, useState } from "react";
import { NOTESAPP_EMOJI } from "@/lib/messages-rules";
import { Emoji } from "@/components/NotesAppEmoji";

// A small set of everyday emojis (no flags or skin tones: those draw as letters or boxes on some devices).
export const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘",
  "😋","😎","🤗","🤔","😐","😮","😢","😭","😡","🥳","😴","🤝","👍","👎","👏","🙌",
  "🙏","💪","👋","✌️","🤞","👌","🔥","💯","✨","🎉","🎂","🎁","❤️","💛","💚","💙",
  "💜","🖤","💔","⭐","🌟","🌍","☀️","🌙","☕","🍽️","🚀","💡","📌","📎","📅","✅",
];

// The 😊 button before B / I / U: opens a grid; tapping an emoji puts it into the message where the cursor is.
export default function EmojiPicker({ onPick, disabled, className = "w-8 rounded border border-rule py-1" }: { onPick: (emoji: string) => void; disabled?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-label="Emoji" title="Emoji" className={className}>😊</button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-rule bg-card p-2 shadow-lg" role="dialog" aria-label="Choose an emoji">
          {/* Ours first: they go in as :na: and :academy: and show as pictures once sent. */}
          <p className="px-1 pb-1 font-ui text-[11px] font-bold uppercase tracking-wider text-slate">#NotesApp</p>
          <div className="mb-2 flex gap-1 border-b border-rule pb-2">
            {Object.entries(NOTESAPP_EMOJI).map(([code, x]) => (
              <button key={code} type="button" onClick={() => onPick(code)} aria-label={`Insert ${x.label}`} title={`${x.label} (${code})`} className="rounded p-1 text-xl leading-none hover:bg-paper"><Emoji e={code} /></button>
            ))}
          </div>
          <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => onPick(e)} aria-label={`Insert ${e}`} className="rounded p-1 text-xl leading-none hover:bg-paper">{e}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
