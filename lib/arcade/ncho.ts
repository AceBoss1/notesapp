// Ncho (Okwe): the Igbo seed-sowing game, played to the rules the owner confirmed on 21 Nov 2026. Pure logic, no React
// or DOM, so tests and the UI share one set of rules.
//
// The board: two rows of holes ("houses"), one row per player, and a store for each player's captured seeds.
//   Ncho is played on 6 holes a side, 12 holes in all (the owner, 21 Nov 2026: "there's no 12 hole ncho").
//   Four seeds in every hole at the start: 48 seeds, and that total never changes.
// Indexes: holes 0..n-1 are the bottom row (you, left to right); holes n..2n-1 are the top row (the computer, right to
// left). Going up the indexes is anticlockwise round the board as drawn.
//
// The rules:
//   1. Each player owns the holes on their own row at the start, 4 seeds in each, and has a store.
//   2. A turn: pick up ALL the seeds from a non-empty hole you OWN (your own row's holes you still own, plus any of the
//      opponent's holes you conquered in earlier rounds) and sow them one by one into the following holes,
//      anticlockwise for Ncho, clockwise for Aka-Hausa (otherwise exactly the same game), round and round, never
//      skipping a hole (not even the one you lifted from) and never into a store.
//   3. Relay sowing: where the LAST seed lands decides what happens next:
//        - the hole was empty (now holds 1): the turn ends;
//        - the hole now holds EXACTLY 4: the mover takes those 4 into their store, whoever owns the hole and whichever
//          side it is on, and the turn ends;
//        - otherwise: lift ALL the seeds from that hole and keep sowing from there, on either side. Repeat.
//   4. Fours made on the way (owner's update, 21 Nov 2026): any hole that becomes exactly 4 while seeds are being
//      sown, by either player and at any point in a sowing (relays included), goes INSTANTLY to that hole's current
//      OWNER (whoever owns it this round, which may be the opponent or a conqueror) into their store, and the hole is
//      emptied. The exception is the last seed of a hand: when it makes 4, the MOVER takes them (rule 3). A later seed
//      landing in a hole emptied this way finds it empty, so a hand ending there ends the turn. There is no chain.
//   5. A ROUND ends when the player to move has no seeds in any hole they own. Each player then takes the seeds still
//      in the holes they own into their store, and refills the holes they own with 4 each from their store, in board
//      order. A hole its owner can't fill is CONQUERED: it passes to the other player, who fills it. See `endRound`.
//      The loser of the round (fewer houses after the refill; a tie goes to the player who didn't start the round)
//      starts the next one.
//   6. The GAME ends when one player owns every hole, or after the number of rounds the player chose (3, 5, 7, or
//      "all": until one side has every house). Most houses wins; equal is a tie.
//
// Safety caps (not part of the owner's rules; they only stop a game that would otherwise never end):
//   - MAX_SOWINGS per turn: relays can in principle chase each other round for ever, so after 300 laps of sowing (the
//     first sowing plus 299 relays) the turn simply ends where the last seed fell.
//   - moveCap per round (400 moves on 6 holes, 800 on 12): the round ends as if the player to move couldn't play.
//   - MAX_ROUNDS for "all": the game stops after 50 rounds and is decided on houses as they stand.

export type Player = 0 | 1;
export type Level = "easy" | "medium" | "hard";
export type NchoVariant = "ncho" | "akahausa";
export type HolesPerSide = 6;
export type RoundsTarget = 3 | 5 | 7 | "all";

export type NchoOptions = {
  holesPerSide?: HolesPerSide; // always 6
  rounds?: RoundsTarget; // how many rounds the game lasts; "all" = until one side has every house (default 3)
};

// A 4 taken during a move: `step` is its index in the move's `path` (the seed that made it), `to` who took it, and
// `last` is true for the mover's 4 made by the last seed of the hand.
export type Capture = { hole: number; to: Player; step: number; last: boolean };

// One lap of sowing: lifted `seeds` from `from` and dropped one into each hole of `path`.
export type Sowing = { from: number; seeds: number; path: number[] };

export type NchoMove = {
  player: Player;
  hole: number; // the hole the player chose
  sowings: Sowing[]; // the first sowing, then each relay in order
  path: number[]; // every hole a seed dropped into, relays included, in order (for the animation)
  relays: number; // how many times the seeds were lifted again (sowings.length - 1)
  lastHole: number; // where the very last seed landed
  made: number; // seeds in that hole when the last seed landed
  end: "empty" | "four" | "cap"; // why the turn ended
  captures: Capture[]; // every 4 taken during the move, in order (fours on the way, then the mover's final 4)
  captured: number[]; // the holes those 4s were taken from, in order
  amount: number; // seeds the MOVER took with the last seed (0 or 4)
  gains: [number, number]; // seeds each player's store gained during the move (fours on the way included)
};

// What happened at the end of a round, kept on the state so the UI can show it.
export type RoundResult = {
  counted: [number, number]; // seeds each player took from the holes they owned
  totals: [number, number]; // each store after counting
  houses: [number, number]; // holes each player owns after the refill
  conquered: { hole: number; from: Player; to: Player }[]; // holes that changed hands
  leftover: { hole: number; to: Player; seeds: number } | null; // the one hole filled with the combined leftovers
  pits: number[]; // the refilled board (4 in every hole)
  owner: Player[];
  stores: [number, number]; // what's left in each store (always 0 and 0: every seed goes back on the board)
  nextStarter: Player; // the loser of the round starts the next one
};

export type RoundSummary = RoundResult & {
  round: number;
  reason: "no-seeds" | "move-cap";
  finalPits: number[]; // the board as the round ended, before counting
  finalOwner: Player[];
  finalStores: [number, number];
};

export type NchoState = {
  pits: number[]; // 2 × holesPerSide holes
  owner: Player[]; // who owns each hole this round
  stores: [number, number]; // seeds captured this round
  turn: Player;
  round: number; // 1-based
  roundsTarget: number | "all";
  roundStarter: Player; // who moved first this round (for the tie-breaks)
  roundMoves: number; // moves played this round (for the move cap)
  lastRound: RoundSummary | null; // set when the last move ended a round
  over: boolean;
  winner: Player | "draw" | null;
  endReason: "all-houses" | "rounds" | "round-cap" | null;
  last: NchoMove | null;
  plies: number;
  variant: NchoVariant; // "ncho" sows anticlockwise, "akahausa" clockwise
  holesPerSide: HolesPerSide;
};

export const START_SEEDS = 4;
export const CAPTURE_AT = 4;
// Relay cap: at most this many laps of sowing in one turn; when it's hit the turn simply ends.
export const MAX_SOWINGS = 300;
// Move cap per round: when it's hit the round ends as if the player to move couldn't play.
export const moveCap = (_holesPerSide: number) => 400;
// Round cap for "until one side has every house": the game is decided on houses after this many rounds.
export const MAX_ROUNDS = 50;
export const ROUND_OPTIONS: RoundsTarget[] = [3, 5, 7, "all"];

// Board helpers, all derived from the board size.
export const holeCount = (holesPerSide: number) => holesPerSide * 2;
export const totalSeeds = (holesPerSide: number) => holeCount(holesPerSide) * START_SEEDS;
// Which row a hole sits on (row 0 = bottom, yours; row 1 = top, the computer's). Not the same as who owns it.
export const sideOfHole = (hole: number, holesPerSide: number): Player => (hole < holesPerSide ? 0 : 1);
export const startingOwner = (holesPerSide: number): Player[] =>
  Array.from({ length: holeCount(holesPerSide) }, (_, h) => sideOfHole(h, holesPerSide));
// The holes a player owns, in board order: from the first hole of their own row, round anticlockwise (up the indexes).
export const ownedHoles = (owner: Player[], p: Player): number[] => {
  const n = owner.length;
  const start = p === 0 ? 0 : n / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) { const h = (start + i) % n; if (owner[h] === p) out.push(h); }
  return out;
};
export const housesOf = (owner: Player[], p: Player) => owner.reduce<number>((a, o) => a + (o === p ? 1 : 0), 0);
export const seedsOwned = (pits: number[], owner: Player[], p: Player) => {
  let s = 0;
  for (let h = 0; h < pits.length; h++) if (owner[h] === p) s += pits[h];
  return s;
};
export const holesOf = (state: Pick<NchoState, "owner">, p: Player) => ownedHoles(state.owner, p);

export const other = (p: Player): Player => (p === 0 ? 1 : 0);
// +1 for each hole sown: up the indexes for Ncho (anticlockwise), down them for Aka-Hausa (clockwise).
export const directionOf = (variant: NchoVariant): 1 | -1 => (variant === "akahausa" ? -1 : 1);

// The rng is accepted so every arcade game shares one signature; Ncho's start is fixed.
export function initialState(_rng?: () => number, first: Player = 0, variant: NchoVariant = "ncho", options: NchoOptions = {}): NchoState {
  const holesPerSide: HolesPerSide = 6;
  const r = options.rounds;
  const roundsTarget: number | "all" = r === "all" ? "all" : r === 5 || r === 7 ? r : 3;
  return {
    pits: Array(holeCount(holesPerSide)).fill(START_SEEDS),
    owner: startingOwner(holesPerSide),
    stores: [0, 0],
    turn: first,
    round: 1,
    roundsTarget,
    roundStarter: first,
    roundMoves: 0,
    lastRound: null,
    over: false,
    winner: null,
    endReason: null,
    last: null,
    plies: 0,
    variant,
    holesPerSide,
  };
}

// Relay sowing from `hole`, without legality checks. `owner` decides who gets a 4 made on the way. Returns a new pits
// array and the move record.
export function sow(
  pits: number[],
  owner: Player[],
  player: Player,
  hole: number,
  variant: NchoVariant = "ncho",
  cap = MAX_SOWINGS,
): { pits: number[]; move: NchoMove } {
  const n = pits.length;
  const dir = directionOf(variant);
  const next = pits.slice();
  const sowings: Sowing[] = [];
  const path: number[] = [];
  const captures: Capture[] = [];
  const gains: [number, number] = [0, 0];
  let from = hole;
  let end: NchoMove["end"] = "cap";
  let pos = hole;
  let made = 0;
  let amount = 0;
  while (sowings.length < cap) {
    let seeds = next[from];
    next[from] = 0;
    const lap: Sowing = { from, seeds, path: [] };
    sowings.push(lap);
    pos = from;
    while (seeds > 0) {
      pos = (pos + dir + n) % n; // every hole in turn, the one just lifted from included
      next[pos] += 1;
      lap.path.push(pos);
      path.push(pos);
      seeds -= 1;
      // A 4 made on the way (not by the hand's last seed) goes straight to the hole's owner.
      if (seeds > 0 && next[pos] === CAPTURE_AT) {
        const to = owner[pos];
        gains[to] += CAPTURE_AT;
        next[pos] = 0;
        captures.push({ hole: pos, to, step: path.length - 1, last: false });
      }
    }
    made = next[pos];
    if (made === 1) { end = "empty"; break; }
    if (made === CAPTURE_AT) {
      end = "four";
      amount = CAPTURE_AT;
      gains[player] += CAPTURE_AT;
      next[pos] = 0;
      captures.push({ hole: pos, to: player, step: path.length - 1, last: true });
      break;
    }
    from = pos; // lift them all and keep going
  }
  return {
    pits: next,
    move: {
      player, hole, sowings, path, relays: sowings.length - 1, lastHole: pos, made, end,
      captures, captured: captures.map((c) => c.hole), amount, gains,
    },
  };
}

export function legalMoves(state: NchoState): number[] {
  if (state.over) return [];
  return holesOf(state, state.turn).filter((h) => state.pits[h] > 0).sort((a, b) => a - b);
}

// The end of a round: count, refill and conquer. Pure; seeds are conserved (the board ends with 4 in every hole).
//   1. Each player takes the seeds in the holes they own into their store.
//   2. Each player refills the holes they own, 4 each from their store, in board order (from the first hole of their
//      own row round anticlockwise, so they keep their home holes before any they conquered earlier).
//   3. A hole its owner can't fill is conquered: it passes to the other player, who fills it from their store.
//   4. Leftovers: the two remainders (each store mod 4) add up to 0 or 4. When they add up to 4, one hole is still
//      empty: it goes to the player with the larger remainder (2-2: the player who did NOT start the round), and they
//      fill it with the 4 combined leftover seeds.
//   The next round is started by the player with fewer houses (equal: the player who didn't start this round).
export function endRound(pits: number[], owner: Player[], stores: [number, number], starter: Player): RoundResult {
  const n = pits.length;
  const counted: [number, number] = [0, 0];
  for (let h = 0; h < n; h++) counted[owner[h]] += pits[h];
  const totals: [number, number] = [stores[0] + counted[0], stores[1] + counted[1]];
  const left: [number, number] = [totals[0], totals[1]];
  const newOwner = owner.slice();
  const newPits: number[] = Array(n).fill(0);
  const unfilled: number[] = [];
  // Steps 2-3: each fills their own; what they can't fill passes to the other.
  for (const p of [0, 1] as const) {
    for (const h of ownedHoles(owner, p)) {
      if (left[p] >= START_SEEDS) { newPits[h] = START_SEEDS; left[p] -= START_SEEDS; }
      else unfilled.push(h);
    }
  }
  const stillEmpty: number[] = [];
  for (const h of unfilled) {
    const q = other(owner[h]);
    if (left[q] >= START_SEEDS) { newPits[h] = START_SEEDS; left[q] -= START_SEEDS; newOwner[h] = q; }
    else stillEmpty.push(h);
  }
  // Step 4: the leftovers (conservation means at most one hole is still empty, with exactly 4 seeds left between them).
  let leftover: RoundResult["leftover"] = null;
  if (stillEmpty.length > 0) {
    const h = stillEmpty[0];
    const to: Player = left[0] > left[1] ? 0 : left[1] > left[0] ? 1 : other(starter);
    const seeds = left[0] + left[1];
    newOwner[h] = to;
    newPits[h] = seeds;
    left[0] = 0; left[1] = 0;
    leftover = { hole: h, to, seeds };
    // Defensive: should never happen with a conserved total; any further empty hole stays with its owner, unfilled.
    for (const e of stillEmpty.slice(1)) newOwner[e] = owner[e];
  }
  const conquered = newOwner.flatMap((o, h) => (o !== owner[h] ? [{ hole: h, from: owner[h], to: o }] : []));
  const houses: [number, number] = [housesOf(newOwner, 0), housesOf(newOwner, 1)];
  const nextStarter: Player = houses[0] < houses[1] ? 0 : houses[1] < houses[0] ? 1 : other(starter);
  return { counted, totals, houses, conquered, leftover, pits: newPits, owner: newOwner, stores: [left[0], left[1]], nextStarter };
}

// Close the round on `state` (whose pits/stores are as the round ended) and either start the next round or end the game.
function closeRound(state: NchoState, reason: RoundSummary["reason"]): NchoState {
  const res = endRound(state.pits, state.owner, state.stores, state.roundStarter);
  const summary: RoundSummary = {
    ...res, round: state.round, reason,
    finalPits: state.pits, finalOwner: state.owner, finalStores: state.stores,
  };
  const n = state.pits.length;
  const allHouses = res.houses[0] === n || res.houses[1] === n;
  const target = state.roundsTarget === "all" ? MAX_ROUNDS : state.roundsTarget;
  const base: NchoState = {
    ...state,
    pits: res.pits,
    owner: res.owner,
    stores: res.stores,
    lastRound: summary,
    roundMoves: 0,
  };
  if (allHouses || state.round >= target) {
    const [a, b] = res.houses;
    const endReason: NchoState["endReason"] = allHouses ? "all-houses" : state.roundsTarget === "all" ? "round-cap" : "rounds";
    return { ...base, over: true, winner: a > b ? 0 : b > a ? 1 : "draw", endReason, turn: res.nextStarter };
  }
  return { ...base, round: state.round + 1, turn: res.nextStarter, roundStarter: res.nextStarter };
}

export function applyMove(state: NchoState, hole: number): NchoState {
  if (state.over || state.owner[hole] !== state.turn || !(state.pits[hole] > 0)) throw new Error(`Illegal move ${hole}`);
  const { pits, move } = sow(state.pits, state.owner, state.turn, hole, state.variant);
  const stores: [number, number] = [state.stores[0] + move.gains[0], state.stores[1] + move.gains[1]];
  const next: NchoState = {
    ...state,
    pits,
    stores,
    turn: other(state.turn),
    last: move,
    lastRound: null,
    plies: state.plies + 1,
    roundMoves: state.roundMoves + 1,
  };
  if (seedsOwned(pits, state.owner, next.turn) === 0) return closeRound(next, "no-seeds");
  if (next.roundMoves >= moveCap(state.holesPerSide)) return closeRound(next, "move-cap");
  return next;
}

// --- Computer player: alpha-beta minimax within the round. ---
// Score (from the computer's side): store difference + 4 × the difference in houses each would have if the round ended
// now (floor((store + seeds in owned holes) / 4)). At the end of a round the exact refill is scored instead, and a
// finished game counts as a win or loss.

export const LEVEL_DEPTH: Record<Level, number> = { easy: 2, medium: 4, hard: 6 };
// Aka-Hausa: the computer looks one move further ahead at every level.
export const AKAHAUSA_DEPTH: Record<Level, number> = { easy: 3, medium: 5, hard: 7 };
// Relays make moves long, and the 12-hole board has twice the choices, so the search there is capped to keep a hard
// move well under 300ms (the tests measure it). Aka-Hausa still gets its extra move on top of these.
export const depthFor = (variant: NchoVariant, level: Level, holesPerSide: number = 6) => {
  const base = LEVEL_DEPTH[level];
  return base + (variant === "akahausa" ? 1 : 0);
};

const WIN = 10000;

// A lean copy of sow for the search: mutates `pits` and `stores` in place.
function sowFast(pits: number[], stores: [number, number], owner: Player[], player: Player, hole: number, dir: number): void {
  const n = pits.length;
  let from = hole;
  for (let lap = 0; lap < MAX_SOWINGS; lap++) {
    let seeds = pits[from];
    pits[from] = 0;
    let pos = from;
    while (seeds > 0) {
      pos += dir;
      if (pos === n) pos = 0; else if (pos < 0) pos = n - 1;
      seeds -= 1;
      if (++pits[pos] === CAPTURE_AT && seeds > 0) { pits[pos] = 0; stores[owner[pos]] += CAPTURE_AT; }
    }
    const made = pits[pos];
    if (made === 1) return;
    if (made === CAPTURE_AT) { pits[pos] = 0; stores[player] += CAPTURE_AT; return; }
    from = pos;
  }
}

type Ctx = { dir: number; owner: Player[]; me: Player; starter: Player; round: number; target: number; cap: number; n: number };

function projected(pits: number[], stores: [number, number], c: Ctx): number {
  let mine = stores[c.me];
  let theirs = stores[other(c.me)];
  for (let h = 0; h < c.n; h++) { if (c.owner[h] === c.me) mine += pits[h]; else theirs += pits[h]; }
  return stores[c.me] - stores[other(c.me)] + 4 * (Math.floor(mine / 4) - Math.floor(theirs / 4));
}

function roundEndScore(pits: number[], stores: [number, number], c: Ctx): number {
  const r = endRound(pits, c.owner, stores, c.starter);
  const d = r.houses[c.me] - r.houses[other(c.me)];
  const over = r.houses[0] === c.n || r.houses[1] === c.n || c.round >= c.target;
  if (over && d !== 0) return (d > 0 ? WIN : -WIN) + 4 * d;
  return 4 * d;
}

function search(pits: number[], stores: [number, number], turn: Player, moves: number, depth: number, alpha: number, beta: number, c: Ctx): number {
  let hasMove = false;
  for (let h = 0; h < c.n; h++) if (c.owner[h] === turn && pits[h] > 0) { hasMove = true; break; }
  if (!hasMove || moves >= c.cap) return roundEndScore(pits, stores, c);
  if (depth === 0) return projected(pits, stores, c);
  const maximise = turn === c.me;
  let best = maximise ? -Infinity : Infinity;
  for (let h = 0; h < c.n; h++) {
    if (c.owner[h] !== turn || pits[h] === 0) continue;
    const next = pits.slice();
    const ns: [number, number] = [stores[0], stores[1]];
    sowFast(next, ns, c.owner, turn, h, c.dir);
    const v = search(next, ns, other(turn), moves + 1, depth - 1, alpha, beta, c);
    if (maximise) { if (v > best) best = v; if (best > alpha) alpha = best; }
    else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(state: NchoState, level: Level = "medium", rng: () => number = Math.random): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal move");
  // Easy slips now and then so it's beatable.
  if (level === "easy" && rng() < 0.3) return moves[Math.floor(rng() * moves.length)];
  const me = state.turn;
  const c: Ctx = {
    dir: directionOf(state.variant),
    owner: state.owner,
    me,
    starter: state.roundStarter,
    round: state.round,
    target: state.roundsTarget === "all" ? MAX_ROUNDS : state.roundsTarget,
    cap: moveCap(state.holesPerSide),
    n: state.pits.length,
  };
  const depth = depthFor(state.variant, level, state.holesPerSide);
  let bestScore = -Infinity;
  let best: number[] = [];
  for (const h of moves) {
    const next = state.pits.slice();
    const ns: [number, number] = [state.stores[0], state.stores[1]];
    sowFast(next, ns, c.owner, me, h, c.dir);
    // A window just below the best so far keeps equal moves (for a random pick between them) while still pruning.
    const s = search(next, ns, other(me), state.roundMoves + 1, depth - 1, bestScore - 1, Infinity, c);
    if (s > bestScore) { bestScore = s; best = [h]; }
    else if (s === bestScore) best.push(h);
  }
  return best[Math.floor(rng() * best.length)];
}

// Small seeded RNG for tests and repeatable games.
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
