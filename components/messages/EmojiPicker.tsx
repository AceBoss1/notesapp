"use client";

import { useEffect, useRef, useState } from "react";

// A small set of everyday emojis (no flags or skin tones: those draw as letters or boxes on some devices).
const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘",
  "😋","😎","🤗","🤔","😐","😮","😢","😭","😡","🥳","😴","🤝","👍","👎","👏","🙌",
  "🙏","💪","👋","✌️","🤞","👌","🔥","💯","✨","🎉","🎂","🎁","❤️","💛","💚","💙",
  "💜","🖤","💔","⭐","🌟","🌍","☀️","🌙","☕","🍽️","🚀","💡","📌","📎","📅","✅",
];

// The 😊 button before B / I / U: opens a grid; tapping an emoji puts it into the message where the cursor is.
export default function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
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
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-label="Emoji" title="Emoji" className="w-8 rounded border border-rule py-1">😊</button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-rule bg-card p-2 shadow-lg" role="dialog" aria-label="Choose an emoji">
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
