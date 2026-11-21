// Nana for Ludo (owner, 21 Nov 2026: "a free Nana for arcade [that won't cost us nor the players] where Nana suggests moves or
// analyze opponent moves"). The hint is the action lib/arcade/ludo.ts's own computer would take with your dice (`chooseAction`),
// and the reasons are read off the board before and after it. No AI service and no dice of her own: free, offline, deterministic.
// In 2 v 2 yards and the knockout final she helps whichever of your colours is to move. Pure: no React or DOM.
import {
  HOME, LAST_TRACK, SAFE, YARD, absSquare, applyAction, chooseAction, legalActions, threatAt,
  type LudoAction, type LudoState,
} from "./ludo";
import { listText, type NanaTake, type NanaTip } from "./nana";

// The colour names the board uses (components/games/LudoGame.tsx), clockwise from the bottom-left yard.
export const LUDO_NAMES = ["Green", "Coral", "Gold", "Blue"];

/** What the board lights up for a hint: the seed, the die to use (an index into state.dice), and where it lands (a progress; HOME
 * for home). The roll phase has nothing to light up. */
export type LudoHighlight = { player: number; seed: number; die: number | null; to: number } | null;

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const mine = (s: LudoState, colour: number, controller: number) => s.table.owner[colour] === controller;
const sameAction = (a: LudoAction, b: LudoAction) => a.kind === b.kind && a.seed === b.seed && (a.kind === "home" || (b.kind === "step" && a.die === b.die));

// "the seed 12 steps along", "a seed from your yard", "your gold seed in its home column".
function seedLabel(s: LudoState, colour: number, seed: number, controller: number): string {
  const multi = s.table.owner.filter((o, c) => o === controller && s.table.active[c]).length > 1;
  const col = multi ? `${LUDO_NAMES[colour].toLowerCase()} ` : "";
  const p = s.seeds[colour][seed];
  if (p === YARD) return `a ${col}seed from your yard`;
  if (p > LAST_TRACK) return `your ${col}seed in its home column`;
  if (p === 0) return `your ${col}seed on its start square`;
  return `your ${col}seed ${p} ${p === 1 ? "step" : "steps"} along`;
}

/** Why an action is good, from the board before and after. `you` words it for the person; otherwise for a computer colour. */
function reasons(before: LudoState, a: LudoAction, after: LudoState, you: boolean): string[] {
  const colour = before.turn;
  const ctrl = before.table.owner[colour];
  const out: string[] = [];
  if (after.order.includes(ctrl) && !before.order.includes(ctrl)) {
    return [you ? (after.phase === "over" && after.winner === ctrl ? "it gets your last seed home, so you win" : "it gets your last seed home") : "it got its last seed home"];
  }
  if (a.kind === "home") return [you ? "the 6 and the 5 send a seed from your yard straight home" : "it went 6 + 5 straight home"];
  const e = after.last;
  if (e?.kind !== "move") return out;
  const victims = [...new Set(e.captured.map((c) => c.player))];
  if (victims.length) {
    // Your own colours never capture each other, so "your" only ever means a computer hitting you.
    const names = victims.map((v) => (!you && before.table.owner[v] === 0 ? "your" : `${LUDO_NAMES[v]}'s`));
    out.push(`it ${you ? "captures" : "captured"} ${listText(names)} seed${e.captured.length > 1 ? "s" : ""}`);
    if (e.hitHome) out.push(`${you ? "your" : "its"} seed goes straight home`);
    // No "you roll again": a capture earns no bonus roll (owner, 21 Nov 2026).
    return out;
  }
  if (e.to === HOME) out.push(you ? "it gets a seed home" : "it got a seed home");
  else if (e.from === YARD) out.push(you ? "it brings a new seed out" : "it brought a new seed out");
  else if (e.from <= LAST_TRACK && e.to > LAST_TRACK) out.push(you ? "it moves into your home column, where nothing can hit it" : "it moved into its home column, out of reach");
  const fromSq = absSquare(colour, e.from);
  const toSq = absSquare(colour, e.to);
  const danger = fromSq !== null ? threatAt(before, colour, fromSq) : 0;
  const after1 = toSq !== null ? threatAt(after, colour, toSq) : 0;
  // The safety reasons only when nothing bigger (home, out of the yard, into the home column) already explains the move.
  if (!out.length) {
    if (danger > 0 && after1 === 0) out.push(you ? "it moves a seed out of danger" : "it moved a seed out of danger");
    else if (toSq !== null && SAFE.has(toSq)) out.push(you ? "it lands on a star, which is safe" : "it parked on a star, which is safe");
    else if (toSq !== null && after1 === 0) out.push(you ? "it moves your seed to a square nothing can reach" : "it moved a seed to a square nothing can reach");
  }
  if (!out.length) out.push(you ? "it's the strongest use of your dice here" : `it moved a seed ${e.die} on`);
  return out;
}

/**
 * What Nana would do now for `controller` (0 = the person): roll, or which seed to move with which die, and why. Null when it isn't
 * one of their colours to act, or the game is over.
 */
export function ludoTip(state: LudoState, controller = 0): { tip: NanaTip; highlight: LudoHighlight } | null {
  if (state.phase === "over" || !mine(state, state.turn, controller)) return null;
  if (state.phase === "roll") {
    const two = state.options.dice === 2;
    return { tip: { move: two ? "rolling the dice" : "rolling the die", why: "You need a roll before there's a move to pick. Ask me again once it lands." }, highlight: null };
  }
  const actions = legalActions(state);
  if (actions.length === 0) return null;
  const a = chooseAction(state);
  const after = applyAction(state, a);
  const why = reasons(state, a, after, true);
  if (a.kind === "home") {
    return { tip: { move: "6 + 5 straight home", why: `${capital(listText(why))}.` }, highlight: { player: state.turn, seed: a.seed, die: null, to: HOME } };
  }
  const value = state.dice[a.die];
  const e = after.last;
  const to = e?.kind === "move" ? e.to : state.seeds[state.turn][a.seed] + value;
  const plain = why.length === 1 && why[0].startsWith("it's the strongest");
  const text = actions.length === 1 && plain ? "It's your only move." : `${capital(listText(why))}.${actions.length === 1 ? " It's your only move." : ""}`;
  return {
    tip: { move: `${seedLabel(state, state.turn, a.seed, controller)} with the ${value}`, why: text },
    highlight: { player: state.turn, seed: a.seed, die: a.die, to },
  };
}

/**
 * Nana's take on a computer colour's latest action or roll, from `before` to `after`: what it did and why, and a warning when one of
 * your seeds can now be hit. Null when the latest event isn't a computer's.
 */
export function ludoTake(before: LudoState, after: LudoState, controller = 0): NanaTake | null {
  const e = after.last;
  if (!e || e === before.last || mine(after, e.player, controller)) return null;
  const name = LUDO_NAMES[e.player];
  if (e.kind === "pass") return { text: `${name} rolled ${listText(e.dice.map(String))} and couldn't move.`, tone: "fine" };
  if (e.kind === "three-sixes") return { text: `${name} rolled three ${after.options.dice === 2 ? "double sixes" : "sixes"} and lost the turn.`, tone: "fine" };
  // The action it took: the engine's own pick, so a match is "good". Rebuild it from the event to compare.
  const action: LudoAction | null = e.kind === "straight-home" ? { kind: "home", seed: e.seed }
    : before.phase === "move" ? legalActions(before).find((x) => x.kind === "step" && x.seed === e.seed && before.dice[x.die] === e.die) ?? null : null;
  if (!action || before.turn !== e.player) return null;
  const tone: NanaTake["tone"] = sameAction(chooseAction(before), action) ? "good" : "fine";
  const why = reasons(before, action, after, false);
  // "Coral captured your seed and its seed goes straight home."
  const sentences = [`${name} ${listText(why.map((r) => r.replace(/^it /, "")))}.`];
  if (e.kind === "move" && e.captured.some((c) => before.table.owner[c.player] === controller)) sentences.push("Bad luck. Bring it back out with a 6.");
  else if (after.phase !== "over") {
    // A warning: one of your seeds an opponent can now reach with one die, and couldn't before this move (so the same warning
    // doesn't repeat after every computer move).
    const newlyHit = (c: number, i: number) => {
      const sq = absSquare(c, after.seeds[c][i]);
      if (sq === null || threatAt(after, c, sq) === 0) return false;
      return before.seeds[c][i] !== after.seeds[c][i] || threatAt(before, c, sq) === 0;
    };
    for (const c of after.table.owner.flatMap((o, col) => (o === controller && after.table.active[col] ? [col] : []))) {
      const seed = after.seeds[c].findIndex((_, i) => newlyHit(c, i));
      if (seed >= 0) { sentences.push(`Watch ${seedLabel(after, c, seed, controller)}: it can be hit.`); break; }
    }
  }
  return { text: sentences.join(" "), tone };
}
