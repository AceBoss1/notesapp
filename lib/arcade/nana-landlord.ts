// Nana for Naija Landlord (owner, 21 Nov 2026: "a free Nana for arcade ... where Nana suggests moves or analyze opponent moves").
// Pure: no React.
//
// Free, so no AI service: the tip is the computer players' own choice (aiAction) made from your seat, with the reason put in plain
// words. Nothing is hidden in this game (cash, plots and flats are all on the board, and cards are drawn at random, not from a
// stacked deck), so Nana can use the whole board.
import { listText, type NanaTake, type NanaTip } from "./nana";
import {
  BOARD, BOARD_SIZE, CITIES, HOLDUP, aiAction, applyAction, buildable, canBuy, citySquares, formatNaira, ownsCity, rentFor,
  type Action, type CityId, type State,
} from "./landlord";

const NUMBER_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const count = (n: number) => NUMBER_WORD[n] ?? String(n);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const BUILD_CUSHION = 150; // the engine's own: the computer keeps N$150k after building a flat

/** The dearest rent another player can charge you right now, and where. */
export function worstRent(s: State, me = 0): { square: number; rent: number } | null {
  let best: { square: number; rent: number } | null = null;
  BOARD.forEach((_, i) => {
    const owner = s.owner[i];
    if (owner === null || owner === me || s.players[owner].out) return;
    const rent = rentFor(s, i);
    if (!best || rent > best.rent) best = { square: i, rent };
  });
  return best;
}

/** The dearest rent waiting 2 to 12 squares ahead of you (one roll), if any. */
function dangerAhead(s: State, me = 0): { square: number; rent: number; steps: number } | null {
  const pos = s.players[me].pos;
  let best: { square: number; rent: number; steps: number } | null = null;
  for (let steps = 2; steps <= 12; steps += 1) {
    const i = (pos + steps) % BOARD_SIZE;
    const owner = s.owner[i];
    if (owner === null || owner === me || s.players[owner].out) continue;
    const rent = rentFor(s, i);
    if (!best || rent > best.rent) best = { square: i, rent, steps };
  }
  return best;
}

function cityProgress(s: State, who: number, city: CityId): { owned: number; total: number; blockedBy: number | null } {
  const squares = citySquares(city);
  const blocker = squares.map((i) => s.owner[i]).find((o) => o !== null && o !== who);
  return { owned: squares.filter((i) => s.owner[i] === who).length, total: squares.length, blockedBy: blocker ?? null };
}

const parksOwned = (s: State, who: number) => BOARD.filter((b, i) => b.kind === "park" && s.owner[i] === who).length;

function buyWhy(s: State): string {
  const p = s.players[0];
  const sq = BOARD[p.pos];
  const left = p.cash - (sq.price ?? 0);
  const keep = ` You'd still have ${formatNaira(left)}.`;
  if (sq.kind === "park") {
    const n = parksOwned(s, 0) + 1;
    return `Danfo Parks pay more the more you own: with this one you'd have ${count(n)}, rent ${formatNaira(30 * n)}.${keep}`;
  }
  const city = sq.city as CityId;
  const prog = cityProgress(s, 0, city);
  if (prog.owned + 1 === prog.total) return `You'd complete the ${CITIES[city].name} set, so rent there doubles and you can build flats.${keep}`;
  if (prog.owned > 0) return `You already own ${count(prog.owned)} of the ${count(prog.total)} ${CITIES[city].name} plots; this gets you closer to the set.${keep}`;
  return `Nobody owns any of ${CITIES[city].name} yet, so it could become your set.${keep}`;
}

function skipWhy(s: State): string {
  const p = s.players[0];
  const sq = BOARD[p.pos];
  const price = sq.price ?? 0;
  if (!canBuy(s)) return `You can't afford ${sq.name} (${formatNaira(price)}) with ${formatNaira(p.cash)}.`;
  const left = p.cash - price;
  const worst = worstRent(s);
  const rentNote = worst ? ` The dearest rent you could land on is ${formatNaira(worst.rent)} at ${BOARD[worst.square].short}.` : "";
  const city = sq.city;
  if (city) {
    const prog = cityProgress(s, 0, city);
    if (prog.blockedBy !== null) {
      return `${s.players[prog.blockedBy].name} already owns part of ${CITIES[city].name}, so it won't become your set. Keep ${formatNaira(p.cash)} for rent you may owe instead of dropping to ${formatNaira(left)}.${rentNote}`;
    }
  }
  return `Keep ${formatNaira(p.cash)} for rent you may owe: buying would leave you only ${formatNaira(left)}.${rentNote}`;
}

function rollWhy(s: State): string {
  const p = s.players[0];
  const reasons: string[] = [];
  if (s.again) reasons.push("you rolled a double, so you roll again");
  const owned = (Object.keys(CITIES) as CityId[]).filter((c) => ownsCity(s, 0, c));
  // aiAction only says roll over a legal build when the flat would leave less than its N$150k cushion.
  if (buildable(s, 0).length > 0) reasons.push(`keep at least ${formatNaira(BUILD_CUSHION)} after a flat; with ${formatNaira(p.cash)} it's safer to hold your cash for now`);
  const danger = dangerAhead(s);
  let tail = "";
  if (danger && danger.rent >= 40) tail = ` Watch out: ${s.players[s.owner[danger.square] as number].name}'s ${BOARD[danger.square].short} is ${danger.steps} squares ahead (rent ${formatNaira(danger.rent)}).`;
  const base = reasons.length ? `${cap(listText(reasons))}.` : owned.length ? "Nothing worth building right now, so roll." : "Roll and look for plots to buy: sets of a city are where the money is.";
  return `${base}${tail}`;
}

export function landlordTip(state: State): { tip: NanaTip; highlight: Action } | null {
  if (state.phase === "over" || state.turn !== 0 || state.players[0].out) return null;
  const a = aiAction(state);
  const p = state.players[0];
  const sq = BOARD[p.pos];
  switch (a.type) {
    case "buy": return { tip: { move: `buy ${sq.name}`, why: buyWhy(state) }, highlight: a };
    case "skip": return { tip: { move: `skip ${sq.short}`, why: skipWhy(state) }, highlight: a };
    case "build": {
      const target = BOARD[a.square];
      const now = rentFor(state, a.square);
      const then = rentFor(applyAction(state, a), a.square);
      return { tip: { move: `build a flat on ${target.name}`, why: `It lifts the rent there from ${formatNaira(now)} to ${formatNaira(then)}, and you keep ${formatNaira(p.cash - CITIES[target.city as CityId].flatCost)}.` }, highlight: a };
    }
    default: return { tip: { move: "roll", why: rollWhy(state) }, highlight: a };
  }
}

/** Nana's take on a computer player's latest action. */
export function landlordTake(before: State, action: Action, after: State): NanaTake | null {
  const who = before.turn;
  const p = before.players[who];
  if (p.human) return null;
  const name = p.name;
  const now = after.players[who];
  if (action.type === "buy") {
    const sq = BOARD[before.players[who].pos];
    if (sq.kind === "park") {
      const n = parksOwned(after, who);
      return { text: `${name} bought ${sq.name}: ${count(n)} park${n === 1 ? "" : "s"} now, rent ${formatNaira(30 * n)} a stop.`, tone: n >= 2 ? "risky" : "fine" };
    }
    const city = sq.city as CityId;
    const prog = cityProgress(after, who, city);
    if (prog.owned === prog.total) return { text: `${name} bought ${sq.short} and now owns all of ${CITIES[city].name}: rent there doubles, and flats come next. Tread carefully.`, tone: "risky" };
    if (prog.blockedBy === 0) return { text: `${name} bought ${sq.short}, but you hold part of ${CITIES[city].name}, so nobody gets that set yet.`, tone: "fine" };
    if (prog.blockedBy !== null) return { text: `${name} bought ${sq.short}. ${CITIES[city].name} is split, so no set there yet.`, tone: "fine" };
    const more = prog.total - prog.owned;
    return { text: `${name} bought ${sq.short} in ${CITIES[city].name}: ${count(more)} more and ${name} owns the set.`, tone: more === 1 ? "risky" : "fine" };
  }
  if (action.type === "skip") {
    const sq = BOARD[before.players[who].pos];
    return { text: `${name} passed on ${sq.short}: it's still for sale if you land there.`, tone: "good" };
  }
  if (action.type === "build") {
    const sq = BOARD[action.square];
    return { text: `${name} built a flat on ${sq.short}: rent there is now ${formatNaira(rentFor(after, action.square))}.`, tone: "risky" };
  }
  // A roll: say what came of it, from the board.
  if (now.out) return { text: `${name} ran out of money and is out of the game.`, tone: "good" };
  const pos = now.pos;
  const sq = BOARD[pos];
  const myGain = after.players[0].cash - before.players[0].cash;
  const owner = after.owner[pos];
  if (owner === 0 && myGain > 0) return { text: `${name} landed on your ${sq.short} and paid you ${formatNaira(myGain)}.`, tone: "good" };
  if (now.held && pos === HOLDUP) return { text: `${name} is stuck in Traffic Hold-up and misses a turn.`, tone: "good" };
  if (after.lastCard) return { text: `${name} drew a card: ${after.lastCard}.`, tone: "fine" };
  if (owner !== null && owner !== who) return { text: `${name} paid ${after.players[owner].name} ${formatNaira(rentFor(after, pos))} rent for ${sq.short}.`, tone: "fine" };
  if (after.phase === "buy" && after.turn === who) return { text: `${name} landed on ${sq.short}, for sale at ${formatNaira(sq.price ?? 0)}.`, tone: "fine" };
  const dice = after.dice ? ` rolled ${after.dice[0] + after.dice[1]} and` : "";
  return { text: `${name}${dice} landed on ${sq.short}.`, tone: "fine" };
}
