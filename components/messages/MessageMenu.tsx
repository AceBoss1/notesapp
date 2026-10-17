"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { REACTIONS } from "@/lib/messages-rules";

export type MenuItem = { label: string; icon: string; onClick: () => void; danger?: boolean; hidden?: boolean };

// The menu for one message, opened by right-click on a computer, a long press on a phone, or its ⋯ button: the reactions along the top,
// then Reply, Copy, Pin, Message info, Select, Edit, Delete… On a phone it rises from the bottom; on a computer it opens where you
// clicked, kept inside the window.
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
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    box.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const shown = items.filter((i) => !i.hidden);
  const sheet = !at || (typeof window !== "undefined" && window.innerWidth < 1024);
  // Kept inside the window: about 300 px wide and 48 px a row.
  const style = sheet || !at ? undefined : {
    left: Math.max(8, Math.min(at.x - (mine ? 290 : 0), window.innerWidth - 308)),
    top: Math.max(8, Math.min(at.y, window.innerHeight - (shown.length * 44 + 90))),
  };
  return createPortal(
    <div className="fixed inset-0 z-[120]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onTouchStart={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {sheet && <div className="absolute inset-0 bg-ink/30" aria-hidden="true" onClick={onClose} />}
      <div ref={box} role="menu" aria-label="Message actions" style={style}
        className={sheet
          ? "absolute inset-x-0 bottom-0 rounded-t-3xl bg-card px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          : "absolute w-[300px] rounded-2xl border border-rule bg-card py-2 shadow-2xl"}>
        {sheet && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule" aria-hidden="true" />}
        {canReact && (
          <div className={`flex items-center justify-between gap-1 ${sheet ? "mb-2 rounded-2xl bg-paper px-2 py-1.5" : "mx-2 mb-1 border-b border-rule px-1 pb-2"}`} aria-label="React">
            {REACTIONS.map((e) => (
              <button key={e} type="button" role="menuitemradio" aria-checked={current === e} aria-label={`React ${e}`} onClick={() => onReact(current === e ? "" : e)}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform hover:scale-110 ${current === e ? "bg-crimson/15 ring-2 ring-crimson/40" : ""}`}>{e}</button>
            ))}
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
      </div>
    </div>,
    document.body,
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
