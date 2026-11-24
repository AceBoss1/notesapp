// Per-game leaderboards, the pure rules (lib/arcade/boards.ts; owner, Nov 2026: "each game has leaderboard makeup of top npc 🤖 and top
// human"): each game's record read from the saved kv, the caps and growth limits, and the computer players' wins from members' losses.
// Run: npm run test:arcade.
import assert from "node:assert/strict";
import {
  BOARD_RULES, NPC_PER_DAY, NPC_PER_SAVE, SNAKE_MAX, boardRule, count, creditSave, lagosDay, lostKey, lostMap, touchedBoards, type PersonRecord,
} from "../../lib/arcade/boards";
import { ARCADE_GAMES } from "../../lib/arcade/catalogue";
import { cleanKey } from "../../lib/arcade/progress";
import { autopilotScores, snakeAutopilot } from "../../lib/arcade/boards-bots";

const rule = (slug: string) => { const r = boardRule(slug); assert.ok(r, slug); return r!; };
const DAY = "2026-11-24";

// Every game in the catalogue has a board, every key it reads is one the account save keeps, and every board has computer players.
assert.deepEqual(BOARD_RULES.map((r) => r.slug).sort(), ARCADE_GAMES.map((g) => g.slug).sort());
for (const r of BOARD_RULES) {
  for (const k of r.keys) assert.equal(cleanKey(k), k, `${r.slug}: ${k} must be a key /api/arcade/progress saves`);
  assert.ok(r.npcs.length >= 1 && r.npcs.length <= 5, r.slug);
  assert.equal(new Set(r.npcs.map((n) => n.id)).size, r.npcs.length, `${r.slug}: npc ids are unique`);
}
for (const s of ["snake", "run", "puffpuff"]) { assert.equal(rule(s).metric, "best"); assert.equal(rule(s).label, "Best score"); }
for (const s of ["ludo", "whot", "spades", "landlord", "ncho", "akahausa", "chess", "draughts", "achi"]) { assert.equal(rule(s).metric, "wins"); assert.equal(rule(s).label, "Wins vs the computer"); }

// Numbers from saved text: whole and non-negative, anything else 0.
assert.equal(count("12"), 12); assert.equal(count(" 7 "), 7); assert.equal(count(3.9), 3);
for (const bad of ["-4", "1e9", "abc", "", "3.5", null, undefined, -1, Infinity, "9".repeat(20)]) assert.equal(count(bad), 0, String(bad));

// Per-game derivation from the kv.
assert.deepEqual(rule("ludo").claim({ "notes-arcade-ludo-wins": "5", [lostKey("ludo")]: JSON.stringify({ coral: 2, blue: 1, green: 0 }) }), { value: 5, wins: 5, losses: 3 });
assert.deepEqual(rule("whot").claim({ "notes-arcade-whot-record": JSON.stringify({ won: 4, lost: 6 }) }), { value: 4, wins: 4, losses: 6 });
assert.deepEqual(rule("spades").lost({ "notes-arcade-spades-record": JSON.stringify({ won: 1, lost: 2 }) }), { eastwest: 2 });
assert.deepEqual(rule("whot").lost({}), {}, "no record, no losses");
assert.equal(rule("ncho").claim({ "arcade-ncho-wins": "3", "arcade-ncho-wins-4p": "2", "arcade-akahausa-wins": "9" }).value, 5, "2- and 4-player wins, not Aka-Hausa's");
assert.equal(rule("akahausa").claim({ "arcade-akahausa-wins": "9", "arcade-akahausa-wins-4p": "1" }).value, 10);
assert.deepEqual(rule("chess").claim({ "notes-arcade-chess": JSON.stringify({ level: "hard", side: "w", wins: 7 }), [lostKey("chess")]: JSON.stringify({ hard: 2, easy: 1 }) }), { value: 7, wins: 7, losses: 3 });
assert.equal(rule("chess").claim({ "notes-arcade-chess": "not json" }).value, 0);
assert.equal(rule("run").claim({ "notes-arcade-run-best-chill": "900", "notes-arcade-run-best-fast": "4100", "notes-arcade-run-best-normal": "2000" }).value, 4100, "the best of any speed");
assert.equal(rule("snake").claim({ "arcade-snake-best": "250" }).value, 250);
assert.equal(rule("puffpuff").claim({ "puffpuff.best": "9999" }).value, 0, "the old key was never saved");
assert.equal(rule("landlord").claim({ "notes-arcade-landlord-wins": "2" }).value, 2);
// Lost maps keep only the game's own computer players.
assert.deepEqual(lostMap(JSON.stringify({ chidi: 2, hacker: 99, __proto__: 5, tunde: "x" }), rule("landlord").npcs), { chidi: 2, tunde: 0 });
assert.deepEqual(lostMap("[1,2]", rule("landlord").npcs), {});

// Which boards a save touches.
assert.deepEqual(touchedBoards({ "arcade-ncho-wins-4p": "1" }).map((r) => r.slug), ["ncho"]);
assert.deepEqual(touchedBoards({ [lostKey("draughts")]: "{}" }).map((r) => r.slug), ["draughts"]);
assert.deepEqual(touchedBoards({ "arcade-nana-ludo": "off", "arcade-draughts-rules": "english-8" }), [], "choices and Nana switches don't touch a board");

// Lagos day: UTC+1.
assert.equal(lagosDay(new Date("2026-11-24T22:59:00Z")), "2026-11-24");
assert.equal(lagosDay(new Date("2026-11-24T23:00:00Z")), "2026-11-25");

// ---- creditSave: wins games ----
const ludo = rule("ludo");
const lw = (wins: number, lost: Record<string, number> = {}) => ({ "notes-arcade-ludo-wins": String(wins), [lostKey("ludo")]: JSON.stringify(lost) });
// A member's first win.
let r = creditSave(ludo, null, {}, lw(1), DAY);
assert.equal(r.record!.value, 1); assert.equal(r.record!.wins, 1); assert.equal(r.record!.losses, 0); assert.deepEqual(r.npc, {});
// Nothing to record: no row.
assert.equal(creditSave(ludo, null, {}, { [lostKey("ludo")]: "{}" }, DAY).record, null);
// History from before the boards: up to firstSave of the wins already saved.
assert.equal(creditSave(ludo, null, lw(40), lw(41), DAY).record!.value, 41);
assert.equal(creditSave(ludo, null, lw(5000), lw(5001), DAY).record!.value, ludo.caps.firstSave, "an absurd history is capped");
// After that, wins come from the change since the last save, perSave at most.
let prev: PersonRecord = { value: 10, wins: 10, losses: 0, day: DAY, dayGain: 0, dayNpc: 0 };
assert.equal(creditSave(ludo, prev, lw(10), lw(11), DAY).record!.value, 11);
assert.equal(creditSave(ludo, prev, lw(10), lw(10_000), DAY).record!.value, 10 + ludo.caps.perSave, "growth per save is capped");
assert.equal(creditSave(ludo, prev, lw(10), lw(3), DAY).record!.value, 10, "a lower number never lowers the board");
assert.equal(creditSave(ludo, prev, lw(3), lw(4), DAY).record!.value, 11, "after a reset, each new win still counts");
// The browser's number isn't trusted: a save claiming 999 over a kv that said 998 earns one win.
assert.equal(creditSave(ludo, prev, lw(998), lw(999), DAY).record!.value, 11);
// The daily cap.
prev = { value: 100, wins: 100, losses: 0, day: DAY, dayGain: ludo.caps.perDay - 1, dayNpc: 0 };
r = creditSave(ludo, prev, lw(5), lw(8), DAY);
assert.equal(r.record!.value, 101, "only what's left of today's allowance"); assert.equal(r.record!.dayGain, ludo.caps.perDay);
assert.equal(creditSave(ludo, r.record, lw(8), lw(9), DAY).record!.value, 101, "nothing more today");
const tomorrow = creditSave(ludo, r.record, lw(8), lw(9), "2026-11-25").record!;
assert.equal(tomorrow.value, 102); assert.equal(tomorrow.dayGain, 1, "a new day starts a new allowance");
// The absolute cap.
prev = { value: ludo.caps.max - 1, wins: ludo.caps.max - 1, losses: 0, day: DAY, dayGain: 0, dayNpc: 0 };
assert.equal(creditSave(ludo, prev, lw(1), lw(4), DAY).record!.value, ludo.caps.max);

// ---- Computer players' wins: a member's saved loss going up ----
prev = { value: 2, wins: 2, losses: 0, day: DAY, dayGain: 0, dayNpc: 0 };
r = creditSave(ludo, prev, lw(2, { coral: 1 }), lw(2, { coral: 2, blue: 1 }), DAY);
assert.deepEqual(r.npc, { coral: 1, blue: 1 }); assert.equal(r.record!.losses, 2); assert.equal(r.record!.dayNpc, 2); assert.equal(r.record!.value, 2);
assert.deepEqual(creditSave(ludo, prev, lw(2, { coral: 1 }), lw(2, { coral: 50 }), DAY).npc, { coral: NPC_PER_SAVE }, "capped per save");
assert.deepEqual(creditSave(ludo, prev, lw(2, { coral: 5 }), lw(2, { coral: 1 }), DAY).npc, {}, "a lower count credits nobody");
assert.deepEqual(creditSave(ludo, { ...prev, dayNpc: NPC_PER_DAY - 1 }, lw(2), lw(2, { gold: 3 }), DAY).npc, { gold: 1 }, "capped per day");
assert.deepEqual(creditSave(ludo, { ...prev, dayNpc: NPC_PER_DAY }, lw(2), lw(2, { gold: 3 }), "2026-11-25").npc, { gold: 3 }, "a new day");
assert.deepEqual(creditSave(ludo, prev, lw(2), { ...lw(2), [lostKey("ludo")]: JSON.stringify({ hacker: 3 }) }, DAY).npc, {}, "unknown computer players are ignored");
// Losses only (never won): a row with value 0 (the API leaves it off), so the daily NPC cap is kept.
r = creditSave(ludo, null, {}, { [lostKey("ludo")]: JSON.stringify({ blue: 1 }) }, DAY);
assert.equal(r.record!.value, 0); assert.deepEqual(r.npc, { blue: 1 }); assert.equal(r.record!.dayNpc, 1);
// Whot and Spades: their existing record's lost count; a first save credits no history to the computer.
const whot = rule("whot");
const wr = (won: number, lost: number) => ({ "notes-arcade-whot-record": JSON.stringify({ won, lost }) });
r = creditSave(whot, null, wr(3, 9), wr(3, 10), DAY);
assert.deepEqual(r.npc, { computer: 1 }); assert.equal(r.record!.value, 3); assert.equal(r.record!.losses, 10);
r = creditSave(whot, null, {}, wr(3, 20), DAY);
assert.deepEqual(r.npc, { computer: NPC_PER_SAVE }, "no saved record before: only NPC_PER_SAVE");
// Levels: the computer at the level you lost to.
const chess = rule("chess");
r = creditSave(chess, prev, { [lostKey("chess")]: JSON.stringify({ hard: 1 }) }, { [lostKey("chess")]: JSON.stringify({ hard: 2, easy: 0 }) }, DAY);
assert.deepEqual(r.npc, { hard: 1 });
assert.deepEqual(chess.npcs.map((n) => n.name), ["Computer · Easy", "Computer · Medium", "Computer · Hard"]);
assert.deepEqual(rule("landlord").npcs.map((n) => n.name), ["Chidi", "Amaka", "Tunde"]);

// ---- creditSave: best scores ----
const snake = rule("snake");
r = creditSave(snake, null, {}, { "arcade-snake-best": "340" }, DAY);
assert.equal(r.record!.value, 340); assert.equal(r.record!.wins, undefined);
assert.equal(creditSave(snake, null, {}, { "arcade-snake-best": "99999" }, DAY).record!.value, snake.caps.perSave, "a first best climbs perSave at most");
prev = { value: 3000, day: DAY, dayGain: 0, dayNpc: 0 };
assert.equal(creditSave(snake, prev, {}, { "arcade-snake-best": "99999" }, DAY).record!.value, SNAKE_MAX, "never past a full board");
assert.equal(creditSave(snake, prev, {}, { "arcade-snake-best": "100" }, DAY).record!.value, 3000, "a lower best never lowers the board");
const run = rule("run");
prev = { value: 1000, day: DAY, dayGain: run.caps.perDay - 500, dayNpc: 0 };
assert.equal(creditSave(run, prev, {}, { "notes-arcade-run-best-fast": "9000" }, DAY).record!.value, 1500, "the daily cap holds for bests too");
assert.equal(creditSave(run, prev, {}, { "notes-arcade-run-best-fast": "9000" }, "2026-11-25").record!.value, 9000);
// A capped best keeps climbing on later saves of that game.
let climb: PersonRecord | null = null;
for (let i = 0; i < 3; i++) climb = creditSave(snake, climb, { "arcade-snake-best": "3900" }, { "arcade-snake-best": "3900" }, DAY).record;
assert.equal(climb!.value, 3900);
assert.deepEqual(creditSave(snake, null, {}, { "arcade-snake-best": "50" }, DAY).npc, {}, "action games credit no computer");

// ---- The autopilots (the 🤖 column of the action games): deterministic, real scores within the caps ----
assert.equal(snakeAutopilot("classic", 7), snakeAutopilot("classic", 7));
for (const slug of ["snake", "run", "puffpuff"]) {
  const s = autopilotScores(slug);
  assert.deepEqual(Object.keys(s).sort(), rule(slug).npcs.map((n) => n.id).sort(), slug);
  for (const v of Object.values(s)) assert.ok(v > 0 && v <= rule(slug).caps.max, `${slug} autopilot ${v}`);
}
assert.deepEqual(autopilotScores("ludo"), {});

console.log("ARCADE BOARDS OK");
