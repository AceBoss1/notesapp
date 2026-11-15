"use client";

import { useEffect, useRef, useState } from "react";
import { EmojiPanel } from "./EmojiPicker";
import { StickerPanel } from "./StickerPicker";

// The composer's "😊 Emoji · Stickers" button (Moda user dashboard redesign): one panel with Emoji | Stickers at the top. An emoji goes into
// the message where the cursor is; a sticker is sent straight away. The panel opens above the composer's row, the full width on a phone.
export default function EmojiStickerPicker({ onEmoji, onSticker, disabled, stickersDisabled, className = "", label = "😊" }: {
  onEmoji: (emoji: string) => void; onSticker: (id: string) => void; disabled?: boolean; stickersDisabled?: boolean; className?: string; label?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "stickers">("emoji");
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
    <div ref={box} className="lg:relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-label="Emoji and stickers" title="Emoji and stickers" className={className}>{label}</button>
      {open && (
        <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-t-2xl border border-rule bg-card p-3 shadow-xl lg:inset-x-auto lg:left-0 lg:w-[22rem] lg:rounded-2xl" role="dialog" aria-label="Emoji and stickers">
          <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-rule lg:hidden" />
          <div className="mb-3 grid grid-cols-2 rounded-full border border-rule bg-paper p-[3px] font-ui text-sm" role="tablist">
            {(["emoji", "stickers"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} disabled={t === "stickers" && stickersDisabled} onClick={() => setTab(t)}
                className={`rounded-full py-1.5 disabled:opacity-50 ${tab === t ? "bg-crimson font-semibold text-paper" : "text-ink"}`}>{t === "emoji" ? "Emoji" : "Stickers"}</button>
            ))}
          </div>
          {tab === "emoji" ? <EmojiPanel onPick={onEmoji} /> : <StickerPanel onPick={(id) => { setOpen(false); onSticker(id); }} />}
        </div>
      )}
    </div>
  );
}
