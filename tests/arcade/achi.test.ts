// Achi (lib/arcade/achi.ts) on the eight-line board: the lines and who connects to whom, wins on any line,
// placing then moving, the no-move loss, the draws, and the computer at every level.
// Run: npx -y tsx tests/arcade/achi.test.ts
import assert from "node:assert/strict";
import {
  ADJACENT, LINES, MOVE_CAP, applyMove, boardKey, cannotMove, chooseMove, initialState, isLegal, legalMoves, lineOf, phaseOf, seededRng,
  solvedValue, targetsFrom, type AchiState, type Cell, type Level, type Move, type Player,
} from "../../lib/arcade/achi";

let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };
// "x" = you (0), "o" = computer (1), "." = empty; rows top to bottom.
const B = (rows: string): Cell[] => rows.replace(/\s/g, "").split("").map((c) => (c === "x" ? 0 : c === "o" ? 1 : null));
const at = (rows: string, turn: Player = 0, over: Partial<AchiState> = {}): AchiState => ({ ...initialState(turn), board: B(rows), seen: {}, ...over });
const place = (to: number): Move => ({ kind: "place", to });
const slide = (from: number, to: number): Move => ({ kind: "move", from, to });

// --- The board ---
ok("eight lines: four edges, the middle row and column, and two diagonals", () => {
  const norm = LINES.map((l) => [...l].sort((a, b) => a - b).join(",")).sort();
  assert.deepEqual(norm, ["0,1,2", "0,3,6", "0,4,8", "1,4,7", "2,4,6", "2,5,8", "3,4,5", "6,7,8"]);
});
ok("adjacency: centre joins all 8 points, edge-middles 3, corners 3", () => {
  assert.deepEqual(ADJACENT[4], [0, 1, 2, 3, 5, 6, 7, 8]);
  for (const mid of [1, 3, 5, 7]) assert.equal(ADJACENT[mid].length, 3, `edge-middle ${mid}`);
  for (const c of [0, 2, 6, 8]) assert.equal(ADJACENT[c].length, 3, `corner ${c}`);
  assert.deepEqual(ADJACENT[0], [1, 3, 4]);
  assert.deepEqual(ADJACENT[1], [0, 2, 4]);
  assert.deepEqual(ADJACENT[3], [0, 4, 6]);
  assert.deepEqual(ADJACENT[8], [4, 5, 7]);
  // symmetric
  ADJACENT.forEach((ns, i) => ns.forEach((j) => assert.ok(ADJACENT[j].includes(i))));
});

// --- Winning ---
ok("each of the eight lines wins", () => {
  for (const line of LINES) {
    const b: Cell[] = Array(9).fill(null);
    line.forEach((i) => (b[i] = 1));
    assert.deepEqual(lineOf(b, 1), [...line]);
  }
});
ok("the middle row and middle column win (the owner's screenshot: three across the middle)", () => {
  assert.deepEqual(lineOf(B("... xxx ..."), 0), [3, 4, 5]);
  assert.deepEqual(lineOf(B(".x. .x. .x."), 0), [1, 4, 7]);
  assert.equal(lineOf(B("x.. .x. ..o"), 0), null, "not a line");
  assert.equal(lineOf(B("xx. ..x ..."), 0), null, "not a line");
});
ok("placing a third piece in the centre row wins", () => {
  const s = applyMove(at("o.o xx. o..", 0), place(5));
  assert.equal(s.winner, 0);
  assert.deepEqual(s.winLine, [3, 4, 5]);
});
ok("sliding into the middle row wins", () => {
  // The screenshot: o at 0, 2, 7; x at 3, 5 and one more slides into the centre.
  const s = applyMove(at("o.o x.x xo.", 0), slide(6, 4));
  assert.equal(s.winner, 0);
  assert.deepEqual(s.winLine, [3, 4, 5]);
});
ok("a line made while placing wins at once", () => {
  const s = applyMove(at("xx. oo. ...", 0), place(2));
  assert.equal(s.winner, 0);
  assert.equal(s.endReason, "line");
  assert.deepEqual(s.winLine, [0, 1, 2]);
  assert.deepEqual(legalMoves(s), []);
});
ok("a line made by sliding wins (diagonal)", () => {
  // x at 0,4,5 slides 5 → 8 to fill 0-4-8.
  const s = applyMove(at("xo. .xx oo.", 0), slide(5, 8));
  assert.equal(s.winner, 0);
  assert.equal(s.endReason, "line");
  assert.deepEqual(s.winLine, [0, 4, 8]);
});

// --- Placing then moving ---
ok("starts empty in the placing phase; any empty point can be taken", () => {
  const s = initialState(1);
  assert.equal(s.turn, 1);
  assert.equal(s.startedBy, 1);
  assert.equal(phaseOf(s.board, 1), "placing");
  assert.equal(legalMoves(s).length, 9);
  assert.ok(legalMoves(s).every((m) => m.kind === "place"));
});
ok("after six placements both players move, only along lines to an empty neighbour", () => {
  let s = initialState(0);
  for (const p of [4, 1, 3, 5, 8, 6]) s = applyMove(s, place(p)); // x: 4,3,8  o: 1,5,6
  assert.equal(s.winner, null);
  assert.equal(phaseOf(s.board, 0), "moving");
  assert.equal(phaseOf(s.board, 1), "moving");
  assert.equal(s.turn, 0);
  assert.ok(legalMoves(s).every((m) => m.kind === "move"));
  assert.ok(!isLegal(s, place(0)), "no more placing");
  // x at 4 can go to any empty point (0, 2, 7); x at 3 to 0 (4 and 6 taken); x at 8 to 7 (4 and 5 taken).
  assert.deepEqual(targetsFrom(s, 4), [0, 2, 7]);
  assert.deepEqual(targetsFrom(s, 3), [0]);
  assert.deepEqual(targetsFrom(s, 8), [7]);
  assert.ok(!isLegal(s, slide(3, 2)), "not two steps");
  assert.ok(!isLegal(s, slide(1, 0)), "not the other player's piece");
});
ok("the placing → moving switch happens per player (the second player still places when the first must move)", () => {
  let s = initialState(0);
  for (const p of [0, 1, 2, 3, 6]) s = applyMove(s, place(p)); // x 0,2,6 (no line) o 1,3
  assert.equal(s.turn, 1);
  assert.equal(phaseOf(s.board, 1), "placing");
  assert.ok(legalMoves(s).every((m) => m.kind === "place"));
});
ok("applyMove never mutates and rejects illegal moves", () => {
  const s = initialState(0);
  const copy = JSON.stringify(s);
  applyMove(s, place(4));
  assert.equal(JSON.stringify(s), copy);
  assert.throws(() => applyMove(applyMove(s, place(4)), place(4)));
});

// --- No move = loss ---
ok("cannotMove: a player whose three pieces are all hemmed in has no move", () => {
  // x in the top-left pocket (0,1,3); every point it could reach (2,4,6) is taken.
  assert.equal(cannotMove(B("xxo xo. o.."), 0), true);
  assert.equal(cannotMove(B("xxo x.. o.o"), 0), false, "4 is free");
  assert.equal(cannotMove(B("xx. ... ..."), 0), false, "still placing");
});
ok("a player can only be hemmed in once a line is already filled", () => {
  // Every full position (3 v 3) where a player is stuck already has a line on it (theirs or the other side's), so a line win comes first.
  let stuck = 0;
  const walk = (i: number, b: Cell[], x: number, o: number) => {
    if (i === 9) {
      if (x === 3 && o === 3) for (const p of [0, 1] as Player[]) if (cannotMove(b, p)) { stuck++; assert.ok(lineOf(b, p) || lineOf(b, p === 0 ? 1 : 0)); }
      return;
    }
    walk(i + 1, [...b, null], x, o);
    if (x < 3) walk(i + 1, [...b, 0], x + 1, o);
    if (o < 3) walk(i + 1, [...b, 1], x, o + 1);
  };
  walk(0, [], 0, 0);
  assert.ok(stuck > 0);
});

// --- Draws ---
ok("the same position a third time is a draw", () => {
  // x: 0,6,8  o: 2,4,7 — no line for either. x shuffles 0↔1 and o 2↔5.
  let s: AchiState = { ...initialState(0), board: B("x.o .o. xox") };
  s = { ...s, seen: { [boardKey(s.board) + "0"]: 1 } };
  assert.equal(lineOf(s.board, 0), null);
  assert.equal(lineOf(s.board, 1), null);
  const loop = [slide(0, 1), slide(2, 5), slide(1, 0), slide(5, 2)];
  for (let round = 0; round < 2; round++) for (const m of loop) { assert.equal(s.winner, null); s = applyMove(s, m); }
  assert.equal(s.winner, "draw");
  assert.equal(s.endReason, "repetition");
});
ok(`${MOVE_CAP} turns with no winner is a draw`, () => {
  const s = applyMove(at("x.o .o. xox", 0, { plies: MOVE_CAP - 1 }), slide(0, 1));
  assert.equal(s.winner, "draw");
  assert.equal(s.endReason, "cap");
});

// --- The computer ---
ok("on the eight-line board the first player wins with perfect play", () => {
  assert.equal(solvedValue(initialState(0)).v, "win");
  assert.equal(solvedValue(initialState(1)).v, "win");
});
ok("every level takes a win in one", () => {
  for (const level of ["easy", "medium", "hard"] as Level[]) {
    const m = chooseMove(at("oo. xx. x..", 1), level, seededRng(1));
    assert.deepEqual(m, place(2), level);
  }
});
ok("medium and hard block a line in one while placing", () => {
  for (const level of ["medium", "hard"] as Level[]) {
    const m = chooseMove(at("xx. .o. ...", 1), level, seededRng(2));
    assert.deepEqual(m, place(2), level);
  }
});

const randomMove = (s: AchiState, rng: () => number) => { const ms = legalMoves(s); return ms[Math.floor(rng() * ms.length)]; };
function playGame(first: Player, pick: (s: AchiState) => Move): AchiState {
  let s = initialState(first);
  for (let guard = 0; s.winner === null; guard++) {
    assert.ok(guard <= MOVE_CAP, "game must end by the move cap");
    const m = pick(s);
    assert.ok(isLegal(s, m), "computer only plays legal moves");
    s = applyMove(s, m);
  }
  return s;
}

ok("perfect computer never loses to random play (400 games, both starting)", () => {
  const rng = seededRng(7);
  const tally = { won: 0, drawn: 0 };
  for (let g = 0; g < 400; g++) {
    const end = playGame((g % 2) as Player, (s) => (s.turn === 1 ? chooseMove(s, "hard", rng) : randomMove(s, rng)));
    assert.notEqual(end.winner, 0, `game ${g}: random beat hard`);
    if (end.winner === 1) tally.won++; else tally.drawn++;
  }
  assert.ok(tally.won > 300, `hard should win most games against random (won ${tally.won})`);
  console.log(`      hard vs random: won ${tally.won}, drew ${tally.drawn}, lost 0`);
});
ok("hard never loses when it starts, and beats easy and medium most of the time when they start", () => {
  const rng = seededRng(11);
  for (const lvl of ["easy", "medium"] as Level[]) {
    let lost = 0;
    for (let g = 0; g < 40; g++) {
      const first = (g % 2) as Player;
      const end = playGame(first, (s) => chooseMove(s, s.turn === 1 ? "hard" : lvl, rng));
      if (first === 1) assert.equal(end.winner, 1, `${lvl} beat hard when hard started`);
      if (end.winner === 0) lost++;
    }
    assert.ok(lost < 10, `${lvl} beat hard ${lost} times in 20 starts`);
  }
});
ok("hard vs hard: whoever starts wins", () => {
  const rng = seededRng(3);
  for (let g = 0; g < 20; g++) assert.equal(playGame((g % 2) as Player, (s) => chooseMove(s, "hard", rng)).winner, g % 2);
});
ok("full games finish at every pairing, legally", () => {
  const rng = seededRng(5);
  const levels: Level[] = ["easy", "medium", "hard"];
  const ends: Record<string, number> = {};
  for (const a of levels) for (const b of levels) for (let g = 0; g < 6; g++) {
    const end = playGame((g % 2) as Player, (s) => chooseMove(s, s.turn === 0 ? a : b, rng));
    const k = end.endReason!;
    ends[k] = (ends[k] ?? 0) + 1;
  }
  console.log(`      endings: ${JSON.stringify(ends)}`);
});
ok("medium beats easy more often than not", () => {
  const rng = seededRng(9);
  let med = 0, easy = 0;
  for (let g = 0; g < 100; g++) {
    const w = playGame((g % 2) as Player, (s) => chooseMove(s, s.turn === 1 ? "medium" : "easy", rng)).winner;
    if (w === 1) med++; else if (w === 0) easy++;
  }
  assert.ok(med > easy, `medium ${med} vs easy ${easy}`);
});

console.log(`\nachi: ${checks} checks passed`);
