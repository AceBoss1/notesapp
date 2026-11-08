"use client";

import { useEffect, useRef, useState } from "react";
import { MOMENT_PACKS, STICKERS, type Sticker } from "@/lib/stickers";

// A button that opens a grid of stickers: the moment packs first (lib/stickers.ts MOMENT_PACKS, each with its name), then the #NotesApp
// icons from /brand. Picking one sends it straight away.
const MOMENT_IDS = new Set(MOMENT_PACKS.flatMap((p) => p.stickers.map((s) => s.id)));
const SECTIONS: { name: string; stickers: Sticker[] }[] = [...MOMENT_PACKS, { name: "#NotesApp", stickers: STICKERS.filter((s) => !MOMENT_IDS.has(s.id)) }];
export default function StickerPicker({ onPick, disabled, className = "rounded border border-rule px-3 py-1", label = "🖼 Stickers" }: { onPick: (id: string) => void; disabled?: boolean; className?: string; label?: string }) {
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
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-label="Stickers" title="Stickers" className={className}>{label}</button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-rule bg-card p-3 shadow-lg" role="dialog" aria-label="Choose a sticker">
          <div className="max-h-72 overflow-y-auto">
          {SECTIONS.map((sec) => (
          <div key={sec.name} className="mb-2">
          <p className="mb-1 font-ui text-[11px] font-bold uppercase tracking-wide text-slate">{sec.name}</p>
          <div className="grid grid-cols-3 gap-2">
            {sec.stickers.map((s) => (
              <button key={s.id} type="button" onClick={() => { setOpen(false); onPick(s.id); }} title={s.label} aria-label={`Send the ${s.label} sticker`} className={`flex items-center justify-center rounded border border-transparent p-1 hover:border-crimson hover:bg-paper ${s.wide ? "col-span-3 aspect-[3/2]" : "aspect-square"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
          </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
