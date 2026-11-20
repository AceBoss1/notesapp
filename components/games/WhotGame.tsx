"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import {
  SHAPES, applyMove, canPlay, cardLabel, computerMove, initialState, shapeLabel, topCard,
  type Card, type Shape, type WhotMove, type WhotState,
} from "@/lib/arcade/whot";

const RECORD_KEY = "notes-arcade-whot-record";
const COMPUTER_DELAY = 650;

// Our own drawings of the five Whot shapes (viewBox 0 0 100 100).
function ShapeIcon({ shape, className }: { shape: Shape; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {shape === "circle" && <circle cx="50" cy="50" r="40" />}
      {shape === "triangle" && <polygon points="50,9 93,88 7,88" />}
      {shape === "cross" && <polygon points="37,8 63,8 63,37 92,37 92,63 63,63 63,92 37,92 37,63 8,63 8,37 37,37" />}
      {shape === "square" && <rect x="13" y="13" width="74" height="74" />}
      {shape === "star" && <polygon points="50,6 61.8,38 95,38.6 68.6,59.2 78,92 50,72.6 22,92 31.4,59.2 5,38.6 38.2,38" />}
    </svg>
  );
}

function WhotCard({ card }: { card: Card }) {
  const corner = (flip: boolean) => (
    <span className={`whot-corner${flip ? " is-flip" : ""}`}>
      <b>{card.num}</b>
      {card.shape !== "whot" && <ShapeIcon shape={card.shape} />}
    </span>
  );
  return (
    <span className="whot-face" aria-hidden="true">
      {corner(false)}
      <span className="whot-centre">{card.shape === "whot" ? <span className="whot-word">Whot</span> : <ShapeIcon shape={card.shape} />}</span>
      {corner(true)}
    </span>
  );
}

function CardBack() {
  return <span className="whot-back" aria-hidden="true"><span>WHOT</span></span>;
}

type Record_ = { won: number; lost: number };

export default function WhotGame() {
  const [game, setGame] = useState<WhotState | null>(null);
  const [record, setRecord] = useState<Record_>({ won: 0, lost: 0 });
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(arcadeStore.getItem(RECORD_KEY) ?? "null") as Record_ | null;
      if (saved && typeof saved.won === "number" && typeof saved.lost === "number") setRecord(saved);
    } catch { /* storage blocked: keep a fresh record */ }
  }, []);

  const beep = useCallback((freq: number, dur = 0.09) => {
    if (mutedRef.current || typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!audioRef.current) audioRef.current = new window.AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator(); const vol = ctx.createGain(); const now = ctx.currentTime;
      osc.type = "triangle"; osc.frequency.setValueAtTime(freq, now);
      vol.gain.setValueAtTime(0.0001, now); vol.gain.exponentialRampToValueAtTime(0.04, now + 0.01); vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(vol); vol.connect(ctx.destination); osc.start(now); osc.stop(now + dur);
    } catch { /* no audio, no problem */ }
  }, []);

  const commit = useCallback((next: WhotState, sound: number) => {
    setGame(next);
    if (next.phase !== "over") { beep(sound); return; }
    beep(next.winner === 0 ? 880 : 196, 0.3);
    setRecord((r) => {
      const updated = next.winner === 0 ? { ...r, won: r.won + 1 } : { ...r, lost: r.lost + 1 };
      try { arcadeStore.setItem(RECORD_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, [beep]);

  const move = (m: WhotMove) => {
    if (!game || game.phase === "over" || game.turn !== 0) return;
    commit(applyMove(game, m), m.type === "draw" ? 330 : 520);
  };

  const deal = () => {
    // Take turns to start: if you won the last game, the computer goes first.
    setGame(initialState(Math.random, game?.winner === 0 ? 1 : 0));
  };

  // The computer's turn, with a short pause so you can follow it.
  useEffect(() => {
    if (!game || game.phase === "over" || game.turn !== 1) return;
    const t = window.setTimeout(() => commit(applyMove(game, computerMove(game)), 440), COMPUTER_DELAY);
    return () => window.clearTimeout(t);
  }, [game, commit]);

  const toggleSound = () => { setMuted((m) => { mutedRef.current = !m; return !m; }); };

  const myTurn = !!game && game.turn === 0 && game.phase === "play";
  const choosing = !!game && game.turn === 0 && game.phase === "choose";
  const top = game ? topCard(game) : null;
  const mine = game?.hands[0] ?? [];
  const theirs = game?.hands[1] ?? [];

  let status = "Deal to start.";
  if (game) {
    if (game.phase === "over") status = game.log;
    else if (game.turn === 1) status = game.phase === "choose" ? "Computer is choosing a shape…" : "Computer is thinking…";
    else if (choosing) status = "Whot! Pick the shape you want.";
    else if (game.pending) status = `${game.log}. Play a ${game.pending.num} to pass it on, or go to market.`;
    else if (game.wanted) status = `Computer wants ${game.wanted}s. Your turn.`;
    else if (game.log && game.log !== "Your turn" && game.log !== "Computer starts") status = `${game.log}. Your turn.`;
    else status = "Your turn: match the shape or number.";
  }
  const anyPlayable = myTurn && mine.some((c) => canPlay(game as WhotState, c));
  const marketLabel = game?.pending ? `Pick ${game.pending.count}` : "Go to market";

  return (
    <ArcadeShell game={arcadeGame("whot")} index={3}>
      <div className="arc-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOUR CARDS</span><strong>{mine.length}</strong></div>
          <div className="arc-stat"><span className="arc-label">COMPUTER</span><strong>{theirs.length}</strong></div>
          <div className="arc-stat"><span className="arc-label">WON · LOST</span><strong>{record.won} · {record.lost}</strong></div>
          <span className="arc-spacer" />
          <button type="button" className="arc-btn-ghost" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <button type="button" className="arc-btn" onClick={deal} aria-label="Start a new game">NEW GAME</button>
        </div>

        <div className="arc-board-wrap whot-board">
          <div className="whot-opp" aria-label={`Computer has ${theirs.length} card${theirs.length === 1 ? "" : "s"}`}>
            <div className="whot-fan">{theirs.map((_, i) => <span key={i} className="whot-mini"><CardBack /></span>)}</div>
            <span className="whot-tag">COMPUTER{theirs.length === 1 && game?.phase !== "over" ? <em> · LAST CARD!</em> : null}</span>
          </div>

          <div className="whot-table">
            <button
              type="button"
              className={`whot-market${myTurn ? " is-live" : ""}${myTurn && !anyPlayable ? " is-hint" : ""}`}
              onClick={() => myTurn && move({ type: "draw" })}
              disabled={!myTurn}
              aria-label={`${marketLabel}. ${game?.market.length ?? 0} cards in the market`}
            >
              <span className="whot-card"><CardBack /></span>
              <span className="whot-under">{myTurn ? marketLabel.toUpperCase() : "MARKET"} · {game?.market.length ?? 0}</span>
            </button>
            <div className="whot-pile" aria-live="polite" aria-label={top ? `Top of the pile: ${cardLabel(top)}${game?.wanted ? `, ${game.wanted}s wanted` : ""}` : "Empty pile"}>
              {top && <span className="whot-card is-top" key={game?.pile.length}><WhotCard card={top} /></span>}
              <span className="whot-under">
                {game?.wanted ? <>WANTED <ShapeIcon shape={game.wanted} className="whot-chip" /> {game.wanted.toUpperCase()}</> :
                  game?.pending ? `PICK ${game.pending.count} WAITING` : "PILE"}
              </span>
            </div>
          </div>

          <div className="whot-mine">
            <span className="whot-tag">YOU{mine.length === 1 && game?.phase !== "over" ? <em> · LAST CARD!</em> : null}</span>
            <div className="whot-hand" role="group" aria-label="Your hand">
              {mine.map((card, i) => {
                const ok = myTurn && canPlay(game as WhotState, card);
                return (
                  <button
                    key={`${card.shape}-${card.num}-${i}`}
                    type="button"
                    className={`whot-card is-hand${ok ? " is-ok" : ""}`}
                    disabled={!ok}
                    onClick={() => move({ type: "play", index: i })}
                    aria-label={`Play ${cardLabel(card)}${ok ? "" : " (can't play this now)"}`}
                  >
                    <WhotCard card={card} />
                  </button>
                );
              })}
            </div>
          </div>

          {choosing && (
            <div className="whot-picker" role="dialog" aria-label="Ask for a shape">
              <p>ASK FOR A SHAPE</p>
              <div>
                {SHAPES.map((sh) => (
                  <button key={sh} type="button" className="whot-shape-btn" onClick={() => move({ type: "call", shape: sh })} aria-label={`Ask for ${sh}s`}>
                    <ShapeIcon shape={sh} /><span>{shapeLabel(sh)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(!game || game.phase === "over") && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{!game ? "READY WHEN YOU ARE" : game.winner === 0 ? "CHECK UP!" : "UNLUCKY"}</p>
              <h2>{!game ? "Let's play Whot." : game.winner === 0 ? "You win." : "Computer wins."}</h2>
              <p>{!game ? "Five cards each. Match shape or number." : game.log}</p>
              <button type="button" className="arc-btn" onClick={deal} aria-label={game ? "Play again" : "Deal the cards"}>{game ? "PLAY AGAIN" : "DEAL"}</button>
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
      </div>

      <style jsx global>{`
        .whot-board { --whot-red:#c8323f; --whot-cream:#fbf4e6; display:flex; flex-direction:column; gap:14px; min-height:460px; padding:14px 12px 16px; background:radial-gradient(circle at 50% 45%,#24382e,#1b2a23 70%); }
        .whot-tag { color:#b6c4b9; font:600 9px ui-monospace,monospace; letter-spacing:.12em; }.whot-tag em { color:#ff816d; font-style:normal; }
        .whot-opp { display:flex; flex-direction:column; align-items:center; gap:8px; }
        .whot-fan { display:flex; justify-content:center; min-height:46px; padding-left:18px; }
        .whot-mini { position:relative; width:33px; aspect-ratio:5/7; margin-left:-18px; border-radius:5px; box-shadow:0 2px 6px #0005; overflow:hidden; }
        .whot-mini .whot-back span { display:none; }
        .whot-table { flex:1; display:flex; align-items:center; justify-content:center; gap:clamp(18px,7vw,48px); padding:6px 0; }
        .whot-market,.whot-pile { display:flex; flex-direction:column; align-items:center; gap:8px; padding:0; border:0; background:none; color:inherit; font:inherit; }
        .whot-market { cursor:default; border-radius:10px; }.whot-market.is-live { cursor:pointer; }
        .whot-market.is-live .whot-card { transition:transform .15s; }.whot-market.is-live:hover .whot-card { transform:translateY(-3px); }
        .whot-market.is-hint .whot-card { box-shadow:0 0 0 3px #bdf36b,0 6px 16px #0006; }
        .whot-market:focus-visible { outline:2px solid #bdf36b; outline-offset:4px; }
        .whot-under { display:flex; align-items:center; gap:5px; color:#c1cbc3; font:600 9px ui-monospace,monospace; letter-spacing:.1em; white-space:nowrap; }
        .whot-chip { width:12px; height:12px; fill:#ff816d; }
        .whot-table .whot-card { --cw:clamp(66px,21vw,94px); }
        .whot-card { --cw:clamp(50px,15.5vw,70px); position:relative; display:block; width:var(--cw); aspect-ratio:5/7; padding:0; border:0; border-radius:calc(var(--cw)*.1); background:none; box-shadow:0 4px 12px #0005; font-size:calc(var(--cw)*.2); }
        .whot-card.is-top { animation:whot-in .25s ease-out; }
        @keyframes whot-in { from { transform:translateY(-14px) scale(.94); opacity:.4; } to { transform:none; opacity:1; } }
        .whot-face,.whot-back { position:absolute; inset:0; display:block; border-radius:inherit; overflow:hidden; }
        .whot-face { background:var(--whot-cream); border:1px solid #e9dcc2; color:var(--whot-red); fill:var(--whot-red); }
        .whot-corner { position:absolute; top:5%; left:7%; display:flex; flex-direction:column; align-items:center; line-height:1; }
        .whot-corner b { font:700 1em Georgia,serif; }.whot-corner svg { width:.72em; height:.72em; margin-top:.12em; }
        .whot-corner.is-flip { top:auto; left:auto; bottom:5%; right:7%; transform:rotate(180deg); }
        .whot-centre { position:absolute; inset:24% 18%; display:flex; align-items:center; justify-content:center; }
        .whot-centre svg { width:100%; height:100%; }
        .whot-word { font:italic 700 1.15em Georgia,serif; letter-spacing:-.02em; transform:rotate(-24deg); }
        .whot-back { background:repeating-linear-gradient(45deg,#b02a37 0 6px,#c8323f 6px 12px); border:2px solid var(--whot-cream); }
        .whot-back span { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--whot-cream); font:italic 700 9px Georgia,serif; letter-spacing:.06em; transform:rotate(-30deg); }
        .whot-mine { display:flex; flex-direction:column; align-items:center; gap:10px; }
        .whot-hand { display:flex; flex-wrap:wrap; justify-content:center; gap:7px; min-height:80px; }
        .whot-card.is-hand { cursor:default; opacity:.5; transition:transform .15s,opacity .15s; touch-action:manipulation; }
        .whot-card.is-hand.is-ok { cursor:pointer; opacity:1; }
        .whot-card.is-hand.is-ok:hover { transform:translateY(-6px); }
        .whot-card.is-hand:focus-visible,.whot-shape-btn:focus-visible { outline:2px solid #bdf36b; outline-offset:3px; }
        .whot-picker { position:absolute; left:50%; top:50%; z-index:4; transform:translate(-50%,-50%); width:min(330px,92%); padding:14px; border-radius:12px; background:#f7f7f2; box-shadow:0 18px 40px #0008; text-align:center; }
        .whot-picker p { margin:0 0 10px; color:#17251f; font:700 9px ui-monospace,monospace; letter-spacing:.14em; }
        .whot-picker>div { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
        .whot-shape-btn { display:flex; flex-direction:column; align-items:center; gap:5px; padding:9px 2px 7px; border:1px solid #e3e6df; border-radius:8px; background:#fff; color:#17251f; font:600 8px ui-monospace,monospace; letter-spacing:.04em; cursor:pointer; }
        .whot-shape-btn svg { width:26px; height:26px; fill:#c8323f; }.whot-shape-btn:hover { background:#eef3e6; }
        @media(max-width:420px) { .whot-board { min-height:420px; padding:12px 8px 14px; }.whot-hand { gap:5px; } }
        @media(prefers-reduced-motion:reduce) { .whot-card.is-top { animation:none; }.whot-card.is-hand,.whot-market.is-live .whot-card { transition:none; } }
      `}</style>
    </ArcadeShell>
  );
}
