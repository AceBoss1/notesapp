"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import ArcadeNana from "@/components/games/ArcadeNana";
import ArcadeShell from "@/components/games/ArcadeShell";
import { ENTRY } from "@/lib/arcade/achi.entry";
import { arcadeStore } from "@/lib/arcade/store";
import { LINES, MOVE_CAP, PIECES, applyMove, chooseMove, initialState, legalMoves, phaseOf, piecesOf, targetsFrom, type AchiState, type Level, type Move, type Player } from "@/lib/arcade/achi";
import type { NanaTake } from "@/lib/arcade/nana";
import { achiTake, achiTip, type AchiHighlight } from "@/lib/arcade/nana-achi";

type Phase = "ready" | "playing" | "over";
type Piece = { id: number; player: Player; at: number };

const THINK_MS = 550;
const WINS_KEY = "arcade-achi-wins";
// Point coordinates in the SVG (viewBox 0 0 300 300), row by row like the logic's numbering.
const STEP = [42, 150, 258];
const XY = Array.from({ length: 9 }, (_, i) => ({ x: STEP[i % 3], y: STEP[Math.floor(i / 3)] }));
const NAMES = ["top left", "top middle", "top right", "left middle", "centre", "right middle", "bottom left", "bottom middle", "bottom right"];
const YOU = "#9bd34d";
const CPU = "#ff816d";

const other = (p: Player): Player => (p === 0 ? 1 : 0);

function endText(s: AchiState): string {
  if (s.winner === "draw") return s.endReason === "repetition" ? "A draw: the same position came up three times." : `A draw: ${MOVE_CAP} turns and no line.`;
  if (s.endReason === "stuck") return s.winner === 0 ? "The computer can't move, so you win." : "You can't move, so the computer wins.";
  return s.winner === 0 ? "Three in a line. You win!" : "The computer filled a line.";
}

function turnText(s: AchiState, selected: number | null): string {
  if (s.turn === 1) return "Computer is thinking…";
  if (phaseOf(s.board, 0) === "placing") {
    const left = PIECES - piecesOf(s.board, 0);
    return `Place a piece (${left} left)`;
  }
  return selected === null ? "Move a piece along a line" : "Now tap a highlighted point";
}

export default function AchiGame() {
  const [game, setGame] = useState<AchiState>(() => initialState(0));
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState<Level>("medium");
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null); // a one-off hint that replaces the status until the next move
  const [wins, setWins] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nextFirst, setNextFirst] = useState<Player>(0); // the loser starts the next game; a draw passes it over
  // Nana (owner, 21 Nov 2026): a free hint lit up on the board, and her take on the computer's last move, both from the engine.
  const [hint, setHint] = useState<AchiHighlight | null>(null);
  const [take, setTake] = useState<NanaTake | null>(null);
  const [gameNo, setGameNo] = useState(0);
  const nextId = useRef(1);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    try { setWins(Number(arcadeStore.getItem(WINS_KEY)) || 0); } catch { /* storage blocked: start from 0 */ }
  }, []);
  useEffect(() => () => { void audioRef.current?.close(); }, []);

  // One note: frequency glide from f0 to f1, a soft attack and a quick fade.
  const tone = useCallback((f0: number, f1: number, dur: number, at = 0, type: OscillatorType = "sine", vol = 0.05) => {
    if (mutedRef.current || typeof window === "undefined" || !window.AudioContext) return;
    if (!audioRef.current) audioRef.current = new window.AudioContext();
    const ctx = audioRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + at;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }, []);
  const sound = useCallback((kind: "place" | "move" | "win" | "lose" | "draw") => {
    if (kind === "place") tone(880, 520, 0.07, 0, "triangle", 0.06);
    else if (kind === "move") tone(300, 480, 0.16, 0, "sine", 0.045);
    else if (kind === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, i * 0.09, "triangle", 0.05));
    else if (kind === "lose") tone(220, 140, 0.45, 0, "sine", 0.06);
    else [440, 392].forEach((f, i) => tone(f, f, 0.2, i * 0.14, "sine", 0.04));
  }, [tone]);

  const play = useCallback((state: AchiState, m: Move) => {
    const mover = state.turn;
    const next = applyMove(state, m);
    setGame(next);
    setSelected(null);
    setNote(null);
    setHint(null); // any move, yours or the computer's, makes an old hint stale
    if (mover === 1) setTake(achiTake(state, m, next));
    setPieces((ps) => m.kind === "place"
      ? [...ps, { id: nextId.current++, player: mover, at: m.to }]
      : ps.map((p) => (p.at === m.from ? { ...p, at: m.to } : p)));
    if (next.winner === null) { sound(m.kind === "place" ? "place" : "move"); return; }
    setPhase("over");
    setNextFirst(next.winner === 0 ? 1 : next.winner === 1 ? 0 : other(state.startedBy));
    if (next.winner === 0) {
      sound("win");
      setWins((w) => {
        try { arcadeStore.setItem(WINS_KEY, String(w + 1)); } catch { /* ignore */ }
        return w + 1;
      });
    } else sound(next.winner === 1 ? "lose" : "draw");
  }, [sound]);

  // The computer's turn, after a short pause so you can see what it does.
  useEffect(() => {
    if (phase !== "playing" || game.winner !== null || game.turn !== 1) return;
    const t = window.setTimeout(() => play(game, chooseMove(game, level)), THINK_MS);
    return () => window.clearTimeout(t);
  }, [game, level, phase, play]);

  const start = () => {
    setGame(initialState(nextFirst));
    setPieces([]);
    setSelected(null);
    setNote(nextFirst === 1 ? "The computer starts this game." : null);
    setPhase("playing");
    setHint(null);
    setTake(null);
    setGameNo((n) => n + 1);
  };

  const myTurn = phase === "playing" && game.winner === null && game.turn === 0;
  const placing = phaseOf(game.board, 0) === "placing";
  const legal = myTurn ? legalMoves(game) : [];
  const targets = myTurn && !placing && selected !== null ? targetsFrom(game, selected) : [];
  const movable = new Set(legal.flatMap((m) => (m.kind === "move" ? [m.from] : [])));

  // Nana's hint: the move HARD would play for you, lit up in gold on the board until you move.
  const askNana = () => {
    const t = myTurn ? achiTip(game) : null;
    setHint(t?.highlight ?? null);
    return t?.tip ?? null;
  };
  const shownHint = myTurn ? hint : null;

  const tap = (i: number) => {
    if (!myTurn) return;
    if (placing) {
      if (game.board[i] === null) play(game, { kind: "place", to: i });
      return;
    }
    if (selected !== null && targets.includes(i)) { play(game, { kind: "move", from: selected, to: i }); return; }
    if (game.board[i] === 0) {
      if (movable.has(i)) { setSelected(i); setNote(null); } else { setSelected(null); setNote("That piece has nowhere to go. Try another."); }
      return;
    }
    setSelected(null);
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(i); }
    if (e.key === "Escape") setSelected(null);
  };

  const pointLabel = (i: number) => {
    const c = game.board[i];
    const what = c === 0 ? "your piece" : c === 1 ? "computer's piece" : "empty";
    let act = "";
    if (myTurn && placing && c === null) act = ", place here";
    else if (myTurn && targets.includes(i)) act = ", move here";
    else if (myTurn && !placing && c === 0) act = selected === i ? ", selected" : movable.has(i) ? ", tap to move" : ", can't move";
    return `${NAMES[i]}, ${what}${act}`;
  };

  const status = phase === "ready" ? "Press start to play."
    : phase === "over" ? endText(game)
    : note ? `${note} ${turnText(game, selected)}` : turnText(game, selected);
  const toPlace = (p: Player) => PIECES - piecesOf(game.board, p);
  const lastTo = game.last && game.turn === 0 && phase === "playing" ? game.last.to : null;
  const winColour = game.winner === 0 ? "#bdf36b" : CPU;

  return (
    <ArcadeShell game={ENTRY}>
      <div className="arc-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOU · TO PLACE</span><strong>{toPlace(0)}</strong></div>
          <div className="arc-stat"><span className="arc-label">COMPUTER · TO PLACE</span><strong>{toPlace(1)}</strong></div>
          <div className="arc-stat"><span className="arc-label">WINS</span><strong>{wins}</strong></div>
          <span className="arc-spacer" />
          <select className="arc-select" aria-label="Computer level" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            <option value="easy">EASY</option>
            <option value="medium">MEDIUM</option>
            <option value="hard">HARD</option>
          </select>
          <button type="button" className="arc-btn-ghost" aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}
            onClick={() => setMuted((m) => { mutedRef.current = !m; return !m; })}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <button type="button" className="arc-btn-ghost" onClick={start} aria-label="New game">NEW GAME</button>
        </div>

        <div className="arc-board-wrap achi-wrap">
          <svg className="achi-board" viewBox="0 0 300 300" role="group" aria-label="Achi board: nine points joined by eight lines: the four outside edges, the middle row and column, and the two diagonals. Your pieces are green, the computer's are coral.">
            <g className="achi-lines" aria-hidden="true">
              {LINES.map((l) => <line key={l.join("")} x1={XY[l[0]].x} y1={XY[l[0]].y} x2={XY[l[2]].x} y2={XY[l[2]].y} />)}
            </g>
            {game.winLine && (
              <line className="achi-winline" aria-hidden="true" stroke={winColour}
                x1={XY[game.winLine[0]].x} y1={XY[game.winLine[0]].y} x2={XY[game.winLine[2]].x} y2={XY[game.winLine[2]].y} />
            )}
            {XY.map((p, i) => <circle key={`dot${i}`} className="achi-dot" cx={p.x} cy={p.y} r={7} aria-hidden="true" />)}
            {XY.map((p, i) => (targets.includes(i) || (myTurn && placing && game.board[i] === null)) && (
              <circle key={`t${i}`} className={`achi-target${placing ? " is-place" : ""}`} cx={p.x} cy={p.y} r={placing ? 16 : 20} aria-hidden="true" />
            ))}
            {lastTo !== null && <circle className="achi-last" cx={XY[lastTo].x} cy={XY[lastTo].y} r={30} aria-hidden="true" />}
            {shownHint && [shownHint.from, shownHint.to].map((pt, k) => pt !== null && (
              <circle key={`nana${k}`} className={`achi-nana${k === 1 && shownHint.from !== null ? " is-dest" : ""}`} cx={XY[pt].x} cy={XY[pt].y} r={33} aria-hidden="true" />
            ))}
            {pieces.map((pc) => (
              <g key={pc.id} className="achi-piece" style={{ transform: `translate(${XY[pc.at].x}px, ${XY[pc.at].y}px)` }} aria-hidden="true">
                <circle r={24} fill={pc.player === 0 ? YOU : CPU} className={selected === pc.at ? "is-selected" : undefined} />
                <circle r={13} fill="none" stroke="#17251f" strokeOpacity={0.18} strokeWidth={2} />
              </g>
            ))}
            {XY.map((p, i) => (
              <circle key={`hit${i}`} className="achi-hit" cx={p.x} cy={p.y} r={44} role="button" tabIndex={myTurn ? 0 : -1}
                aria-label={pointLabel(i)} aria-disabled={!myTurn} onClick={() => tap(i)} onKeyDown={(e) => onKey(e, i)} />
            ))}
          </svg>
          {phase !== "playing" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{phase === "over" ? "GAME OVER" : "THREE PIECES EACH · EIGHT LINES"}</p>
              <h2>{phase === "ready" ? "Three in a line." : game.winner === 0 ? "You win." : game.winner === 1 ? "Computer wins." : "A draw."}</h2>
              <p>{phase === "ready"
                ? "Place your three, then slide them along the lines. Fill any line to win."
                : `${endText(game)} ${nextFirst === 0 ? "You start the next game." : "The computer starts the next game."}`}</p>
              <button type="button" className="arc-btn" onClick={start} aria-label={phase === "over" ? "Play again" : "Start game"}>{phase === "over" ? "PLAY AGAIN" : "START GAME"}</button>
            </div>
          )}
        </div>
        <p className="arc-status" role="status" aria-live="polite">{status}</p>
        <ArcadeNana slug="achi" canAsk={myTurn} onAsk={askNana} take={take} resetKey={gameNo} onToggle={() => setHint(null)} />
      </div>

      <style jsx global>{`
        .achi-wrap { display:flex; justify-content:center; background:radial-gradient(120% 90% at 50% 0%,#24372d 0%,#1b2a23 70%); }
        .achi-board { display:block; width:min(100%,460px); height:auto; aspect-ratio:1; padding:clamp(6px,2vw,14px); touch-action:manipulation; user-select:none; -webkit-tap-highlight-color:transparent; }
        .achi-lines line { stroke:#c1e993; stroke-opacity:.42; stroke-width:4; stroke-linecap:round; }
        .achi-winline { stroke-width:9; stroke-linecap:round; stroke-opacity:.9; filter:drop-shadow(0 0 6px #bdf36b88); }
        .achi-dot { fill:#2c4136; stroke:#c1e993; stroke-opacity:.55; stroke-width:2; }
        .achi-target { fill:#bdf36b22; stroke:#bdf36b; stroke-width:2.5; stroke-dasharray:5 4; pointer-events:none; }
        .achi-target.is-place { fill:#bdf36b10; stroke-opacity:.45; }
        .achi-last { fill:none; stroke:#ff816d; stroke-opacity:.55; stroke-width:2; pointer-events:none; }
        .achi-piece { transition:transform .22s ease-out; pointer-events:none; }
        .achi-piece circle:first-child { stroke:#0d1712; stroke-opacity:.35; stroke-width:2; filter:drop-shadow(0 3px 3px #0007); }
        .achi-piece circle.is-selected { stroke:#fff; stroke-opacity:1; stroke-width:4; }
        .achi-hit { fill:transparent; cursor:pointer; outline:none; }
        .achi-hit[aria-disabled="true"] { cursor:default; }
        .achi-hit:focus-visible { stroke:#bdf36b; stroke-width:3; stroke-dasharray:4 4; }
        @media(hover:hover) { .achi-hit:not([aria-disabled="true"]):hover { fill:#ffffff0d; } }
        /* Nana's hint: a gold ring on the piece to move (or the point to place on) and a dashed one where it goes. */
        .achi-nana { fill:#ffd16614; stroke:#ffd166; stroke-width:3.5; pointer-events:none; filter:drop-shadow(0 0 6px #ffd166aa); animation:achi-nana 1.4s ease-in-out infinite; }
        .achi-nana.is-dest { stroke-dasharray:6 5; }
        @keyframes achi-nana { 50% { stroke-opacity:.45; } }
        @media(prefers-reduced-motion:reduce) { .achi-piece { transition:none; } .achi-nana { animation:none; } }
      `}</style>
    </ArcadeShell>
  );
}
