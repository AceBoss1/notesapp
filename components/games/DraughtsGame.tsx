"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArcadeNana from "@/components/games/ArcadeNana";
import ArcadeShell from "@/components/games/ArcadeShell";
import { arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import {
  DRAW_PLIES, applyMove, chooseMove, countPieces, initialState, isDark, legalMoves, sizeOf,
  type BoardSize, type Cell, type DraughtsMove, type DraughtsState, type Level, type Rules,
} from "@/lib/arcade/draughts";
import type { NanaTake } from "@/lib/arcade/nana";
import { draughtsTake, draughtsTip } from "@/lib/arcade/nana-draughts";
import { DRAUGHTS_LEVELS, draughtsTourneyReply, draughtsTourneyStart, encodeDraughts, parseDraughtsLevel } from "@/lib/arcade/replay-draughts";
import type { TourneyProps } from "@/lib/arcade/tournament-games";

type Phase = "ready" | "playing" | "over";

const THINK_MS = 500;
const HOP_MS = 260; // each hop of the computer's multi-jump
const WINS_KEY = "arcade-draughts-wins";
const RULES_KEY = "arcade-draughts-rules";
const FILES = "abcdefghij";

const name = (i: number, n: number) => `${FILES[i % n]}${n - Math.floor(i / n)}`;

// The rules menu: African on the 10×10 board (the default), African on 8×8, or English (always 8×8).
type Variant = "african-10" | "african-8" | "english";
// The tournament's boards (lib/arcade/replay-draughts.ts) map onto this menu's choices.
const TOURNEY_VARIANT: Record<string, Variant> = { african10: "african-10", african8: "african-8", english: "english" };
const VARIANTS: Record<Variant, { rules: Rules; size: BoardSize; label: string; intro: string }> = {
  "african-10": { rules: "african", size: 10, label: "AFRICAN 10×10", intro: "20 each. Men take backwards too, kings fly, and you must take the most pieces." },
  "african-8": { rules: "african", size: 8, label: "AFRICAN 8×8", intro: "12 each. Men take backwards too, kings fly, and you must take the most pieces." },
  english: { rules: "english", size: 8, label: "ENGLISH 8×8", intro: "12 each. Men move and take forward only; kings move one square either way." },
};
const isVariant = (v: unknown): v is Variant => typeof v === "string" && v in VARIANTS;
const fresh = (v: Variant, drawRule = true) => initialState(undefined, { drawRule, rules: VARIANTS[v].rules, size: VARIANTS[v].size });

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// The board part-way through a move: the piece on its latest square, taken pieces still showing (faded) until the move ends.
function midMove(board: Cell[], m: { from: number; path: number[]; captures: number[] }): Cell[] {
  const b = board.slice();
  const piece = b[m.from];
  b[m.from] = null;
  if (m.path.length) b[m.path[m.path.length - 1]] = piece;
  return b;
}

export default function DraughtsGame({ tourney }: { tourney?: TourneyProps } = {}) {
  // A tournament try (owner, 21 Nov 2026: "add tournament versions of … Draughts"; lib/arcade/replay-draughts.ts): the tournament's
  // level sets the rules, the board and the computer's strength; you play light and move first, the 40-move draw is on, the computer's
  // replies come from the seed with a position-capped search (so the server's replay finds the same moves), no new game, and the game
  // doesn't count towards your practice wins or change your saved rules.
  const tourneyLevel = tourney ? (parseDraughtsLevel(tourney.level) ? tourney.level : DRAUGHTS_LEVELS[0]) : null;
  const tp = tourneyLevel ? parseDraughtsLevel(tourneyLevel)! : null;
  const [game, setGame] = useState<DraughtsState>(() => (tourney ? draughtsTourneyStart(tourney.seed, tourneyLevel!) : fresh("african-10")));
  const [phase, setPhase] = useState<Phase>(tourney ? "playing" : "ready");
  const [level, setLevel] = useState<Level>(tp?.level ?? "medium");
  const [drawRule, setDrawRule] = useState(true);
  const [variant, setVariant] = useState<Variant>(tp ? TOURNEY_VARIANT[tp.board] : "african-10");
  const [resigned, setResigned] = useState(false);
  const mineRef = useRef<DraughtsMove[]>([]); // your moves this game, exactly what the replay reads
  const sentRef = useRef(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [steps, setSteps] = useState<number[]>([]); // your landings so far in a multi-jump
  const [anim, setAnim] = useState<{ board: Cell[]; taken: number[]; at: number } | null>(null);
  const [status, setStatus] = useState(tourney ? "Your turn. You play the light pieces." : "Press start to play.");
  const [wins, setWins] = useState(0);
  const [muted, setMuted] = useState(false);
  // Nana (owner, 21 Nov 2026): a free hint from the engine itself, lit up in gold, and her take on each computer move.
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [take, setTake] = useState<NanaTake | null>(null);
  const [gameNo, setGameNo] = useState(0);
  const timers = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    try { setWins(Number(arcadeStore.getItem(WINS_KEY)) || 0); } catch { /* storage blocked: start from 0 */ }
    if (tourney) return; // the tournament sets the rules; your saved choice stays for practice
    try {
      const saved = arcadeStore.getItem(RULES_KEY);
      if (isVariant(saved)) { setVariant(saved); setGame(fresh(saved)); }
    } catch { /* storage blocked: African 10×10 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clearTimers = useCallback(() => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; }, []);
  useEffect(() => clearTimers, [clearTimers]);

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
    vol.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(vol); vol.connect(ctx.destination);
    osc.start(now); osc.stop(now + dur);
  }, []);

  const legal = useMemo(() => (phase === "playing" && !anim ? legalMoves(game) : []), [anim, game, phase]);
  const mustCapture = legal.length > 0 && legal[0].captures.length > 0;
  const candidates = useMemo(
    () => (selected === null ? [] : legal.filter((m) => m.from === selected && steps.every((s, i) => m.path[i] === s))),
    [legal, selected, steps],
  );
  const destinations = new Set(candidates.map((m) => m.path[steps.length]).filter((x) => x !== undefined));
  const movable = new Set(game.turn === 0 ? legal.map((m) => m.from) : []);

  // A tournament try ends once (a win, a loss, a draw, or resigning): send your moves; the server replays the computer's.
  const finishTourney = useCallback((resign: boolean, board: Cell[]) => {
    if (!tourney || sentRef.current) return;
    sentRef.current = true;
    tourney.onFinish(encodeDraughts(mineRef.current, sizeOf(board), resign));
  }, [tourney]);

  // `before` is passed for the computer's move, so Nana can say what it was for.
  const commit = useCallback((next: DraughtsState, before?: DraughtsState) => {
    const m = next.last!;
    const mover = next.turn === 1 ? "You" : "Computer";
    if (!before) mineRef.current = [...mineRef.current, m];
    setGame(next);
    setAnim(null);
    setSelected(null);
    setSteps([]);
    setHint(null);
    if (before && !tourney) setTake(draughtsTake(before, m, next));
    beep(m.captures.length ? 520 : 380, 0.09);
    if (next.over) {
      setPhase("over");
      setStatus(next.winner === 0 ? "You win." : next.winner === 1 ? "Computer wins." : "A draw: 40 moves each with no capture.");
      if (tourney) { finishTourney(false, next.board); return; }
      if (next.winner === 0) setWins((w) => { try { arcadeStore.setItem(WINS_KEY, String(w + 1)); } catch { /* ignore */ } return w + 1; });
      return;
    }
    const took = m.captures.length ? `${mover} took ${m.captures.length}${m.crowns ? " and crowned a king" : ""}. ` : m.crowns ? `${mover} crowned a king. ` : "";
    if (next.turn === 1) setStatus(`${took}Computer is thinking…`);
    else {
      const must = (legalMoves(next)[0]?.captures.length ?? 0) > 0;
      setStatus(`${took}Your turn${must ? ": you must capture" : ""}.`);
    }
  }, [beep, finishTourney, tourney]);

  // Computer's turn: think, then play its move hop by hop.
  useEffect(() => {
    if (phase !== "playing" || resigned || anim || game.over || game.turn !== 1) return;
    const t = window.setTimeout(() => {
      const m = tourney ? draughtsTourneyReply(game, level, tourney.seed) : chooseMove(game, level);
      const next = applyMove(game, m);
      if (prefersReducedMotion() || m.path.length === 1) { commit(next, game); return; }
      m.path.forEach((_, i) => {
        timers.current.push(window.setTimeout(() => {
          const part = { from: m.from, path: m.path.slice(0, i + 1), captures: m.captures.slice(0, i + 1) };
          setAnim({ board: midMove(game.board, part), taken: part.captures, at: part.path[i] });
          beep(500, 0.06);
        }, i * HOP_MS));
      });
      timers.current.push(window.setTimeout(() => commit(next, game), m.path.length * HOP_MS));
    }, THINK_MS);
    return () => window.clearTimeout(t);
  }, [anim, beep, commit, game, level, phase, resigned, tourney]);

  const start = useCallback(() => {
    if (tourney) return; // a tournament game is never restarted from here; a new try comes with a new run id
    clearTimers();
    setGame(fresh(variant, drawRule));
    setAnim(null);
    setSelected(null);
    setSteps([]);
    setHint(null);
    setTake(null);
    setGameNo((g) => g + 1);
    setPhase("playing");
    setStatus("Your turn. You play the light pieces.");
  }, [clearTimers, drawRule, tourney, variant]);

  // A new tournament run (a new run id) starts the same game afresh.
  const runId = tourney?.runId;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!tourney) return;
    clearTimers();
    setGame(draughtsTourneyStart(tourney.seed, tourneyLevel!));
    setAnim(null);
    setSelected(null);
    setSteps([]);
    setPhase("playing");
    setResigned(false);
    setStatus("Your turn. You play the light pieces.");
    mineRef.current = [];
    sentRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const resign = () => {
    if (!tourney || phase !== "playing" || game.over || resigned || anim) return;
    clearTimers();
    setResigned(true);
    setSelected(null);
    setSteps([]);
    setPhase("over");
    setStatus("You resigned. The computer wins.");
    finishTourney(true, game.board);
  };

  // The rules and board change what's legal, so switching them sets up a fresh board.
  const changeVariant = (next: Variant) => {
    clearTimers();
    setVariant(next);
    try { arcadeStore.setItem(RULES_KEY, next); } catch { /* ignore */ }
    setGame(fresh(next, drawRule));
    setAnim(null);
    setSelected(null);
    setSteps([]);
    setHint(null);
    setTake(null);
    setGameNo((g) => g + 1);
    setPhase("ready");
    setStatus(`${VARIANTS[next].label.replace("×", " × ")}: ${VARIANTS[next].intro} Press start.`);
  };

  const changeDrawRule = (on: boolean) => {
    setDrawRule(on);
    setGame((g) => ({ ...g, drawRule: on }));
  };

  const tap = (i: number) => {
    if (phase !== "playing" || resigned || game.turn !== 0 || anim) return;
    if (steps.length === 0 && movable.has(i)) {
      setSelected(selected === i ? null : i);
      return;
    }
    if (!destinations.has(i)) {
      if (steps.length === 0 && game.board[i]?.side === 0 && mustCapture) setStatus("You must capture: pick a piece that can jump.");
      return;
    }
    const nextSteps = [...steps, i];
    const done = candidates.find((m) => m.path.length === nextSteps.length && m.path[nextSteps.length - 1] === i);
    if (done) { commit(applyMove(game, done)); return; }
    setSteps(nextSteps);
    setHint(null);
    beep(500, 0.06);
    setStatus("Keep jumping with the same piece.");
  };

  // What to draw: the computer's move in progress, your multi-jump in progress, or the position.
  let board = game.board;
  let taken: number[] = [];
  if (anim) { board = anim.board; taken = anim.taken; }
  else if (selected !== null && steps.length > 0) {
    const m = candidates[0];
    taken = m ? m.captures.slice(0, steps.length) : [];
    board = midMove(game.board, { from: selected, path: steps, captures: taken });
  }
  const heldAt = anim ? anim.at : selected !== null ? (steps.length ? steps[steps.length - 1] : selected) : null;
  const lastSquares = new Set(!anim && game.last ? [game.last.from, ...game.last.path] : []);
  const n = sizeOf(game.board);
  const mine = countPieces(game.board, 0);
  const theirs = countPieces(game.board, 1);

  return (
    <ArcadeShell game={arcadeGame("draughts")} index={8}>
      <div className="arc-console">
        {tourney && <p className="dr-tourney">TOURNAMENT · same deal for everyone</p>}
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOU</span><strong aria-live="polite">{mine.men + mine.kings}</strong></div>
          <div className="arc-stat"><span className="arc-label">COMPUTER</span><strong>{theirs.men + theirs.kings}</strong></div>
          <div className="arc-stat"><span className="arc-label">WINS</span><strong>{wins}</strong></div>
          <span className="arc-spacer" />
          <select className="arc-select" aria-label="Computer level" disabled={!!tourney} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            <option value="easy">EASY</option>
            <option value="medium">MEDIUM</option>
            <option value="hard">HARD</option>
          </select>
          <select className="arc-select" aria-label="Rules and board (changing them starts a new game)" disabled={!!tourney} value={variant} onChange={(e) => changeVariant(e.target.value as Variant)}>
            {(Object.keys(VARIANTS) as Variant[]).map((v) => <option key={v} value={v}>{VARIANTS[v].label}</option>)}
          </select>
          <select className="arc-select" aria-label="Draw after 40 moves each without a capture" disabled={!!tourney} value={drawRule ? "on" : "off"} onChange={(e) => changeDrawRule(e.target.value === "on")}>
            <option value="on">40-MOVE DRAW: ON</option>
            <option value="off">40-MOVE DRAW: OFF</option>
          </select>
          <button type="button" className="arc-btn-ghost" onClick={() => setMuted((m) => { mutedRef.current = !m; return !m; })} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          {tourney
            ? <button type="button" className="arc-btn-ghost" onClick={resign} disabled={phase !== "playing" || game.over || resigned || !!anim} aria-label="Resign this game (counts as a loss)">RESIGN</button>
            : <button type="button" className="arc-btn-ghost" onClick={start} aria-label="New game">NEW GAME</button>}
        </div>

        <div className="arc-board-wrap dr-wrap">
          <div className="dr-board" style={{ gridTemplateColumns: `repeat(${n},minmax(0,1fr))` }} role="group" aria-label="Draughts board. You play light from the bottom.">
            {board.map((p, i) => {
              if (!isDark(i, n)) return <span key={i} className="dr-sq dr-light" aria-hidden="true" />;
              const isDest = destinations.has(i);
              const canPick = steps.length === 0 && movable.has(i);
              const hinted = !!hint && (hint.from === i || hint.to === i);
              const cls = `dr-sq dr-dark${lastSquares.has(i) ? " is-last" : ""}${hinted ? " is-hint" : ""}${isDest ? " is-dest" : ""}${heldAt === i ? " is-held" : ""}${canPick ? " is-movable" : ""}`;
              const label = `${name(i, n)}: ${p ? `${p.side === 0 ? "your" : "computer's"} ${p.king ? "king" : "piece"}${taken.includes(i) ? ", taken" : ""}` : "empty"}${isDest ? ", move here" : canPick ? ", can move" : ""}${hint?.from === i ? ", Nana's hint: move from here" : hint?.to === i ? ", Nana's hint: move here" : ""}`;
              return (
                <button key={i} type="button" className={cls} onClick={() => tap(i)} disabled={!isDest && !canPick} aria-label={label} aria-pressed={heldAt === i ? true : undefined}>
                  {p && (
                    <span className={`dr-piece ${p.side === 0 ? "dr-you" : "dr-them"}${p.king ? " is-king" : ""}${taken.includes(i) ? " is-taken" : ""}`}>
                      {p.king && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16l-1.5-9-4.2 3.6L12 6l-2.3 5.6L5.5 8z" /></svg>}
                    </span>
                  )}
                  {isDest && !p && <span className="dr-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {tourney && phase === "over" && (
            <div className="arc-overlay" role="dialog" aria-label="Game over">
              <p className="arc-overlay-kicker">{resigned ? "RESIGNED" : "GAME OVER"}</p>
              <h2>{resigned ? "You resigned." : game.winner === 0 ? "You win." : game.winner === 1 ? "Computer wins." : "A draw."}</h2>
              <p>{resigned ? "The computer wins." : game.winner === "draw" ? `${DRAW_PLIES / 2} moves each without a capture.` : `You have ${mine.men + mine.kings} left, the computer ${theirs.men + theirs.kings}.`}</p>
              <p role="status">{tourney.finishedText ?? "Checking your game…"}</p>
            </div>
          )}
          {!tourney && phase !== "playing" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{phase === "over" ? "GAME OVER" : `${n} × ${n} · ${VARIANTS[variant].rules === "african" ? "AFRICAN" : "ENGLISH"} RULES`}</p>
              <h2>{phase === "ready" ? "Jump and crown." : game.winner === 0 ? "You win." : game.winner === 1 ? "Computer wins." : "A draw."}</h2>
              <p>{phase === "ready" ? `You play light and go first. ${VARIANTS[variant].intro}` : game.winner === "draw" ? `${DRAW_PLIES / 2} moves each without a capture.` : `You have ${mine.men + mine.kings} left, the computer ${theirs.men + theirs.kings}.`}</p>
              <button type="button" className="arc-btn" onClick={start} aria-label={phase === "over" ? "Play again" : "Start game"}>{phase === "over" ? "PLAY AGAIN" : "START GAME"}</button>
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
        <ArcadeNana
          slug="draughts"
          context={tourney ? { mode: "tournament" } : undefined}
          canAsk={!tourney && phase === "playing" && !game.over && game.turn === 0 && !anim && steps.length === 0}
          onAsk={() => {
            // Synchronous on tap: the hint search is capped (lib/arcade/nana-draughts.ts TIP_BUDGET) and comes back in tens of milliseconds.
            const t = tourney ? null : draughtsTip(game); // Nana sits out tournaments
            setHint(t ? t.highlight : null);
            return t ? t.tip : null;
          }}
          take={take}
          resetKey={gameNo}
          onToggle={() => setHint(null)}
        />
      </div>

      <style jsx global>{`
        .dr-tourney { margin:0 4px 8px; color:#83b83c; font:700 9px ui-monospace,monospace; letter-spacing:.12em; }
        .dr-wrap { padding:clamp(6px,1.6vw,12px); }
        .dr-board { display:grid; aspect-ratio:1; border-radius:6px; overflow:hidden; box-shadow:0 0 0 1px #ffffff14; }
        .dr-sq { position:relative; display:grid; place-items:center; aspect-ratio:1; min-width:0; padding:0; border:0; }
        .dr-light { background:#e9ebe0; }
        .dr-dark { background:#2c4136; color:inherit; font:inherit; cursor:default; touch-action:manipulation; }
        .dr-dark:disabled { cursor:default; }
        .dr-dark.is-movable, .dr-dark.is-dest { cursor:pointer; }
        .dr-dark.is-last { background:#3d5444; box-shadow:inset 0 0 0 2px #ff816d66; }
        .dr-dark.is-movable .dr-piece { box-shadow:0 0 0 2px #9bd34d99,0 3px 0 #0005; }
        .dr-dark.is-held { background:#465f3a; }
        .dr-dark.is-held .dr-piece { box-shadow:0 0 0 3px #bdf36b,0 4px 8px #0007; transform:scale(1.04); }
        .dr-dark.is-dest { background:#37503f; }
        .dr-dark.is-dest:hover { background:#41603f; }
        .dr-dark:focus-visible { outline:2px solid #bdf36b; outline-offset:-3px; z-index:1; }
        .dr-dark.is-hint { box-shadow:inset 0 0 0 3px #ffd166, inset 0 0 16px #ffd16699; animation:dr-hint 1.4s ease-in-out infinite; }
        @keyframes dr-hint { 50% { box-shadow:inset 0 0 0 3px #ffd166, inset 0 0 24px #ffd166dd; } }
        .dr-dot { width:28%; height:28%; border-radius:50%; background:#bdf36b; box-shadow:0 0 10px #bdf36b88; }
        .dr-piece { display:grid; place-items:center; width:76%; height:76%; border-radius:50%; transition:transform .12s,opacity .2s; }
        .dr-you { background:radial-gradient(circle at 40% 35%,#ffffff 0%,#f3f1e4 45%,#d9d6c3 100%); box-shadow:0 3px 0 #0005,inset 0 0 0 3px #e2dfcc,inset 0 0 0 5px #f9f8f0; }
        .dr-them { background:radial-gradient(circle at 40% 35%,#ffa08f 0%,#ff816d 50%,#d9604e 100%); box-shadow:0 3px 0 #0006,inset 0 0 0 3px #e86d5a,inset 0 0 0 5px #ff937f; }
        .dr-piece svg { width:52%; height:52%; }
        .dr-you svg { fill:#83b83c; }
        .dr-them svg { fill:#fff3d6; }
        .dr-piece.is-taken { opacity:.35; transform:scale(.85); }
        @media(prefers-reduced-motion:reduce) { .dr-piece { transition:none; } .dr-dark.is-hint { animation:none; } }
      `}</style>
    </ArcadeShell>
  );
}
