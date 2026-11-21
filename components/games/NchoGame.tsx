"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { ARCADE_GAMES, arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import {
  AUTO_NEXT_ROUND_MS, MAX_ROUNDS, applyMove, autoStartsNextRound, chooseMove, directionOf, homeOf, housesOf, initialState,
  legalMoves,
  type HolesPerSide, type Level, type NchoMove, type NchoState, type NchoVariant, type Player, type PlayerCount,
  type RoundSummary, type RoundsTarget, type Sweep,
} from "@/lib/arcade/ncho";

type Phase = "ready" | "playing" | "round" | "over";
type View = { pits: number[]; stores: number[]; owner: Player[]; active: number | null; taken: number[] };
type Frame = { pits: number[]; stores: number[]; active: number | null; taken: number[]; tone: number | null };

const STEP_MS = 110; // one seed per step: quick, but you can follow it
const MIN_STEP_MS = 28; // relays can be long: the step shortens so a move never drags on
const MAX_ANIM_MS = 7000;
const THINK_MS = 550;
const WATCH_THINK_MS = 300; // 4 players, once you're out: the computers play on a little faster
// Each variant (and the 4-player game) keeps its own win count.
const WINS_KEYS: Record<NchoVariant, string> = { ncho: "arcade-ncho-wins", akahausa: "arcade-akahausa-wins" };
const winsKey = (variant: NchoVariant, players: PlayerCount) => (players === 4 ? `${WINS_KEYS[variant]}-4p` : WINS_KEYS[variant]);
const SEED_COLOURS = ["#f0c27b", "#e2a05f", "#f6dca8", "#d4834f"];
const PORTRAIT_PHONE = "(orientation: portrait) and (max-width: 740px)";

const viewOf = (s: NchoState): View => ({ pits: s.pits.slice(), stores: s.stores.slice(), owner: s.owner.slice(), active: null, taken: [] });
const viewOfRoundEnd = (r: RoundSummary): View => ({ pits: r.finalPits.slice(), stores: r.finalStores.slice(), owner: r.finalOwner.slice(), active: null, taken: [] });
const other = (p: Player): Player => (p === 0 ? 1 : 0);
// Top row: holes n..2n-1 drawn from 2n-1 down (right to left as sown). Bottom row: 0..n-1, left to right.
const rowsFor = (n: number) => ({
  top: Array.from({ length: n }, (_, i) => 2 * n - 1 - i),
  bottom: Array.from({ length: n }, (_, i) => i),
});
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const roundsLabel = (t: number | "all", players: PlayerCount) =>
  (t === "all" ? `until one ${players === 4 ? "player" : "side"} has every house` : `of ${t}`);
// Names: "you", "the computer" (2 players) or "Computer 1".."Computer 3" (4 players); short labels for the stores.
const nameOf = (p: Player, players: PlayerCount) => (p === 0 ? "you" : players === 2 ? "the computer" : `Computer ${p}`);
const Name = (p: Player, players: PlayerCount) => { const n = nameOf(p, players); return n[0].toUpperCase() + n.slice(1); };
const shortOf = (p: Player, players: PlayerCount) => (p === 0 ? "you" : players === 2 ? "computer" : `C${p}`);
const everyone = (players: PlayerCount) => Array.from({ length: players }, (_, p) => p as Player);
// 4 players: where each store half sits (column 1 = left end, 3 = right end; row 1 = top, 2 = bottom), next to that
// player's holes: you bottom left (0-2), Computer 1 bottom right (3-5), Computer 2 top right (6-8), Computer 3 top left (9-11).
const HALF_STORE: { col: number; row: number }[] = [{ col: 1, row: 2 }, { col: 3, row: 2 }, { col: 3, row: 1 }, { col: 1, row: 1 }];

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
function describeMove(m: NchoMove, players: PlayerCount): string {
  let text = `${m.player === 0 ? "You" : players === 2 ? "Computer" : Name(m.player, players)} sowed ${m.sowings[0].seeds}`;
  if (m.relays > 0 && m.relays <= 3) text += m.sowings.slice(1).map((l) => `, lifted ${l.seeds} and kept going`).join("");
  else if (m.relays > 3) text += `, lifted and kept going ${m.relays} times`;
  const onTheWay = m.captures.filter((c) => !c.last);
  const lastFour = m.captures.some((c) => c.last);
  const end = m.end === "four" ? "… made 4: took 4."
    : m.end === "sweep" ? (lastFour ? "… made 4 with 8 left: took all 8." : "…")
    : m.end === "empty" ? "… landed in an empty hole." : "… stopped after 300 sowings.";
  const extras: string[] = [];
  for (const p of everyone(players)) {
    const k = onTheWay.filter((c) => c.to === p).length;
    if (k) extras.push(`${k === 1 ? "A 4" : `${k} fours`} on the way went to ${nameOf(p, players)}.`);
  }
  if (m.sweep && !lastFour) extras.push(`That 4 came with 8 left, so ${nameOf(m.sweep.to, players)} took all 8.`);
  return `${text}${end}${extras.length ? ` ${extras.join(" ")}` : ""}`;
}

// The seed-by-seed frames of a move: lift, drop, drop… each 4 lit up then taken, and the last 8 swept up.
function framesFor(state: NchoState, m: NchoMove): Frame[] {
  const pits = state.pits.slice();
  const stores = state.stores.slice();
  const frames: Frame[] = [];
  let step = 0;
  for (const lap of m.sowings) {
    pits[lap.from] = 0;
    frames.push({ pits: pits.slice(), stores: stores.slice(), active: lap.from, taken: [], tone: null });
    for (const h of lap.path) {
      pits[h] += 1;
      frames.push({ pits: pits.slice(), stores: stores.slice(), active: h, taken: [], tone: 420 + (step % 6) * 40 });
      const cap = m.captures.find((c) => c.step === step);
      if (cap) {
        frames.push({ pits: pits.slice(), stores: stores.slice(), active: h, taken: [h], tone: null });
        pits[h] = 0;
        stores[cap.to] += 4;
        frames.push({ pits: pits.slice(), stores: stores.slice(), active: null, taken: [h], tone: 660 });
        if (m.sweep && m.sweep.step === step) {
          frames.push({ pits: pits.slice(), stores: stores.slice(), active: null, taken: m.sweep.holes, tone: null });
          pits.fill(0);
          stores[m.sweep.to] += m.sweep.seeds;
          frames.push({ pits: pits.slice(), stores: stores.slice(), active: null, taken: m.sweep.holes, tone: 760 });
        }
      }
      step++;
    }
  }
  return frames;
}

// variant "akahausa" is Aka-Hausa: exactly the same game sown clockwise, with a computer that looks one move further
// ahead (lib/arcade/ncho.ts has the rules). The board is 6 holes a side (there's no 12-hole Ncho), and the game
// lasts the number of rounds the player picks. 2 players: you v the computer, and whoever lost the last game starts
// the next one (a tie alternates). 4 players: you v three computers, 3 holes each; you start unless you won the last
// game. When a computer starts a round, the round summary shows for a moment and the round begins by itself.
export default function NchoGame({ variant = "ncho" }: { variant?: NchoVariant }) {
  const clockwise = variant === "akahausa";
  const slug = clockwise ? "akahausa" : "ncho";
  const gameName = clockwise ? "Aka-Hausa" : "Ncho";
  const holesPerSide: HolesPerSide = 6; // Ncho is always 6 holes a side
  const [rounds, setRounds] = useState<RoundsTarget>(3);
  const [players, setPlayers] = useState<PlayerCount>(2);
  const WINS_KEY = winsKey(variant, players);
  const [game, setGame] = useState<NchoState>(() => initialState(undefined, 0, variant));
  const [view, setView] = useState<View>(() => viewOf(initialState(undefined, 0, variant)));
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState<Level>("medium");
  const [busy, setBusy] = useState(false); // sowing animation running
  const [status, setStatus] = useState("Press start to play.");
  const [wins, setWins] = useState(0);
  const [muted, setMuted] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false); // "WAIT" on the round summary stops the automatic start
  // The last round's summary stays readable after the next round starts ("ROUND N SUMMARY" reopens it; play pauses).
  const [recap, setRecap] = useState<{ sum: RoundSummary; sweep: Sweep | null } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  // Phones held upright get a friendly nudge to turn sideways; "Got it" hides it for this visit (state only).
  const [portraitPhone, setPortraitPhone] = useState(false);
  const [rotateDismissed, setRotateDismissed] = useState(false);
  // Who starts the next game: 2 players, the loser of the last one (a tie passes it to the other player); 4 players,
  // you, unless you won (then the next player in turn order). You start the first.
  const [nextFirst, setNextFirst] = useState<Player>(0);
  const startedBy = useRef<Player>(0);
  const timers = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

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

  const gameOverStatus = useCallback((next: NchoState, said: string) => {
    const r = next.lastRound!;
    const P = next.players;
    if (P === 2) {
      const [a, b] = r.houses;
      return `${said} ${next.winner === 0 ? `You win, ${a} houses to ${b}.` : next.winner === 1 ? `Computer wins, ${b} houses to ${a}.` : `A tie, ${a} houses each.`}`;
    }
    const top = Math.max(...r.houses);
    return `${said} ${next.winner === "draw" ? `A tie on ${plural(top, "house")}.` : `${Name(next.winner as Player, P)} ${next.winner === 0 ? "win" : "wins"} with ${plural(top, "house")}.`}`;
  }, []);

  const endGame = useCallback((next: NchoState, said: string) => {
    setPhase("over");
    setStatus(gameOverStatus(next, said));
    if (next.players === 2) setNextFirst(next.winner === 0 ? 1 : next.winner === 1 ? 0 : other(startedBy.current));
    else setNextFirst(next.winner === 0 ? (directionOf(next.variant) === 1 ? 1 : 3) : 0); // you won: the next player in turn order
    if (next.winner === 0) {
      setWins((w) => {
        try { arcadeStore.setItem(WINS_KEY, String(w + 1)); } catch { /* ignore */ }
        return w + 1;
      });
    }
  }, [WINS_KEY, gameOverStatus]);

  const finishMove = useCallback((next: NchoState) => {
    const m = next.last!;
    setGame(next);
    setBusy(false);
    const said = describeMove(m, next.players);
    const r = next.lastRound;
    if (!r) {
      setView(viewOf(next));
      setStatus(next.turn !== 0 ? `${said} ${Name(next.turn, next.players)} is thinking…` : `${said} Your turn.`);
      return;
    }
    // The round is over: show the board as it ended; the overlay explains the count.
    setView(viewOfRoundEnd(r));
    beep(520, 0.2);
    if (!next.over) {
      setPhase("round");
      setAutoPaused(false);
      setRecap({ sum: r, sweep: m.sweep });
      setStatus(`${said} Round ${r.round} is over.`);
      return;
    }
    endGame(next, said);
  }, [beep, endGame]);

  // Sow seed by seed, relays and all, so you can follow where they go and see each 4 taken.
  const play = useCallback((state: NchoState, hole: number) => {
    const next = applyMove(state, hole);
    const m = next.last!;
    if (prefersReducedMotion()) { finishMove(next); return; }
    setBusy(true);
    const frames = framesFor(state, m);
    const step = Math.max(MIN_STEP_MS, Math.min(STEP_MS, Math.floor(MAX_ANIM_MS / Math.max(1, frames.length))));
    frames.forEach((f, i) => {
      later(() => {
        setView({ pits: f.pits, stores: f.stores, owner: state.owner, active: f.active, taken: f.taken });
        if (f.tone) beep(f.tone, f.tone >= 660 ? 0.14 : 0.05);
      }, step * i);
    });
    later(() => finishMove(next), step * frames.length + (m.captures.length ? 300 : 0));
  }, [beep, finishMove, later]);

  const youAreOut = game.players === 4 && housesOf(game.owner, 0) === 0;

  // A computer's turn.
  useEffect(() => {
    if (phase !== "playing" || busy || reviewing || game.over || game.turn === 0) return;
    const t = window.setTimeout(() => play(game, chooseMove(game, level)), youAreOut ? WATCH_THINK_MS : THINK_MS);
    return () => window.clearTimeout(t);
  }, [busy, game, level, phase, play, reviewing, youAreOut]);

  const start = useCallback((opts?: { rounds?: RoundsTarget; players?: PlayerCount }) => {
    clearTimers();
    const target = opts?.rounds ?? rounds;
    const P = opts?.players ?? players;
    const first = opts?.players !== undefined && opts.players !== players ? 0 : nextFirst;
    if (first !== nextFirst) setNextFirst(first);
    startedBy.current = first;
    const s = initialState(undefined, first, variant, { holesPerSide, rounds: target, players: P });
    setRecap(null);
    setReviewing(false);
    setGame(s);
    setView(viewOf(s));
    setBusy(false);
    setPhase("playing");
    setStatus(s.turn === 0 ? "You start. Pick one of your holes." : `${Name(s.turn, P)} starts this game and is thinking…`);
  }, [clearTimers, holesPerSide, nextFirst, players, rounds, variant]);

  const nextRound = useCallback(() => {
    const prev = game.lastRound;
    setView(viewOf(game));
    setPhase("playing");
    // The summary stays in the status line after the round starts, so it can still be read.
    const recap = prev ? ` (Round ${prev.round} houses: ${everyone(game.players).map((p) => `${shortOf(p, game.players)} ${prev.houses[p]}`).join(" · ")}.)` : "";
    setStatus(game.turn === 0
      ? `Round ${game.round}: you start. Pick one of your holes.${recap}`
      : `Round ${game.round}: ${nameOf(game.turn, game.players)} starts and is thinking…${recap}`);
  }, [game]);

  // When a computer starts the next round, carry on by itself once the summary has been up for a moment.
  const autoNext = phase === "round" && autoStartsNextRound(game) && !autoPaused;
  useEffect(() => {
    if (!autoNext) return;
    const t = window.setTimeout(nextRound, AUTO_NEXT_ROUND_MS);
    return () => window.clearTimeout(t);
  }, [autoNext, nextRound]);

  // 4 players, once you're out: play the rest of the game at once.
  const skipToEnd = () => {
    clearTimers();
    let s = game;
    let guard = 0;
    while (!s.over && guard++ < 50000) s = applyMove(s, chooseMove(s, level));
    setGame(s);
    setBusy(false);
    if (s.lastRound) setView(viewOfRoundEnd(s.lastRound));
    endGame(s, "The computers played the rest.");
  };

  const changeRounds = (v: string) => {
    const t: RoundsTarget = v === "all" ? "all" : v === "5" ? 5 : v === "7" ? 7 : 3;
    setRounds(t);
    start({ rounds: t });
  };

  const changePlayers = (v: string) => {
    const P: PlayerCount = v === "4" ? 4 : 2;
    setPlayers(P);
    start({ players: P });
  };

  const toggleSound = () => setMuted((m) => { mutedRef.current = !m; return !m; });

  const P = game.players;
  const canPlay = phase === "playing" && !busy && !reviewing && game.turn === 0 && !game.over;
  const legal = canPlay ? legalMoves(game) : [];
  const { top, bottom } = rowsFor(game.holesPerSide);
  const seedMax = 14;
  const n = game.pits.length;
  const houses = everyone(P).map((p) => housesOf(game.owner, p)); // after the refill, like the round summary
  const roundNo = game.lastRound && phase !== "playing" ? game.lastRound.round : game.round;

  const hole = (h: number) => {
    const seeds = view.pits[h];
    const who = view.owner[h];
    const home = homeOf(h, n, P);
    const conquered = who !== home;
    const isLegal = legal.includes(h);
    const own = who === 0 ? "own-you" : `own-them own-p${who}`;
    const cls = `ncho-hole ${own}${conquered ? " is-conquered" : ""}${view.active === h ? " is-active" : ""}${view.taken.includes(h) ? " is-taken" : ""}${isLegal ? " is-legal" : ""}${game.last?.hole === h && !busy && phase === "playing" ? " is-last" : ""}`;
    const whose = P === 2
      ? who === 0
        ? conquered ? "Your conquered hole on the computer's row" : "Your hole"
        : conquered ? "Computer's conquered hole on your row" : "Computer's hole"
      : `${who === 0 ? "Your hole" : `${Name(who, P)}'s hole`}${conquered ? ` (conquered from ${nameOf(home, P)})` : ""}`;
    if (who !== 0) {
      return <div key={h} className={cls} role="img" aria-label={`${whose}, ${plural(seeds, "seed")}`}><Seeds n={seeds} max={seedMax} /><b>{seeds}</b></div>;
    }
    return (
      <button key={h} type="button" className={cls} disabled={!isLegal} onClick={() => play(game, h)}
        aria-label={`${whose}, ${plural(seeds, "seed")}${isLegal ? "" : ", can't play"}`}>
        <Seeds n={seeds} max={seedMax} /><b>{seeds}</b>
      </button>
    );
  };

  const store = (p: Player) => {
    if (P === 2) {
      return p === 1 ? (
        <div key={p} className="ncho-store ncho-store-them" role="img" aria-label={`Computer's store, ${view.stores[1]} seeds`}>
          <span className="ncho-store-label">COMPUTER</span><Seeds n={view.stores[1]} max={30} /><b>{view.stores[1]}</b>
        </div>
      ) : (
        <div key={p} className="ncho-store ncho-store-you" role="img" aria-label={`Your store, ${view.stores[0]} seeds`}>
          <span className="ncho-store-label">YOU</span><Seeds n={view.stores[0]} max={30} /><b>{view.stores[0]}</b>
        </div>
      );
    }
    const at = HALF_STORE[p];
    const out = housesOf(view.owner, p) === 0;
    return (
      <div key={p} className={`ncho-store is-half store-p${p}${p === 0 ? " ncho-store-you" : ""}${out ? " is-out" : ""}${game.turn === p && phase === "playing" ? " is-turn" : ""}`}
        style={{ gridColumn: at.col, gridRow: at.row }} role="img"
        aria-label={`${p === 0 ? "Your" : `${Name(p, P)}'s`} store, ${plural(view.stores[p] ?? 0, "seed")}${out ? ", out of the game" : ""}`}>
        <span className="ncho-store-label">{shortOf(p, P).toUpperCase()}</span><Seeds n={view.stores[p] ?? 0} max={16} /><b>{view.stores[p] ?? 0}</b>
      </div>
    );
  };

  const r = game.lastRound;
  const roundOverlay = (sum: RoundSummary, sweep: Sweep | null) => {
    const lines: string[] = [];
    if (sum.reason === "sweep" && sweep) lines.push(`${Name(sweep.to, P)} took a 4 with 8 left, so ${sweep.to === 0 ? "you" : "it"} took all 8.`);
    let moved = 0;
    for (const p of everyone(P)) {
      const k = sum.conquered.filter((c) => c.to === p).length;
      moved += k;
      if (k) lines.push(`${Name(p, P)} conquered ${plural(k, "house")}.`);
    }
    if (!moved) lines.push("No houses changed hands.");
    for (const l of sum.leftovers) {
      if (P === 2) { lines.push(`The last hole went to ${nameOf(l.to, P)} with the 4 leftover seeds.`); continue; }
      const was = sum.finalOwner[l.hole];
      lines.push(was === l.to
        ? `${Name(l.to, P)} kept a hole with the 4 leftover seeds.`
        : `${Name(l.to, P)} won ${was === 0 ? "one of your holes" : `one of ${nameOf(was, P)}'s holes`} with the 4 leftover seeds.`);
    }
    const playOn = !game.over && game.lastRound === sum;
    for (const p of sum.eliminated) lines.push(p === 0 ? `You have no houses left: you're out.${playOn ? " The computers play on." : ""}` : `${Name(p, P)} has no houses left and is out.`);
    const counted = P === 2
      ? `Seeds counted: you ${sum.totals[0]} (${sum.finalStores[0]} in store + ${sum.counted[0]} in your holes), computer ${sum.totals[1]} (${sum.finalStores[1]} + ${sum.counted[1]}).`
      : `Seeds counted: ${everyone(P).filter((p) => sum.totals[p] > 0 || housesOf(sum.finalOwner, p) > 0).map((p) => `${shortOf(p, P)} ${sum.totals[p]}`).join(", ")}.`;
    const housesLine = P === 2
      ? `Houses: you ${sum.houses[0]} · computer ${sum.houses[1]}.`
      : `Houses: ${everyone(P).map((p) => `${shortOf(p, P)} ${sum.houses[p]}`).join(" · ")}.`;
    return (
      <>
        <p className="ncho-final">{counted}</p>
        <p className="ncho-final">{housesLine}</p>
        <p>{lines.join(" ")}{sum.reason === "move-cap" ? " (The round ran very long, so it was counted.)" : ""}</p>
      </>
    );
  };
  const starterLine = (sum: RoundSummary) => {
    const s = sum.nextStarter;
    if (P === 2) {
      return s === 0
        ? `${sum.houses[0] === sum.houses[1] ? "Equal houses" : "You have fewer houses"}, so you start round ${game.round}.`
        : `${sum.houses[0] === sum.houses[1] ? "Equal houses" : "The computer has fewer houses"}, so it starts round ${game.round}.`;
    }
    const fewest = sum.houses[s];
    const tied = everyone(P).filter((p) => sum.houses[p] === fewest).length > 1;
    const them = s === 0 ? "you start" : `${nameOf(s, P)} starts`;
    return tied
      ? `${fewest === Math.max(...sum.houses) ? "Houses are level" : "The fewest houses are tied"}, and ${them} round ${game.round}, next in turn.`
      : `${s === 0 ? "You have" : `${Name(s, P)} has`} the fewest houses, so ${s === 0 ? "you start" : "it starts"} round ${game.round}.`;
  };
  const endLine = () => {
    if (game.endReason === "all-houses") return game.winner === 0 ? "You have every house." : `${Name(game.winner as Player, P)} has every house.`;
    let tie = "";
    if (P === 4 && game.winner === "draw") {
      const hs = everyone(P).map((p) => housesOf(game.owner, p));
      const top = Math.max(...hs);
      const names = everyone(P).filter((p) => hs[p] === top).map((p) => nameOf(p, P));
      tie = ` ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} tie on ${plural(top, "house")}.`.replace(/^ you/, " You");
    }
    if (game.endReason === "round-cap") return `After ${MAX_ROUNDS} rounds the houses are counted as they stand.${tie}`;
    return `After ${plural(typeof game.roundsTarget === "number" ? game.roundsTarget : game.round, "round")}.${tie}`;
  };
  const nextLine = P === 4
    ? nextFirst === 0 ? "You start the next game." : `You won, so ${nameOf(nextFirst, P)} starts the next game.`
    : nextFirst === 0
      ? game.winner === "draw" ? "A tie, so you start the next game." : "You lost, so you start the next game."
      : game.winner === "draw" ? "A tie, so the computer starts the next game." : "The computer lost, so it starts the next game.";
  const winnerTitle = game.winner === 0 ? "You win." : game.winner === "draw" ? "A tie." : P === 2 ? "Computer wins." : `${Name(game.winner as Player, P)} wins.`;
  const readyKicker = `${clockwise ? "AKA-HAUSA · SOWN CLOCKWISE" : "SOWN ANTICLOCKWISE"} · ${players === 4 ? "FOUR PLAYERS, THREE HOLES EACH" : "SIX HOLES EACH"}`;
  const readyText = players === 4
    ? `You and three computers, 3 holes each. Yours are green, bottom left; your store is the bottom half of the left end. Relay-sow from your holes; make exactly 4 with your last seed to take them. Lose all your houses and you're out. ${rounds === "all" ? "Last one with houses wins." : `Most houses after ${rounds} rounds wins.`}`
    : `Your holes have green rings and your store is on the right. Relay-sow from one of your holes; make exactly 4 with your last seed to take them. Win houses over ${rounds === "all" ? "as many rounds as it takes" : `${rounds} rounds`}.`;
  const showRotate = portraitPhone && !rotateDismissed;
  const watching = youAreOut && phase === "playing" && !game.over;

  return (
    <ArcadeShell game={arcadeGame(slug)} index={ARCADE_GAMES.findIndex((g) => g.slug === slug) + 1}>
      <div className="arc-console">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">YOUR STORE</span><strong aria-live="polite">{String(view.stores[0]).padStart(2, "0")}</strong></div>
          {P === 2 && <div className="arc-stat"><span className="arc-label">COMPUTER</span><strong>{String(view.stores[1]).padStart(2, "0")}</strong></div>}
          <div className="arc-stat"><span className="arc-label">WINS</span><strong>{wins}</strong></div>
          <span className="arc-spacer" />
          <select className="arc-select" aria-label="Players (starts a new game)" value={String(players)} onChange={(e) => changePlayers(e.target.value)}>
            <option value="2">PLAYERS: 2</option>
            <option value="4">PLAYERS: 4</option>
          </select>
          <select className="arc-select" aria-label="Computer level" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            <option value="easy">EASY</option>
            <option value="medium">MEDIUM</option>
            <option value="hard">HARD</option>
          </select>
          <select className="arc-select" aria-label="Rounds (starts a new game)" value={String(rounds)} onChange={(e) => changeRounds(e.target.value)}>
            <option value="3">ROUNDS: 3</option>
            <option value="5">ROUNDS: 5</option>
            <option value="7">ROUNDS: 7</option>
            <option value="all">{players === 4 ? "ROUNDS: UNTIL ONE PLAYER HAS EVERY HOUSE" : "ROUNDS: UNTIL ONE SIDE HAS EVERY HOUSE"}</option>
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
          <span>{`Round ${roundNo} ${roundsLabel(game.roundsTarget, P)}`}</span>
          <span>{P === 2 ? `Houses: you ${houses[0]} · computer ${houses[1]}` : `Houses: ${everyone(P).map((p) => `${shortOf(p, P)} ${houses[p]}`).join(" · ")}`}</span>
          {P === 2
            ? <span className="ncho-key"><i className="k-you" /> yours <i className="k-them" /> computer&apos;s</span>
            : <span className="ncho-key"><i className="k-you" /> you <i className="k-them" /> C1 <i className="k-p2" /> C2 <i className="k-p3" /> C3</span>}
        </p>

        <div className={`arc-board-wrap ncho-wrap${phase !== "playing" || reviewing ? " has-overlay" : ""}`}>
          <div className={`ncho-board${P === 4 ? " is-four" : ""}`} style={{ ["--ncho-n" as string]: game.holesPerSide }}
            aria-label={P === 2
              ? `${gameName} board, ${game.holesPerSide} holes a side. Green-ringed holes are yours, amber-ringed are the computer's; your store is on the right; seeds move ${clockwise ? "clockwise" : "anticlockwise"}.`
              : `${gameName} board for 4 players, 3 holes each: yours bottom left (green), Computer 1 bottom right (amber), Computer 2 top right (blue), Computer 3 top left (pink). Each end store is split in two, one half per player beside it; seeds move ${clockwise ? "clockwise" : "anticlockwise"}.`}>
            <span className="ncho-dir" aria-hidden="true">{clockwise ? "↻ CLOCKWISE" : "↺ ANTICLOCKWISE"}</span>
            {P === 2 ? store(1) : <>{store(3)}{store(0)}</>}
            <div className="ncho-row ncho-top">{top.map((h) => hole(h))}</div>
            <div className="ncho-row ncho-bottom">{bottom.map((h) => hole(h))}</div>
            {P === 2 ? store(0) : <>{store(2)}{store(1)}</>}
          </div>
          {phase === "playing" && reviewing && recap && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{`ROUND ${recap.sum.round} SUMMARY`}</p>
              <h2>{recap.sum.houses[0] === 0 ? "You went out." : `You kept ${plural(recap.sum.houses[0], "house")}.`}</h2>
              {roundOverlay(recap.sum, recap.sweep)}
              <button type="button" className="arc-btn" onClick={() => setReviewing(false)}>BACK TO THE GAME</button>
            </div>
          )}
          {phase !== "playing" && (
            <div className="arc-overlay">
              <p className="arc-overlay-kicker">{phase === "over" ? "GAME OVER" : phase === "round" && r ? `ROUND ${r.round} OVER` : readyKicker}</p>
              <h2>
                {phase === "ready" ? (players === 4 ? "Four round the board." : clockwise ? "The other way round." : "Sow and gather.")
                  : phase === "round" && r ? (r.houses[0] === 0 ? "You're out." : `You keep ${plural(r.houses[0], "house")}.`)
                  : winnerTitle}
              </h2>
              {phase === "ready" && <p>{readyText}</p>}
              {phase === "round" && r && (
                <>
                  {roundOverlay(r, game.last?.sweep ?? null)}
                  <p>{starterLine(r)}{autoNext ? ` Round ${game.round} starts by itself in a moment.` : ""}</p>
                </>
              )}
              {phase === "over" && (
                <>
                  {r && roundOverlay(r, game.last?.sweep ?? null)}
                  <p className="ncho-final">{endLine()}</p>
                  <p>{nextLine}</p>
                </>
              )}
              {phase === "round"
                ? (
                  <div className="ncho-actions">
                    <button type="button" className="arc-btn" onClick={nextRound} aria-label="Next round">NEXT ROUND</button>
                    {autoNext && <button type="button" className="arc-btn-ghost" onClick={() => setAutoPaused(true)} aria-label="Wait: don't start the next round by itself">WAIT</button>}
                  </div>
                )
                : <button type="button" className="arc-btn" onClick={() => start()} aria-label={phase === "over" ? "Play again" : "Start game"}>{phase === "over" ? "PLAY AGAIN" : "START GAME"}</button>}
            </div>
          )}
        </div>
        <p className="arc-status" role="status">{status}</p>
        {phase === "playing" && recap && !reviewing && (
          <p className="ncho-watch">
            <button type="button" className="arc-btn-ghost" onClick={() => setReviewing(true)} aria-label={`Read the round ${recap.sum.round} summary again (pauses the game)`}>{`ROUND ${recap.sum.round} SUMMARY`}</button>
          </p>
        )}
        {watching && (
          <p className="ncho-watch">
            <span>You&apos;re out: the computers play on.</span>
            <button type="button" className="arc-btn-ghost" onClick={skipToEnd}>SKIP TO THE END</button>
          </p>
        )}
      </div>

      <style jsx global>{`
        .ncho-wrap { background:#1b2a23; }
        /* A short board on an upright phone: the start, round and game-over messages stay readable (the board keeps room for them). */
        @media(max-width:740px) { .ncho-wrap { min-height:230px; } .ncho-wrap .arc-overlay { padding:12px; } .ncho-wrap .arc-overlay h2 { font-size:24px; margin-bottom:4px; } .ncho-wrap .arc-overlay p { margin:0 0 10px; font-size:11.5px; line-height:1.5; } .ncho-wrap .arc-overlay-kicker { margin-bottom:4px; } }
        /* The round and game-over summaries can be longer than the board is tall: give them room, and scroll if need be. */
        .ncho-wrap.has-overlay { min-height:350px; }
        .ncho-wrap .arc-overlay { justify-content:safe center; overflow-y:auto; }
        @media(max-width:740px) { .ncho-wrap.has-overlay { min-height:330px; } }
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
        @media(max-width:420px) { .ncho-store-label { display:none; } .ncho-store { padding:8px 2px; } }
        /* Phones turned sideways: use the full width, slimmer stores and gutters so the holes come out bigger. */
        @media(orientation:landscape) and (max-height:520px) {
          .ncho-wrap { padding-left:0; padding-right:0; }
          .ncho-board { grid-template-columns:minmax(0,.7fr) minmax(0,7fr) minmax(0,.7fr); gap:8px; padding:16px 8px 8px; }
          .ncho-row { gap:8px; }
          .ncho-hole b { font-size:13px; }
          .ncho-seeds i { width:7px; height:7px; }
          .ncho-store-label { display:none; }
          .ncho-info { margin-bottom:6px; }
        }
        /* 4 players: each end store split in two, one half per player beside it; a ring colour per player. */
        .ncho-store.is-half { grid-row:auto; padding:10px 3px; gap:3px; border-radius:18px; }
        .ncho-store.is-half .ncho-store-label { top:6px; writing-mode:horizontal-tb; transform:none; font-size:7px; }
        .ncho-store.is-half b { font-size:clamp(11px,2.2vw,14px); }
        .ncho-store.store-p0 { box-shadow:inset 0 4px 10px #000a,inset 0 0 0 1.5px #9bd34d88; }
        .ncho-store.store-p1 { box-shadow:inset 0 4px 10px #000a,inset 0 0 0 1.5px #f0a85b88; }
        .ncho-store.store-p2 { box-shadow:inset 0 4px 10px #000a,inset 0 0 0 1.5px #6cc4f088; }
        .ncho-store.store-p3 { box-shadow:inset 0 4px 10px #000a,inset 0 0 0 1.5px #ee8fc088; }
        .ncho-store.store-p1 .ncho-store-label { color:#f0a85bcc; } .ncho-store.store-p2 .ncho-store-label { color:#6cc4f0cc; } .ncho-store.store-p3 .ncho-store-label { color:#ee8fc0cc; }
        .ncho-store.store-p0 .ncho-store-label { top:6px; bottom:auto; }
        .ncho-store.is-turn { outline:2px solid #f0c27b; outline-offset:1px; }
        .ncho-store.is-out { opacity:.45; }
        .ncho-hole.own-p2 { --own:#6cc4f077; } .ncho-hole.own-p3 { --own:#ee8fc077; }
        .ncho-hole.is-conquered.own-p2 { --own:#6cc4f0cc; } .ncho-hole.is-conquered.own-p3 { --own:#ee8fc0cc; }
        .ncho-key .k-p2 { box-shadow:inset 0 0 0 2px #6cc4f0; margin-left:6px; }
        .ncho-key .k-p3 { box-shadow:inset 0 0 0 2px #ee8fc0; margin-left:6px; }
        .ncho-actions { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; }
        .ncho-watch { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px 12px; margin:6px 0 0; color:#3f5a2c; font:600 12px ui-monospace,monospace; }
        @media(max-width:420px) { .ncho-store.is-half .ncho-store-label { display:block; font-size:6px; } .ncho-store.is-half { padding:12px 1px 4px; } }
        @media(prefers-reduced-motion:reduce) { .ncho-hole { transition:none; } .ncho-hole.is-legal:hover { transform:none; } .ncho-rotate-icon { animation:none; } }
      `}</style>
    </ArcadeShell>
  );
}
