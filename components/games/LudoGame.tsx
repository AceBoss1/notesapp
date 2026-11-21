"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ArcadeShell from "@/components/games/ArcadeShell";
import { arcadeGame } from "@/lib/arcade/catalogue";
import { arcadeStore } from "@/lib/arcade/store";
import ArcadeAdSpot from "./ArcadeAdSpot";
import {
  DEFAULT_OPTIONS, HOME, HOME_COLUMN, START, STARS, TRACK, YARD, YARD_ORIGIN,
  advanceKnockout, applyAction, applyMove, applyRoll, banked, chooseAction, coloursOf, diceForSeed, finalYards, inPlay, knockoutGame,
  legalActions, newGame, newKnockout, pairOwners, playOut, playOutKnockout, rollDice, seedCell, straightHomeSeed, twoYardsTable,
  type Knockout, type LudoAction, type LudoEvent, type LudoOptions, type LudoState,
} from "@/lib/arcade/ludo";

// Colours clockwise from the bottom-left yard. Who plays each one is in game.table.owner: controller 0 is you.
// Modes (owner, 21 Nov 2026): four players (you + 3 computers, one colour each), 2 v 2 yards (you pick any two colours, one
// computer plays the other two) and knockout (last home is out each round; the final is 2 v 2 yards).
const NAMES = ["Green", "Coral", "Gold", "Blue"];
const COLOURS = ["#9bd34d", "#ff816d", "#f2c14e", "#6cb4e8"];
type Mode = "four" | "pairs" | "knockout";
const MODE_LABEL: Record<Mode, string> = { four: "4 PLAYERS", pairs: "2 V 2 YARDS", knockout: "KNOCKOUT" };
const DEFAULT_YARDS = [0, 2]; // green and the yard opposite
const ROLL_MS = 520;
const CPU_ROLL_MS = 550;
const CPU_MOVE_MS = 600;
const FAST = 0.35; // computer speed-up once none of your colours is still playing
const AUTO_MOVE_MS = 700; // when you have only one legal move, it plays itself after this pause (you can still tap first)
const WINS_KEY = "notes-arcade-ludo-wins";

// Pips on a 3×3 grid, numbered 0–8 left to right, top to bottom.
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// Where finished seeds rest: in their own triangle of the centre (row, col in cell units).
const HOME_SPOT: [number, number][] = [[8.45, 7.5], [7.5, 6.55], [6.55, 7.5], [7.5, 8.45]];
const YARD_SPOTS: [number, number][] = [[2, 2], [2, 4], [4, 2], [4, 4]];

const rolled = (dice: number[]) => (dice.length === 2 && dice[0] === dice[1] ? `double ${dice[0]}` : dice.length > 2 ? dice.join(", ") : dice.join(" and "));
const ordinal = (n: number) => ["1st", "2nd", "3rd", "4th"][n] ?? `${n + 1}th`;
const mine = (g: LudoState, colour: number) => g.table.owner[colour] === 0;
const myColours = (g: LudoState) => coloursOf(g, 0);
// A controller's name: you, the computer (2 v 2), or the colour that player started with (four players, knockout).
const ctrlName = (mode: Mode, c: number) => (c === 0 ? "You" : mode === "pairs" ? "The computer" : NAMES[c]);
const yardList = (cs: number[]) => cs.map((c) => NAMES[c]).join(" + ");

function describe(e: LudoEvent | null, g: LudoState): string {
  if (!e) return "";
  const multi = myColours(g).length > 1;
  const you = mine(g, e.player);
  const who = you ? (multi ? `You (${NAMES[e.player]})` : "You") : NAMES[e.player];
  const yourSeed = (c: number) => (multi ? `your ${NAMES[c].toLowerCase()} seed` : "your seed");
  if (e.kind === "pass") return `${who} rolled ${rolled(e.dice)}: no move.`;
  if (e.kind === "three-sixes") {
    const what = g.options.dice === 2 ? "three double sixes" : "three sixes";
    return you ? `${who} rolled ${what} in a row: you lose the turn.` : `${who} rolled ${what} and lost the turn.`;
  }
  if (e.kind === "straight-home") return you ? `6 + 5: ${yourSeed(e.player)} went straight home!` : `${who} went 6 + 5 straight home.`;
  let text = "";
  if (e.captured.length > 0) {
    const victims = e.captured.map((c) => (mine(g, c.player) ? yourSeed(c.player) : `${NAMES[c.player]}'s seed`));
    const list = [...new Set(victims)].join(" and ");
    text = `${who} sent ${list} back to the yard${you ? "!" : "."}`;
    if (e.hitHome) text = `${text} ${you ? "Your seed goes" : "Its seed goes"} straight home.`;
  } else if (e.to === HOME) text = `${who} got a seed home.`;
  else if (e.from === YARD) text = you ? `${multi ? `Your ${NAMES[e.player].toLowerCase()}` : "Your"} seed is out.` : `${who} brought a seed out.`;
  if (e.forfeited.length > 0) text = `${text} The ${e.forfeited.join(" and ")} couldn't be used.`.trim();
  return text;
}

// What to do with the banked dice in front of you.
function moveHint(g: LudoState): string {
  const actions = legalActions(g);
  const home = straightHomeSeed(g) !== null;
  const left = banked(g);
  const fresh = !g.used.some(Boolean);
  const head = fresh ? `You rolled ${rolled(g.dice)}` : `${describe(g.last, g)} Now ${left.length === 1 ? `the ${left[0]}` : rolled(left)}`.trim();
  const seed = myColours(g).length > 1 ? `glowing ${NAMES[g.turn].toLowerCase()} seed` : "glowing seed";
  if (actions.length === 1) return `${head}. Moving your seed…`;
  if (home) return `${head}: tap 6+5 → HOME to send a seed straight home, or pick a die and a seed.`;
  if (left.length === 1) return `${head}: tap a ${seed}.`;
  if (new Set(actions.flatMap((a) => (a.kind === "step" ? [g.dice[a.die]] : []))).size === 1) return `${head}: tap a ${seed}.`;
  const other = left.find((d) => d !== 6);
  if (fresh && other !== undefined && left.includes(6) && g.seeds[g.turn].includes(YARD)) return `${head}: bring a seed out with a 6, then spend the rest in any order.`;
  return `${head}: pick a die, then tap a ${seed}. Spend them in any order.`;
}

function statusLine(g: LudoState, rolling: boolean, mode: Mode): string {
  if (g.phase === "over") {
    if (g.table.playToLast) return `${g.order.map((c, i) => `${ordinal(i)} ${ctrlName(mode, c)}`).join(", ")}. ${ctrlName(mode, g.loser ?? 1)} ${g.loser === 0 ? "are" : "is"} out.`;
    const n = myColours(g).length * 4;
    return g.winner === 0 ? `All ${n === 4 ? "four" : n} home. You win!` : `${ctrlName(mode, g.winner ?? 1)} got all ${coloursOf(g, g.winner ?? 1).length * 4} home first.`;
  }
  const name = NAMES[g.turn];
  if (rolling) return mine(g, g.turn) ? "Rolling…" : `${name} is rolling…`;
  const before = describe(g.last, g);
  const dice = g.options.dice === 2 ? "the dice" : "the die";
  const bank = banked(g);
  const last = g.last;
  const afterCapture = !!last && last.kind === "move" && last.player === g.turn && last.bonus;
  const six = g.options.dice === 2 ? "Double 6!" : "A six!";
  if (mine(g, g.turn)) {
    if (g.phase === "move") return moveHint(g);
    if (afterCapture) return `${before} Roll again${bank.length ? ` (still banked: ${rolled(bank)})` : ""}.`.trim();
    if (bank.length) return `${six} Banked: ${rolled(bank)}. Roll again.`;
    return `${before} Your turn${myColours(g).length > 1 ? ` (${name})` : ""}: roll ${dice}.`.trim();
  }
  if (g.phase === "move") {
    if (g.used.some(Boolean)) return `${before} ${name} is thinking…`.trim();
    return `${name} rolled ${rolled(g.dice)} and is thinking…`;
  }
  if (bank.length && !afterCapture) return `${name}: ${six.toLowerCase().replace("!", "")}, rolling again (banked: ${rolled(bank)}).`;
  return `${before} ${name}'s turn.`.trim();
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Token = { player: number; seed: number; progress: number; y: number; x: number; size: number };

// Board position of every seed in play, with seeds sharing a square nudged apart so each can be seen and tapped.
function layoutTokens(g: LudoState): Token[] {
  const raw: Token[] = [];
  g.seeds.forEach((row, player) => {
    if (!g.table.active[player]) return; // an empty yard
    row.forEach((progress, seed) => {
      let y: number; let x: number;
      if (progress === YARD) { y = YARD_ORIGIN[player][0] + YARD_SPOTS[seed][0]; x = YARD_ORIGIN[player][1] + YARD_SPOTS[seed][1]; }
      else if (progress >= HOME) { [y, x] = HOME_SPOT[player]; }
      else { const [r, c] = seedCell(player, progress)!; y = r + 0.5; x = c + 0.5; }
      raw.push({ player, seed, progress, y, x, size: 0.8 });
    });
  });
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

type DieProps = { value: number; rolling: boolean; used?: boolean; picked?: boolean; onPick?: () => void };

// One die. With 2 dice on your move it's a button: pick which die to move with. Spent dice are greyed.
function Die({ value, rolling, used = false, picked = false, onPick }: DieProps) {
  const className = `ludo-die${rolling ? " is-rolling" : ""}${used ? " is-used" : ""}${picked ? " is-picked" : ""}`;
  const pips = Array.from({ length: 9 }, (_, i) => <span key={i} className={PIPS[value]?.includes(i) ? "ludo-pip" : ""} />);
  if (onPick) {
    return (
      <button type="button" className={className} onClick={onPick} aria-pressed={picked} aria-label={`Use the ${value}${picked ? " (chosen)" : ""}`}>
        {pips}
      </button>
    );
  }
  const label = rolling ? "Die rolling" : `Die showing ${value}${used ? ", used" : ""}`;
  return <div className={className} role="img" aria-label={label}>{pips}</div>;
}

function Star() {
  return (
    <svg className="ludo-star" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z" />
    </svg>
  );
}

// The board: yards, track, home columns and the centre. An empty yard (knockout round 2) is greyed; yours are tagged.
function BoardSquares({ active, yours }: { active: boolean[]; yours: boolean[] }) {
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
        <div key={`y${p}`} className={`ludo-yard${active[p] ? "" : " is-empty"}`} style={{ gridArea: `${r + 1} / ${c + 1} / span 6 / span 6`, background: COLOURS[p] }}>
          {/* Each yard is a full-square advert spot under the seed holder (owner, 21 Nov 2026). */}
          <ArcadeAdSpot variant="yard" game="ludo" offset={p} />
          <div className="ludo-yard-inner">
            {YARD_SPOTS.map((_, i) => <i key={i} style={{ background: `${COLOURS[p]}55` }} />)}
          </div>
          {!active[p] && <span className="ludo-yard-tag">EMPTY</span>}
          {active[p] && yours[p] && <span className="ludo-yard-tag">YOU</span>}
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

// Pick your two yards: tap a colour to swap it in for the one you picked longest ago.
function YardPicker({ picks, onChange, them }: { picks: number[]; onChange: (p: number[]) => void; them: string }) {
  return (
    <div className="ludo-picker">
      <div className="ludo-picker-chips" role="group" aria-label="Choose your two yards">
        {NAMES.map((n, c) => {
          const on = picks.includes(c);
          return (
            <button
              key={n}
              type="button"
              className={`ludo-chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => { if (!on) onChange([picks[1], c]); }}
              style={{ "--ludo-c": COLOURS[c] } as CSSProperties}
            >
              <i />{n.toUpperCase()}
            </button>
          );
        })}
      </div>
      <p className="ludo-picker-note">You: {yardList([...picks].sort())} · {them}: {yardList([0, 1, 2, 3].filter((c) => !picks.includes(c)))}</p>
    </div>
  );
}

export default function LudoGame() {
  const [options, setOptions] = useState<LudoOptions>(DEFAULT_OPTIONS);
  const [mode, setMode] = useState<Mode>("four");
  const [yards, setYards] = useState<number[]>(DEFAULT_YARDS); // your two yards in 2 v 2
  const [ko, setKo] = useState<Knockout | null>(null); // the knockout so far (rounds before this game)
  const [finalPick, setFinalPick] = useState<number[] | null>(null); // your yards for the knockout final
  const [rest, setRest] = useState<Knockout | null>(null); // the knockout played out by the computers after you went out
  const [game, setGame] = useState<LudoState>(() => newGame(DEFAULT_OPTIONS));
  const [started, setStarted] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [faces, setFaces] = useState<number[]>([6, 6]);
  const [pick, setPick] = useState<number | null>(null); // the die you chose to move with (2 dice)
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

  const myTurn = mine(game, game.turn);
  // None of your colours is still taking turns (you've finished this knockout round): the computers speed up.
  const watching = started && game.phase !== "over" && !myColours(game).some((c) => inPlay(game, c));

  // Sounds for what just happened.
  useEffect(() => {
    const e = game.last;
    if (!e) return;
    if (game.phase === "over") beep((game.table.playToLast ? game.loser !== 0 : game.winner === 0) ? 880 : 220, 0.4);
    else if (e.kind === "straight-home") beep(game.table.owner[e.player] === 0 ? 780 : 300, 0.25);
    else if (e.kind === "move" && e.captured.length > 0) beep(game.table.owner[e.player] === 0 ? 740 : 196, 0.22);
    else if (e.kind === "move") beep(e.to === HOME ? 660 : 420, 0.08);
  }, [game.last, game.phase, game.winner, game.loser, game.table, beep]);

  // Count a win once per game: a 4-player or 2 v 2 game you won, or the knockout final.
  useEffect(() => {
    if (game.phase !== "over" || countedRef.current) return;
    countedRef.current = true;
    if (game.winner !== 0 || game.table.playToLast) return;
    setWins((w) => {
      const next = w + 1;
      try { arcadeStore.setItem(WINS_KEY, String(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, [game.phase, game.winner, game.table.playToLast]);

  const startRoll = useCallback(() => {
    if (rolling) return;
    const values = rollDice(game.options.dice);
    const finish = () => {
      setFaces(values);
      setRolling(false);
      setPick(null);
      setGame((g) => (g.phase === "roll" && g.options.dice === values.length ? applyRoll(g, values) : g));
    };
    if (prefersReducedMotion() || watching) { finish(); return; }
    setRolling(true);
    beep(300, 0.05);
    const spin = window.setInterval(() => setFaces(values.map(() => 1 + Math.floor(Math.random() * 6))), 70);
    const done = window.setTimeout(() => { clearRollTimers(); finish(); }, ROLL_MS);
    rollTimers.current.push(spin, done);
  }, [rolling, game.options.dice, beep, clearRollTimers, watching]);

  // The die your taps move with: the one you picked, or else the highest die that can move something.
  const activeDie = useMemo(() => {
    if (!mine(game, game.turn) || game.phase !== "move") return null;
    const usable = game.dice
      .map((_, i) => i)
      .filter((i) => game.seeds[game.turn].some((_, seed) => diceForSeed(game, seed).includes(i)));
    if (pick !== null && usable.includes(pick)) return pick;
    return usable.sort((a, b) => game.dice[b] - game.dice[a])[0] ?? null;
  }, [game, pick]);

  const play = useCallback((action: LudoAction) => {
    setGame((g) => (mine(g, g.turn) && g.phase === "move" && legalActions(g).some((a) => JSON.stringify(a) === JSON.stringify(action)) ? applyAction(g, action) : g));
  }, []);

  const moveSeed = useCallback((seed: number) => {
    if (activeDie === null) return;
    setGame((g) => (mine(g, g.turn) && g.phase === "move" && diceForSeed(g, seed).includes(activeDie) ? applyMove(g, seed, activeDie) : g));
  }, [activeDie]);

  const goHome = useCallback(() => {
    setGame((g) => {
      const seed = mine(g, g.turn) ? straightHomeSeed(g) : null;
      return seed === null ? g : applyAction(g, { kind: "home", seed });
    });
  }, []);

  // Computer turns, and your auto-move when only one move is possible.
  useEffect(() => {
    if (!started || rolling || game.phase === "over") return;
    let t: number | undefined;
    const speed = watching ? FAST : 1;
    if (!myTurn) {
      if (game.phase === "roll") {
        const wait = game.last && (game.last.kind === "pass" || game.last.kind === "three-sixes") ? CPU_ROLL_MS + 400 : CPU_ROLL_MS; // time to read "no move"
        t = window.setTimeout(startRoll, wait * speed);
      } else {
        t = window.setTimeout(() => setGame((g) => (!mine(g, g.turn) && g.phase === "move" ? applyAction(g, chooseAction(g)) : g)), CPU_MOVE_MS * speed);
      }
    } else if (game.phase === "move") {
      const actions = legalActions(game);
      if (actions.length === 1) t = window.setTimeout(() => play(actions[0]), AUTO_MOVE_MS);
    }
    return () => window.clearTimeout(t);
  }, [game, started, rolling, startRoll, play, myTurn, watching]);

  // The game for a mode: four players, 2 v 2 with your yards, or the knockout's current round.
  const makeGame = (opts: LudoOptions, m: Mode, myYards: number[], k: Knockout | null, finalYardsPick: number[] | null): LudoState => {
    if (m === "pairs") return newGame(opts, 0, twoYardsTable(myYards));
    if (m === "knockout" && k) {
      const them = k.alive.find((c) => c !== 0);
      const owner = k.round === 3 && k.alive.includes(0) && finalYardsPick && them !== undefined ? pairOwners(0, them, finalYardsPick) : undefined;
      return knockoutGame(k, opts, owner);
    }
    return newGame(opts);
  };

  const begin = useCallback((g: LudoState) => {
    clearRollTimers();
    setRolling(false);
    setFaces([6, 6]);
    setPick(null);
    countedRef.current = false;
    setGame(g);
    setStarted(true);
  }, [clearRollTimers]);

  // A new game (a new knockout from round 1 in knockout mode).
  const restart = (opts: LudoOptions, m: Mode = mode, myYards: number[] = yards) => {
    const k = m === "knockout" ? newKnockout() : null;
    setKo(k);
    setRest(null);
    setFinalPick(null);
    begin(makeGame(opts, m, myYards, k, null));
  };

  // Changing the mode, dice or a rule starts a new game (or sets up the next one, before you press Start).
  const changeSetup = (next: Partial<LudoOptions>, m: Mode = mode, myYards: number[] = yards) => {
    const opts = { ...options, ...next };
    setOptions(opts);
    setMode(m);
    setYards(myYards);
    if (started) { restart(opts, m, myYards); return; }
    const k = m === "knockout" ? newKnockout() : null;
    setKo(k);
    setRest(null);
    setFinalPick(null);
    setFaces([6, 6]);
    setGame(makeGame(opts, m, myYards, k, null));
  };

  // Knockout, once a round is over: the knockout with this round's result in.
  const nextKo = useMemo(() => (mode === "knockout" && ko && game.phase === "over" && game.loser !== null && ko.champion === null ? advanceKnockout(ko, game) : null), [mode, ko, game]);
  const finalDefault = nextKo && nextKo.round === 3 && nextKo.alive.includes(0) ? finalYards(nextKo.alive).flatMap((o, c) => (o === 0 ? [c] : [])) : null;
  const nextRound = () => {
    if (!nextKo) return;
    setKo(nextKo);
    begin(makeGame(options, "knockout", yards, nextKo, finalPick ?? finalDefault));
  };
  const playRest = () => { if (nextKo) setRest(playOutKnockout(nextKo, options)); };
  const skipAhead = () => setGame((g) => playOut(g));

  const two = game.options.dice === 2;
  const canRoll = started && !rolling && myTurn && game.phase === "roll";
  const movable = useMemo(
    () => (activeDie === null || rolling ? [] : game.seeds[game.turn].flatMap((_, seed) => (diceForSeed(game, seed).includes(activeDie) ? [seed] : []))),
    [game, rolling, activeDie],
  );
  const canGoHome = started && !rolling && myTurn && straightHomeSeed(game) !== null;
  // Banked dice that can move something now; you can pick between them when they show different numbers.
  const usableDice = useMemo(
    () => (mine(game, game.turn) && game.phase === "move" ? game.dice.flatMap((_, i) => (game.seeds[game.turn].some((__, seed) => diceForSeed(game, seed).includes(i)) ? [i] : [])) : []),
    [game],
  );
  const pickable = activeDie !== null && new Set(usableDice.map((i) => game.dice[i])).size > 1;

  // Keyboard: Space or R rolls; 1–4 moves that seed; D switches die; H plays 6 + 5 straight home.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "SUMMARY"].includes(el.tagName)) return;
      if ((e.key === " " || e.key === "r" || e.key === "R") && canRoll) { e.preventDefault(); startRoll(); return; }
      if ((e.key === "d" || e.key === "D") && pickable && activeDie !== null) {
        // Next die with a different number.
        e.preventDefault();
        const order = usableDice.filter((i) => i > activeDie).concat(usableDice.filter((i) => i < activeDie));
        const next = order.find((i) => game.dice[i] !== game.dice[activeDie]);
        if (next !== undefined) setPick(next);
        return;
      }
      if ((e.key === "h" || e.key === "H") && canGoHome) { e.preventDefault(); goHome(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && movable.includes(n - 1)) { e.preventDefault(); moveSeed(n - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canRoll, movable, startRoll, moveSeed, pickable, activeDie, usableDice, game.dice, canGoHome, goHome]);

  const toggleSound = () => setMuted((m) => { mutedRef.current = !m; return !m; });

  const tokens = layoutTokens(game);
  const homeCount = (p: number) => game.seeds[p].filter((s) => s === HOME).length;
  const mineNow = myColours(game);
  const myHome = mineNow.reduce((n, c) => n + homeCount(c), 0);
  const myCaptures = mineNow.reduce((n, c) => n + game.captures[c], 0);
  const status = started ? statusLine(game, rolling, mode) : "Press Start to play.";
  // The dice on show: the bank (with the new roll spinning beside it while rolling), or the last roll seen.
  const count = game.options.dice;
  const bankNow = game.phase === "roll" ? banked(game) : [];
  const spin = faces.slice(0, count);
  while (spin.length < count) spin.push(6);
  const shown = rolling ? [...bankNow, ...spin] : game.dice.length ? [...game.dice] : spin;
  const spinningFrom = rolling ? bankNow.length : Infinity;
  const showUsed = !rolling && game.phase === "move";
  const rulesKicker = `${two ? "TWO DICE" : "ONE DIE"}${game.options.sixFiveHome ? " · 6+5 HOME" : ""}${game.options.hitHome ? " · HIT → HOME" : ""}`;
  const name = (c: number) => ctrlName(mode, c);
  const roundName = (r: number) => (r === 3 ? "the final" : `round ${r}`);
  // Knockout: what the round so far looks like (for the players list and the board label).
  const koNow = mode === "knockout" ? ko : null;
  const yours = [0, 1, 2, 3].map((c) => mineNow.length > 1 && mineNow.includes(c)); // tag your yards when you play two

  // The players list: each colour with who plays it, seeds home, or its finishing place.
  const playerLabel = (c: number) => {
    if (!game.table.active[c]) return "OUT";
    const o = game.table.owner[c];
    if (o === 0) return "YOU";
    if (mode === "pairs") return "CPU";
    return NAMES[o].toUpperCase(); // in the knockout final, a finalist's second yard shows the colour they started with
  };

  return (
    <ArcadeShell game={arcadeGame("ludo")} index={2}>
      <div className="arc-console ludo">
        <div className="arc-head">
          <div className="arc-stat"><span className="arc-label">HOME</span><strong>{myHome}/{Math.max(1, mineNow.length) * 4}</strong></div>
          <div className="arc-stat"><span className="arc-label">CAPTURES</span><strong>{myCaptures}</strong></div>
          {koNow ? (
            <div className="arc-stat"><span className="arc-label">ROUND</span><strong>{koNow.round === 3 ? "FINAL" : `${koNow.round}/3`}</strong></div>
          ) : (
            <div className="arc-stat"><span className="arc-label">WINS</span><strong>{wins}</strong></div>
          )}
          <div className="arc-spacer" />
          <select className="arc-select" aria-label="Game mode (starts a new game)" value={mode} onChange={(e) => changeSetup({}, e.target.value as Mode)}>
            {(Object.keys(MODE_LABEL) as Mode[]).map((m) => <option key={m} value={m}>MODE: {MODE_LABEL[m]}</option>)}
          </select>
          <select className="arc-select" aria-label="Number of dice (starts a new game)" value={String(options.dice)} onChange={(e) => changeSetup({ dice: e.target.value === "1" ? 1 : 2 })}>
            <option value="2">DICE: 2</option>
            <option value="1">DICE: 1</option>
          </select>
          <select className="arc-select" aria-label="6 and 5 sends a seed from the yard straight home (starts a new game)" value={options.sixFiveHome ? "on" : "off"} onChange={(e) => changeSetup({ sixFiveHome: e.target.value === "on" })}>
            <option value="off">6+5 HOME: OFF</option>
            <option value="on">6+5 HOME: ON</option>
          </select>
          <select className="arc-select" aria-label="A seed that captures goes straight home (starts a new game)" value={options.hitHome ? "on" : "off"} onChange={(e) => changeSetup({ hitHome: e.target.value === "on" })}>
            <option value="on">HIT → HOME: ON</option>
            <option value="off">HIT → HOME: OFF</option>
          </select>
          <button type="button" className="arc-btn-ghost" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
          <button type="button" className="arc-btn-ghost" onClick={() => restart(options)} aria-label={mode === "knockout" ? "Start a new knockout" : "Start a new game"}>NEW GAME</button>
        </div>

        <div className="arc-board-wrap ludo-wrap">
          <div className="ludo-board" role="group" aria-label={`Ludo board. You play ${yardList(mineNow)}. Seeds home: ${game.seeds.flatMap((_, p) => (game.table.active[p] ? [`${NAMES[p]} ${homeCount(p)}`] : [])).join(", ")}.`}>
            <BoardSquares active={game.table.active} yours={yours} />
            {tokens.map((t) => {
              const style = {
                left: `${(t.x / 15) * 100}%`,
                top: `${(t.y / 15) * 100}%`,
                width: `${(t.size / 15) * 100}%`,
                "--ludo-c": COLOURS[t.player],
              } as CSSProperties;
              if (!mine(game, t.player)) return <span key={`${t.player}-${t.seed}`} className="ludo-seed" style={style} aria-hidden="true" />;
              const can = t.player === game.turn && movable.includes(t.seed);
              const where = t.progress === YARD ? "in your yard" : t.progress >= HOME ? "home" : t.progress > 50 ? "in your home column" : `${t.progress} steps along`;
              const colour = mineNow.length > 1 ? `${NAMES[t.player].toLowerCase()} ` : "";
              return (
                <button
                  key={`${t.player}-${t.seed}`}
                  type="button"
                  className={`ludo-seed is-mine${can ? " is-movable" : ""}`}
                  style={style}
                  disabled={!can}
                  onClick={() => moveSeed(t.seed)}
                  aria-label={`Your ${colour}seed ${t.seed + 1}, ${where}${can ? ". Move it" : ""}`}
                />
              );
            })}
          </div>

          {!started && (
            <div className="arc-overlay ludo-overlay">
              <p className="arc-overlay-kicker">{MODE_LABEL[mode]} · {rulesKicker}</p>
              <h2>{mode === "knockout" ? "Last home is out." : "Roll home."}</h2>
              {mode === "four" && <p>You&apos;re green against three computers. {two ? "A six on either die brings a seed out." : "Roll a six to bring a seed out."}</p>}
              {mode === "pairs" && (
                <>
                  <p>Pick any two yards. The computer plays the other two. Get all 8 seeds home first.</p>
                  <YardPicker picks={yards} onChange={(p) => changeSetup({}, "pairs", p)} them="Computer" />
                </>
              )}
              {mode === "knockout" && <p>You&apos;re green against three computers. Last to get all four home each round is out. The final two play two yards each.</p>}
              <button type="button" className="arc-btn" onClick={() => restart(options)}>START</button>
            </div>
          )}
          {game.phase === "over" && mode !== "knockout" && (
            <div className="arc-overlay ludo-overlay">
              <p className="arc-overlay-kicker">GAME OVER</p>
              <h2>{game.winner === 0 ? "You win!" : `${name(game.winner ?? 1)} wins.`}</h2>
              <p>{game.winner === 0 ? `All ${myHome} seeds home. Nicely done.` : `You got ${myHome} of ${mineNow.length * 4} home. Go again?`}</p>
              <button type="button" className="arc-btn" onClick={() => restart(options)}>PLAY AGAIN</button>
            </div>
          )}
          {game.phase === "over" && mode === "knockout" && ko && (() => {
            const champ = nextKo?.champion ?? null;
            if (rest) {
              // You went out; the computers played the rest out in an instant.
              const later = rest.results.slice(ko.results.length + 1);
              return (
                <div className="arc-overlay ludo-overlay">
                  <p className="arc-overlay-kicker">KNOCKOUT RESULT · PLAYED OUT BY THE COMPUTERS</p>
                  <h2>{name(rest.champion ?? 1)} wins.</h2>
                  <ul className="ludo-results">
                    {later.map((r) => (
                      <li key={r.round}>{r.round === 3 ? `Final: ${name(r.order[0])} beat ${name(r.loser ?? 1)}.` : `Round ${r.round}: ${name(r.loser ?? 1)} out.`}</li>
                    ))}
                  </ul>
                  <button type="button" className="arc-btn" onClick={() => restart(options)}>NEW KNOCKOUT</button>
                </div>
              );
            }
            if (champ !== null) {
              return (
                <div className="arc-overlay ludo-overlay">
                  <p className="arc-overlay-kicker">KNOCKOUT OVER</p>
                  <h2>{champ === 0 ? "You win the knockout!" : `${name(champ)} wins the knockout.`}</h2>
                  <p>{champ === 0 ? `You beat ${name(game.loser ?? 1)} in the final.` : "You made the final. Go again?"}</p>
                  <button type="button" className="arc-btn" onClick={() => restart(options)}>NEW KNOCKOUT</button>
                </div>
              );
            }
            if (!nextKo) return null;
            const order = `${game.order.map((c, i) => `${ordinal(i)} ${name(c)}`).join(" · ")}`;
            if (game.loser === 0) {
              return (
                <div className="arc-overlay ludo-overlay">
                  <p className="arc-overlay-kicker">ROUND {ko.round} · {order.toUpperCase()}</p>
                  <h2>You&apos;re out.</h2>
                  <p>You were last home in {roundName(ko.round)}. The computers can play out the rest in an instant.</p>
                  <div className="ludo-overlay-btns">
                    <button type="button" className="arc-btn" onClick={playRest}>PLAY OUT THE REST</button>
                    <button type="button" className="arc-btn-ghost" onClick={() => restart(options)}>NEW KNOCKOUT</button>
                  </div>
                </div>
              );
            }
            const them = nextKo.alive.find((c) => c !== 0) ?? 1;
            return (
              <div className="arc-overlay ludo-overlay">
                <p className="arc-overlay-kicker">ROUND {ko.round} OVER · {order.toUpperCase()}</p>
                <h2>{name(game.loser ?? 1)} {game.loser === 0 ? "are" : "is"} out.</h2>
                {nextKo.round === 2 && <p>Round 2: you, {nextKo.alive.filter((c) => c !== 0).map(name).join(" and ")}. {NAMES[game.loser ?? 1]}&apos;s yard sits empty.</p>}
                {nextKo.round === 3 && (
                  <>
                    <p>The final: you against {name(them)}, two yards each. First to get all 8 home wins.</p>
                    <YardPicker picks={finalPick ?? finalDefault ?? DEFAULT_YARDS} onChange={setFinalPick} them={name(them)} />
                  </>
                )}
                <button type="button" className="arc-btn" onClick={nextRound}>{nextKo.round === 3 ? "START THE FINAL" : "START ROUND 2"}</button>
              </div>
            );
          })()}
        </div>

        <div className="ludo-controls">
          {koNow && (
            <p className="ludo-ko">
              {koNow.round === 3 ? "FINAL" : `ROUND ${koNow.round} OF 3`}
              {koNow.out.length > 0 && <> · OUT: {koNow.out.map((c) => name(c).toUpperCase()).join(", ")}</>}
            </p>
          )}
          <ul className="ludo-players" aria-label="Players">
            {NAMES.map((n, p) => {
              const placed = game.order.indexOf(game.table.owner[p]);
              const turn = started && game.turn === p && game.phase !== "over";
              return (
                <li key={n} className={`${turn ? "is-turn" : ""}${game.table.active[p] ? "" : " is-out"}`} aria-label={`${n}: ${playerLabel(p)}${game.table.active[p] ? `, ${homeCount(p)} home` : ""}${placed >= 0 ? `, finished ${ordinal(placed)}` : ""}`}>
                  <i style={{ background: COLOURS[p] }} />
                  <span>{playerLabel(p)}</span>
                  {game.table.active[p] && <b>{placed >= 0 && game.table.playToLast ? ordinal(placed).toUpperCase() : homeCount(p)}</b>}
                </li>
              );
            })}
          </ul>
          <div className="ludo-roll">
            <div className="ludo-dice" role="group" aria-label={two ? "Dice" : "Die"}>
              {shown.map((value, i) => (
                <Die
                  key={i}
                  value={value}
                  rolling={i >= spinningFrom}
                  used={showUsed && game.used[i]}
                  picked={pickable && activeDie === i}
                  onPick={pickable && usableDice.includes(i) ? () => setPick(i) : undefined}
                />
              ))}
            </div>
            {canGoHome && (
              <button type="button" className="arc-btn-ghost ludo-home-btn" onClick={goHome} aria-label="Spend the 6 and the 5 to send a seed from your yard straight home">
                6+5 → HOME
              </button>
            )}
            {watching ? (
              <button type="button" className="arc-btn" onClick={skipAhead} aria-label="Play out the rest of this round at once">SKIP AHEAD</button>
            ) : (
              <button type="button" className="arc-btn" onClick={startRoll} disabled={!canRoll} aria-label={two ? "Roll the dice" : "Roll the die"}>ROLL</button>
            )}
          </div>
        </div>

        <p className="arc-status" aria-live="polite">{watching ? `You're home. ${status}` : status}</p>
      </div>

      <style jsx global>{`
        .ludo-wrap { padding:10px; }
        .ludo-board { position:relative; display:grid; grid-template-columns:repeat(15,1fr); grid-template-rows:repeat(15,1fr); gap:1px; width:100%; max-width:560px; aspect-ratio:1; margin:0 auto; overflow:hidden; border-radius:6px; background:#cfd5c9; }
        .ludo-sq { position:relative; display:grid; place-items:center; background:#f7f7f2; }
        .ludo-sq.is-home { filter:saturate(.85); }
        .ludo-star { width:72%; height:72%; fill:#b9c1b4; }
        .ludo-sq.is-start .ludo-star { fill:#ffffffaa; }
        .ludo-yard { position:relative; display:grid; place-items:center; }
        .ludo-yard.is-empty { filter:grayscale(1) opacity(.45); }
        .ludo-yard-tag { position:absolute; z-index:2; left:6%; top:6%; padding:2px 5px; border-radius:4px; background:#17251fcc; color:#fff; font:700 8px ui-monospace,monospace; letter-spacing:.1em; pointer-events:none; }
        .ludo-yard-inner { position:relative; z-index:1; width:66.6%; height:66.6%; border-radius:12%; background:#f7f7f2b8; box-shadow:inset 0 0 0 1px #17251f14; backdrop-filter:blur(1px); pointer-events:none; }
        .ludo-yard-inner i { position:absolute; width:32%; height:32%; border-radius:50%; transform:translate(-50%,-50%); }
        .ludo-yard-inner i:nth-child(1) { left:25%; top:25%; }.ludo-yard-inner i:nth-child(2) { left:75%; top:25%; }
        .ludo-yard-inner i:nth-child(3) { left:25%; top:75%; }.ludo-yard-inner i:nth-child(4) { left:75%; top:75%; }
        .ludo-centre { position:relative; grid-area:7 / 7 / span 3 / span 3; }
        .ludo-seed { position:absolute; z-index:2; aspect-ratio:1; padding:0; border:2px solid #17251f; border-radius:50%; background:radial-gradient(circle at 35% 30%, #ffffffd9 0 10%, transparent 26%), radial-gradient(circle at 50% 50%, #fff 0 20%, var(--ludo-c) 22% 68%, color-mix(in srgb, var(--ludo-c) 70%, #000) 100%); box-shadow:0 3px 0 #17251f66, 0 5px 8px #17251f40, inset 0 -3px 4px #0003; transform:translate(-50%,-50%); transition:left .25s ease, top .25s ease, width .2s ease; }
        button.ludo-seed { cursor:default; }
        button.ludo-seed:disabled { opacity:1; }
        .ludo-seed.is-movable { z-index:3; cursor:pointer; animation:ludo-pulse 1s ease-in-out infinite; }
        .ludo-seed.is-movable::after { content:""; position:absolute; inset:-5px; border:2px solid #bdf36b; border-radius:50%; }
        .ludo-seed.is-movable::before { content:""; position:absolute; inset:-10px; border-radius:50%; } /* a bigger tap target on small screens */
        .ludo-seed:focus-visible { outline:2px solid #ff816d; outline-offset:3px; }
        @keyframes ludo-pulse { 50% { box-shadow:0 0 0 4px #bdf36b88, 0 2px 0 #17251f55; } }
        .ludo-overlay { overflow-y:auto; }
        .ludo-overlay p { max-width:340px; }
        .ludo-overlay-btns { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; }
        .ludo-picker { margin:0 0 16px; }
        .ludo-picker-chips { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; }
        .ludo-chip { display:inline-flex; align-items:center; gap:6px; padding:7px 10px; border:1.5px solid #ffffff40; border-radius:999px; background:transparent; color:#c1cbc3; font:700 9px ui-monospace,monospace; letter-spacing:.08em; cursor:pointer; }
        .ludo-chip i { width:10px; height:10px; border:1.5px solid #17251f; border-radius:50%; background:var(--ludo-c); }
        .ludo-chip.is-on { border-color:var(--ludo-c); background:#ffffff1a; color:#fff; box-shadow:0 0 0 2px color-mix(in srgb, var(--ludo-c) 45%, transparent); }
        .ludo-chip:focus-visible { outline:2px solid #c2f17a; outline-offset:2px; }
        .arc-overlay .ludo-picker-note { margin:8px 0 0; font-size:11px; }
        .ludo-results { margin:0 0 16px; padding:0; list-style:none; color:#c1cbc3; font-size:12px; line-height:1.7; }
        .ludo-controls { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 4px 0; }
        .ludo-ko { flex-basis:100%; margin:0; color:#58645c; font:700 9px ui-monospace,monospace; letter-spacing:.1em; }
        .ludo-players { display:flex; flex-wrap:wrap; gap:6px; margin:0; padding:0; list-style:none; }
        .ludo-players li { display:flex; align-items:center; gap:6px; padding:6px 8px; border:1px solid #e3e6df; border-radius:7px; background:#f8f9f6; color:#58645c; font:700 9px ui-monospace,monospace; letter-spacing:.08em; }
        .ludo-players li.is-turn { border-color:#83b83c; background:#eef8de; color:#17251f; }
        .ludo-players li.is-out { opacity:.5; text-decoration:line-through; }
        .ludo-players i { width:10px; height:10px; border:1.5px solid #17251f; border-radius:50%; }
        .ludo-players b { color:#929b94; font-weight:600; }
        .ludo-roll { display:flex; align-items:center; gap:12px; }
        .ludo-dice { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; max-width:260px; }
        .ludo-die { display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); gap:3px; width:46px; height:46px; padding:7px; box-sizing:border-box; border:1.5px solid #17251f; border-radius:9px; background:#fff; box-shadow:0 3px 0 #17251f22; }
        .ludo-pip { border-radius:50%; background:#17251f; }
        button.ludo-die { cursor:pointer; }
        button.ludo-die:focus-visible { outline:2px solid #ff816d; outline-offset:3px; }
        .ludo-die.is-picked { border-color:#83b83c; box-shadow:0 0 0 3px #bdf36b, 0 3px 0 #17251f22; }
        .ludo-die.is-used { opacity:.35; box-shadow:none; }
        .ludo-home-btn { border-color:#83b83c; background:#eef8de; color:#17251f; white-space:nowrap; }
        .ludo-die.is-rolling { animation:ludo-shake .26s linear infinite; }
        @keyframes ludo-shake { 25% { transform:rotate(-12deg) translateY(-2px); } 75% { transform:rotate(12deg) translateY(-2px); } }
        @media(max-width:480px) { .ludo-wrap { padding:6px; } .ludo-seed { border-width:1.5px; } .ludo-players li { padding:5px 6px; font-size:8px; } .ludo-die { width:40px; height:40px; padding:6px; } .ludo-roll { gap:8px; } .ludo-dice { gap:6px; } .ludo-home-btn { padding:9px 8px; } .ludo-overlay { padding:12px; justify-content:safe center; } .ludo-overlay h2 { font-size:24px; margin-bottom:4px; } .ludo-overlay p { margin:0 0 10px; font-size:11px; } .ludo-picker { margin-bottom:10px; } .ludo-chip { padding:6px 8px; } .ludo-yard-tag { font-size:6px; padding:1px 3px; } }
        @media(prefers-reduced-motion:reduce) { .ludo-seed { transition:none; } .ludo-seed.is-movable, .ludo-die.is-rolling { animation:none; } }
      `}</style>
    </ArcadeShell>
  );
}
