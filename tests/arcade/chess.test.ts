// Chess rules and computer player (lib/arcade/chess.ts).
// Run: npx -y tsx tests/arcade/chess.test.ts
import assert from "node:assert/strict";
import {
  BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, applyMove, chooseMove, findMove, gameStatus, inCheck, initialState,
  insufficientMaterial, legalMoves, moveToSan, parseFen, perft, positionKey, searchBest, squareFromName as sq, toFen,
  type ChessState, type Level,
} from "../../lib/arcade/chess";

// Seeded RNG so games are repeatable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const play = (s: ChessState, ...moves: string[]) => moves.reduce((st, uci) => {
  const promo = uci[4] ? " pnbrqk".indexOf(uci[4]) : QUEEN;
  const m = findMove(st, sq(uci.slice(0, 2)), sq(uci.slice(2, 4)), promo);
  assert.ok(m, `illegal move ${uci} in ${toFen(st)}`);
  return applyMove(st, m);
}, s);
const sans = (s: ChessState, ...moves: string[]) => {
  const out: string[] = [];
  moves.reduce((st, uci) => {
    const promo = uci[4] ? " pnbrqk".indexOf(uci[4]) : QUEEN;
    const m = findMove(st, sq(uci.slice(0, 2)), sq(uci.slice(2, 4)), promo)!;
    out.push(moveToSan(st, m));
    return applyMove(st, m);
  }, s);
  return out;
};

// FEN round trip and the start position.
const start = initialState();
assert.equal(toFen(start), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
assert.equal(start.board[sq("e1")], KING);
assert.equal(start.board[sq("d8")], QUEEN | BLACK);
const kiwiFen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
assert.equal(toFen(parseFen(kiwiFen)), kiwiFen);
assert.throws(() => parseFen("8/8/8 w - - 0 1"));

// Perft: counts of every legal move sequence, the standard check that move generation is exactly right.
assert.equal(perft(start, 1), 20);
assert.equal(perft(start, 2), 400);
assert.equal(perft(start, 3), 8902);
const kiwi = parseFen(kiwiFen); // "Kiwipete": castling, en passant, promotions and pins all at once
assert.equal(perft(kiwi, 1), 48);
assert.equal(perft(kiwi, 2), 2039);
assert.equal(perft(kiwi, 3), 97862);
assert.equal(perft(parseFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 4), 43238); // en passant that would expose the king
assert.equal(perft(parseFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3), 9467);
assert.equal(perft(parseFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"), 3), 62379);

// applyMove never mutates.
const before = toFen(start);
play(start, "e2e4");
assert.equal(toFen(start), before);

// Fool's mate: black mates on move 2.
const fool = play(start, "f2f3", "e7e5", "g2g4", "d8h4");
assert.deepEqual(gameStatus(fool), { over: true, result: "checkmate", winner: "b", check: true });
assert.deepEqual(sans(start, "f2f3", "e7e5", "g2g4", "d8h4"), ["f3", "e5", "g4", "Qh4#"]);
assert.equal(legalMoves(fool).length, 0);

// Stalemate: black to move, not in check, nowhere to go.
const stale = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
assert.equal(inCheck(stale), false);
assert.deepEqual(gameStatus(stale), { over: true, result: "stalemate", winner: null, check: false });
// Reaching it with a move gets no check sign.
assert.deepEqual(sans(parseFen("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1"), "f1f7"), ["Qf7"]);
assert.equal(gameStatus(play(parseFen("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1"), "f1f7")).result, "stalemate");

// Castling both ways, and the rook goes with the king.
const castleReady = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
const short = play(castleReady, "e1g1");
assert.equal(short.board[sq("g1")], KING);
assert.equal(short.board[sq("f1")], ROOK);
assert.equal(short.board[sq("h1")], 0);
assert.equal(short.castling & 3, 0, "white loses both rights after castling");
const long = play(castleReady, "e1g1", "e8c8");
assert.equal(long.board[sq("c8")], KING | BLACK);
assert.equal(long.board[sq("d8")], ROOK | BLACK);
assert.deepEqual(sans(castleReady, "e1g1", "e8c8"), ["O-O", "O-O-O"]);
// Not through check: a black rook on f8 covers f1, so no short castling; queen side is still fine.
const through = parseFen("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
assert.equal(findMove(through, sq("e1"), sq("g1")), undefined);
assert.ok(findMove(through, sq("e1"), sq("c1")));
// Not out of check.
assert.equal(findMove(parseFen("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), sq("e1"), sq("g1")), undefined);
// Queen side: b1 may be attacked (the king doesn't cross it), but it must be empty.
assert.ok(findMove(parseFen("1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1"), sq("e1"), sq("c1")));
assert.equal(findMove(parseFen("4k3/8/8/8/8/8/8/RN2K3 w Q - 0 1"), sq("e1"), sq("c1")), undefined);
// Moving a rook loses that side's right; capturing a rook on its home square too.
assert.equal(play(castleReady, "h1h2").castling & 1, 0);
assert.equal(play(castleReady, "a1a8").castling & 8, 0);

// En passant: only straight after the double step.
const ep = play(start, "e2e4", "a7a6", "e4e5", "d7d5");
const epMove = findMove(ep, sq("e5"), sq("d6"))!;
assert.ok(epMove && epMove.captured === (PAWN | BLACK));
const afterEp = applyMove(ep, epMove);
assert.equal(afterEp.board[sq("d5")], 0, "the passed pawn is removed");
assert.equal(moveToSan(ep, epMove), "exd6");
assert.equal(findMove(play(ep, "h2h3", "h7h6"), sq("e5"), sq("d6")), undefined, "the chance is gone a move later");

// Promotion: four choices, queen by default, under-promotion allowed.
const promo = parseFen("8/P6k/8/8/8/8/8/K7 w - - 0 1");
assert.equal(legalMoves(promo).filter((m) => m.from === sq("a7")).length, 4);
assert.equal(play(promo, "a7a8").board[sq("a8")], QUEEN);
assert.equal(play(promo, "a7a8n").board[sq("a8")], KNIGHT);
assert.deepEqual(sans(promo, "a7a8"), ["a8=Q"]);
assert.deepEqual(sans(promo, "a7a8r"), ["a8=R"]);

// Pinned piece can't move; SAN disambiguation.
assert.equal(legalMoves(parseFen("4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1")).some((m) => m.from === sq("e2")), false);
assert.deepEqual(sans(parseFen("4k3/8/8/8/8/8/4K3/R6R w - - 0 1"), "a1d1"), ["Rad1"]);
assert.deepEqual(sans(parseFen("4k3/8/8/R7/8/8/8/R3K3 w - - 0 1"), "a1a3"), ["R1a3"]);
assert.deepEqual(sans(parseFen("4k3/8/8/8/8/2N3N1/8/4K1N1 w - - 0 1"), "g1e2"), ["N1e2"]);
assert.deepEqual(sans(parseFen("4k3/8/8/8/8/2N3N1/8/2N1K1N1 w - - 0 1"), "g1e2"), ["Ng1e2"]);
assert.deepEqual(sans(start, "g1f3", "b8c6", "e2e4", "c6d4", "f3d4"), ["Nf3", "Nc6", "e4", "Nd4", "Nxd4"]);

// Insufficient material.
assert.ok(insufficientMaterial(parseFen("8/8/4k3/8/8/3K4/8/8 w - - 0 1").board));
assert.ok(insufficientMaterial(parseFen("8/8/4k3/8/8/3KN3/8/8 w - - 0 1").board));
assert.ok(insufficientMaterial(parseFen("8/8/4kb2/8/8/3KB3/8/8 w - - 0 1").board), "bishops on the same colour");
assert.ok(!insufficientMaterial(parseFen("8/8/4k1b1/8/8/3KB3/8/8 w - - 0 1").board), "bishops on opposite colours can mate");
assert.ok(!insufficientMaterial(parseFen("8/8/4k3/8/8/3KNN2/8/8 w - - 0 1").board));
assert.ok(!insufficientMaterial(parseFen("8/8/4k3/8/8/3K4/4P3/8 w - - 0 1").board));
assert.equal(gameStatus(play(parseFen("8/8/4k3/8/8/3K4/8/5r2 w - - 0 1"), "d3e2", "e6e5", "e2f1")).result, "insufficient");
assert.equal(BISHOP, 3);

// 50-move rule.
assert.equal(gameStatus(parseFen("8/8/4k3/8/8/3K4/8/R7 w - - 100 80")).result, "fifty");
assert.equal(gameStatus(parseFen("8/8/4k3/8/8/3K4/8/R7 w - - 99 80")).over, false);

// Threefold repetition: knights out and back twice.
const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
const twice = play(start, ...shuffle);
assert.equal(gameStatus(twice).over, false);
const thrice = play(twice, ...shuffle);
assert.equal(gameStatus(thrice).result, "threefold");
// En passant square only counts when a capture is possible.
assert.equal(positionKey(play(start, "e2e4")).endsWith(" -"), true);
assert.equal(positionKey(ep).endsWith(" d6"), true);

// Computer: takes a free queen, finds mate in one, and answers quickly.
const freeQueen = parseFen("4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1");
for (const level of ["medium", "hard"] as Level[]) {
  const m = chooseMove(freeQueen, level, rng(1))!;
  assert.equal(m.to, sq("d5"), `${level} takes the queen`);
}
const mateInOne = parseFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1");
const mate = searchBest(mateInOne, { maxDepth: 3, maxNodes: 50000, timeMs: 5000 })!;
assert.equal(moveToSan(mateInOne, mate.move), "Ra8#");
for (const level of ["easy", "medium", "hard"] as Level[]) {
  const t0 = Date.now();
  const m = chooseMove(parseFen(kiwiFen), level, rng(2));
  const ms = Date.now() - t0;
  assert.ok(m && legalMoves(kiwi).some((x) => x.from === m.from && x.to === m.to));
  assert.ok(ms < 1500, `${level} took ${ms}ms`);
  console.log(`  ${level}: ${ms}ms`);
}
assert.equal(chooseMove(fool, "hard"), null);

// Full games between computer players finish without an illegal move.
function fullGame(white: Level, black: Level, seed: number) {
  const r = rng(seed);
  let s = initialState();
  for (let ply = 0; ply < 600; ply++) {
    const st = gameStatus(s);
    if (st.over) return { st, ply };
    const m = chooseMove(s, s.turn === "w" ? white : black, r, { timeMs: 200 })!;
    assert.ok(legalMoves(s).some((x) => x.from === m.from && x.to === m.to && x.promo === m.promo), "computer move is legal");
    s = applyMove(s, m);
  }
  return { st: gameStatus(s), ply: 600 };
}
const g1 = fullGame("easy", "easy", 7);
assert.ok(g1.st.over, "easy vs easy ends");
const g2 = fullGame("medium", "easy", 11);
assert.ok(g2.st.over, "medium vs easy ends");
console.log(`  games: easy/easy ${g1.st.result} in ${g1.ply} plies, medium/easy ${g2.st.result} (${g2.st.winner}) in ${g2.ply} plies`);

console.log("chess tests passed");
