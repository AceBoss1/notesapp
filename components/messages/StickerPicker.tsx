"use client";

import { useEffect, useRef, useState } from "react";
import { STICKERS } from "@/lib/stickers";

// A button that opens a grid of stickers (the #NotesApp icons from /brand). Picking one sends it straight away.
export default function StickerPicker({ onPick, disabled }: { onPick: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-label="Stickers" title="Stickers" className="rounded border border-rule px-3 py-1">🖼 Stickers</button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-rule bg-card p-3 shadow-lg" role="dialog" aria-label="Choose a sticker">
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
            {STICKERS.map((s) => (
              <button key={s.id} type="button" onClick={() => { setOpen(false); onPick(s.id); }} title={s.label} aria-label={`Send the ${s.label} sticker`} className="flex aspect-square items-center justify-center rounded border border-transparent p-1 hover:border-crimson hover:bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
