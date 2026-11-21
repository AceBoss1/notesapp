"use client";

// Nana's strip under a game board (owner, 21 Nov 2026): free hints and a running take on the opponent's moves, worked out by the game's
// own engine in the browser (lib/arcade/nana.ts says why that keeps it free, and when she's allowed). The game supplies `onAsk` (what
// Nana would play, and it highlights that move itself) and `take` (her comment on the last move); this component only shows them,
// keeps the on/off choice per game, and counts the hints used this game.
import Image from "next/image";
import { useEffect, useState } from "react";
import { arcadeStore } from "@/lib/arcade/store";
import { nanaAvailability, nanaKey, type NanaContext, type NanaTake, type NanaTip } from "@/lib/arcade/nana";

type Props = {
  slug: string;
  context?: NanaContext;
  /** True when a hint makes sense now (usually: it's the player's turn). */
  canAsk: boolean;
  /** What Nana would play now, or null when there's nothing to suggest. The game highlights the move. */
  onAsk: () => NanaTip | null;
  /** Nana's comment on the latest move (usually the computer's). */
  take?: NanaTake | null;
  /** Change it to start afresh: a new game clears the bubble and the hint count. */
  resetKey?: unknown;
  /** Told when the player switches Nana on or off, so the game can clear a highlighted hint. */
  onToggle?: (on: boolean) => void;
};

export function useNanaOn(slug: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try { if (arcadeStore.getItem(nanaKey(slug)) === "off") setOn(false); } catch { /* storage blocked: Nana stays on */ }
  }, [slug]);
  const set = (v: boolean) => {
    setOn(v);
    try { arcadeStore.setItem(nanaKey(slug), v ? "on" : "off"); } catch { /* ignore */ }
  };
  return [on, set];
}

export default function ArcadeNana({ slug, context = { mode: "practice" }, canAsk, onAsk, take, resetKey, onToggle }: Props) {
  const [on, setOn] = useNanaOn(slug);
  const [tip, setTip] = useState<NanaTip | null>(null);
  const [empty, setEmpty] = useState(false);
  const [hints, setHints] = useState(0);
  const allowed = nanaAvailability(context);

  useEffect(() => { setTip(null); setEmpty(false); setHints(0); }, [resetKey]);
  useEffect(() => { if (!canAsk) { setTip(null); setEmpty(false); } }, [canAsk]);

  if (!allowed.available) {
    return (
      <div className="arc-nana is-off" role="note">
        <Image src="/images/nana/nana-sm.webp" alt="" width={36} height={36} className="arc-nana-face" />
        <p className="arc-nana-text">{allowed.reason}</p>
      </div>
    );
  }

  const ask = () => {
    const t = onAsk();
    setTip(t);
    setEmpty(!t);
    if (t) setHints((h) => h + 1);
  };
  const toggle = () => {
    const next = !on;
    setOn(next);
    if (!next) { setTip(null); setEmpty(false); }
    onToggle?.(next);
  };

  let body: React.ReactNode;
  if (!on) body = <span className="arc-nana-muted">Nana is off for this game. Switch her on for free hints and her take on each move.</span>;
  else if (tip) body = <><strong>My pick: {tip.move}.</strong> {tip.why}</>;
  else if (empty) body = <span className="arc-nana-muted">Nothing to suggest right now.</span>;
  else if (take) body = <span className={`arc-nana-take is-${take.tone}`}>{take.text}</span>;
  else body = <span className="arc-nana-muted">{canAsk ? "Stuck? Tap HINT and I'll show you what I'd play." : "I'm watching the board. I'll tell you what I make of each move."}</span>;

  return (
    <div className={`arc-nana${on ? "" : " is-off"}`}>
      <Image src="/images/nana/nana-sm.webp" alt="" width={36} height={36} className="arc-nana-face" />
      <div className="arc-nana-main">
        <p className="arc-nana-kicker">NANA · FREE{on && hints > 0 ? ` · ${hints} HINT${hints === 1 ? "" : "S"} THIS GAME` : ""}</p>
        <p className="arc-nana-text" role="status" aria-live="polite">{body}</p>
      </div>
      <div className="arc-nana-actions">
        {on && <button type="button" className="arc-btn-ghost" onClick={ask} disabled={!canAsk} aria-label="Ask Nana for a hint">HINT</button>}
        <button type="button" className="arc-btn-ghost" onClick={toggle} aria-pressed={on} aria-label={on ? "Switch Nana off for this game" : "Switch Nana on for this game"}>{on ? "NANA ON" : "NANA OFF"}</button>
      </div>
      <style jsx global>{`
        .arc-nana { display:flex; align-items:center; gap:12px; margin-top:12px; padding:10px 12px; border:1px solid #c1e99333; border-radius:14px; background:#1b2a23; color:#e8f3dc; }
        .arc-nana.is-off { opacity:.85; }
        .arc-nana-face { flex:none; width:36px; height:36px; border-radius:999px; background:#f6efe6; object-fit:cover; }
        .arc-nana-main { flex:1; min-width:0; }
        .arc-nana-kicker { margin:0; font:600 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.12em; color:#9bd34d; }
        .arc-nana-text { margin:2px 0 0; font-size:14px; line-height:1.45; }
        .arc-nana-text strong { color:#bdf36b; }
        .arc-nana-muted { color:#e8f3dcb3; }
        .arc-nana-take.is-good { color:#d6f7b0; }
        .arc-nana-take.is-risky { color:#ffc2b5; }
        .arc-nana-actions { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
        .arc-nana-actions button:disabled { opacity:.45; cursor:default; }
        @media(max-width:560px) { .arc-nana { flex-wrap:wrap; } .arc-nana-actions { width:100%; justify-content:flex-start; } }
      `}</style>
    </div>
  );
}
