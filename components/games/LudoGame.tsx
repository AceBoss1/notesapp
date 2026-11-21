"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import ArcadeAdSpot from "./ArcadeAdSpot";
import {
  HOME, HOME_COLUMN, PLAYERS, START, STARS, TRACK, YARD, YARD_ORIGIN,
  applyMove, applyRoll, chooseMove, legalMoves, newGame, rollDie, seedCell,
  type LudoEvent, type LudoState,
} from "@/lib/arcade/ludo";

// Player 0 is you (bottom-left yard). The rest are computer players, clockwise.
const NAMES = ["Green", "Coral", "Gold", "Blue"];
const COLOURS = ["#9bd34d", "#ff816d", "#f2c14e", "#6cb4e8"];
const ROLL_MS = 520;
const CPU_ROLL_MS = 550;
const CPU_MOVE_MS = 600;
const AUTO_MOVE_MS = 700; // when you have only one legal move, it plays itself after this pause (you can still tap first)
const WINS_KEY = "notes-arcade-ludo-wins";

// Pips on a 3×3 grid, numbered 0–8 left to right, top to bottom.
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// Where finished seeds rest: in their own triangle of the centre (row, col in cell units).
const HOME_SPOT: [number, number][] = [[8.45, 7.5], [7.5, 6.55], [6.55, 7.5], [7.5, 8.45]];
const YARD_SPOTS: [number, number][] = [[2, 2], [2, 4], [4, 2], [4, 4]];

const who = (p: number) => (p === 0 ? "You" : NAMES[p]);

function describe(e: LudoEvent | null): string {
  if (!e) return "";
  if (e.kind === "pass") return e.player === 0 ? `You rolled ${e.die}: no move.` : `${NAMES[e.player]} rolled ${e.die}: no move.`;
  if (e.kind === "three-sixes") return e.player === 0 ? "Three sixes in a row: you lose the turn." : `${NAMES[e.player]} rolled three sixes and lost the turn.`;
  if (e.captured.length > 0) {
    const victims = e.captured.map((c) => (c.player === 0 ? "your seed" : `${NAMES[c.player]}'s seed`));
    const list = [...new Set(victims)].join(" and ");
    return e.player === 0 ? `You sent ${list} back to the yard!` : `${NAMES[e.player]} sent ${list} back to the yard.`;
  }
  if (e.to === HOME) return e.player === 0 ? "You got a seed home." : `${NAMES[e.player]} got a seed home.`;
  if (e.from === YARD) return e.player === 0 ? "Your seed is out." : `${NAMES[e.player]} brought a seed out.`;
  return "";
}

function statusLine(g: LudoState, rolling: boolean): string {
  if (g.phase === "over") return g.winner === 0 ? "All four home. You win!" : `${NAMES[g.winner ?? 1]} got all four home first.`;
  if (rolling) return g.turn === 0 ? "Rolling…" : `${NAMES[g.turn]} is rolling…`;
  const before = describe(g.last);
  if (g.turn === 0) {
    if (g.phase === "move") {
      return legalMoves(g).length === 1 ? `You rolled ${g.die}. Moving your seed…` : `You rolled ${g.die}. Tap a glowing seed.`;
    }
    const mine = g.last?.kind === "move" && g.last.player === 0 && g.last.bonus;
    if (mine) return `${before || "A six!"} Roll again.`.trim();
    return `${before} Your turn: roll the die.`.trim();
  }
  if (g.phase === "move") return `${NAMES[g.turn]} rolled ${g.die} and is thinking…`;
  return `${before} ${NAMES[g.turn]}'s turn.`.trim();
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Token = { player: number; seed: number; progress: number; y: number; x: number; size: number };

// Board position of every seed, with seeds sharing a square nudged apart so each can be seen and tapped.
function layoutTokens(g: LudoState): Token[] {
  const raw: Token[] = [];
  g.seeds.forEach((row, player) => row.forEach((progress, seed) => {
    let y: number; let x: number;
    if (progress === YARD) { y = YARD_ORIGIN[player][0] + YARD_SPOTS[seed][0]; x = YARD_ORIGIN[player][1] + YARD_SPOTS[seed][1]; }
    else if (progress >= HOME) { [y, x] = HOME_SPOT[player]; }
    else { const [r, c] = seedCell(player, progress)!; y = r + 0.5; x = c + 0.5; }
    raw.push({ player, seed, progress, y, x, size: 0.8 });
  }));
  const groups = new Map<string, Token[]>();
  for (const t of raw) {
    const k = `${t.y},${t.x}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  for (const group of groups.values()) {
    const n = group.length;
    if (n === 1) continue;
    const r = n === 2 ? 0.2 : 0.24;
    group.forEach((t, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4;
      t.y += Math.sin(a) * r; t.x += Math.cos(a) * r;
      t.size = n === 2 ? 0.6 : 0.5;
    });
  }
  return raw;
}

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div className={`ludo-die${rolling ? " is-rolling" : ""}`} role="img" aria-label={rolling ? "Die rolling" : `Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className={PIPS[value]?.includes(i) ? "ludo-pip" : ""} />)}
    </div>
  );
}

function Star() {
  return (
    <svg className="ludo-star" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z" />
    </svg>
  );
}

// The static board: yards, track, home columns and the centre. Built once.
function BoardSquares() {
  const cells = useMemo(() => {
    const out: { key: string; r: number; c: number; className: string; style?: CSSProperties; star?: boolean }[] = [];
    TRACK.forEach(([r, c], i) => {
      const owner = START.indexOf(i);
      out.push({
        key: `t${i}`, r, c,
        className: `ludo-sq${owner >= 0 ? " is-start" : ""}`,
        style: owner >= 0 ? { background: COLOURS[owner] } : undefined,
        star: STARS.includes(i),
      });
    });
    HOME_COLUMN.forEach((col, p) => col.forEach(([r, c], i) => {
      out.push({ key: `h${p}${i}`, r, c, className: "ludo-sq is-home", style: { background: COLOURS[p] } });
    }));
    return out;
  }, []);
  return (
    <>
      {YARD_ORIGIN.map(([r, c], p) => (
        <div key={`y${p}`} className="ludo-yard" style={{ gridArea: `${r + 1} / ${c + 1} / span 6 / span 6`, background: COLOURS[p] }}>
          <div className="ludo-yard-inner">
            {YARD_SPOTS.map((_, i) => <i key={i} style={{ background: `${COLOURS[p]}55` }} />)}
          </div>
        </div>
      ))}
      {cells.map((s) => (
        <div key={s.key} className={s.className} style={{ ...s.style, gridRow: s.r + 1, gridColumn: s.c + 1 }}>
          {s.star && <Star />}
        </div>
      ))}
      <div
        className="ludo-centre"
        style={{ background: `conic-gradient(from -45deg, ${COLOURS[2]} 0 90deg, ${COLOURS[3]} 90deg 180deg, ${COLOURS[0]} 180deg 270deg, ${COLOURS[1]} 270deg 360deg)` }}
      >
        {/* The centre of the board is an advert spot (owner, 20 Nov 2026). */}
        <ArcadeAdSpot variant="board" game="ludo" />
      </div>
    </>
  );
}

export default function LudoGame() {
  const [game, setGame] = useState<LudoState>(() => newGame());
  const [started, setStarted] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(6);
  const [wins, setWins] = useState(0);
  const [muted, setMuted] = useState(false);
  const rollTimers = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const countedRef = useRef(false);

  useEffect(() => {
    try {
      setWins(Number(arcadeStore.getItem(WINS_KEY)) || 0);
    } catch {
      // storage blocked: just don't remember wins
    }
  }, []);

  const clearRollTimers = useCallback(() => {
    rollTimers.current.forEach((t) => { window.clearTimeout(t); window.clearInterval(t); });
    rollTimers.current = [];
  }, []);
  useEffect(() => clearRollTimers, [clearRollTimers]);

  const beep = useCallback((freq: number, dur: number) => {
    if (mutedRef.current || typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!audioRef.current) audioRef.current = new window.AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      vol.gain.setValueAtTime(0.0001, now);
      vol.gain.exponentialRampToValueAtTime(0.04, now + 0.012);
      vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch {
      // no audio: carry on silently
    }
  }, []);

  // Sounds for what just happened.
  useEffect(() => {
    const e = game.last;
    if (!e) return;
    if (game.phase === "over") beep(game.winner === 0 ? 880 : 220, 0.4);
    else if (e.kind === "move" && e.captured.length > 0) beep(e.player === 0 ? 740 : 196, 0.22);
    else if (e.kind === "move") beep(e.to === HOME ? 660 : 420, 0.08);
  }, [game.last, game.phase, game.winner, beep]);

  // Count a win once per game.
  useEffect(() => {
    if (game.phase !== "over" || countedRef.current) return;
    countedRef.current = true;
    if (game.winner !== 0) return;
    setWins((w) => {
      const next = w + 1;
      try { arcadeStore.setItem(WINS_KEY, String(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, [game.phase, game.winner]);

  const startRoll = useCallback(() => {
    if (rolling) return;
    const value = rollDie();
    const finish = () => {
      setFace(value);
      setRolling(false);
      setGame((g) => (g.phase === "roll" ? applyRoll(g, value) : g));
    };
    if (prefersReducedMotion()) { finish(); return; }
    setRolling(true);
    beep(300, 0.05);
    const spin = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    const done = window.setTimeout(() => { clearRollTimers(); finish(); }, ROLL_MS);
    rollTimers.current.push(spin, done);
  }, [rolling, beep, clearRollTimers]);

  const moveSeed = useCallback((seed: number) => {
    setGame((g) => (g.turn === 0 && g.phase === "move" && legalMoves(g).includes(seed) ? applyMove(g, seed) : g));
  }, []);

  // Computer turns, and your auto-move when only one seed can go.
  useEffect(() => {
    if (!started || rolling || game.phase === "over") return;
    let t: number | undefined;
    if (game.turn !== 0) {
      if (game.phase === "roll") {
        const wait = game.last && game.last.kind !== "move" ? CPU_ROLL_MS + 400 : CPU_ROLL_MS; // time to read "no move"
        t = window.setTimeout(startRoll, wait);
      } else {
        t = window.setTimeout(() => setGame((g) => (g.turn !== 0 && g.phase === "move" ? applyMove(g, chooseMove(g)) : g)), CPU_MOVE_MS);
      }
    } else if (game.phase === "move") {
      const moves = legalMoves(game);
      if (moves.length === 1) t = window.setTimeout(() => moveSeed(moves[0]), AUTO_MOVE_MS);
    }
    return () => window.clearTimeout(t);
  }, [game, started, rolling, startRoll, moveSeed]);

  const restart = useCallback(() => {
    clearRollTimers();
    setRolling(false);
    setFace(6);
    countedRef.current = false;
    setGame(newGame());
    setStarted(true);
  }, [clearRollTimers]);

  const canRoll = started && !rolling && game.turn === 0 && game.phase === "roll";
  const movable = useMemo(() => (game.turn === 0 && !rolling ? legalMoves(game) : []), [game, rolling]);

  // Keyboard: Space or R rolls; 1–4 moves that seed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "SUMMARY"].includes(el.tagName)) return;
      if ((e.key === " " || e.key === "r" || e.key === "R") && canRoll) { e.preventDefault(); startRoll(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && movable.includes(n - 1)) { e.preventDefault(); moveSeed(n - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canRoll, movable, startRoll, moveSeed]);

  const toggleSound = () => setMuted((m) => { mutedRef.current = !m; return !m; });

  const tokens = layoutTokens(game);
  const homeCount = (p: number) => game.seeds[p].filter((s) => s === HOME).length;
  const status = started ? statusLine(game, rolling) : "Press Start to play.";
  const shownFace = rolling ? face : game.die ?? face;

  return (
    <ArcadeShell game={arcadeGame("ludo")} index={2}>
      <div className="arc-console ludo">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">HOME</span><strong>{homeCount(0)}/4</strong></div>
          <div className="arc-stat"><span className="arc-label">CAPTURES</span><strong>{game.captures[0]}</strong></div>
          <div className="arc-stat"><span className="arc-label">WINS</span><strong>{wins}</strong></div>
          <div className="arc-spacer" />
          <button type="button" className="arc-btn-ghost" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
          <button type="button" className="arc-btn-ghost" onClick={restart} aria-label="Start a new game">NEW GAME</button>
        </div>

        <div className="arc-board-wrap ludo-wrap">
          <div className="ludo-board" role="group" aria-label={`Ludo board. You are green. Seeds home: ${game.seeds.map((_, p) => `${NAMES[p]} ${homeCount(p)}`).join(", ")}.`}>
            <BoardSquares />
            {tokens.map((t) => {
              const style = {
                left: `${(t.x / 15) * 100}%`,
                top: `${(t.y / 15) * 100}%`,
                width: `${(t.size / 15) * 100}%`,
                "--ludo-c": COLOURS[t.player],
              } as CSSProperties;
              if (t.player !== 0) return <span key={`${t.player}-${t.seed}`} className="ludo-seed" style={style} aria-hidden="true" />;
              const can = movable.includes(t.seed);
              const where = t.progress === YARD ? "in your yard" : t.progress >= HOME ? "home" : t.progress > 50 ? "in your home column" : `${t.progress} steps along`;
              return (
                <button
                  key={`0-${t.seed}`}
                  type="button"
                  className={`ludo-seed is-mine${can ? " is-movable" : ""}`}
                  style={style}
                  disabled={!can}
                  onClick={() => moveSeed(t.seed)}
                  aria-label={`Your seed ${t.seed + 1}, ${where}${can ? ". Move it" : ""}`}
                />
              );
            })}
          </div>

          {!started && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">FOUR COLOURS · ONE DIE</p>
              <h2>Roll home.</h2>
              <p>You&apos;re green. Roll a six to bring a seed out.</p>
              <button type="button" className="arc-btn" onClick={restart}>START</button>
            </div>
          )}
          {game.phase === "over" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">GAME OVER</p>
              <h2>{game.winner === 0 ? "You win!" : `${NAMES[game.winner ?? 1]} wins.`}</h2>
              <p>{game.winner === 0 ? "All four seeds home. Nicely done." : `You got ${homeCount(0)} of 4 home. Go again?`}</p>
              <button type="button" className="arc-btn" onClick={restart}>PLAY AGAIN</button>
            </div>
          )}
        </div>

        <div className="ludo-controls">
          <ul className="ludo-players" aria-label="Players">
            {NAMES.map((n, p) => (
              <li key={n} className={started && game.turn === p && game.phase !== "over" ? "is-turn" : ""}>
                <i style={{ background: COLOURS[p] }} />
                <span>{p === 0 ? "YOU" : n.toUpperCase()}</span>
                <b>{homeCount(p)}</b>
              </li>
            ))}
          </ul>
          <div className="ludo-roll">
            <Die value={shownFace} rolling={rolling} />
            <button type="button" className="arc-btn" onClick={startRoll} disabled={!canRoll} aria-label="Roll the die">ROLL</button>
          </div>
        </div>

        <p className="arc-status" aria-live="polite">{status}</p>
      </div>

      <style jsx global>{`
        .ludo-wrap { padding:10px; }
        .ludo-board { position:relative; display:grid; grid-template-columns:repeat(15,1fr); grid-template-rows:repeat(15,1fr); gap:1px; width:100%; max-width:560px; aspect-ratio:1; margin:0 auto; overflow:hidden; border-radius:6px; background:#cfd5c9; }
        .ludo-sq { position:relative; display:grid; place-items:center; background:#f7f7f2; }
        .ludo-sq.is-home { filter:saturate(.85); }
        .ludo-star { width:72%; height:72%; fill:#b9c1b4; }
        .ludo-sq.is-start .ludo-star { fill:#ffffffaa; }
        .ludo-yard { display:grid; place-items:center; }
        .ludo-yard-inner { position:relative; width:66.6%; height:66.6%; border-radius:12%; background:#f7f7f2; box-shadow:inset 0 0 0 1px #17251f14; }
        .ludo-yard-inner i { position:absolute; width:32%; height:32%; border-radius:50%; transform:translate(-50%,-50%); }
        .ludo-yard-inner i:nth-child(1) { left:25%; top:25%; }.ludo-yard-inner i:nth-child(2) { left:75%; top:25%; }
        .ludo-yard-inner i:nth-child(3) { left:25%; top:75%; }.ludo-yard-inner i:nth-child(4) { left:75%; top:75%; }
        .ludo-centre { position:relative; grid-area:7 / 7 / span 3 / span 3; }
        .ludo-seed { position:absolute; z-index:2; aspect-ratio:1; padding:0; border:2px solid #17251f; border-radius:50%; background:radial-gradient(circle at 50% 50%, #fff 0 22%, var(--ludo-c) 24%); box-shadow:0 2px 0 #17251f55; transform:translate(-50%,-50%); transition:left .25s ease, top .25s ease, width .2s ease; }
        button.ludo-seed { cursor:default; }
        button.ludo-seed:disabled { opacity:1; }
        .ludo-seed.is-movable { z-index:3; cursor:pointer; animation:ludo-pulse 1s ease-in-out infinite; }
        .ludo-seed.is-movable::after { content:""; position:absolute; inset:-5px; border:2px solid #bdf36b; border-radius:50%; }
        .ludo-seed.is-movable::before { content:""; position:absolute; inset:-10px; border-radius:50%; } /* a bigger tap target on small screens */
        .ludo-seed:focus-visible { outline:2px solid #ff816d; outline-offset:3px; }
        @keyframes ludo-pulse { 50% { box-shadow:0 0 0 4px #bdf36b88, 0 2px 0 #17251f55; } }
        .ludo-controls { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 4px 0; }
        .ludo-players { display:flex; flex-wrap:wrap; gap:6px; margin:0; padding:0; list-style:none; }
        .ludo-players li { display:flex; align-items:center; gap:6px; padding:6px 8px; border:1px solid #e3e6df; border-radius:7px; background:#f8f9f6; color:#58645c; font:700 9px ui-monospace,monospace; letter-spacing:.08em; }
        .ludo-players li.is-turn { border-color:#83b83c; background:#eef8de; color:#17251f; }
        .ludo-players i { width:10px; height:10px; border:1.5px solid #17251f; border-radius:50%; }
        .ludo-players b { color:#929b94; font-weight:600; }
        .ludo-roll { display:flex; align-items:center; gap:12px; }
        .ludo-die { display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); gap:3px; width:46px; height:46px; padding:7px; box-sizing:border-box; border:1.5px solid #17251f; border-radius:9px; background:#fff; box-shadow:0 3px 0 #17251f22; }
        .ludo-pip { border-radius:50%; background:#17251f; }
        .ludo-die.is-rolling { animation:ludo-shake .26s linear infinite; }
        @keyframes ludo-shake { 25% { transform:rotate(-12deg) translateY(-2px); } 75% { transform:rotate(12deg) translateY(-2px); } }
        @media(max-width:480px) { .ludo-wrap { padding:6px; } .ludo-seed { border-width:1.5px; } .ludo-players li { padding:5px 6px; font-size:8px; } .ludo-die { width:42px; height:42px; padding:6px; } }
        @media(prefers-reduced-motion:reduce) { .ludo-seed { transition:none; } .ludo-seed.is-movable, .ludo-die.is-rolling { animation:none; } }
      `}</style>
    </ArcadeShell>
  );
}
