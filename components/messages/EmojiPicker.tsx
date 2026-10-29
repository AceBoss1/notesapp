"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BRAND_EMOJI } from "@/lib/messages-rules";
import { EMOJI_PACKS, packUnlocked, unlocksPacks } from "@/lib/emoji-packs";
import { effectiveTier } from "@/lib/effective-tier";
import { useMember } from "@/lib/member-client";
import { Emoji } from "@/components/NotesAppEmoji";

// A small set of everyday emojis (no flags or skin tones: those draw as letters or boxes on some devices).
export const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘",
  "😋","😎","🤗","🤔","😐","😮","😢","😭","😡","🥳","😴","🤝","👍","👎","👏","🙌",
  "🙏","💪","👋","✌️","🤞","👌","🔥","💯","✨","🎉","🎂","🎁","❤️","💛","💚","💙",
  "💜","🖤","💔","⭐","🌟","🌍","☀️","🌙","☕","🍽️","🚀","💡","📌","📎","📅","✅",
];

// The 😊 button before B / I / U: opens a grid; tapping an emoji puts it into the message where the cursor is. Tabs along the top: Everyday
// (ours and the usual emojis) and each emoji pack (lib/emoji-packs.ts). A pack that comes with Pro and above shows a lock and Unlock.
export default function EmojiPicker({ onPick, disabled, className = "w-8 rounded border border-rule py-1" }: { onPick: (emoji: string) => void; disabled?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("everyday");
  const { profile } = useMember();
  const tier = profile ? effectiveTier(profile) : undefined;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const pack = EMOJI_PACKS.find((p) => p.id === tab);
  const unlocked = !pack || packUnlocked(pack, tier);
  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-label="Emoji" title="Emoji" className={className}>😊</button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-[19.5rem] rounded-lg border border-rule bg-card p-2 shadow-lg" role="dialog" aria-label="Choose an emoji">
          <div className="mb-2 flex gap-1 overflow-x-auto border-b border-rule pb-2" role="tablist" aria-label="Emoji packs">
            {[{ id: "everyday", name: "Everyday", free: true }, ...EMOJI_PACKS].map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={tab === p.id} onClick={() => setTab(p.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 font-ui text-xs font-semibold ${tab === p.id ? "bg-crimson text-white" : "text-slate hover:bg-paper"}`}>
                {!p.free && !unlocksPacks(tier) && <span aria-label="locked">🔒 </span>}{p.name}
              </button>
            ))}
          </div>
          {!pack ? (
            <>
              {/* Ours first: they go in as :na:, :academy: or :football: and show as pictures once sent. */}
              <p className="px-1 pb-1 font-ui text-[11px] font-bold uppercase tracking-wider text-slate">#NotesApp</p>
              <div className="mb-2 flex gap-1 border-b border-rule pb-2">
                {Object.entries(BRAND_EMOJI).map(([code, x]) => (
                  <button key={code} type="button" onClick={() => onPick(code)} aria-label={`Insert ${x.label}`} title={`${x.label} (${code})`} className="rounded p-1 text-xl leading-none hover:bg-paper"><Emoji e={code} /></button>
                ))}
              </div>
              <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => onPick(e)} aria-label={`Insert ${e}`} className="rounded p-1 text-xl leading-none hover:bg-paper">{e}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              {!unlocked && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-paper px-2 py-1.5">
                  <p className="text-xs text-slate">{pack.name} comes with Pro, Business and Enterprise.</p>
                  <Link href="/pricing" className="shrink-0 rounded-full bg-gradient-to-r from-crimson to-crimson-bright px-3 py-1 font-ui text-xs font-bold text-white">Unlock</Link>
                </div>
              )}
              <div className={`grid max-h-56 grid-cols-8 gap-1 overflow-y-auto ${unlocked ? "" : "opacity-60"}`}>
                {pack.emojis.map((x) => (
                  <button key={x.code} type="button" disabled={!unlocked} onClick={() => onPick(x.code)} aria-label={`Insert ${x.label}`} title={x.label}
                    className="rounded p-1 text-xl leading-none hover:bg-paper disabled:cursor-not-allowed disabled:hover:bg-transparent"><Emoji e={x.code} /></button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
