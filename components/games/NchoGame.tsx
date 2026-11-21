"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { ARCADE_GAMES, arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import { applyMove, chooseMove, initialState, legalMoves, type HolesPerSide, type Level, type NchoState, type NchoVariant, type Player } from "@/lib/arcade/ncho";

type Phase = "ready" | "playing" | "over";
type View = { pits: number[]; stores: [number, number]; active: number | null; taken: number[] };

const STEP_MS = 110; // one seed per step: quick, but you can follow it
const LONG_STEP_MS = 80; // the 12-hole board has longer sowings
const THINK_MS = 550;
// Each variant keeps its own win count.
const WINS_KEYS: Record<NchoVariant, string> = { ncho: "arcade-ncho-wins", akahausa: "arcade-akahausa-wins" };
const SEED_COLOURS = ["#f0c27b", "#e2a05f", "#f6dca8", "#d4834f"];

const viewOf = (s: NchoState): View => ({ pits: s.pits.slice(), stores: [s.stores[0], s.stores[1]], active: null, taken: [] });
const other = (p: Player): Player => (p === 0 ? 1 : 0);
// Top row: the computer's holes, right to left (n..2n-1 drawn from 2n-1 down). Bottom row: yours, left to right.
const rowsFor = (n: number) => ({
  top: Array.from({ length: n }, (_, i) => 2 * n - 1 - i),
  bottom: Array.from({ length: n }, (_, i) => i),
});

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function Seeds({ n, max = 14 }: { n: number; max?: number }) {
  const shown = Math.min(n, max);
  return (
    <span className="ncho-seeds" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => <i key={i} style={{ background: SEED_COLOURS[i % SEED_COLOURS.length] }} />)}
    </span>
  );
}

// Status line for a move that didn't end the game.
function moveStatus(next: NchoState): string {
  const m = next.last!;
  const you = m.player === 0;
  if (m.amount > 0) {
    const extra = m.captured.length > 1 ? ` (${m.captured.length} holes in a chain)` : "";
    return you ? `You made 4 in their hole: captured ${m.amount}${extra}.` : `Computer captured ${m.amount}${extra}.`;
  }
  const then = next.turn === 0 ? " Your turn." : "";
  if (m.onTheirSide) return `${you ? "Made" : "Computer made"} ${m.made}: no capture.${then}`;
  return `${you ? "Ended on your side" : "Computer ended on its side"}: no capture.${then}`;
}

// variant "akahausa" is Aka-Hausa: exactly the same game sown clockwise, with a computer that looks one move further ahead
// (lib/arcade/ncho.ts has the rules). The board can be 6 holes a side (standard) or 12 (Nchokoroto), with or without
// the village chain capture. Whoever lost the last game starts the next one (a draw alternates).
export default function NchoGame({ variant = "ncho" }: { variant?: NchoVariant }) {
  const clockwise = variant === "akahausa";
  const slug = clockwise ? "akahausa" : "ncho";
  const WINS_KEY = WINS_KEYS[variant];
  const [holesPerSide, setHolesPerSide] = useState<HolesPerSide>(6);
  const [chain, setChain] = useState(false);
  const [game, setGame] = useState<NchoState>(() => initialState(undefined, 0, variant));
  const [view, setView] = useState<View>(() => viewOf(initialState(undefined, 0, variant)));
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState<Level>("medium");
  const [busy, setBusy] = useState(false); // sowing animation running
  const [status, setStatus] = useState("Press start to play.");
  const [wins, setWins] = useState(0);
  const [muted, setMuted] = useState(false);
  // Who starts the next game: the loser of the last one (a draw passes it to the other player). You start the first.
  const [nextFirst, setNextFirst] = useState<Player>(0);
  const startedBy = useRef<Player>(0);
  const timers = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const long = game.holesPerSide === 12;

  useEffect(() => {
    try { setWins(Number(arcadeStore.getItem(WINS_KEY)) || 0); } catch { /* storage blocked: start from 0 */ }
  }, [WINS_KEY]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);

  const beep = useCallback((freq: number, dur: number) => {
    if (mutedRef.current || typeof window === "undefined" || !window.AudioContext) return;
    if (!audioRef.current) audioRef.current = new window.AudioContext();
    const ctx = audioRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    vol.gain.setValueAtTime(0.0001, now);
    vol.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(vol); vol.connect(ctx.destination);
    osc.start(now); osc.stop(now + dur);
  }, []);

  const finishMove = useCallback((next: NchoState) => {
    const m = next.last!;
    setGame(next);
    setView(viewOf(next));
    setBusy(false);
    if (m.amount > 0) beep(660, 0.14);
    if (next.over) {
      setPhase("over");
      const [a, b] = next.stores;
      const lead = next.winner === 0 ? `You win, ${a} to ${b}.` : next.winner === 1 ? `Computer wins, ${b} to ${a}.` : `A draw, ${a} each.`;
      const why = next.endReason === "stalled" ? " No captures for a long time, so the houses are counted." : "";
      setStatus(`${m.amount > 0 ? `${moveStatus(next)} ` : ""}${lead}${why}`);
      setNextFirst(next.winner === 0 ? 1 : next.winner === 1 ? 0 : other(startedBy.current));
      if (next.winner === 0) {
        setWins((w) => {
          try { arcadeStore.setItem(WINS_KEY, String(w + 1)); } catch { /* ignore */ }
          return w + 1;
        });
      }
      return;
    }
    setStatus(next.turn === 1 && m.amount === 0 ? `${moveStatus(next)} Computer is thinking…` : moveStatus(next));
  }, [WINS_KEY, beep]);

  // Sow hole by hole so you can see where the seeds go, then show the capture.
  const play = useCallback((state: NchoState, hole: number) => {
    const next = applyMove(state, hole);
    const m = next.last!;
    if (prefersReducedMotion()) { finishMove(next); return; }
    setBusy(true);
    const step = state.holesPerSide === 12 ? LONG_STEP_MS : STEP_MS;
    const pits = state.pits.slice();
    pits[hole] = 0;
    setView({ pits: pits.slice(), stores: [state.stores[0], state.stores[1]], active: hole, taken: [] });
    m.path.forEach((h, i) => {
      later(() => {
        pits[h] += 1;
        setView({ pits: pits.slice(), stores: [state.stores[0], state.stores[1]], active: h, taken: [] });
        beep(420 + (i % 6) * 40, 0.05);
      }, step * (i + 1));
    });
    const end = step * (m.path.length + 1);
    if (m.captured.length > 0) {
      later(() => setView({ pits: pits.slice(), stores: [state.stores[0], state.stores[1]], active: null, taken: m.captured }), end);
      later(() => finishMove(next), end + 420);
    } else {
      later(() => finishMove(next), end);
    }
  }, [beep, finishMove, later]);

  // Computer's turn.
  useEffect(() => {
    if (phase !== "playing" || busy || game.over || game.turn !== 1) return;
    const t = window.setTimeout(() => play(game, chooseMove(game, level)), THINK_MS);
    return () => window.clearTimeout(t);
  }, [busy, game, level, phase, play]);

  const start = useCallback((opts?: { holesPerSide?: HolesPerSide; chain?: boolean }) => {
    clearTimers();
    const size = opts?.holesPerSide ?? holesPerSide;
    const withChain = opts?.chain ?? chain;
    startedBy.current = nextFirst;
    const s = initialState(undefined, nextFirst, variant, { holesPerSide: size, chain: withChain });
    setGame(s);
    setView(viewOf(s));
    setBusy(false);
    setPhase("playing");
    setStatus(nextFirst === 0 ? "You start. Pick a hole on your side." : "The computer starts this game. Computer is thinking…");
  }, [chain, clearTimers, holesPerSide, nextFirst, variant]);

  const changeSize = (v: string) => { const n: HolesPerSide = v === "12" ? 12 : 6; setHolesPerSide(n); start({ holesPerSide: n }); };
  const changeChain = (v: string) => { const on = v === "on"; setChain(on); start({ chain: on }); };

  const toggleSound = () => setMuted((m) => { mutedRef.current = !m; return !m; });

  const canPlay = phase === "playing" && !busy && game.turn === 0 && !game.over;
  const legal = canPlay ? legalMoves(game) : [];
  const { top, bottom } = rowsFor(game.holesPerSide);
  const seedMax = long ? 8 : 14;

  const hole = (h: number, mine: boolean) => {
    const n = view.pits[h];
    const isLegal = legal.includes(h);
    const cls = `ncho-hole${view.active === h ? " is-active" : ""}${view.taken.includes(h) ? " is-taken" : ""}${isLegal ? " is-legal" : ""}${game.last?.hole === h && !busy ? " is-last" : ""}`;
    if (!mine) {
      return <div key={h} className={cls} role="img" aria-label={`Computer's hole, ${n} seed${n === 1 ? "" : "s"}`}><Seeds n={n} max={seedMax} /><b>{n}</b></div>;
    }
    return (
      <button key={h} type="button" className={cls} disabled={!isLegal} onClick={() => play(game, h)}
        aria-label={`Your hole ${h + 1}, ${n} seed${n === 1 ? "" : "s"}${isLegal ? "" : ", can't play"}`}>
        <Seeds n={n} max={seedMax} /><b>{n}</b>
      </button>
    );
  };

  const [ya, yb] = game.stores;
  const nextLine = nextFirst === 0
    ? game.winner === "draw" ? "A draw, so you start the next game." : "You lost, so you start the next game."
    : game.winner === "draw" ? "A draw, so the computer starts the next game." : "The computer lost, so it starts the next game.";
  const readyKicker = `${clockwise ? "AKA-HAUSA · SOWN CLOCKWISE" : "SOWN ANTICLOCKWISE"} · ${long ? "TWELVE" : "SIX"} HOLES EACH`;

  return (
    <ArcadeShell game={arcadeGame(slug)} index={ARCADE_GAMES.findIndex((g) => g.slug === slug) + 1}>
      <div className="arc-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOU</span><strong aria-live="polite">{String(view.stores[0]).padStart(2, "0")}</strong></div>
          <div className="arc-stat"><span className="arc-label">COMPUTER</span><strong>{String(view.stores[1]).padStart(2, "0")}</strong></div>
          <div className="arc-stat"><span className="arc-label">WINS</span><strong>{wins}</strong></div>
          <span className="arc-spacer" />
          <select className="arc-select" aria-label="Computer level" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            <option value="easy">EASY</option>
            <option value="medium">MEDIUM</option>
            <option value="hard">HARD</option>
          </select>
          <select className="arc-select" aria-label="Board size (starts a new game)" value={String(holesPerSide)} onChange={(e) => changeSize(e.target.value)}>
            <option value="6">BOARD: 6 HOLES</option>
            <option value="12">BOARD: 12 HOLES (NCHOKOROTO)</option>
          </select>
          <select className="arc-select" aria-label="Chain capture (starts a new game)" value={chain ? "on" : "off"} onChange={(e) => changeChain(e.target.value)}>
            <option value="off">CHAIN CAPTURE: OFF</option>
            <option value="on">CHAIN CAPTURE: ON</option>
          </select>
          <button type="button" className="arc-btn-ghost" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <button type="button" className="arc-btn-ghost" onClick={() => start()} aria-label="New game">NEW GAME</button>
        </div>

        <div className="arc-board-wrap ncho-wrap">
          <div className={`ncho-board${long ? " ncho-long" : ""}`} style={{ ["--ncho-n" as string]: game.holesPerSide }}
            aria-label={`${clockwise ? "Aka-Hausa" : "Ncho"} board, ${game.holesPerSide} holes a side. Your holes are on the bottom row and your house is on the right; seeds move ${clockwise ? "clockwise" : "anticlockwise"}.`}>
            <span className="ncho-dir" aria-hidden="true">{clockwise ? "↻ CLOCKWISE" : "↺ ANTICLOCKWISE"}{game.chain ? " · CHAIN" : ""}</span>
            <div className="ncho-store ncho-store-them" role="img" aria-label={`Computer's house, ${view.stores[1]} seeds`}>
              <span className="ncho-store-label">COMPUTER</span><Seeds n={view.stores[1]} max={long ? 24 : 30} /><b>{view.stores[1]}</b>
            </div>
            <div className="ncho-row ncho-top">{top.map((h) => hole(h, false))}</div>
            <div className="ncho-row ncho-bottom">{bottom.map((h) => hole(h, true))}</div>
            <div className="ncho-store ncho-store-you" role="img" aria-label={`Your house, ${view.stores[0]} seeds`}>
              <span className="ncho-store-label">YOU</span><Seeds n={view.stores[0]} max={long ? 24 : 30} /><b>{view.stores[0]}</b>
            </div>
          </div>
          {phase !== "playing" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{phase === "over" ? "GAME OVER" : readyKicker}</p>
              <h2>{phase === "ready" ? (clockwise ? "The other way round." : "Sow and gather.") : game.winner === 0 ? "You win." : game.winner === 1 ? "Computer wins." : "A draw."}</h2>
              {phase === "ready" ? (
                <p>{`Your holes are the bottom row and your house is on the right. Make exactly 4 in one of their holes to capture.`}</p>
              ) : (
                <>
                  <p className="ncho-final">{`Houses: you ${ya}, computer ${yb}.`}{game.endReason === "stalled" ? " No captures for a long time, so the game was counted." : ""}</p>
                  <p>{nextLine}</p>
                </>
              )}
              <button type="button" className="arc-btn" onClick={() => start()} aria-label={phase === "over" ? "Play again" : "Start game"}>{phase === "over" ? "PLAY AGAIN" : "START GAME"}</button>
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
      </div>

      <style jsx global>{`
        .ncho-wrap { background:#1b2a23; }
        .ncho-board { --ncho-n:6; position:relative; display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,6fr) minmax(0,.9fr); grid-template-rows:1fr 1fr; gap:clamp(5px,1.4vw,10px); padding:clamp(14px,2.6vw,20px) clamp(10px,2.4vw,18px) clamp(10px,2.4vw,18px); border-radius:10px;
          background:
            repeating-linear-gradient(92deg,#ffffff05 0 2px,transparent 2px 9px),
            radial-gradient(120% 90% at 50% 0%,#3a3426 0%,#2a2a20 45%,#1b2a23 100%); box-shadow:inset 0 0 0 1px #ffffff10,inset 0 -10px 30px #0006; }
        .ncho-dir { position:absolute; top:3px; left:50%; transform:translateX(-50%); z-index:1; padding:1px 7px; border-radius:999px; background:#0f1914cc; color:#f0c27b; font:600 8px ui-monospace,monospace; letter-spacing:.14em; pointer-events:none; white-space:nowrap; }
        .ncho-row { display:grid; grid-template-columns:repeat(var(--ncho-n),minmax(0,1fr)); gap:clamp(4px,1.2vw,9px); grid-column:2; }
        .ncho-top { grid-row:1; }.ncho-bottom { grid-row:2; }
        .ncho-store { grid-row:1/3; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-width:0; padding:18px 3px; border-radius:999px; background:radial-gradient(ellipse at 50% 40%,#0f1914 0%,#16211b 70%,#22302a 100%); box-shadow:inset 0 4px 10px #000a,0 1px 0 #ffffff12; }
        .ncho-store-them { grid-column:1; }.ncho-store-you { grid-column:3; }
        .ncho-store-label { position:absolute; top:8px; color:#c1e99399; font:600 7px ui-monospace,monospace; letter-spacing:.1em; writing-mode:vertical-rl; transform:rotate(180deg); }
        .ncho-store-you .ncho-store-label { top:auto; bottom:8px; color:#bdf36bcc; }
        .ncho-store .ncho-seeds { max-width:100%; }
        .ncho-store b { color:#f6dca8; font:600 clamp(12px,2.6vw,16px) ui-monospace,monospace; }
        .ncho-store-you b { color:#bdf36b; }
        .ncho-hole { position:relative; overflow:hidden; aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-width:0; padding:4px; border:0; border-radius:50%; background:radial-gradient(circle at 50% 38%,#0e1813 0%,#16221c 62%,#26332c 100%); box-shadow:inset 0 4px 9px #000b,0 1px 0 #ffffff14; color:#f6dca8; font:inherit; transition:box-shadow .12s,transform .12s; }
        button.ncho-hole { cursor:pointer; touch-action:manipulation; }
        button.ncho-hole:disabled { cursor:default; }
        .ncho-hole.is-legal { box-shadow:inset 0 4px 9px #000b,0 0 0 2px #9bd34d88; }
        .ncho-hole.is-legal:hover { box-shadow:inset 0 4px 9px #000b,0 0 0 2px #bdf36b; transform:translateY(-1px); }
        .ncho-hole:focus-visible { outline:2px solid #bdf36b; outline-offset:2px; }
        .ncho-hole.is-last { box-shadow:inset 0 4px 9px #000b,0 0 0 2px #ff816d88; }
        .ncho-hole.is-active { box-shadow:inset 0 4px 9px #000b,0 0 0 2px #f0c27b; }
        .ncho-hole.is-taken { box-shadow:inset 0 4px 9px #000b,0 0 0 3px #ff816d; background:radial-gradient(circle,#3a2320 0%,#16221c 80%); }
        .ncho-hole b { color:#f6dca8cc; font:600 clamp(9px,2vw,12px) ui-monospace,monospace; line-height:1; }
        .ncho-bottom .ncho-hole b { color:#e7f7cf; }
        .ncho-seeds { display:flex; flex-wrap:wrap; justify-content:center; gap:2px; max-width:78%; }
        .ncho-seeds i { display:block; width:clamp(4px,1.1vw,7px); height:clamp(4px,1.1vw,7px); border-radius:50%; box-shadow:inset -1px -1px 0 #0004,0 1px 1px #0006; }
        .ncho-final { color:#f6dca8 !important; font:600 12px ui-monospace,monospace; letter-spacing:.04em; }
        /* Nchokoroto: twelve holes a row. Narrower houses, tighter gaps; the holes shrink and the seed dots go when they're tiny. */
        .ncho-long { grid-template-columns:minmax(0,1fr) minmax(0,12fr) minmax(0,1fr); gap:clamp(3px,.9vw,8px); }
        .ncho-long .ncho-row { gap:clamp(2px,.55vw,6px); }
        .ncho-long .ncho-hole { padding:2px; gap:2px; }
        .ncho-long .ncho-hole b { font-size:clamp(8px,1.5vw,11px); }
        .ncho-long .ncho-seeds { gap:1px; max-width:84%; }
        .ncho-long .ncho-seeds i { width:clamp(3px,.75vw,6px); height:clamp(3px,.75vw,6px); }
        .ncho-long .ncho-store { padding:10px 2px; }
        .ncho-long .ncho-store-label { display:none; } /* the pots are short here; the score row names them */
        @media(max-width:520px) { .ncho-long .ncho-hole .ncho-seeds { display:none; } }
        @media(max-width:420px) { .ncho-store-label { display:none; } .ncho-store { padding:8px 2px; } .ncho-long .ncho-store { padding:6px 1px; } .ncho-long { padding:14px 6px 6px; } .ncho-long .ncho-store .ncho-seeds { display:none; } }
        @media(prefers-reduced-motion:reduce) { .ncho-hole { transition:none; } .ncho-hole.is-legal:hover { transform:none; } }
      `}</style>
    </ArcadeShell>
  );
}
