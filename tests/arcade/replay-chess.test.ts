// Chess tournament replay (lib/arcade/replay-chess.ts); owner, 21 Nov 2026: "start tournaments".
// Run: npx -y tsx tests/arcade/replay-chess.test.ts
import assert from "node:assert/strict";
import { applyMove, gameStatus, initialState, legalMoves, searchBest, toFen, type ChessState, type Level, type Move } from "../../lib/arcade/chess";
import { CHESS_TOURNAMENT, encodeChess, plyOf, replayChess, tourneyReply, uciOf } from "../../lib/arcade/replay-chess";
import { compareRank } from "../../lib/arcade/tournament-games";

const rngFrom = (seed: number) => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

// Plays a game the way the component does: the human (a bot here) picks a move, then the computer replies with tourneyReply. Recorded
// through the same encoder the component uses.
function botGame(seed: number, level: Level, human: (s: ChessState) => Move, maxMoves = 200) {
  let s = initialState();
  const mine: Move[] = [];
  const replies: string[] = [];
  while (!gameStatus(s).over && mine.length < maxMoves) {
    const m = human(s);
    mine.push(m);
    s = applyMove(s, m);
    if (gameStatus(s).over) break;
    const r = tourneyReply(s, level, seed)!;
    replies.push(uciOf(r));
    s = applyMove(s, r);
  }
  return { recording: encodeChess(mine), state: s, mine, replies };
}
const randomHuman = (seed: number) => { const rng = rngFrom(seed); return (s: ChessState) => { const l = legalMoves(s); return l[Math.floor(rng() * l.length)]; }; };
const strongHuman = (s: ChessState) => searchBest(s, { maxDepth: 3, maxNodes: 60000, timeMs: Infinity, now: () => 0 })!.move;

// UCI: from, to, promotion.
{
  const s = initialState();
  const e4 = legalMoves(s).find((m) => uciOf(m) === "e2e4");
  assert.ok(e4);
  assert.equal(encodeChess([e4!]), "e2e4");
  assert.equal(encodeChess([e4!], true), "e2e4,resign");
  assert.equal(encodeChess([], true), "resign");
}

// The computer's tournament reply never looks at a clock: the same position, level and seed give the same move, even when "now" races.
{
  let s = initialState();
  s = applyMove(s, legalMoves(s).find((m) => uciOf(m) === "e2e4")!);
  for (const level of ["easy", "medium", "hard"] as const) {
    const a = uciOf(tourneyReply(s, level, 77)!);
    for (let i = 0; i < 3; i++) assert.equal(uciOf(tourneyReply(s, level, 77)!), a, `${level}: same reply`);
  }
  assert.equal(plyOf(s), 1);
}

// A losing bot (random moves) against medium: replays to the identical game and result.
{
  const g = botGame(2024, "medium", randomHuman(5));
  const st = gameStatus(g.state);
  assert.ok(st.over, "the game ends");
  const r = replayChess(2024, "medium", g.recording);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(toFen(r.state), toFen(g.state), "identical final position");
    assert.equal(r.moves, g.mine.length);
    assert.equal(r.finished, true);
  }
  const res = CHESS_TOURNAMENT.replay(2024, "medium", g.recording);
  assert.ok(res.ok && res.finished);
  assert.equal(st.winner, "b", "random moves lose to medium");
  if (res.ok) {
    assert.equal(res.summary, `Lost in ${g.mine.length} moves`);
    assert.deepEqual(res.rank, [0, g.mine.length]);
  }

  // Tampering: a move after the end, an illegal move, garbage, a promotion with no piece, resign anywhere but last, after the end.
  const anyMove = "a2a3";
  assert.deepEqual(replayChess(2024, "medium", g.recording + "," + anyMove), { ok: false, error: "That game carries on after it ended." });
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", g.recording + ",resign").ok, false, "can't resign a finished game");
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "e2e5").ok, false, "illegal move");
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "e7e5").ok, false, "a black piece");
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "e2e4,,d2d4").ok, false);
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "E2E4").ok, false);
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "hello").ok, false);
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", ["e2e4"]).ok, false);
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "resign,e2e4").ok, false);
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "e2e4,resign,resign").ok, false);
  assert.equal(CHESS_TOURNAMENT.replay(2024, "grandmaster", "e2e4").ok, false, "unknown level");
  assert.equal(CHESS_TOURNAMENT.replay(2024, "medium", "e2e4,".repeat(500)).ok, false, "too long");
}

// A winning bot (a deeper search) against easy: replays to the identical win, ranked by fewest moves.
let win: { recording: string; moves: number } | null = null;
{
  const g = botGame(99, "easy", strongHuman);
  const st = gameStatus(g.state);
  assert.equal(st.winner, "w", "the strong bot beats easy");
  const res = CHESS_TOURNAMENT.replay(99, "easy", g.recording);
  assert.ok(res.ok && res.finished);
  if (res.ok) {
    assert.equal(res.summary, `Won in ${g.mine.length} moves`);
    assert.deepEqual(res.rank, [2, -g.mine.length]);
    assert.equal(res.score, 1000 - g.mine.length);
  }
  win = { recording: g.recording, moves: g.mine.length };

  // The same seed gives the same computer replies; easy's loose picks follow the seed, so another seed plays differently somewhere.
  const again = botGame(99, "easy", strongHuman);
  assert.deepEqual(again.replies, g.replies);
  const other = botGame(100, "easy", strongHuman);
  assert.notDeepEqual(other.replies, g.replies, "another seed, other easy replies");
  // So the same moves on another seed don't replay to the same game.
  const moved = CHESS_TOURNAMENT.replay(100, "easy", g.recording);
  assert.ok(!moved.ok || moved.summary !== `Won in ${g.mine.length} moves`);
}

// Unfinished: the game stops before an end, so it isn't finished.
{
  const r = CHESS_TOURNAMENT.replay(1, "medium", "e2e4");
  assert.ok(r.ok && r.finished === false);
  const empty = CHESS_TOURNAMENT.replay(1, "medium", "");
  assert.ok(empty.ok && empty.finished === false);
}

// Resigning is a finished loss.
{
  const r = CHESS_TOURNAMENT.replay(1, "medium", "e2e4,resign");
  assert.ok(r.ok && r.finished);
  if (r.ok) { assert.deepEqual(r.rank, [0, 1]); assert.equal(r.summary, "Resigned after 1 move"); }
  const zero = CHESS_TOURNAMENT.replay(1, "medium", "resign");
  assert.ok(zero.ok && zero.finished && zero.summary === "Resigned after 0 moves");
}

// A quick loss: the fool's mate pattern, when the computer goes for it.
{
  const s1 = applyMove(initialState(), legalMoves(initialState()).find((m) => uciOf(m) === "f2f3")!);
  const reply = uciOf(tourneyReply(s1, "medium", 3)!);
  if (reply === "e7e5" || reply === "e7e6") {
    const r = CHESS_TOURNAMENT.replay(3, "medium", "f2f3,g2g4");
    assert.ok(r.ok && r.finished && r.summary === "Lost in 2 moves", "Qh4# is found");
  }
}

// Ranking: win (fewer moves first) > draw > loss (a longer fight first); the tuples straight from the formula and from real replays.
{
  const rank = (outcome: "win" | "draw" | "loss", moves: number) => [outcome === "win" ? 2 : outcome === "draw" ? 1 : 0, outcome === "win" ? -moves : moves];
  const order = [rank("win", 20), rank("win", 40), rank("draw", 30), rank("draw", 10), rank("loss", 60), rank("loss", 12)];
  for (let i = 0; i + 1 < order.length; i++) assert.ok(compareRank(order[i], order[i + 1]) > 0, `rank ${i} above ${i + 1}`);
  const w = CHESS_TOURNAMENT.replay(99, "easy", win!.recording);
  const resign = CHESS_TOURNAMENT.replay(1, "medium", "e2e4,resign");
  const longResign = CHESS_TOURNAMENT.replay(1, "medium", "e2e4,d2d4,resign");
  assert.ok(w.ok && resign.ok && longResign.ok);
  if (w.ok && resign.ok && longResign.ok) {
    assert.ok(compareRank(w.rank, resign.rank) > 0);
    assert.ok(compareRank(longResign.rank, resign.rank) > 0, "holding out longer ranks higher when losing");
    assert.ok(w.score > longResign.score);
  }
}

// The registry entry.
assert.equal(CHESS_TOURNAMENT.slug, "chess");
assert.equal(CHESS_TOURNAMENT.levels[0], "medium");
assert.ok(CHESS_TOURNAMENT.maxRecording >= 400 * 6);

console.log("replay-chess: all tests passed");
