"use client";

import { MOMENT_PACKS, STICKERS, type Sticker } from "@/lib/stickers";

// Stickers: the moment packs first (lib/stickers.ts MOMENT_PACKS, each with its name), then the #NotesApp icons from /brand.
const MOMENT_IDS = new Set(MOMENT_PACKS.flatMap((p) => p.stickers.map((s) => s.id)));
const SECTIONS: { name: string; stickers: Sticker[] }[] = [...MOMENT_PACKS, { name: "#NotesApp", stickers: STICKERS.filter((s) => !MOMENT_IDS.has(s.id)) }];
// The sticker half of the composer's Emoji · Stickers panel (EmojiStickerPicker): picking one sends it straight away.
export function StickerPanel({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      {SECTIONS.map((sec) => (
        <div key={sec.name} className="mb-3">
          <p className="mb-2 text-center font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-crimson-bright">{sec.name}</p>
          <div className="grid grid-cols-3 gap-2">
            {sec.stickers.map((s) => (
              <button key={s.id} type="button" onClick={() => onPick(s.id)} title={s.label} aria-label={`Send the ${s.label} sticker`} className={`flex items-center justify-center rounded-xl border border-transparent p-1 hover:border-crimson hover:bg-paper ${s.wide ? "col-span-3 aspect-[3/2]" : "aspect-square"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
