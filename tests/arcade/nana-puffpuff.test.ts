// Nana for Puff-Puff Rush (lib/arcade/nana-puffpuff.ts): what she notices during a game, her coaching, and her tip while paused.
// Run: npx -y tsx tests/arcade/nana-puffpuff.test.ts
import assert from "node:assert/strict";
import { botDirection, initialState, step, type Dir, type Goat, type PuffState } from "../../lib/arcade/puffpuff";
import { newPuffWatch, puffCoach, puffStats, puffTip, watchPuff, type PuffWatch } from "../../lib/arcade/nana-puffpuff";

// A game in progress on the first market, with the goats placed by the test (the rest stay in the pen for a long while).
function board(player: { x: number; y: number; dir: Dir | null }, goats: Partial<Goat>[] = [], extra: Partial<PuffState> = {}): PuffState {
  const s = initialState({ seed: 3 });
  const placed = s.goats.map((g, i) => (goats[i] ? { ...g, prog: 0, scared: false, ...goats[i] } as Goat : { ...g, mode: "pen" as const, releaseMs: 1e9, x: s.maze.penCenter.x, y: s.maze.penCenter.y, dir: null }));
  return { ...s, phase: "playing", phaseMs: 0, events: [], player: { ...player, prog: 0, nextDir: null }, goats: placed, ...extra };
}

function play(s: PuffState, ms: number, w: PuffWatch = newPuffWatch()): { s: PuffState; w: PuffWatch } {
  for (let t = 0; t < ms; t += 16) {
    const next = step(s, 16);
    w = watchPuff(w, s, next);
    s = next;
    if (next.events.includes("caught")) break;
  }
  return { s, w };
}

// Before the first game: a welcome.
assert.match(puffCoach(null).text, /which goat got you/);

// Riding straight into Oga: Nana names him, says it was head on, how he hunts, and the soup still on the board.
{
  const { s, w } = play(board({ x: 9, y: 15, dir: "left" }, [{ x: 6, y: 15, dir: "right", mode: "active" }]), 2000);
  assert.ok(s.events.includes("caught"));
  assert.equal(w.catches.length, 1);
  const c = w.catches[0];
  assert.equal(c.goat, "Oga");
  assert.equal(c.head_on, true);
  assert.equal(c.soupsLeft, 4);
  assert.equal(c.market, "Morning market");
  const over = { ...s, phase: "over" as const, lives: 0 };
  const take = puffCoach(puffStats(over, w, 0));
  assert.match(take.text, /In the end it was Oga in Morning market: you rode straight into him\. Oga heads straight for you/);
  assert.match(take.text, /You still had 4 bowls of pepper soup on the board/);
  assert.equal(take.tone, "risky", "caught early on the first market");
}

// Caught from behind while stopped at a wall, just after the soup wore off.
{
  const start = board({ x: 9, y: 15, dir: "up" }, [undefined as unknown as Partial<Goat>, { x: 10, y: 15, dir: "left", mode: "active" }], { scaredMs: 20 });
  const { w } = play(start, 2000);
  assert.equal(w.catches.length, 1);
  assert.equal(w.catches[0].goat, "Sharp");
  assert.equal(w.catches[0].head_on, false);
  assert.equal(w.catches[0].soupJustEnded, true);
  const paused = puffCoach(puffStats(start, w, 0));
  assert.match(paused.text, /Last time it was Sharp in Morning market: he crept up on you\. Sharp aims a few tiles in front of you/);
  assert.match(paused.text, /The soup had just worn off/);
}

// A bowl of soup with no goat anywhere near is a wasted bowl.
{
  const { s, w } = play(board({ x: 1, y: 1, dir: "down" }, [{ x: 9, y: 7, dir: "left", mode: "active" }]), 400);
  assert.ok(s.scaredMs > 0, "the soup was eaten");
  assert.deepEqual(w.bowls, [0]);
  assert.equal(w.farBowls, 1);
  const take = puffCoach(puffStats(s, w, 0));
  assert.match(take.text, /No goat has caught you yet this game/);
  assert.match(take.text, /You ate a bowl of soup with no goat near\. Save it for when they close in/);
}

// A good game: new best, three goats on one bowl, a market cleared.
{
  const s = { ...initialState({ seed: 1 }), phase: "over" as const, score: 4200, level: 2, lives: 0 };
  const w: PuffWatch = { ...newPuffWatch(), bowls: [1, 3], cleared: 1, catches: [
    { goat: "Waka", kind: "wanderer", market: "Night market", head_on: true, soupsLeft: 0, soupJustEnded: false },
    { goat: "Waka", kind: "wanderer", market: "Night market", head_on: false, soupsLeft: 0, soupJustEnded: false },
  ] };
  const take = puffCoach(puffStats(s, w, 3000));
  assert.equal(take.tone, "good");
  assert.match(take.text, /^New best: 4200\. In the end it was Waka in Night market: he crept up on you\. Waka wanders half the time/);
  assert.match(take.text, /Waka caught you 2 times\./);
  const noBest = puffCoach(puffStats(s, { ...w, catches: w.catches.slice(0, 1) }, 9000));
  assert.match(noBest.text, /Lovely soup timing: 3 goats on one bowl\./);
}

// Paused tips: the way botDirection rides, with the nearest goat as the why; chase a scared goat when there's time.
{
  const near = board({ x: 9, y: 15, dir: "left" }, [{ x: 6, y: 15, dir: "right", mode: "active" }]);
  const before = JSON.stringify(near);
  const tip = puffTip(near);
  assert.ok(tip);
  assert.equal(tip.move, `riding ${botDirection(near)}`);
  assert.match(tip.why, /^Oga is 3 tiles to your left, so that way keeps clear of him/);
  assert.equal(JSON.stringify(near), before, "a tip never changes the game");

  const fresh = initialState({ seed: 1 });
  const calm = puffTip(fresh);
  assert.ok(calm);
  assert.equal(calm.move, `riding ${botDirection(fresh)}`);
  assert.match(calm.why, /shortest way to the nearest puff-puff, and the nearest goat, Oga, is 8 tiles above you/);

  const scared = board({ x: 9, y: 15, dir: "left" }, [{ x: 6, y: 15, dir: "right", mode: "active", scared: true }], { scaredMs: 4000 });
  const chase = puffTip(scared);
  assert.equal(chase?.move, "going after Oga");
  assert.match(chase!.why, /scared for 4 s more and 3 tiles to your left: catch him for 200/);

  assert.equal(puffTip({ ...near, phase: "over" }), null, "nothing to steer once it's over");
  assert.equal(puffTip({ ...near, phase: "dying" }), null);
}

// Watching changes nothing: a bot game with Nana watching every frame plays out exactly like one without.
{
  let a = initialState({ seed: 11 }); let b = initialState({ seed: 11 }); let w = newPuffWatch();
  for (let i = 0; i < 4000 && a.phase !== "over"; i += 1) {
    const d = botDirection(a);
    const na = step(a, 16, d ? { dir: d } : {});
    w = watchPuff(w, a, na);
    if (na.phase === "playing") puffTip(na);
    a = na;
    const db = botDirection(b);
    b = step(b, 16, db ? { dir: db } : {});
  }
  assert.deepEqual(a, b);
}

console.log("nana-puffpuff: all tests passed");
