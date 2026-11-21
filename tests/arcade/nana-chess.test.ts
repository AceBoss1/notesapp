// Nana for Chess: free hints from the engine and her take on the computer's moves (lib/arcade/nana-chess.ts).
// Run: npx -y tsx tests/arcade/nana-chess.test.ts
import assert from "node:assert/strict";
import { applyMove, findMove, initialState, legalMoves, parseFen, squareFromName as sq, type ChessState } from "../../lib/arcade/chess";
import { attackers, chessTake, chessTip, moveLabel } from "../../lib/arcade/nana-chess";

const play = (s: ChessState, ...moves: string[]) => moves.reduce((st, uci) => applyMove(st, findMove(st, sq(uci.slice(0, 2)), sq(uci.slice(2, 4)))!), s);
const isLegal = (s: ChessState, from: number, to: number) => legalMoves(s).some((m) => m.from === from && m.to === to);

// The start position: a legal move, the same every time it's asked, and quick.
const start = initialState();
let t = performance.now();
const first = chessTip(start);
const ms = performance.now() - t;
assert.ok(first, "a tip at the start");
assert.ok(isLegal(start, first.highlight.from, first.highlight.to), "the tip is a legal move");
assert.ok(first.tip.move && first.tip.why.endsWith("."), "the tip has words");
assert.deepEqual(chessTip(start), first, "same position, same tip");
assert.ok(ms < 1000, `a hint is quick (${ms.toFixed(0)} ms)`);

// The tip is for whoever is to move: black after 1.e4.
const afterE4 = play(start, "e2e4");
const black = chessTip(afterE4)!;
assert.ok(isLegal(afterE4, black.highlight.from, black.highlight.to), "a legal move for black");

// Mate in one on the back rank: she finds it and says so.
const backRank = parseFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
const mate = chessTip(backRank)!;
assert.deepEqual(mate.highlight, { from: sq("a1"), to: sq("a8") });
assert.equal(mate.tip.move, "rook a1 to a8");
assert.match(mate.tip.why, /checkmate/i);

// A queen hanging: she takes it and says it's free.
const hanging = parseFen("4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1");
const grab = chessTip(hanging)!;
assert.deepEqual(grab.highlight, { from: sq("d1"), to: sq("d5") });
assert.match(grab.tip.why, /takes their queen on d5 for free/);

// Saving a piece: the knight on e4 is attacked by a pawn, so the tip moves it and says why.
const attacked = parseFen("4k3/8/8/3p4/4N3/8/8/4K3 w - - 0 1");
const save = chessTip(attacked)!;
assert.ok(save.highlight.from === sq("e4") || /takes/.test(save.tip.why), "deals with the attacked knight");

// Over: no tip.
const fool = play(start, "f2f3", "e7e5", "g2g4", "d8h4");
assert.equal(chessTip(fool), null, "no tip once it's checkmate");

// Labels.
const e4 = findMove(start, sq("e2"), sq("e4"))!, nf3 = findMove(start, sq("g1"), sq("f3"))!;
assert.equal(moveLabel(e4), "e2–e4");
assert.equal(moveLabel(nf3), "knight g1 to f3");
const castle = parseFen("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
assert.equal(moveLabel(findMove(castle, sq("e1"), sq("g1"))!), "castling king side");

// attackers(): who hits a square.
assert.deepEqual(attackers(attacked.board, sq("e4"), "b"), [1], "the d5 pawn hits e4");
assert.deepEqual(attackers(start.board, sq("f3"), "w").sort(), [1, 1, 2].sort(), "e2, g2 pawns and the g1 knight cover f3");

// Her take on the computer's moves (you play black here; the computer is white, then the other way round).
const pre = play(start, "e2e4", "d7d5");
const exd5 = findMove(pre, sq("e4"), sq("d5"))!;
const took = chessTake(pre, exd5, applyMove(pre, exd5));
assert.match(took.text, /took your pawn, but you can take back on d5/);

const preMate = play(start, "f2f3", "e7e5", "g2g4");
const qh4 = findMove(preMate, sq("d8"), sq("h4"))!;
const mated = chessTake(preMate, qh4, applyMove(preMate, qh4));
assert.match(mated.text, /Checkmate/);
assert.equal(mated.tone, "risky");

const preCheck = play(start, "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6");
const qxf7 = findMove(preCheck, sq("h5"), sq("f7"))!; // Scholar's mate
assert.match(chessTake(preCheck, qxf7, applyMove(preCheck, qxf7)).text, /Checkmate/);

const preThreat = parseFen("4k3/3p4/8/8/4N3/8/8/4K3 b - - 0 1");
const d5 = findMove(preThreat, sq("d7"), sq("d5"))!;
const warn = chessTake(preThreat, d5, applyMove(preThreat, d5));
assert.match(warn.text, /Watch your knight on e4/);
assert.equal(warn.tone, "risky");

const preCheck2 = parseFen("4k3/8/8/8/8/8/3q4/R3K3 b - - 0 1");
const qd1 = findMove(preCheck2, sq("d2"), sq("d1"))!;
const chk = chessTake(preCheck2, qd1, applyMove(preCheck2, qd1));
assert.match(chk.text, /^Check! Its queen on d1/);

const develop = chessTake(afterE4, findMove(afterE4, sq("b8"), sq("c6"))!, play(afterE4, "b8c6"));
assert.match(develop.text, /brought a knight out/);
assert.equal(develop.tone, "fine");

// A middlegame hint stays quick too.
const middle = parseFen("r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP1B1PPP/R2QKB1R w KQ - 0 8");
t = performance.now();
const mid = chessTip(middle)!;
const midMs = performance.now() - t;
assert.ok(isLegal(middle, mid.highlight.from, mid.highlight.to));
assert.ok(midMs < 1000, `a middlegame hint is quick (${midMs.toFixed(0)} ms)`);

console.log("nana-chess: all tests passed");
