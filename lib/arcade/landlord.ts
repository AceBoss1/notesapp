// Naija Landlord: our own property-trading game on a 32-square loop of Nigerian neighbourhoods and markets.
// Pure logic, no React or DOM. Money is in thousands of naira (1 = N$1k). Every apply returns a new state.

export type Rng = () => number;

export const START_CASH = 1500;
export const SALARY = 200;
export const ROUND_CAP = 80;
export const HOLDUP = 8; // index of the Traffic Hold-up square
export const MAX_FLATS = 3;
export const BOARD_SIZE = 32;

export type CityId = "enugu" | "kano" | "ibadan" | "ph" | "east" | "abuja" | "lagosmkt" | "lagos";
export type City = { id: CityId; name: string; colour: string; flatCost: number };

export const CITIES: Record<CityId, City> = {
  enugu: { id: "enugu", name: "Enugu", colour: "#c9b29b", flatCost: 50 },
  kano: { id: "kano", name: "Kano", colour: "#e5a985", flatCost: 50 },
  ibadan: { id: "ibadan", name: "Ibadan", colour: "#b5c99a", flatCost: 100 },
  ph: { id: "ph", name: "Port Harcourt", colour: "#93bccb", flatCost: 100 },
  east: { id: "east", name: "Eastern markets", colour: "#8fc2b0", flatCost: 100 },
  abuja: { id: "abuja", name: "Abuja", colour: "#c3abd6", flatCost: 150 },
  lagosmkt: { id: "lagosmkt", name: "Lagos markets", colour: "#d9a3b4", flatCost: 150 },
  lagos: { id: "lagos", name: "Lagos", colour: "#e3c46f", flatCost: 150 },
};

export type SquareKind = "start" | "plot" | "park" | "market" | "fortune" | "tax" | "holdup" | "rest";
export type Square = { name: string; short: string; kind: SquareKind; city?: CityId; price?: number; rent?: number };

const plot = (name: string, short: string, city: CityId, price: number, rent: number): Square => ({ name, short, kind: "plot", city, price, rent });
// Park rent is N$30k per park the owner holds: N$30k, N$60k or N$90k.
const park = (name: string): Square => ({ name, short: "Danfo Park", kind: "park", price: 150, rent: 30 });

// Clockwise from the top-left corner, cheap to dear. Corners: Start, Traffic Hold-up, Rest Stop, Tax office.
export const BOARD: Square[] = [
  { name: "Start", short: "Start", kind: "start" },
  plot("Ogui", "Ogui", "enugu", 60, 12),
  plot("Independence Layout", "Ind. Layout", "enugu", 70, 14),
  { name: "Market", short: "Market", kind: "market" },
  plot("Sabon Gari", "Sabon Gari", "kano", 80, 16),
  plot("Nassarawa", "Nassarawa", "kano", 90, 18),
  park("Oshodi Danfo Park"),
  { name: "Fortune", short: "Fortune", kind: "fortune" },
  { name: "Traffic Hold-up", short: "Hold-up", kind: "holdup" },
  plot("Ring Road", "Ring Road", "ibadan", 100, 20),
  plot("Bodija", "Bodija", "ibadan", 120, 24),
  { name: "Market", short: "Market", kind: "market" },
  plot("Trans-Amadi", "Trans-Amadi", "ph", 140, 28),
  plot("GRA", "GRA", "ph", 150, 30),
  park("Upper Iweka Park (Onitsha)"),
  plot("Ariaria International Market (Aba)", "Ariaria", "east", 160, 32),
  { name: "Rest Stop", short: "Rest Stop", kind: "rest" },
  plot("Nkwo Nnewi Market (Nnewi)", "Nkwo Nnewi", "east", 160, 32),
  plot("Eke Osumenyi Market (Nnewi)", "Eke Osumenyi", "east", 170, 34),
  { name: "Fortune", short: "Fortune", kind: "fortune" },
  plot("Garki", "Garki", "abuja", 180, 36),
  plot("Wuse", "Wuse", "abuja", 180, 36),
  plot("Maitama", "Maitama", "abuja", 200, 40),
  { name: "Market", short: "Market", kind: "market" },
  { name: "Tax office", short: "Tax office", kind: "tax" },
  plot("Lagos International Trade Fair", "Trade Fair", "lagosmkt", 210, 42),
  plot("Alaba International Market (Lagos)", "Alaba", "lagosmkt", 230, 46),
  park("Ojota Danfo Park"),
  plot("Yaba", "Yaba", "lagos", 240, 48),
  { name: "Fortune", short: "Fortune", kind: "fortune" },
  plot("Ikoyi", "Ikoyi", "lagos", 260, 52),
  plot("Lekki", "Lekki", "lagos", 280, 56),
];

export const LEKKI = 31;

/** Rent multiplier on a plot's base rent once its owner holds the whole city, by number of flats. */
export const CITY_RENT_MULT = [2, 10, 28, 60];

export type CardEffect =
  | { kind: "collect"; amount: number }
  | { kind: "pay"; amount: number }
  | { kind: "move"; to: number }
  | { kind: "back"; steps: number }
  | { kind: "each"; amount: number } // positive: everyone pays you; negative: you pay everyone
  | { kind: "holdup" }
  | { kind: "perFlat"; amount: number };
export type Card = { text: string; effect: CardEffect };

export const MARKET_CARDS: Card[] = [
  { text: "NEPA brought light all week: collect N$50k", effect: { kind: "collect", amount: 50 } },
  { text: "Tyre burst on Third Mainland Bridge: pay N$30k", effect: { kind: "pay", amount: 30 } },
  { text: "Your skit went viral: collect N$100k", effect: { kind: "collect", amount: 100 } },
  { text: "Owambe this weekend, aso ebi money: pay N$40k", effect: { kind: "pay", amount: 40 } },
  { text: "An old customer finally paid you: collect N$60k", effect: { kind: "collect", amount: 60 } },
  { text: "Generator needs servicing: pay N$25k", effect: { kind: "pay", amount: 25 } },
  { text: "Hop on a danfo back to Start: collect your salary", effect: { kind: "move", to: 0 } },
  { text: "Plumber fixed every tap: pay N$10k per flat", effect: { kind: "perFlat", amount: 10 } },
  { text: "Bulk buy at Alaba for your tenants: pay N$40k", effect: { kind: "pay", amount: 40 } },
];

export const FORTUNE_CARDS: Card[] = [
  { text: "It's your birthday: everyone sends you N$20k", effect: { kind: "each", amount: 20 } },
  { text: "Group chat contribution: pay each player N$15k", effect: { kind: "each", amount: -15 } },
  { text: "Landlord of the year award: collect N$80k", effect: { kind: "collect", amount: 80 } },
  { text: "Heavy rain flooded the road: go back 3 squares", effect: { kind: "back", steps: 3 } },
  { text: "Gridlock on the expressway: go to Traffic Hold-up", effect: { kind: "holdup" } },
  { text: "A friend gives you a lift to Lekki", effect: { kind: "move", to: LEKKI } },
  { text: "Bank alert! A client paid you N$70k", effect: { kind: "collect", amount: 70 } },
  { text: "Paint your flats for the festive season: pay N$20k per flat", effect: { kind: "perFlat", amount: 20 } },
  { text: "You won the jollof cook-off: collect N$40k", effect: { kind: "collect", amount: 40 } },
  { text: "Your Ariaria shoe order came through: collect N$80k", effect: { kind: "collect", amount: 80 } },
];

export type Player = { name: string; colour: string; human: boolean; cash: number; pos: number; out: boolean; held: boolean };

export type Phase = "roll" | "buy" | "over";

export type State = {
  players: Player[];
  owner: (number | null)[]; // per square
  flats: number[]; // per square
  turn: number;
  phase: Phase;
  dice: [number, number] | null;
  doubles: number; // doubles rolled this turn
  again: boolean; // the last roll was a double, so roll again after this square
  round: number;
  winner: number | null;
  endReason: "last" | "cap" | null;
  lastCard: string | null;
  log: string[];
};

export type Action = { type: "roll" } | { type: "buy" } | { type: "skip" } | { type: "build"; square: number };

const NAMES = ["You", "Chidi", "Amaka", "Tunde"];
export const PLAYER_COLOURS = ["#ff816d", "#4f8fd6", "#f2c14e", "#9b6fd1"];
const LOG_LIMIT = 40;

export function createGame(_rng: Rng = Math.random, playerCount = 4): State {
  const n = Math.max(2, Math.min(4, playerCount));
  return {
    players: Array.from({ length: n }, (_, i) => ({ name: NAMES[i], colour: PLAYER_COLOURS[i], human: i === 0, cash: START_CASH, pos: 0, out: false, held: false })),
    owner: BOARD.map(() => null),
    flats: BOARD.map(() => 0),
    turn: 0,
    phase: "roll",
    dice: null,
    doubles: 0,
    again: false,
    round: 1,
    winner: null,
    endReason: null,
    lastCard: null,
    log: ["New game. Everyone starts with N$1,500k."],
  };
}

export function formatNaira(k: number): string {
  return `N$${k.toLocaleString("en-GB")}k`;
}

function clone(s: State): State {
  return { ...s, players: s.players.map((p) => ({ ...p })), owner: [...s.owner], flats: [...s.flats], log: [...s.log] };
}

// The human player is "You", so their log lines need the plain verb.
function verb(p: Player, third: string, plain: string): string {
  return p.human ? plain : third;
}

function say(s: State, line: string) {
  s.log.push(line);
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export function citySquares(city: CityId): number[] {
  return BOARD.flatMap((sq, i) => (sq.city === city ? [i] : []));
}

export function ownsCity(s: State, player: number, city: CityId): boolean {
  return citySquares(city).every((i) => s.owner[i] === player);
}

export function rentFor(s: State, square: number): number {
  const sq = BOARD[square];
  const owner = s.owner[square];
  if (owner === null) return 0;
  if (sq.kind === "park") {
    const parks = BOARD.filter((b, i) => b.kind === "park" && s.owner[i] === owner).length;
    return (sq.rent ?? 0) * parks;
  }
  if (sq.kind !== "plot" || !sq.city) return 0;
  const base = sq.rent ?? 0;
  return ownsCity(s, owner, sq.city) ? base * CITY_RENT_MULT[s.flats[square]] : base;
}

export function flatCount(s: State, player: number): number {
  return s.flats.reduce((n, f, i) => n + (s.owner[i] === player ? f : 0), 0);
}

export function netWorth(s: State, player: number): number {
  const p = s.players[player];
  if (p.out) return 0;
  let worth = p.cash;
  BOARD.forEach((sq, i) => {
    if (s.owner[i] !== player) return;
    worth += sq.price ?? 0;
    if (sq.city) worth += s.flats[i] * CITIES[sq.city].flatCost;
  });
  return worth;
}

export function canBuild(s: State, player: number, square: number): boolean {
  if (s.phase === "over" || player !== s.turn) return false;
  const sq = BOARD[square];
  if (sq.kind !== "plot" || !sq.city || s.owner[square] !== player) return false;
  if (!ownsCity(s, player, sq.city)) return false;
  const flats = s.flats[square];
  if (flats >= MAX_FLATS) return false;
  // Build evenly: a plot can't get ahead of the others in its city.
  const lowest = Math.min(...citySquares(sq.city).map((i) => s.flats[i]));
  if (flats > lowest) return false;
  return s.players[player].cash >= CITIES[sq.city].flatCost;
}

export function buildable(s: State, player = s.turn): number[] {
  return BOARD.flatMap((_, i) => (canBuild(s, player, i) ? [i] : []));
}

export function canBuy(s: State): boolean {
  if (s.phase !== "buy") return false;
  const p = s.players[s.turn];
  const sq = BOARD[p.pos];
  return s.owner[p.pos] === null && (sq.price ?? Infinity) <= p.cash;
}

export function legalActions(s: State): Action[] {
  if (s.phase === "over") return [];
  const builds: Action[] = buildable(s).map((square) => ({ type: "build", square }));
  if (s.phase === "roll") return [{ type: "roll" }, ...builds];
  return [...(canBuy(s) ? [{ type: "buy" } as Action] : []), { type: "skip" }, ...builds];
}

function isLegal(s: State, a: Action): boolean {
  return legalActions(s).some((l) => l.type === a.type && (l.type !== "build" || (a.type === "build" && l.square === a.square)));
}

export function applyAction(state: State, action: Action, rng: Rng = Math.random): State {
  if (!isLegal(state, action)) throw new Error(`Illegal move: ${action.type}`);
  const s = clone(state);
  s.lastCard = null;
  const p = s.players[s.turn];
  switch (action.type) {
    case "roll":
      doRoll(s, rng);
      break;
    case "buy": {
      const sq = BOARD[p.pos];
      p.cash -= sq.price ?? 0;
      s.owner[p.pos] = s.turn;
      say(s, `${p.name} bought ${sq.name} for ${formatNaira(sq.price ?? 0)}.`);
      finishMove(s);
      break;
    }
    case "skip":
      say(s, `${p.name} passed on ${BOARD[p.pos].name}.`);
      finishMove(s);
      break;
    case "build": {
      const sq = BOARD[action.square];
      const cost = CITIES[sq.city as CityId].flatCost;
      p.cash -= cost;
      s.flats[action.square] += 1;
      say(s, `${p.name} built a flat on ${sq.name} (${formatNaira(cost)}).`);
      break;
    }
  }
  return s;
}

/** Roll two dice from the rng. */
export function rollDice(rng: Rng): [number, number] {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

function doRoll(s: State, rng: Rng) {
  const p = s.players[s.turn];
  const [a, b] = rollDice(rng);
  s.dice = [a, b];
  const double = a === b;
  if (double) s.doubles += 1;
  if (s.doubles === 3) {
    say(s, `${p.name} rolled a third double and got stuck in Traffic Hold-up.`);
    sendToHoldup(s, s.turn);
    endTurn(s);
    return;
  }
  s.again = double;
  say(s, `${p.name} rolled ${a} and ${b}${double ? ", a double" : ""}.`);
  moveForward(s, s.turn, a + b);
  land(s, rng);
  if (s.phase !== "buy") finishMove(s);
}

function moveForward(s: State, who: number, steps: number) {
  const p = s.players[who];
  const next = (p.pos + steps) % BOARD_SIZE;
  if (next < p.pos || next === 0) {
    p.cash += SALARY;
    say(s, `${p.name} passed Start: salary ${formatNaira(SALARY)}.`);
  }
  p.pos = next;
}

function sendToHoldup(s: State, who: number) {
  const p = s.players[who];
  p.pos = HOLDUP;
  p.held = true;
  s.again = false;
}

function land(s: State, rng: Rng) {
  const who = s.turn;
  const p = s.players[who];
  const sq = BOARD[p.pos];
  switch (sq.kind) {
    case "plot":
    case "park": {
      const owner = s.owner[p.pos];
      if (owner === null) {
        if ((sq.price ?? 0) <= p.cash) s.phase = "buy";
        else say(s, `${p.name} can't afford ${sq.name}.`);
      } else if (owner !== who) {
        const rent = rentFor(s, p.pos);
        say(s, `${p.name} ${verb(p, "pays", "pay")} ${s.players[owner].human ? "you" : s.players[owner].name} ${formatNaira(rent)} rent for ${sq.name}.`);
        pay(s, who, rent, owner);
      }
      break;
    }
    case "tax": {
      const tax = Math.round(p.cash / 10);
      say(s, `${p.name} ${verb(p, "pays", "pay")} ${formatNaira(tax)} at the Tax office.`);
      if (tax > 0) pay(s, who, tax, null);
      break;
    }
    case "holdup":
      p.held = true;
      s.again = false;
      say(s, `${p.name} ${verb(p, "is", "are")} stuck in traffic and will miss a turn.`);
      break;
    case "market":
    case "fortune": {
      const deck = sq.kind === "market" ? MARKET_CARDS : FORTUNE_CARDS;
      const card = deck[Math.floor(rng() * deck.length)];
      s.lastCard = card.text;
      say(s, `${sq.name}: ${card.text}.`);
      applyCard(s, card.effect, rng);
      break;
    }
    default:
      break;
  }
}

function applyCard(s: State, e: CardEffect, rng: Rng) {
  const who = s.turn;
  const p = s.players[who];
  switch (e.kind) {
    case "collect":
      p.cash += e.amount;
      break;
    case "pay":
      pay(s, who, e.amount, null);
      break;
    case "perFlat": {
      const total = flatCount(s, who) * e.amount;
      if (total > 0) pay(s, who, total, null);
      break;
    }
    case "each":
      s.players.forEach((other, i) => {
        if (i === who || other.out || p.out) return;
        if (e.amount > 0) pay(s, i, e.amount, who);
        else pay(s, who, -e.amount, i);
      });
      break;
    case "holdup":
      sendToHoldup(s, who);
      break;
    case "move":
      moveForward(s, who, (e.to - p.pos + BOARD_SIZE) % BOARD_SIZE);
      land(s, rng);
      break;
    case "back":
      p.pos = (p.pos - e.steps + BOARD_SIZE) % BOARD_SIZE;
      land(s, rng);
      break;
  }
}

/** Pay money, selling flats then plots back to the bank at half price if short. Goes bankrupt if still short. */
function pay(s: State, who: number, amount: number, creditor: number | null) {
  const p = s.players[who];
  if (p.out) return;
  raiseCash(s, who, amount);
  if (p.cash >= amount) {
    p.cash -= amount;
    if (creditor !== null) s.players[creditor].cash += amount;
    return;
  }
  if (creditor !== null) s.players[creditor].cash += p.cash;
  bankrupt(s, who);
}

function raiseCash(s: State, who: number, amount: number) {
  const p = s.players[who];
  let flatsSold = 0;
  let plotsSold = 0;
  while (p.cash < amount) {
    // Sell from the plot with the most flats so the city stays even.
    let best = -1;
    BOARD.forEach((_, i) => {
      if (s.owner[i] === who && s.flats[i] > 0 && (best < 0 || s.flats[i] > s.flats[best])) best = i;
    });
    if (best >= 0) {
      s.flats[best] -= 1;
      p.cash += CITIES[BOARD[best].city as CityId].flatCost / 2;
      flatsSold += 1;
      continue;
    }
    // Then the cheapest plot.
    let cheapest = -1;
    BOARD.forEach((sq, i) => {
      if (s.owner[i] === who && (cheapest < 0 || (sq.price ?? 0) < (BOARD[cheapest].price ?? 0))) cheapest = i;
    });
    if (cheapest < 0) break;
    s.owner[cheapest] = null;
    p.cash += (BOARD[cheapest].price ?? 0) / 2;
    plotsSold += 1;
  }
  if (flatsSold || plotsSold) {
    const parts = [flatsSold ? `${flatsSold} flat${flatsSold > 1 ? "s" : ""}` : "", plotsSold ? `${plotsSold} plot${plotsSold > 1 ? "s" : ""}` : ""].filter(Boolean);
    say(s, `${p.name} sold ${parts.join(" and ")} back to the bank.`);
  }
}

function bankrupt(s: State, who: number) {
  const p = s.players[who];
  p.out = true;
  p.cash = 0;
  p.held = false;
  BOARD.forEach((_, i) => {
    if (s.owner[i] === who) {
      s.owner[i] = null;
      s.flats[i] = 0;
    }
  });
  say(s, `${p.name} ran out of money and ${verb(p, "is", "are")} out.`);
  const alive = s.players.flatMap((x, i) => (x.out ? [] : [i]));
  if (alive.length === 1) {
    s.phase = "over";
    s.winner = alive[0];
    s.endReason = "last";
    say(s, `${s.players[alive[0]].name} ${verb(s.players[alive[0]], "is", "are")} the last landlord standing.`);
  }
}

function finishMove(s: State) {
  if (s.phase === "over") return;
  const p = s.players[s.turn];
  if (!p.out && !p.held && s.again) {
    s.phase = "roll";
    say(s, `${p.name} ${verb(p, "rolls", "roll")} again.`);
  } else endTurn(s);
}

function endTurn(s: State) {
  if (s.phase === "over") return;
  s.again = false;
  s.doubles = 0;
  let next = s.turn;
  for (;;) {
    next = (next + 1) % s.players.length;
    if (next === 0) {
      s.round += 1;
      if (s.round > ROUND_CAP) {
        finishByWorth(s);
        return;
      }
    }
    const p = s.players[next];
    if (p.out) continue;
    if (p.held) {
      p.held = false;
      say(s, `${p.name} ${verb(p, "sits", "sit")} in traffic and ${verb(p, "misses", "miss")} this turn.`);
      continue;
    }
    break;
  }
  s.turn = next;
  s.phase = "roll";
}

function finishByWorth(s: State) {
  let best = -1;
  s.players.forEach((p, i) => {
    if (!p.out && (best < 0 || netWorth(s, i) > netWorth(s, best))) best = i;
  });
  s.round = ROUND_CAP;
  s.phase = "over";
  s.winner = best;
  s.endReason = "cap";
  say(s, `${ROUND_CAP} rounds played. ${s.players[best].name} ${verb(s.players[best], "is", "are")} the richest landlord.`);
}

// ---- Computer player ----

/** How much cash the computer keeps back before buying, by how useful the plot is. */
function buyCushion(s: State, who: number, square: number): number {
  const sq = BOARD[square];
  if (sq.kind === "park") return 150;
  const city = sq.city as CityId;
  const others = citySquares(city).filter((i) => i !== square);
  if (others.every((i) => s.owner[i] === who)) return 60; // finishes a city
  if (others.some((i) => s.owner[i] !== null && s.owner[i] !== who)) return 250; // someone else is in this city
  if (others.some((i) => s.owner[i] === who)) return 80;
  return 100;
}

export function aiAction(s: State): Action {
  const who = s.turn;
  const p = s.players[who];
  if (s.phase === "buy") {
    const square = p.pos;
    if (canBuy(s) && p.cash - (BOARD[square].price ?? 0) >= buyCushion(s, who, square)) return { type: "buy" };
    return { type: "skip" };
  }
  // Build on the most valuable city first, keeping a cushion for rent.
  const builds = buildable(s, who).filter((i) => p.cash - CITIES[BOARD[i].city as CityId].flatCost >= 150);
  if (builds.length) {
    builds.sort((a, b) => (BOARD[b].rent ?? 0) - (BOARD[a].rent ?? 0));
    return { type: "build", square: builds[0] };
  }
  return { type: "roll" };
}

// ---- Board drawing helper ----

/** Grid cell (1-based row, col) of a square on the 9×9 ring (8 per side), clockwise from the top-left corner. */
export function squareCell(i: number): { row: number; col: number } {
  if (i <= 8) return { row: 1, col: i + 1 };
  if (i <= 16) return { row: i - 7, col: 9 };
  if (i <= 24) return { row: 9, col: 9 - (i - 16) };
  return { row: 9 - (i - 24), col: 1 };
}
