// Nana for Ncho and Ncho Aka-Hausa (owner, 21 Nov 2026: "a free Nana for arcade [that won't cost us nor the players] where Nana
// suggests moves or analyze opponent moves"). The hint is the hole lib/arcade/ncho.ts's own computer picks on HARD, and the reasons
// come from playing that hole out with the real rules (relays, fours on the way, the last 8). No AI service: free and offline.
// Works for 2 and 4 players and for both sowing directions, since the engine does. Pure: no React or DOM.
import { applyMove, chooseMove, legalMoves, nextPlayer, directionOf, housesOf, type NchoMove, type NchoState, type Player } from "./ncho";
import { listText, rateMove, type NanaTake, type NanaTip } from "./nana";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** How the UI names a player: "you", "the computer" (2 players) or "Computer 1".."Computer 3" (4 players). */
export function nchoName(p: Player, players: number): string {
  return p === 0 ? "you" : players === 2 ? "the computer" : `Computer ${p}`;
}

/** A hole as the board shows it: bottom row 0..n-1 left to right, top row drawn from 2n-1 down, left to right. */
export function holeLabel(hole: number, holesPerSide: number): string {
  if (hole < holesPerSide) return `bottom-row hole ${hole + 1} from the left`;
  return `top-row hole ${2 * holesPerSide - hole} from the left`;
}

// Net seeds a move wins for the mover straight away: its own gains minus the most any one other player gained.
const net = (m: NchoMove, mover: Player) => {
  const others = m.gains.filter((_, p) => p !== mover);
  return (m.gains[mover] ?? 0) - Math.max(0, ...others);
};

// The most the player to move in `s` can take with one move (by every rule: last-seed 4s, 4s on the way, the last 8).
function bestImmediate(s: NchoState): number {
  return bestTake(s).seeds;
}
// The same, and whether that best take is the last 8 (rule 5), so a hint can name it.
function bestTake(s: NchoState): { seeds: number; lastEight: boolean } {
  let best = { seeds: 0, lastEight: false };
  if (s.over || s.lastRound) return best;
  for (const h of legalMoves(s)) {
    const m = applyMove(s, h).last!;
    const seeds = m.gains[s.turn] ?? 0;
    if (seeds > best.seeds) best = { seeds, lastEight: m.sweep?.to === s.turn };
  }
  return best;
}

/** Why a sowing is good for its mover, from the move record and the board after. */
function reasons(before: NchoState, after: NchoState): string[] {
  const m = after.last!;
  const me = m.player;
  const P = before.players;
  const out: string[] = [];
  if (m.sweep && m.sweep.to === me) out.push(`it takes a 4 with only 8 seeds left, so you take all 8 and the round ends`);
  else if (m.end === "four") {
    const row = before.owner[m.lastHole] === me ? "" : before.owner[m.lastHole] === 0 ? " on your row" : ` in ${nchoName(before.owner[m.lastHole], P)}'s hole`;
    out.push(`the last seed lands on a 4${row}, so you take it`);
  }
  const onWay = m.captures.filter((c) => !c.last && c.to === me).length;
  if (onWay) out.push(onWay === 1 ? "a 4 made on the way lands in one of your holes, so it's yours" : `${onWay} fours made on the way land in your holes, so they're yours`);
  const given = m.gains.reduce((a, g, p) => (p === me ? a : a + g), 0);
  if (out.length && given === 0 && m.relays > 0) out.push(`the relay gives nothing away`);
  if (after.lastRound && !after.lastRound.eliminated.includes(me) && !out.length) {
    out.push(`it ends the round with you on ${plural(after.lastRound.houses[me], "house")}`);
  }
  if (out.length) return out;
  // A quiet move: say what it denies the next player, compared with the other holes.
  const nextUp = after.turn;
  const after1 = bestImmediate(after);
  const others = legalMoves(before).map((h) => bestImmediate(applyMove(before, h)));
  const name = nchoName(nextUp, P);
  if (after1 === 0 && others.filter((x) => x === 0).length === 1) return [`it's the only hole that leaves ${name} no 4 to take next turn`];
  if (after1 === 0) return [`it leaves ${name} no 4 to take next turn`];
  if (after1 <= Math.min(...others)) return [`every hole gives ${name} something, and this one gives the least`];
  return ["looking several moves ahead, it does the most for your houses"];
}

// HARD's pick, with its ties broken sensibly. chooseMove picks at random between equally scored holes (so games vary); Nana must
// give the same hint every time and, among equals, the one that takes the most now (a sure 4, or the last 8, beats "it comes back
// later"), then the one that leaves the next player least. The rng values (i + 0.5) / 12 reach every index of up to 12 tied holes,
// and a search takes a few milliseconds, so asking 12 times is cheap.
function bestHole(state: NchoState, moves: number[]): number {
  if (moves.length === 1) return moves[0];
  const tied = new Set<number>();
  for (let i = 0; i < 12; i++) tied.add(chooseMove(state, "hard", () => (i + 0.5) / 12));
  const rank = (h: number) => {
    const a = applyMove(state, h);
    return { take: a.last!.gains[state.turn] ?? 0, give: a.turn !== state.turn ? bestImmediate(a) : 0 };
  };
  return [...tied].sort((x, y) => {
    const a = rank(x); const b = rank(y);
    return b.take - a.take || a.give - b.give || x - y;
  })[0];
}

/** What Nana would play for the person (on their turn): the hole to highlight and why. Null when there's nothing to play. */
export function nchoTip(state: NchoState): { tip: NanaTip; highlight: number } | null {
  if (state.over || state.lastRound) return null; // between rounds there's no hole to pick
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  const hole = bestHole(state, moves);
  const after = applyMove(state, hole);
  const why = reasons(state, after);
  return {
    tip: { move: `the ${holeLabel(hole, state.holesPerSide)} (${plural(state.pits[hole], "seed")})`, why: `${capital(listText(why))}.` },
    highlight: hole,
  };
}

/** Nana's take on a computer's sowing, from `before` to `after` (whose `last` is that move): what it won, and what it means for you. */
export function nchoTake(before: NchoState, after: NchoState): NanaTake | null {
  const m = after.last;
  if (!m || m.player !== before.turn || m.player === 0) return null;
  const P = before.players;
  const who = capital(nchoName(m.player, P));
  // Tone: what this sowing won, less what the next player can take straight back, against the best of its other holes. Two moves
  // deep is enough for a plain "good / fine / risky": the engine looks further, so a deep plan can come out "fine", never wrong.
  const value = (a: NchoState) => net(a.last!, m.player) - (a.turn !== m.player ? bestImmediate(a) : 0);
  const best = Math.max(...legalMoves(before).map((h) => value(applyMove(before, h))));
  const tone = rateMove(value(after), best, 3);
  const parts: string[] = [];
  const yours = m.gains[0] ?? 0;
  if (m.sweep) {
    parts.push(m.sweep.to === 0 ? `${who} made a 4 with 8 left in your hole, so you took all 8.` : `${who} took a 4 with only 8 left, so it took all 8 and the round is over.`);
  } else {
    const took = m.gains[m.player] ?? 0;
    if (m.end === "four") {
      const whose = before.owner[m.lastHole];
      parts.push(`${who}'s last seed made 4 ${whose === 0 ? "in your hole" : whose === m.player ? "in its own hole" : `in ${nchoName(whose, P)}'s hole`}, so it took them.`);
    } else if (took > 0) parts.push(`${who} sowed for ${plural(took, "seed")} from fours on the way.`);
    else parts.push(`${who} sowed ${plural(m.sowings[0].seeds, "seed")}${m.relays === 1 ? " and relayed once" : m.relays > 1 ? ` and relayed ${m.relays} times` : ""} without taking a 4.`);
    if (yours > 0) parts.push(`${yours === 4 ? "A 4" : `${yours} seeds`} on the way went to you.`);
  }
  if (after.lastRound) {
    if (!m.sweep) parts.push(`That ends round ${after.lastRound.round}.`);
    return { text: parts.join(" "), tone };
  }
  if (after.over) return { text: parts.join(" "), tone };
  // What it means for you, when you're up next: a 4 to take, or the computer's plan to keep you from one.
  if (after.turn === 0 && housesOf(after.owner, 0) > 0) {
    const now = bestTake(after);
    if (now.seeds > 0) parts.push(now.lastEight ? "The last 8 are yours to take now." : now.seeds === 4 ? "There's a 4 for you to take now." : `There are ${now.seeds} seeds for you to take now.`);
    else if (yours === 0 && m.end !== "four") parts.push("It left you no 4 to take.");
  } else if (P === 4 && after.turn !== 0) {
    // Someone else plays before you: no warning yet, just who's next.
    const after2 = nextPlayer(after.owner, after.turn, P, directionOf(after.variant));
    if (after2 === 0) parts.push(`${capital(nchoName(after.turn, P))} plays, then you.`);
  }
  return { text: parts.join(" "), tone };
}
