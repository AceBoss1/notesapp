// Per-game leaderboards end to end on the Firestore emulator (lib/arcade/boards-server.ts; owner, Nov 2026: "each game has leaderboard
// makeup of top npc 🤖 and top human"): saving progress moves the board, guests and child profiles never appear, teen mode follows the
// Billionaires List rule, the caps hold, the top-N order, and the API's shape and caching.
// Run: npm run test:boards-server → "BOARDS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { BoardError, getBoard, saveProgress } from "../../lib/arcade/boards-server";
import { NPC_PER_SAVE, PEOPLE_SHOWN, lostKey } from "../../lib/arcade/boards";
import { GET } from "../../app/api/arcade/boards/[slug]/route";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const now = new Date("2026-11-24T12:00:00Z");
const ludo = (wins: number, lost: Record<string, number> = {}) => ({ "notes-arcade-ludo-wins": String(wins), [lostKey("ludo")]: JSON.stringify(lost) });
const person = async (slug: string, uid: string) => (await db.doc(`arcadeBoards/${slug}/people/${uid}`).get()).data();

(async () => {
  for (let i = 1; i <= 25; i++) await db.doc(`users/a${i}`).set({ uid: `a${i}`, username: `adult${i}`, displayName: `Adult ${i}` });
  await db.doc("users/teen").set({ uid: "teen", username: "teen1", displayName: "Teen One", teen: true });
  await db.doc("users/hidden").set({ uid: "hidden", username: "hidden1", displayName: "Kept Hidden", keepHidden: true });
  await db.doc("users/kid_k1").set({ uid: "kid_k1", displayName: "Little One", kid: true, teen: true });
  await db.doc("users/sus").set({ uid: "sus", username: "sus1", suspended: true });
  await db.doc("users/nouser").set({ uid: "nouser" });

  // Saving progress moves the board, and still returns the merged kv as before.
  const kv = await saveProgress(db, "a1", ludo(1), now);
  assert.equal(kv["notes-arcade-ludo-wins"], "1");
  assert.equal((await db.doc("arcadeProgress/a1").get()).get("kv")["notes-arcade-ludo-wins"], "1", "progress itself is saved");
  assert.equal((await person("ludo", "a1"))!.value, 1);
  await saveProgress(db, "a1", ludo(2), now);
  assert.equal((await person("ludo", "a1"))!.value, 2);
  // A save that touches no board key writes no board rows.
  await saveProgress(db, "a2", { "arcade-nana-ludo": "off" }, now);
  assert.equal(await person("ludo", "a2"), undefined);

  // Losses credit the computer that won; the per-save cap holds.
  await saveProgress(db, "a1", { [lostKey("ludo")]: JSON.stringify({ coral: 1 }) }, now);
  await saveProgress(db, "a2", ludo(0, { coral: 1, gold: 1 }), now);
  await saveProgress(db, "a3", ludo(0, { blue: 40 }), now);
  const npcWins = (await db.doc("arcadeBoards/ludo").get()).get("npcWins");
  assert.deepEqual(npcWins, { coral: 2, gold: 1, blue: NPC_PER_SAVE });

  // Caps: a made-up jump earns at most perSave wins; a made-up first history at most firstSave.
  await saveProgress(db, "a1", ludo(9_999), now);
  assert.equal((await person("ludo", "a1"))!.value, 5, "2 + perSave 3");
  await saveProgress(db, "a4", ludo(1_000_000), now);
  assert.equal((await person("ludo", "a4"))!.value, 50);

  // Child profiles, suspended accounts and accounts with no username: progress saved, no row.
  for (const uid of ["kid_k1", "sus", "nouser"]) {
    await saveProgress(db, uid, ludo(3, { coral: 2 }), now);
    assert.ok((await db.doc(`arcadeProgress/${uid}`).get()).exists, `${uid}: progress is still saved`);
    assert.equal(await person("ludo", uid), undefined, `${uid}: never on the board`);
  }
  assert.equal((await db.doc("arcadeBoards/ludo").get()).get("npcWins").coral, 2, "their losses don't count either");
  // A teen and a member kept hidden do get a row (so they see their own place); the listing decides who sees it.
  await saveProgress(db, "teen", ludo(7), now);
  await saveProgress(db, "hidden", ludo(6), now);
  assert.equal((await person("ludo", "teen"))!.value, 7);

  // Guests' view: no teen, no hidden, no kid; ordered; the shape.
  let view = await getBoard(db, "ludo");
  assert.equal(view.game, "ludo"); assert.equal(view.metric, "wins"); assert.equal(view.label, "Wins vs the computer");
  assert.equal(view.me, undefined, "no viewer, no me");
  assert.deepEqual(view.people.map((p) => p.username), ["adult4", "adult1"]);
  assert.deepEqual(view.people[0], { rank: 1, name: "Adult 4", username: "adult4", value: 50, wins: 50, losses: 0 });
  assert.deepEqual(view.npcs.slice(0, 3), [{ id: "blue", name: "Blue", value: 3 }, { id: "coral", name: "Coral", value: 2 }, { id: "gold", name: "Gold", value: 1 }]);
  assert.ok(view.npcs.length <= 5);
  assert.ok(!JSON.stringify(view).includes("teen1") && !JSON.stringify(view).includes("Little") && !JSON.stringify(view).includes("hidden1"));

  // The teen sees themselves, highlighted, with their rank and the teen note; an adult who isn't a mutual follow doesn't see them.
  view = await getBoard(db, "ludo", "teen");
  assert.deepEqual(view.people.map((p) => p.username), ["adult4", "teen1", "adult1"]);
  assert.equal(view.people[1].you, true);
  assert.deepEqual(view.me, { rank: 2, value: 7, hidden: true });
  view = await getBoard(db, "ludo", "a1");
  assert.deepEqual(view.people.map((p) => p.username), ["adult4", "adult1"]);
  assert.deepEqual(view.me, { rank: 4, value: 5 }, "rank counts everyone above, shown or not, as the Billionaires List does");
  assert.equal(view.people[1].you, true);
  // A friend the teen follows back sees them (follows/{followerUid}_{username}).
  await db.doc("follows/a1_teen1").set({ followerUid: "a1", username: "teen1" });
  await db.doc("follows/teen_adult1").set({ followerUid: "teen", username: "adult1" });
  view = await getBoard(db, "ludo", "a1");
  assert.deepEqual(view.people.map((p) => p.username), ["adult4", "teen1", "adult1"]);
  // A member with no row yet.
  view = await getBoard(db, "ludo", "a9");
  assert.deepEqual(view.me, { rank: null, value: 0 });
  assert.equal((await getBoard(db, "ludo", "kid_k1")).me?.rank, null);

  // Top N: 20 people, best first; members with only losses (value 0) aren't listed.
  for (let i = 5; i <= 25; i++) await saveProgress(db, `a${i}`, ludo(i), now);
  view = await getBoard(db, "ludo");
  assert.equal(view.people.length, PEOPLE_SHOWN);
  for (let i = 1; i < view.people.length; i++) assert.ok(view.people[i - 1].value >= view.people[i].value);
  assert.deepEqual(view.people.slice(0, 2).map((p) => p.username), ["adult4", "adult25"]);
  assert.ok(!view.people.some((p) => p.username === "adult2" || p.username === "adult3"), "losses only: not listed");

  // An action game: best score, the autopilots as computer players, kept on the board doc.
  await saveProgress(db, "a1", { "arcade-snake-best": "420" }, now);
  await saveProgress(db, "a2", { "arcade-snake-best": "999999" }, now);
  view = await getBoard(db, "snake");
  assert.equal(view.metric, "best"); assert.equal(view.label, "Best score"); assert.equal(view.npcLabel, "Autopilot best score");
  assert.deepEqual(view.people.map((p) => [p.username, p.value]), [["adult2", 1500], ["adult1", 420]], "an absurd best is capped per save");
  assert.equal(view.people[0].wins, undefined);
  assert.equal(view.npcs.length, 3); assert.ok(view.npcs.every((n) => n.value > 0 && n.name.startsWith("Autopilot")));
  assert.equal((await db.doc("arcadeBoards/snake").get()).get("autopilotVersion"), 1);

  // Unknown games.
  await assert.rejects(getBoard(db, "nope"), (e: unknown) => e instanceof BoardError && e.status === 404);

  // The API: the guest answer is cached for everyone; an unknown game is a 404.
  const res = await GET(new NextRequest("http://localhost/api/arcade/boards/ludo", { headers: { "x-forwarded-for": "10.9.0.1" } }), { params: { slug: "ludo" } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control") ?? "", /s-maxage=60/);
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ["game", "label", "metric", "npcLabel", "npcs", "people"]);
  assert.equal(body.people.length, PEOPLE_SHOWN);
  const bad = await GET(new NextRequest("http://localhost/api/arcade/boards/nope", { headers: { "x-forwarded-for": "10.9.0.2" } }), { params: { slug: "nope" } });
  assert.equal(bad.status, 404);

  console.log("BOARDS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
