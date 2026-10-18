"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NOTESAPP_EMOJI, REACTIONS, isReaction } from "@/lib/messages-rules";
import { useQuickReactions } from "@/lib/quick-reactions-client";
import { Emoji } from "@/components/NotesAppEmoji";
import { EMOJIS } from "./EmojiPicker";

export type MenuItem = { label: string; icon: string; onClick: () => void; danger?: boolean; hidden?: boolean };

// The menu for one message, opened by right-click on a computer, a long press on a phone, or its ⋯ button: your quick reactions along
// the top (⇄ at the end swaps any of them for another emoji), then Reply, Copy, Pin, Message info, Select, Edit, Delete… On a phone it
// rises from the bottom; on a computer it opens where you clicked, kept inside the window.
export default function MessageMenu({ at, mine, current, canReact, items, onReact, onClose }: {
  at: { x: number; y: number } | null; // where it was opened (computers); null = bottom sheet
  mine: boolean;
  current: string; // your reaction now, or ""
  canReact: boolean;
  items: MenuItem[];
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [quick] = useQuickReactions();
  const [swapping, setSwapping] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    box.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const shown = items.filter((i) => !i.hidden);
  const sheet = !at || (typeof window !== "undefined" && window.innerWidth < 1024);
  // Kept inside the window: about 330 px wide and 48 px a row.
  const style = sheet || !at ? undefined : {
    left: Math.max(8, Math.min(at.x - (mine ? 320 : 0), window.innerWidth - 338)),
    top: Math.max(8, Math.min(at.y, window.innerHeight - (swapping ? 470 : shown.length * 44 + 90))),
  };
  // Your reaction, if it isn't one of your quick ones, still shows (so you can see it and take it off).
  const row = current && !quick.includes(current) ? [...quick.slice(0, -1), current] : quick;
  return createPortal(
    <div className="fixed inset-0 z-[120]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onTouchStart={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {sheet && <div className="absolute inset-0 bg-ink/30" aria-hidden="true" onClick={onClose} />}
      <div ref={box} role="menu" aria-label="Message actions" style={style}
        className={sheet
          ? "absolute inset-x-0 bottom-0 rounded-t-3xl bg-card px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          : "absolute w-[330px] rounded-2xl border border-rule bg-card py-2 shadow-2xl"}>
        {sheet && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule" aria-hidden="true" />}
        {swapping ? <SwapReactions sheet={sheet} onDone={() => setSwapping(false)} /> : (<>
          {canReact && (
            <div className={`flex items-center justify-between ${sheet ? "mb-2 rounded-2xl bg-paper px-1.5 py-1.5" : "mx-2 mb-1 border-b border-rule pb-2"}`} aria-label="React">
              {row.map((e) => (
                <button key={e} type="button" role="menuitemradio" aria-checked={current === e} aria-label={`React ${NOTESAPP_EMOJI[e]?.label ?? e}`} onClick={() => onReact(current === e ? "" : e)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-[1.4rem] leading-none transition-transform hover:scale-110 lg:h-9 lg:w-9 lg:text-xl ${current === e ? "bg-crimson/15 ring-2 ring-crimson/40" : ""}`}><Emoji e={e} /></button>
              ))}
              <button type="button" onClick={() => setSwapping(true)} aria-label="Change your quick reactions" title="Change your quick reactions"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rule bg-card text-slate hover:border-crimson/40 hover:text-crimson lg:h-9 lg:w-9">
                <SwapIcon />
              </button>
            </div>
          )}
          <ul>
            {shown.map((i) => (
              <li key={i.label}>
                <button type="button" role="menuitem" onClick={() => { onClose(); i.onClick(); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left font-ui text-[15px] hover:bg-paper lg:py-2 lg:text-sm ${i.danger ? "text-red-700" : "text-ink"}`}>
                  <span aria-hidden="true" className="w-6 text-center text-base">{i.icon}</span>{i.label}
                </button>
              </li>
            ))}
          </ul>
        </>)}
      </div>
    </div>,
    document.body,
  );
}

const SwapIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 7h12l-3.5-3.5" /><path d="M17 17H5l3.5 3.5" />
  </svg>
);

// Swapping your quick reactions: choose a place in your row, then the emoji to put there (from ours, the grid, or typed with your
// keyboard: any emoji works). One already in your row swaps places with it. Saved to your account as you go.
function SwapReactions({ sheet, onDone }: { sheet: boolean; onDone: () => void }) {
  const [quick, save] = useQuickReactions();
  const [slot, setSlot] = useState(0);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  function put(e: string) {
    setError("");
    const next = [...quick];
    const was = next.indexOf(e);
    if (was === slot) return;
    if (was !== -1) next[was] = next[slot]; // already in the row: the two change places
    next[slot] = e;
    save(next).catch((err) => setError(err instanceof Error ? err.message : "Couldn't save that."));
    setSlot((s) => Math.min(s + 1, next.length - 1));
  }
  const isDefault = quick.join() === REACTIONS.join();
  return (
    <div className={sheet ? "px-1" : "px-3 py-1"} role="dialog" aria-label="Change your quick reactions">
      <div className="flex items-center justify-between">
        <p className="font-ui text-sm font-bold text-ink">Your quick reactions</p>
        <button type="button" onClick={onDone} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-sm font-semibold text-white hover:bg-crimson-bright">Done</button>
      </div>
      <p className="mt-1 text-xs text-slate">Choose one to swap, then pick its new emoji.</p>
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-paper px-1.5 py-1.5" role="radiogroup" aria-label="Your quick reactions">
        {quick.map((e, i) => (
          <button key={`${i}${e}`} type="button" role="radio" aria-checked={slot === i} aria-label={`Place ${i + 1}: ${NOTESAPP_EMOJI[e]?.label ?? e}`} onClick={() => setSlot(i)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-[1.4rem] leading-none lg:h-9 lg:w-9 lg:text-xl ${slot === i ? "bg-card ring-2 ring-crimson" : ""}`}><Emoji e={e} /></button>
        ))}
      </div>
      <p className="mt-3 px-1 font-ui text-[11px] font-bold uppercase tracking-wider text-slate">#NotesApp</p>
      <div className="mt-1 flex gap-1">
        {Object.entries(NOTESAPP_EMOJI).map(([code, x]) => (
          <button key={code} type="button" onClick={() => put(code)} aria-label={`Use ${x.label}`} className={`rounded-lg p-1.5 text-2xl leading-none hover:bg-paper ${quick.includes(code) ? "bg-crimson/10" : ""}`}><Emoji e={code} /></button>
        ))}
      </div>
      <div className={`mt-2 grid grid-cols-8 gap-0.5 overflow-y-auto ${sheet ? "max-h-48" : "max-h-40"}`}>
        {EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => put(e)} aria-label={`Use ${e}`} className={`rounded-lg p-1 text-[1.4rem] leading-none hover:bg-paper ${quick.includes(e) ? "bg-crimson/10" : ""}`}>{e}</button>
        ))}
      </div>
      <form className="mt-2 flex items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); const v = typed.trim(); if (isReaction(v)) { put(v); setTyped(""); } else setError("Type one emoji."); }}>
        <input value={typed} onChange={(ev) => setTyped(ev.target.value)} maxLength={16} placeholder="Or type any emoji" aria-label="Type any emoji"
          className="min-w-0 flex-1 rounded-full bg-paper px-4 py-2 text-base outline-none focus:ring-2 focus:ring-crimson/20" />
        <button type="submit" disabled={!typed.trim()} className="rounded-full border border-rule px-4 py-2 font-ui text-sm font-semibold text-ink hover:bg-paper disabled:opacity-40">Use</button>
      </form>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
      {!isDefault && <button type="button" onClick={() => save(null).catch(() => {})} className="mt-2 px-1 text-xs font-semibold text-crimson underline">Back to the usual set</button>}
    </div>
  );
}

// Message info: when it was sent and who has read it. One-to-one: the read time. A group: who has read it (each member's read marker
// has passed it) and who hasn't yet; groups keep no read time per person.
export function MessageInfo({ sent, readAt, readers, notYet, edited, onClose }: { sent: string; readAt?: string; readers?: string[]; notYet?: string[]; edited?: string; onClose: () => void }) {
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  const row = "flex items-start justify-between gap-4 border-b border-rule py-3 text-sm last:border-0";
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Message info" className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Message info</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-paper">×</button>
        </div>
        <div className="mt-2">
          <p className={row}><span className="text-slate">✓ Sent</span><span className="text-right text-ink">{fmt(sent)}</span></p>
          {edited && <p className={row}><span className="text-slate">✏️ Edited</span><span className="text-right text-ink">{fmt(edited)}</span></p>}
          {readers === undefined
            ? <p className={row}><span className="text-slate">✓✓ Read</span><span className="text-right text-ink">{readAt ? fmt(readAt) : "Not read yet"}</span></p>
            : (<>
              <div className={row}><span className="shrink-0 text-slate">✓✓ Read by {readers.length}</span><span className="text-right text-ink">{readers.length ? readers.join(", ") : "No one yet"}</span></div>
              {notYet && notYet.length > 0 && <div className={row}><span className="shrink-0 text-slate">Not yet</span><span className="text-right text-slate">{notYet.join(", ")}</span></div>}
            </>)}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Deleting one message or a selection: for you (any message: it leaves your view of the chat; everyone else still sees it), or for
// everyone (only when they're all yours; ones that have been read wait for the readers to agree).
export function DeleteChoice({ count, everyone, read, onMe, onEveryone, onClose }: { count: number; everyone: boolean; read: boolean; onMe: () => void; onEveryone: () => void; onClose: () => void }) {
  const what = count === 1 ? "this message" : `${count} messages`;
  const btn = "w-full rounded-full px-4 py-3 font-ui text-sm font-semibold";
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Delete ${what}`} className="w-full max-w-sm rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <h2 className="font-display text-2xl text-ink">Delete {what}?</h2>
        <p className="mt-1 text-sm text-slate">
          {everyone
            ? read ? "For everyone: anything already read waits for the readers to agree. For you: it goes from your chat only." : "For everyone, or just from your own chat."
            : count === 1 ? "It goes from your chat only; everyone else still sees it." : "Some of them aren't yours, so they can go from your chat only; everyone else still sees them."}
        </p>
        <div className="mt-4 space-y-2">
          {everyone && <button type="button" onClick={onEveryone} className={`${btn} bg-red-700 text-white hover:bg-red-800`}>Delete for everyone</button>}
          <button type="button" onClick={onMe} className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}>Delete for me</button>
          <button type="button" onClick={onClose} className={`${btn} text-ink hover:bg-paper`}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
