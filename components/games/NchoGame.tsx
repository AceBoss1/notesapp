"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { ARCADE_GAMES, arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import {
  MAX_ROUNDS, applyMove, chooseMove, housesOf, initialState, legalMoves, sideOfHole,
  type HolesPerSide, type Level, type NchoMove, type NchoState, type NchoVariant, type Player, type RoundSummary, type RoundsTarget,
} from "@/lib/arcade/ncho";

type Phase = "ready" | "playing" | "round" | "over";
type View = { pits: number[]; stores: [number, number]; owner: Player[]; active: number | null; taken: number[] };
type Frame = { pits: number[]; stores: [number, number]; active: number | null; taken: number[]; tone: number | null };

const STEP_MS = 110; // one seed per step: quick, but you can follow it
const LONG_STEP_MS = 80; // the 12-hole board has longer sowings
const MIN_STEP_MS = 28; // relays can be long: the step shortens so a move never drags on
const MAX_ANIM_MS = 7000;
const THINK_MS = 550;
// Each variant keeps its own win count.
const WINS_KEYS: Record<NchoVariant, string> = { ncho: "arcade-ncho-wins", akahausa: "arcade-akahausa-wins" };
const SEED_COLOURS = ["#f0c27b", "#e2a05f", "#f6dca8", "#d4834f"];
const PORTRAIT_PHONE = "(orientation: portrait) and (max-width: 740px)";

const viewOf = (s: NchoState): View => ({ pits: s.pits.slice(), stores: [s.stores[0], s.stores[1]], owner: s.owner.slice(), active: null, taken: [] });
const viewOfRoundEnd = (r: RoundSummary): View => ({ pits: r.finalPits.slice(), stores: [r.finalStores[0], r.finalStores[1]], owner: r.finalOwner.slice(), active: null, taken: [] });
const other = (p: Player): Player => (p === 0 ? 1 : 0);
// Top row: the computer's starting holes, right to left (n..2n-1 drawn from 2n-1 down). Bottom row: yours, left to right.
const rowsFor = (n: number) => ({
  top: Array.from({ length: n }, (_, i) => 2 * n - 1 - i),
  bottom: Array.from({ length: n }, (_, i) => i),
});
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const roundsLabel = (t: number | "all") => (t === "all" ? "until one side has every house" : `of ${t}`);

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

// "You sowed 4, lifted 5 and kept going… made 4: took 4."
function describeMove(m: NchoMove): string {
  const you = m.player === 0;
  let text = `${you ? "You" : "Computer"} sowed ${m.sowings[0].seeds}`;
  if (m.relays > 0 && m.relays <= 3) text += m.sowings.slice(1).map((l) => `, lifted ${l.seeds} and kept going`).join("");
  else if (m.relays > 3) text += `, lifted and kept going ${m.relays} times`;
  const onTheWay = m.captures.filter((c) => !c.last);
  const toYou = onTheWay.filter((c) => c.to === 0).length;
  const toThem = onTheWay.length - toYou;
  const end = m.end === "four" ? "… made 4: took 4." : m.end === "empty" ? "… landed in an empty hole." : "… stopped after 300 sowings.";
  const extras: string[] = [];
  if (toYou) extras.push(`${toYou === 1 ? "A 4" : `${toYou} fours`} on the way went to you.`);
  if (toThem) extras.push(`${toThem === 1 ? "A 4" : `${toThem} fours`} on the way went to the computer.`);
  return `${text}${end}${extras.length ? ` ${extras.join(" ")}` : ""}`;
}

// The seed-by-seed frames of a move: lift, drop, drop… and each 4 lit up then taken.
function framesFor(state: NchoState, m: NchoMove): Frame[] {
  const pits = state.pits.slice();
  const stores: [number, number] = [state.stores[0], state.stores[1]];
  const frames: Frame[] = [];
  let step = 0;
  for (const lap of m.sowings) {
    pits[lap.from] = 0;
    frames.push({ pits: pits.slice(), stores: [stores[0], stores[1]], active: lap.from, taken: [], tone: null });
    for (const h of lap.path) {
      pits[h] += 1;
      frames.push({ pits: pits.slice(), stores: [stores[0], stores[1]], active: h, taken: [], tone: 420 + (step % 6) * 40 });
      const cap = m.captures.find((c) => c.step === step);
      if (cap) {
        frames.push({ pits: pits.slice(), stores: [stores[0], stores[1]], active: h, taken: [h], tone: null });
        pits[h] = 0;
        stores[cap.to] += 4;
        frames.push({ pits: pits.slice(), stores: [stores[0], stores[1]], active: null, taken: [h], tone: 660 });
      }
      step++;
    }
  }
  return frames;
}

// variant "akahausa" is Aka-Hausa: exactly the same game sown clockwise, with a computer that looks one move further
// ahead (lib/arcade/ncho.ts has the rules). The board can be 6 holes a side (standard) or 12 (Nchokoroto), and the game
// lasts the number of rounds the player picks. Whoever lost the last game starts the next one (a tie alternates).
export default function NchoGame({ variant = "ncho" }: { variant?: NchoVariant }) {
  const clockwise = variant === "akahausa";
  const slug = clockwise ? "akahausa" : "ncho";
  const gameName = clockwise ? "Aka-Hausa" : "Ncho";
  const WINS_KEY = WINS_KEYS[variant];
  const [holesPerSide, setHolesPerSide] = useState<HolesPerSide>(6);
  const [rounds, setRounds] = useState<RoundsTarget>(3);
  const [game, setGame] = useState<NchoState>(() => initialState(undefined, 0, variant));
  const [view, setView] = useState<View>(() => viewOf(initialState(undefined, 0, variant)));
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState<Level>("medium");
  const [busy, setBusy] = useState(false); // sowing animation running
  const [status, setStatus] = useState("Press start to play.");
  const [wins, setWins] = useState(0);
  const [muted, setMuted] = useState(false);
  // Phones held upright get a friendly nudge to turn sideways; "Got it" hides it for this visit (state only).
  const [portraitPhone, setPortraitPhone] = useState(false);
  const [rotateDismissed, setRotateDismissed] = useState(false);
  // Who starts the next game: the loser of the last one (a tie passes it to the other player). You start the first.
  const [nextFirst, setNextFirst] = useState<Player>(0);
  const startedBy = useRef<Player>(0);
  const timers = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const long = game.holesPerSide === 12;

  useEffect(() => {
    try { setWins(Number(arcadeStore.getItem(WINS_KEY)) || 0); } catch { /* storage blocked: start from 0 */ }
  }, [WINS_KEY]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(PORTRAIT_PHONE);
    const update = () => setPortraitPhone(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

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
    setBusy(false);
    const said = describeMove(m);
    const r = next.lastRound;
    if (!r) {
      setView(viewOf(next));
      setStatus(next.turn === 1 ? `${said} Computer is thinking…` : `${said} Your turn.`);
      return;
    }
    // The round is over: show the board as it ended; the overlay explains the count.
    setView(viewOfRoundEnd(r));
    beep(520, 0.2);
    if (!next.over) {
      setPhase("round");
      setStatus(`${said} Round ${r.round} is over.`);
      return;
    }
    setPhase("over");
    const [a, b] = r.houses;
    setStatus(`${said} ${next.winner === 0 ? `You win, ${a} houses to ${b}.` : next.winner === 1 ? `Computer wins, ${b} houses to ${a}.` : `A tie, ${a} houses each.`}`);
    setNextFirst(next.winner === 0 ? 1 : next.winner === 1 ? 0 : other(startedBy.current));
    if (next.winner === 0) {
      setWins((w) => {
        try { arcadeStore.setItem(WINS_KEY, String(w + 1)); } catch { /* ignore */ }
        return w + 1;
      });
    }
  }, [WINS_KEY, beep]);

  // Sow seed by seed, relays and all, so you can follow where they go and see each 4 taken.
  const play = useCallback((state: NchoState, hole: number) => {
    const next = applyMove(state, hole);
    const m = next.last!;
    if (prefersReducedMotion()) { finishMove(next); return; }
    setBusy(true);
    const frames = framesFor(state, m);
    const base = state.holesPerSide === 12 ? LONG_STEP_MS : STEP_MS;
    const step = Math.max(MIN_STEP_MS, Math.min(base, Math.floor(MAX_ANIM_MS / Math.max(1, frames.length))));
    frames.forEach((f, i) => {
      later(() => {
        setView({ pits: f.pits, stores: f.stores, owner: state.owner, active: f.active, taken: f.taken });
        if (f.tone) beep(f.tone, f.tone === 660 ? 0.14 : 0.05);
      }, step * i);
    });
    later(() => finishMove(next), step * frames.length + (m.captures.length ? 300 : 0));
  }, [beep, finishMove, later]);

  // Computer's turn.
  useEffect(() => {
    if (phase !== "playing" || busy || game.over || game.turn !== 1) return;
    const t = window.setTimeout(() => play(game, chooseMove(game, level)), THINK_MS);
    return () => window.clearTimeout(t);
  }, [busy, game, level, phase, play]);

  const start = useCallback((opts?: { holesPerSide?: HolesPerSide; rounds?: RoundsTarget }) => {
    clearTimers();
    const size = opts?.holesPerSide ?? holesPerSide;
    const target = opts?.rounds ?? rounds;
    startedBy.current = nextFirst;
    const s = initialState(undefined, nextFirst, variant, { holesPerSide: size, rounds: target });
    setGame(s);
    setView(viewOf(s));
    setBusy(false);
    setPhase("playing");
    setStatus(nextFirst === 0 ? "You start. Pick one of your holes." : "The computer starts this game. Computer is thinking…");
  }, [clearTimers, holesPerSide, nextFirst, rounds, variant]);

  const nextRound = () => {
    setView(viewOf(game));
    setPhase("playing");
    setStatus(game.turn === 0 ? `Round ${game.round}: you start. Pick one of your holes.` : `Round ${game.round}: the computer starts. Computer is thinking…`);
  };

  const changeSize = (v: string) => { const n: HolesPerSide = v === "12" ? 12 : 6; setHolesPerSide(n); start({ holesPerSide: n }); };
  const changeRounds = (v: string) => {
    const t: RoundsTarget = v === "all" ? "all" : v === "5" ? 5 : v === "7" ? 7 : 3;
    setRounds(t);
    start({ rounds: t });
  };

  const toggleSound = () => setMuted((m) => { mutedRef.current = !m; return !m; });

  const canPlay = phase === "playing" && !busy && game.turn === 0 && !game.over;
  const legal = canPlay ? legalMoves(game) : [];
  const { top, bottom } = rowsFor(game.holesPerSide);
  const seedMax = long ? 8 : 14;
  const houses: [number, number] = [housesOf(view.owner, 0), housesOf(view.owner, 1)];
  const roundNo = game.lastRound && phase !== "playing" ? game.lastRound.round : game.round;

  const hole = (h: number) => {
    const n = view.pits[h];
    const who = view.owner[h];
    const conquered = who !== sideOfHole(h, game.holesPerSide);
    const isLegal = legal.includes(h);
    const cls = `ncho-hole ${who === 0 ? "own-you" : "own-them"}${conquered ? " is-conquered" : ""}${view.active === h ? " is-active" : ""}${view.taken.includes(h) ? " is-taken" : ""}${isLegal ? " is-legal" : ""}${game.last?.hole === h && !busy && phase === "playing" ? " is-last" : ""}`;
    const whose = who === 0
      ? conquered ? "Your conquered hole on the computer's row" : "Your hole"
      : conquered ? "Computer's conquered hole on your row" : "Computer's hole";
    if (who !== 0) {
      return <div key={h} className={cls} role="img" aria-label={`${whose}, ${plural(n, "seed")}`}><Seeds n={n} max={seedMax} /><b>{n}</b></div>;
    }
    return (
      <button key={h} type="button" className={cls} disabled={!isLegal} onClick={() => play(game, h)}
        aria-label={`${whose}, ${plural(n, "seed")}${isLegal ? "" : ", can't play"}`}>
        <Seeds n={n} max={seedMax} /><b>{n}</b>
      </button>
    );
  };

  const r = game.lastRound;
  const roundOverlay = (sum: RoundSummary) => {
    const won = sum.conquered.filter((c) => c.to === 0).length;
    const lost = sum.conquered.filter((c) => c.to === 1).length;
    const lines: string[] = [];
    if (won) lines.push(`You conquered ${plural(won, "house")}.`);
    if (lost) lines.push(`The computer conquered ${plural(lost, "house")}.`);
    if (!won && !lost) lines.push("No houses changed hands.");
    if (sum.leftover) lines.push(`The last hole went to ${sum.leftover.to === 0 ? "you" : "the computer"} with the 4 leftover seeds.`);
    return (
      <>
        <p className="ncho-final">{`Seeds counted: you ${sum.totals[0]} (${sum.finalStores[0]} in store + ${sum.counted[0]} in your holes), computer ${sum.totals[1]} (${sum.finalStores[1]} + ${sum.counted[1]}).`}</p>
        <p className="ncho-final">{`Houses: you ${sum.houses[0]} · computer ${sum.houses[1]}.`}</p>
        <p>{lines.join(" ")}{sum.reason === "move-cap" ? " (The round ran very long, so it was counted.)" : ""}</p>
      </>
    );
  };
  const endLine = () => {
    if (game.endReason === "all-houses") return game.winner === 0 ? "You have every house." : "The computer has every house.";
    if (game.endReason === "round-cap") return `After ${MAX_ROUNDS} rounds the houses are counted as they stand.`;
    return `After ${plural(typeof game.roundsTarget === "number" ? game.roundsTarget : game.round, "round")}.`;
  };
  const nextLine = nextFirst === 0
    ? game.winner === "draw" ? "A tie, so you start the next game." : "You lost, so you start the next game."
    : game.winner === "draw" ? "A tie, so the computer starts the next game." : "The computer lost, so it starts the next game.";
  const readyKicker = `${clockwise ? "AKA-HAUSA · SOWN CLOCKWISE" : "SOWN ANTICLOCKWISE"} · ${long ? "TWELVE" : "SIX"} HOLES EACH`;
  const showRotate = portraitPhone && !rotateDismissed;

  return (
    <ArcadeShell game={arcadeGame(slug)} index={ARCADE_GAMES.findIndex((g) => g.slug === slug) + 1}>
      <div className="arc-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOUR STORE</span><strong aria-live="polite">{String(view.stores[0]).padStart(2, "0")}</strong></div>
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
          <select className="arc-select" aria-label="Rounds (starts a new game)" value={String(rounds)} onChange={(e) => changeRounds(e.target.value)}>
            <option value="3">ROUNDS: 3</option>
            <option value="5">ROUNDS: 5</option>
            <option value="7">ROUNDS: 7</option>
            <option value="all">ROUNDS: UNTIL ONE SIDE HAS EVERY HOUSE</option>
          </select>
          <button type="button" className="arc-btn-ghost" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <button type="button" className="arc-btn-ghost" onClick={() => start()} aria-label="New game">NEW GAME</button>
        </div>

        {showRotate && (
          <div className="ncho-rotate" role="note">
            <svg className="ncho-rotate-icon" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="10" y="4" width="12" height="22" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M5 21a11 11 0 0 1 3-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M5 10h3.5v3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{`Turn your phone sideways to enjoy ${gameName} better`}</span>
            <button type="button" className="arc-btn-ghost" onClick={() => setRotateDismissed(true)}>GOT IT</button>
          </div>
        )}

        <p className="ncho-info" aria-live="polite">
          <span>{`Round ${roundNo} ${roundsLabel(game.roundsTarget)}`}</span>
          <span>{`Houses: you ${houses[0]} · computer ${houses[1]}`}</span>
          <span className="ncho-key"><i className="k-you" /> yours <i className="k-them" /> computer&apos;s</span>
        </p>

        <div className="arc-board-wrap ncho-wrap">
          <div className={`ncho-board${long ? " ncho-long" : ""}`} style={{ ["--ncho-n" as string]: game.holesPerSide }}
            aria-label={`${gameName} board, ${game.holesPerSide} holes a side. Green-ringed holes are yours, amber-ringed are the computer's; your store is on the right; seeds move ${clockwise ? "clockwise" : "anticlockwise"}.`}>
            <span className="ncho-dir" aria-hidden="true">{clockwise ? "↻ CLOCKWISE" : "↺ ANTICLOCKWISE"}</span>
            <div className="ncho-store ncho-store-them" role="img" aria-label={`Computer's store, ${view.stores[1]} seeds`}>
              <span className="ncho-store-label">COMPUTER</span><Seeds n={view.stores[1]} max={long ? 24 : 30} /><b>{view.stores[1]}</b>
            </div>
            <div className="ncho-row ncho-top">{top.map((h) => hole(h))}</div>
            <div className="ncho-row ncho-bottom">{bottom.map((h) => hole(h))}</div>
            <div className="ncho-store ncho-store-you" role="img" aria-label={`Your store, ${view.stores[0]} seeds`}>
              <span className="ncho-store-label">YOU</span><Seeds n={view.stores[0]} max={long ? 24 : 30} /><b>{view.stores[0]}</b>
            </div>
          </div>
          {phase !== "playing" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{phase === "over" ? "GAME OVER" : phase === "round" && r ? `ROUND ${r.round} OVER` : readyKicker}</p>
              <h2>
                {phase === "ready" ? (clockwise ? "The other way round." : "Sow and gather.")
                  : phase === "round" && r ? `You keep ${plural(r.houses[0], "house")}.`
                  : game.winner === 0 ? "You win." : game.winner === 1 ? "Computer wins." : "A tie."}
              </h2>
              {phase === "ready" && (
                <p>{`Your holes have green rings and your store is on the right. Relay-sow from one of your holes; make exactly 4 with your last seed to take them. Win houses over ${rounds === "all" ? "as many rounds as it takes" : `${rounds} rounds`}.`}</p>
              )}
              {phase === "round" && r && (
                <>
                  {roundOverlay(r)}
                  <p>{r.nextStarter === 0 ? `${r.houses[0] === r.houses[1] ? "Equal houses" : "You have fewer houses"}, so you start round ${game.round}.` : `${r.houses[0] === r.houses[1] ? "Equal houses" : "The computer has fewer houses"}, so it starts round ${game.round}.`}</p>
                </>
              )}
              {phase === "over" && (
                <>
                  {r && roundOverlay(r)}
                  <p className="ncho-final">{endLine()}</p>
                  <p>{nextLine}</p>
                </>
              )}
              {phase === "round"
                ? <button type="button" className="arc-btn" onClick={nextRound} aria-label="Next round">NEXT ROUND</button>
                : <button type="button" className="arc-btn" onClick={() => start()} aria-label={phase === "over" ? "Play again" : "Start game"}>{phase === "over" ? "PLAY AGAIN" : "START GAME"}</button>}
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
      </div>

      <style jsx global>{`
        .ncho-wrap { background:#1b2a23; }
        /* A short board on an upright phone: the start, round and game-over messages stay readable (the board keeps room for them). */
        @media(max-width:740px) { .ncho-wrap { min-height:230px; } .ncho-wrap .arc-overlay { padding:12px; } .ncho-wrap .arc-overlay h2 { font-size:24px; margin-bottom:4px; } .ncho-wrap .arc-overlay p { margin:0 0 10px; font-size:11.5px; line-height:1.5; } .ncho-wrap .arc-overlay-kicker { margin-bottom:4px; } }
        .ncho-info { display:flex; flex-wrap:wrap; justify-content:center; gap:4px 16px; margin:0 0 8px; color:#3f5a2c; font:600 11px ui-monospace,monospace; letter-spacing:.06em; }
        .ncho-key { display:inline-flex; align-items:center; gap:5px; color:#6d7870; }
        .ncho-key i { display:inline-block; width:10px; height:10px; border-radius:50%; background:#16221c; }
        .ncho-key .k-you { box-shadow:inset 0 0 0 2px #9bd34d; }
        .ncho-key .k-them { box-shadow:inset 0 0 0 2px #f0a85b; margin-left:6px; }
        .ncho-rotate { display:flex; align-items:center; gap:10px; margin:0 0 8px; padding:8px 10px; border-radius:8px; background:#24352c; color:#f6dca8; font:600 12px/1.35 ui-monospace,monospace; box-shadow:inset 0 0 0 1px #f0c27b44; }
        .ncho-rotate span { flex:1; }
        .ncho-rotate-icon { flex:none; width:26px; height:26px; color:#f0c27b; animation:ncho-tilt 2.4s ease-in-out infinite; }
        @keyframes ncho-tilt { 0%,35% { transform:rotate(0deg); } 55%,90% { transform:rotate(-90deg); } 100% { transform:rotate(0deg); } }
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
        /* Ownership: a green inner ring for your holes, amber for the computer's (conquered holes sit on the other row). */
        .ncho-hole { --own:#9bd34d66; position:relative; overflow:hidden; aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-width:0; padding:4px; border:0; border-radius:50%; background:radial-gradient(circle at 50% 38%,#0e1813 0%,#16221c 62%,#26332c 100%); box-shadow:inset 0 0 0 2px var(--own),inset 0 4px 9px #000b,0 1px 0 #ffffff14; color:#f6dca8; font:inherit; transition:box-shadow .12s,transform .12s; }
        .ncho-hole.own-them { --own:#f0a85b77; }
        .ncho-hole.is-conquered.own-you { --own:#9bd34dcc; background:radial-gradient(circle at 50% 38%,#0e1813 0%,#1a2a1a 62%,#2c3d26 100%); }
        .ncho-hole.is-conquered.own-them { --own:#f0a85bcc; background:radial-gradient(circle at 50% 38%,#0e1813 0%,#2a2219 62%,#3a2f22 100%); }
        button.ncho-hole { cursor:pointer; touch-action:manipulation; }
        button.ncho-hole:disabled { cursor:default; }
        .ncho-hole.is-legal { box-shadow:inset 0 0 0 2px var(--own),inset 0 4px 9px #000b,0 0 0 2px #9bd34d88; }
        .ncho-hole.is-legal:hover { box-shadow:inset 0 0 0 2px var(--own),inset 0 4px 9px #000b,0 0 0 2px #bdf36b; transform:translateY(-1px); }
        .ncho-hole:focus-visible { outline:2px solid #bdf36b; outline-offset:2px; }
        .ncho-hole.is-last { box-shadow:inset 0 0 0 2px var(--own),inset 0 4px 9px #000b,0 0 0 2px #ff816d88; }
        .ncho-hole.is-active { box-shadow:inset 0 0 0 2px var(--own),inset 0 4px 9px #000b,0 0 0 2px #f0c27b; }
        .ncho-hole.is-taken { box-shadow:inset 0 0 0 2px var(--own),inset 0 4px 9px #000b,0 0 0 3px #ff816d; background:radial-gradient(circle,#3a2320 0%,#16221c 80%); }
        .ncho-hole b { color:#f6dca8cc; font:600 clamp(9px,2vw,12px) ui-monospace,monospace; line-height:1; }
        .ncho-hole.own-you b { color:#e7f7cf; }
        .ncho-seeds { display:flex; flex-wrap:wrap; justify-content:center; gap:2px; max-width:78%; }
        .ncho-seeds i { display:block; width:clamp(4px,1.1vw,7px); height:clamp(4px,1.1vw,7px); border-radius:50%; box-shadow:inset -1px -1px 0 #0004,0 1px 1px #0006; }
        .ncho-final { color:#f6dca8 !important; font:600 12px ui-monospace,monospace; letter-spacing:.04em; }
        /* Nchokoroto: twelve holes a row. Narrower stores, tighter gaps; the holes shrink and the seed dots go when they're tiny. */
        .ncho-long { grid-template-columns:minmax(0,1fr) minmax(0,12fr) minmax(0,1fr); gap:clamp(3px,.9vw,8px); }
        .ncho-long .ncho-row { gap:clamp(2px,.55vw,6px); }
        .ncho-long .ncho-hole { padding:2px; gap:2px; }
        .ncho-long .ncho-hole b { font-size:clamp(8px,1.5vw,11px); }
        .ncho-long .ncho-seeds { gap:1px; max-width:84%; }
        .ncho-long .ncho-seeds i { width:clamp(3px,.75vw,6px); height:clamp(3px,.75vw,6px); }
        .ncho-long .ncho-store { padding:10px 2px; }
        .ncho-long .ncho-store-label { display:none; } /* the pots are short here; the score row names them */
        @media(max-width:520px) and (orientation:portrait) { .ncho-long .ncho-hole .ncho-seeds { display:none; } }
        @media(max-width:420px) { .ncho-store-label { display:none; } .ncho-store { padding:8px 2px; } .ncho-long .ncho-store { padding:6px 1px; } .ncho-long { padding:14px 6px 6px; } .ncho-long .ncho-store .ncho-seeds { display:none; } }
        /* Phones turned sideways: use the full width, slimmer stores and gutters so the holes come out bigger. */
        @media(orientation:landscape) and (max-height:520px) {
          .ncho-wrap { padding-left:0; padding-right:0; }
          .ncho-board { grid-template-columns:minmax(0,.7fr) minmax(0,7fr) minmax(0,.7fr); gap:8px; padding:16px 8px 8px; }
          .ncho-long { grid-template-columns:minmax(0,.8fr) minmax(0,13fr) minmax(0,.8fr); gap:5px; padding:16px 6px 6px; }
          .ncho-row { gap:8px; }
          .ncho-long .ncho-row { gap:4px; }
          .ncho-hole b { font-size:13px; }
          .ncho-long .ncho-hole b { font-size:11px; }
          .ncho-seeds i { width:7px; height:7px; }
          .ncho-long .ncho-seeds i { width:4px; height:4px; }
          .ncho-store-label { display:none; }
          .ncho-info { margin-bottom:6px; }
        }
        @media(prefers-reduced-motion:reduce) { .ncho-hole { transition:none; } .ncho-hole.is-legal:hover { transform:none; } .ncho-rotate-icon { animation:none; } }
      `}</style>
    </ArcadeShell>
  );
}
