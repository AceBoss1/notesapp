"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import ArcadeAdSpot from "./ArcadeAdSpot";
import {
  BOARD, CITIES, ROUND_CAP,
  aiAction, applyAction, buildable, canBuy, createGame, formatNaira, netWorth, rentFor, squareCell,
  type Action, type Square, type State,
} from "@/lib/arcade/landlord";

const AI_DELAY = 600;
const WINS_KEY = "notes-arcade-landlord-wins";

// Pip positions (3×3 grid, 0–8) for each die face.
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

const SPECIAL_TINT: Partial<Record<Square["kind"], string>> = {
  start: "#bdf36b", market: "#f4e3c1", fortune: "#d9eccd", tax: "#e9e1d8", holdup: "#ffc9bf", rest: "#dfe9e4", park: "#d6dde9",
};

function Die({ value }: { value: number }) {
  return (
    <span className="ll-die" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[value]?.includes(i) ? "on" : ""} />)}
    </span>
  );
}

function squareLabel(g: State, i: number): string {
  const sq = BOARD[i];
  const parts = [sq.name];
  if (sq.city) parts.push(CITIES[sq.city].name);
  const owner = g.owner[i];
  if (sq.price) parts.push(owner === null ? `for sale, ${formatNaira(sq.price)}` : `owned by ${g.players[owner].name}, rent ${formatNaira(rentFor(g, i))}`);
  if (g.flats[i]) parts.push(`${g.flats[i]} flat${g.flats[i] > 1 ? "s" : ""}`);
  const here = g.players.filter((p) => !p.out && p.pos === i).map((p) => p.name);
  if (here.length) parts.push(`here: ${here.join(", ")}`);
  return parts.join(", ");
}

function squareInfo(g: State, i: number): string {
  const sq = BOARD[i];
  switch (sq.kind) {
    case "start": return "Start: collect N$200k salary each time you pass.";
    case "market": case "fortune": return `${sq.name}: draw a card.`;
    case "tax": return "Tax office: pay 10% of your cash.";
    case "holdup": return "Traffic Hold-up: miss your next turn.";
    case "rest": return "Rest Stop: nothing happens. Breathe.";
    case "park": {
      const owner = g.owner[i];
      const scale = "rent N$30k, N$60k or N$90k for one, two or three parks";
      if (owner === null) return `${sq.name}, a Danfo Park: ${formatNaira(sq.price ?? 0)}, ${scale}.`;
      return `${sq.name}, a Danfo Park: ${g.players[owner].name}'s, rent ${formatNaira(rentFor(g, i))} (${scale}).`;
    }
    default: {
      const owner = g.owner[i];
      const city = sq.city ? ` (${CITIES[sq.city].name}, flat ${formatNaira(CITIES[sq.city].flatCost)})` : "";
      if (owner === null) return `${sq.name}${city}: ${formatNaira(sq.price ?? 0)}, rent from ${formatNaira(sq.rent ?? 0)}.`;
      return `${sq.name}${city}: ${g.players[owner].name}'s, rent ${formatNaira(rentFor(g, i))}.`;
    }
  }
}

export default function LandlordGame() {
  const [game, setGame] = useState<State>(() => createGame());
  const [started, setStarted] = useState(false);
  const [buildMode, setBuildMode] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const [muted, setMuted] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);
  const logRef = useRef<HTMLOListElement | null>(null);
  const countedRef = useRef(false);

  const me = game.players[0];
  const myTurn = started && game.phase !== "over" && game.turn === 0 && !me.out;
  const finished = game.phase === "over" || me.out;
  const myBuilds = myTurn ? buildable(game, 0) : [];

  useEffect(() => {
    try {
      setWins(Number(arcadeStore.getItem(WINS_KEY)) || 0);
    } catch {
      /* storage blocked: start from 0 */
    }
  }, []);

  const beep = useCallback((freq: number, dur: number) => {
    if (muted || typeof window === "undefined" || !window.AudioContext) return;
    if (!audioRef.current) audioRef.current = new window.AudioContext();
    const ctx = audioRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    vol.gain.setValueAtTime(0.0001, now);
    vol.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }, [muted]);

  const act = useCallback((a: Action) => {
    setGame((g) => {
      try {
        return applyAction(g, a);
      } catch {
        return g; // a stale tap: ignore it
      }
    });
    if (a.type === "roll") beep(520, 0.08);
    else if (a.type === "buy" || a.type === "build") beep(780, 0.12);
  }, [beep]);

  // Computer turns, one action at a time so you can follow.
  useEffect(() => {
    if (!started || finished || game.players[game.turn].human) return;
    const t = window.setTimeout(() => setGame((g) => (g.phase === "over" || g.players[g.turn].human ? g : applyAction(g, aiAction(g)))), AI_DELAY);
    return () => window.clearTimeout(t);
  }, [game, started, finished]);

  // Count a win once per game.
  useEffect(() => {
    if (game.phase !== "over" || game.winner !== 0 || countedRef.current) return;
    countedRef.current = true;
    setWins((w) => {
      const next = w + 1;
      try {
        arcadeStore.setItem(WINS_KEY, String(next));
      } catch {
        /* storage blocked: keep the count for this visit */
      }
      return next;
    });
  }, [game.phase, game.winner]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game.log]);

  // Leave build mode when there's nothing left to build.
  useEffect(() => {
    if (buildMode && myBuilds.length === 0) setBuildMode(false);
  }, [buildMode, myBuilds.length]);

  const newGame = useCallback(() => {
    setGame(createGame());
    setStarted(true);
    setBuildMode(false);
    setSelected(null);
    countedRef.current = false;
  }, []);

  const canRoll = myTurn && game.phase === "roll" && !buildMode;
  const buyOpen = myTurn && game.phase === "buy";
  const canBuyNow = buyOpen && canBuy(game);
  const here = BOARD[me.pos];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "r" && canRoll) act({ type: "roll" });
      else if (k === "b" && canBuyNow) act({ type: "buy" });
      else if (k === "s" && buyOpen) act({ type: "skip" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, buyOpen, canBuyNow, canRoll]);

  const onSquare = (i: number) => {
    if (buildMode && myBuilds.includes(i)) {
      act({ type: "build", square: i });
      return;
    }
    setSelected(i);
  };

  let status: string;
  if (!started) status = "Press Start to play.";
  else if (me.out) status = "You ran out of money.";
  else if (game.phase === "over") status = game.winner === 0 ? "You win!" : `${game.players[game.winner ?? 0].name} wins.`;
  else if (buildMode) status = "Tap a glowing plot to build a flat.";
  else if (buyOpen) status = canBuyNow ? `Buy ${here.name} for ${formatNaira(here.price ?? 0)}?` : `You can't afford ${here.name}.`;
  else if (myTurn) status = myBuilds.length ? "Your turn. Build a flat or roll." : "Your turn. Roll the dice.";
  else status = `${game.players[game.turn].name} is thinking…`;

  const current = game.players[game.turn];
  const winnerName = game.winner !== null ? game.players[game.winner].name : "";

  return (
    <ArcadeShell game={arcadeGame("landlord")} index={5}>
      <div className="arc-console ll-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOUR CASH</span><strong aria-live="polite">{formatNaira(me.cash)}</strong></div>
          <div className="arc-stat"><span className="arc-label">ROUND</span><strong>{game.round}/{ROUND_CAP}</strong></div>
          <div className="arc-stat"><span className="arc-label">WINS</span><strong>{wins}</strong></div>
          <span className="arc-spacer" />
          <button type="button" className="arc-btn-ghost" onClick={() => setMuted((m) => !m)} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <button type="button" className="arc-btn-ghost" onClick={newGame} aria-label="Start a new game">NEW GAME</button>
        </div>

        <div className="arc-board-wrap ll-wrap">
          <div className="ll-board" role="group" aria-label="Naija Landlord board">
            {BOARD.map((sq, i) => {
              const { row, col } = squareCell(i);
              const owner = game.owner[i];
              const tokens = game.players.map((p, pi) => ({ p, pi })).filter(({ p }) => !p.out && p.pos === i);
              const glow = buildMode && myBuilds.includes(i);
              const band = sq.city ? CITIES[sq.city].colour : SPECIAL_TINT[sq.kind];
              const corner = i % 8 === 0;
              return (
                <button
                  key={i}
                  type="button"
                  className={`ll-sq${corner ? " is-corner" : ""}${glow ? " is-glow" : ""}${selected === i ? " is-sel" : ""}${sq.city ? "" : " is-special"}`}
                  style={{ gridRow: row, gridColumn: col, ["--band" as string]: band ?? "#eee" }}
                  onClick={() => onSquare(i)}
                  aria-label={glow ? `Build a flat on ${sq.name}` : squareLabel(game, i)}
                >
                  <span className="ll-band" />
                  <span className="ll-name">{sq.short}</span>
                  {sq.price ? <span className="ll-price">{owner === null ? formatNaira(sq.price) : formatNaira(rentFor(game, i))}</span> : null}
                  {game.flats[i] > 0 && <span className="ll-flats" aria-hidden="true">{Array.from({ length: game.flats[i] }, (_, k) => <i key={k} />)}</span>}
                  {tokens.length > 0 && (
                    <span className="ll-tokens" aria-hidden="true">
                      {tokens.map(({ p, pi }) => <i key={pi} style={{ background: p.colour }} className={pi === game.turn ? "is-turn" : ""} />)}
                    </span>
                  )}
                  {owner !== null && <span className="ll-owner" style={{ background: game.players[owner].colour }} />}
                </button>
              );
            })}

            <div className="ll-hud">
              <div className="ll-dice" aria-label={game.dice ? `Dice: ${game.dice[0]} and ${game.dice[1]}` : "Dice not rolled yet"}>
                {game.dice ? <><Die value={game.dice[0]} /><Die value={game.dice[1]} /></> : <><Die value={1} /><Die value={1} /></>}
              </div>
              <p className="ll-turn"><i style={{ background: current.colour }} />{finished ? "Game over" : current.human ? "Your turn" : `${current.name}'s turn`}</p>
              {game.lastCard && <p className="ll-card">{game.lastCard}</p>}
              {/* The middle of the board carries an advert, like a billboard in the town square (owner, 20 Nov 2026). */}
              <div className="ll-ad"><ArcadeAdSpot variant="tile" game="landlord" pin="landlord-tile" /></div>
              {/* A second square on the left of the middle (owner, 21 Nov 2026: "the left side is also ad spot"). */}
              <div className="ll-ad ll-ad-left"><ArcadeAdSpot variant="tile" game="landlord" offset={1} pin="landlord-tile" /></div>
            </div>

            <div className="ll-panel">
              <ul className="ll-players" aria-label="Players">
                {game.players.map((p, i) => (
                  <li key={i} className={`${i === game.turn && !finished ? "is-turn" : ""}${p.out ? " is-out" : ""}`}>
                    <i style={{ background: p.colour }} />
                    <span>{p.name}</span>
                    <b>{p.out ? "out" : formatNaira(p.cash)}</b>
                  </li>
                ))}
              </ul>
              <div className="ll-actions">
                <button type="button" className="arc-btn" disabled={!canRoll} onClick={() => act({ type: "roll" })} aria-label="Roll the dice">ROLL</button>
                <button type="button" className="arc-btn" disabled={!canBuyNow} onClick={() => act({ type: "buy" })} aria-label={buyOpen ? `Buy ${here.name}` : "Buy this plot"}>BUY{canBuyNow ? ` ${formatNaira(here.price ?? 0)}` : ""}</button>
                <button type="button" className="arc-btn-ghost" disabled={!buyOpen} onClick={() => act({ type: "skip" })} aria-label="Skip buying">SKIP</button>
                <button type="button" className="arc-btn-ghost" disabled={!myBuilds.length} aria-pressed={buildMode} onClick={() => setBuildMode((b) => !b)} aria-label={buildMode ? "Stop building" : "Build a flat"}>{buildMode ? "DONE" : "BUILD"}</button>
              </div>
              <p className="ll-info">{selected !== null ? squareInfo(game, selected) : "Tap a square to see its details."}</p>
              <ol className="ll-log" ref={logRef} aria-label="What happened" aria-live="polite">
                {game.log.slice(-14).map((line, i) => <li key={`${game.log.length}-${i}`}>{line}</li>)}
              </ol>
            </div>
          </div>

          {!started && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">YOU VS 3 COMPUTER PLAYERS</p>
              <h2>Naija Landlord</h2>
              <p>Everyone starts with N$1,500k. Buy plots, build flats, collect rent.</p>
              <button type="button" className="arc-btn" onClick={newGame} aria-label="Start the game">START</button>
            </div>
          )}
          {started && finished && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{game.endReason === "cap" ? `${ROUND_CAP} ROUNDS PLAYED` : "GAME OVER"}</p>
              <h2>{me.out ? "You're out" : game.winner === 0 ? "You win!" : `${winnerName} wins`}</h2>
              <p>
                {me.out
                  ? "You couldn't cover a bill. Better luck next time."
                  : game.endReason === "cap"
                    ? `Richest landlord: ${winnerName}, worth ${formatNaira(netWorth(game, game.winner ?? 0))}.`
                    : `${game.winner === 0 ? "You're" : `${winnerName} is`} the last landlord standing.`}
              </p>
              <button type="button" className="arc-btn" onClick={newGame} aria-label="Play again">PLAY AGAIN</button>
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
      </div>

      <style jsx global>{`
        .ll-wrap { padding:8px; background:#1b2a23; }
        .ll-board { display:grid; grid-template-columns:repeat(9,minmax(0,1fr)); gap:3px; }
        .ll-sq { position:relative; aspect-ratio:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:1px; padding:0 2px 6px; overflow:hidden; border:0; border-radius:5px; background:#f7f7f2; color:#17251f; cursor:pointer; font:inherit; text-align:center; }
        .ll-sq.is-special { background:color-mix(in srgb, var(--band) 45%, #f7f7f2); }
        .ll-sq:focus-visible { outline:2px solid #bdf36b; outline-offset:1px; z-index:2; }
        .ll-sq.is-sel { box-shadow:inset 0 0 0 2px #83b83c; }
        .ll-sq.is-glow { box-shadow:0 0 0 2px #bdf36b, 0 0 12px #bdf36b; animation:ll-pulse 1.1s ease-in-out infinite; }
        .ll-band { flex:0 0 auto; width:calc(100% + 4px); height:16%; background:var(--band); }
        .ll-sq.is-special .ll-band { display:none; }
        .ll-sq.is-special .ll-name { margin-top:14%; }
        .ll-sq.is-corner .ll-name { font-weight:700; }
        .ll-name { margin-top:2px; font:600 clamp(5.5px,1.3vw,9px)/1.1 ui-monospace,monospace; letter-spacing:-.02em; overflow-wrap:anywhere; hyphens:auto; }
        .ll-price { color:#5c685f; font:500 clamp(5px,1.15vw,8.5px)/1 ui-monospace,monospace; }
        .ll-flats { display:flex; gap:2px; }
        .ll-flats i { width:clamp(3px,.9vw,6px); height:clamp(3px,.9vw,6px); border-radius:50%; background:#17251f; }
        .ll-tokens { position:absolute; left:2px; right:2px; bottom:6px; display:flex; justify-content:center; flex-wrap:wrap; gap:1px; }
        .ll-tokens i { width:clamp(7px,2.2vw,14px); height:clamp(7px,2.2vw,14px); border-radius:50%; border:1.5px solid #fff; box-shadow:0 1px 2px #0005; }
        .ll-tokens i.is-turn { outline:1.5px solid #17251f; }
        .ll-owner { position:absolute; left:0; right:0; bottom:0; height:4px; }
        .ll-hud { position:relative; grid-row:2 / 4; grid-column:2 / 9; display:flex; align-items:center; justify-content:center; gap:10px 14px; flex-wrap:wrap; padding:8px 4px 2px; color:#f7f7f2; min-width:0; }
        .ll-dice { display:flex; gap:8px; }
        .ll-ad { position:absolute; top:6px; right:8px; }.ll-ad-left { right:auto; left:8px; }
        .ll-die { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; width:34px; height:34px; padding:5px; border-radius:7px; background:#f7f7f2; box-shadow:0 2px 0 #0004; }
        .ll-die i { border-radius:50%; }
        .ll-die i.on { background:#17251f; }
        .ll-turn { display:flex; align-items:center; gap:7px; margin:0; font:500 18px/1.1 Georgia,serif; letter-spacing:-.02em; }
        .ll-turn i { width:12px; height:12px; border-radius:50%; border:1.5px solid #fff; }
        .ll-card { flex-basis:100%; margin:0; color:#c1e993; font:600 9px/1.4 ui-monospace,monospace; letter-spacing:.03em; text-align:center; }
        .ll-panel { grid-row:4 / 9; grid-column:2 / 9; contain:size; display:flex; flex-direction:column; gap:7px; min-height:0; padding:4px 6px 6px; overflow:hidden; color:#dfe6e0; }
        .ll-players { display:grid; grid-template-columns:1fr 1fr; gap:3px 10px; margin:0; padding:0; list-style:none; font:600 10px ui-monospace,monospace; }
        .ll-players li { display:flex; align-items:center; gap:6px; padding:3px 6px; border-radius:5px; }
        .ll-players li.is-turn { background:#ffffff14; }
        .ll-players li.is-out { opacity:.4; text-decoration:line-through; }
        .ll-players i { width:9px; height:9px; flex:0 0 auto; border-radius:50%; }
        .ll-players b { margin-left:auto; color:#fff; font-weight:600; }
        .ll-actions { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
        .ll-actions .arc-btn, .ll-actions .arc-btn-ghost { padding:9px 4px; min-height:36px; white-space:nowrap; }
        .ll-actions .arc-btn-ghost:disabled { opacity:.45; cursor:default; }
        .ll-actions .arc-btn-ghost[aria-pressed="true"] { background:#bdf36b; color:#20301e; }
        .ll-info { margin:0; color:#aebbb1; font:500 9px/1.4 ui-monospace,monospace; }
        .ll-log { flex:1; min-height:0; margin:0; padding:6px 8px 6px 22px; overflow-y:auto; border-radius:6px; background:#ffffff0d; font:500 9.5px/1.45 ui-monospace,monospace; color:#cfd8d1; }
        .ll-log li:last-child { color:#fff; }
        @keyframes ll-pulse { 50% { box-shadow:0 0 0 2px #bdf36b, 0 0 4px #bdf36b; } }
        @media (max-width:640px) {
          .ll-wrap { padding:5px; }
          .ll-board { gap:2px; }
          .ll-sq { border-radius:3px; padding-bottom:5px; }
          .ll-hud { grid-row:2 / 9; flex-direction:column; justify-content:center; gap:8px; }
          .ll-turn { font-size:15px; }
          .ll-card { flex-basis:auto; max-width:100%; padding:0 6px; }
          .ll-die { width:28px; height:28px; padding:4px; }
          .ll-panel { grid-row:10; grid-column:1 / -1; contain:none; padding:10px 2px 4px; }
          .ll-log { height:120px; flex:none; }
          .ll-players { font-size:10px; }
        }
        @media (max-width:420px) {
          .ll-console { padding:10px 8px; }
          .ll-wrap { padding:4px; }
          .ll-board { gap:1.5px; }
          .ll-sq { padding:0 1px 4px; border-radius:2px; }
          .ll-band { width:calc(100% + 2px); }
          .ll-name { margin-top:1px; font-size:5.5px; line-height:1.05; letter-spacing:-.03em; }
          .ll-price { font-size:5px; }
          .ll-owner { height:3px; }
          .ll-tokens { bottom:4px; }
          .ll-tokens i { width:7px; height:7px; border-width:1px; }
        }
        @media (prefers-reduced-motion:reduce) { .ll-sq.is-glow { animation:none; } }
      `}</style>
    </ArcadeShell>
  );
}
