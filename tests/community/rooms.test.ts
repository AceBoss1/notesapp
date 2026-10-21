// Audio rooms (lib/rooms.ts): who is on stage, who listens, and which connections each person makes. Run: npm run test:community → "ALL OK".
import assert from "node:assert/strict";
import { ROOM_LISTENERS_MAX_P2P, cleanRoomTitle, linksFor, listenersOf, presentIn, roomIsFull, roomRole, stageOf, type RoomDoc } from "../../lib/rooms";

const now = Date.parse("2026-10-22T10:00:00Z");
const p = (seenAgo = 0) => ({ name: "x", avatar: "", at: "2026-10-22T09:00:00Z", seen: new Date(now - seenAgo).toISOString() });
const room = (speakers: string[], uids: Record<string, number>): Pick<RoomDoc, "hostUid" | "speakers" | "joined"> =>
  ({ hostUid: "h", speakers, joined: Object.fromEntries(Object.entries(uids).map(([u, ago]) => [u, p(ago)])) });

const r = room(["s1", "s2"], { h: 0, s1: 0, s2: 0, l1: 0, l2: 0, gone: 120_000 });
assert.deepEqual(presentIn(r, now).sort(), ["h", "l1", "l2", "s1", "s2"], "not heard from for 2 minutes: gone");
assert.deepEqual(stageOf(r, now), ["h", "s1", "s2"]);
assert.deepEqual(listenersOf(r, now), ["l1", "l2"]);
assert.deepEqual([roomRole(r, "h"), roomRole(r, "s1"), roomRole(r, "l1")], ["host", "speaker", "listener"]);

// the host: stage links to the speakers (the larger uid offers), and one listen link to every listener (the host offers)
assert.deepEqual(linksFor(r, "h", now), [
  { peer: "s1", kind: "stage", offer: false }, { peer: "s2", kind: "stage", offer: false },
  { peer: "l1", kind: "listen", offer: true }, { peer: "l2", kind: "listen", offer: true },
]);
// a speaker: stage links only, never to listeners
assert.deepEqual(linksFor(r, "s2", now), [{ peer: "h", kind: "stage", offer: true }, { peer: "s1", kind: "stage", offer: true }]);
assert.deepEqual(linksFor(r, "s1", now), [{ peer: "h", kind: "stage", offer: true }, { peer: "s2", kind: "stage", offer: false }]);
// both ends of every stage pair agree on who offers
for (const a of stageOf(r, now)) for (const l of linksFor(r, a, now).filter((x) => x.kind === "stage")) {
  const back = linksFor(r, l.peer, now).find((x) => x.peer === a)!;
  assert.notEqual(l.offer, back.offer, `${a}↔${l.peer}`);
}
// a listener: one link, from the host, answered; none while the host is away
assert.deepEqual(linksFor(r, "l1", now), [{ peer: "h", kind: "listen", offer: false }]);
assert.deepEqual(linksFor(room([], { h: 120_000, l1: 0 }), "l1", now), []);

// full at 20 listeners (phone to phone)
const many = room([], { h: 0, ...Object.fromEntries(Array.from({ length: ROOM_LISTENERS_MAX_P2P }, (_, i) => [`l${i}`, 0])) });
assert.equal(roomIsFull(many, now), true);
assert.equal(roomIsFull(room([], { h: 0, l1: 0 }), now), false);
assert.equal(cleanRoomTitle("  Sunday   Q&A  "), "Sunday Q&A");
assert.equal(cleanRoomTitle("x".repeat(200)).length, 80);
console.log("ALL OK");
