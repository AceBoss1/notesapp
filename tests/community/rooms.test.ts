// Audio rooms (lib/rooms.ts): who is on stage, who listens, and which connections each person makes. Run: npm run test:community → "ALL OK".
import assert from "node:assert/strict";
import {
  ALL_MOD_PERMS, MOD_PRESETS, ROOM_INVITE_MS, ROOM_LISTENERS_MAX_P2P, ROOM_SPEAKERS_MAX, canPush, cleanPerms, cleanRoomTitle, emptySeats, inviteFor, linksFor, listenersOf, mayActOn,
  permsOf, presentIn, pullsFor, roomCan, roomIsFull, roomRole, seatAction, stageModeOf, stageOf, strictlyWithin, type RoomDoc,
} from "../../lib/rooms";

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

// full at 20 listeners (phone to phone, the default cap); a bigger cap (the relay's) lets more in
const many = room([], { h: 0, ...Object.fromEntries(Array.from({ length: ROOM_LISTENERS_MAX_P2P }, (_, i) => [`l${i}`, 0])) });
assert.equal(roomIsFull(many, ROOM_LISTENERS_MAX_P2P, now), true);
assert.equal(roomIsFull(many, 500, now), false);
assert.equal(roomIsFull(room([], { h: 0, l1: 0 }), ROOM_LISTENERS_MAX_P2P, now), false);
assert.equal(cleanRoomTitle("  Sunday   Q&A  "), "Sunday Q&A");
assert.equal(cleanRoomTitle("x".repeat(200)).length, 80);

// ── the stage (lib/rooms.ts "Stage seats") ──
const st = (stageMode: RoomDoc["stageMode"], speakers: string[] = []) => ({ hostUid: "h", speakers, stageMode });
assert.equal(stageModeOf({}), "approve", "rooms from before: Approve");
assert.equal(seatAction(st("solo"), "l1"), "none", "Solo: no +");
assert.equal(seatAction(st("approve"), "l1"), "request");
assert.equal(seatAction(st("open"), "l1"), "take");
assert.equal(seatAction(st("open"), "l1", true), "request", "teen mode asks, even in Open");
assert.equal(seatAction(st("open", ["a", "b", "c", "d"]), "l1"), "none", "Open and full: nothing to take");
assert.equal(seatAction(st("approve", ["a", "b", "c", "d"]), "l1"), "request", "Approve and full: the host can make room");
assert.equal(seatAction(st("open", ["s1"]), "s1"), "none", "already on stage");
assert.equal(seatAction(st("open"), "h"), "none");
assert.equal(emptySeats(st("open", ["a"])), ROOM_SPEAKERS_MAX - 1);
const inv = { invites: { l1: { at: new Date(now - ROOM_INVITE_MS + 1000).toISOString(), by: "h", byName: "H", name: "L1", avatar: "" } } };
assert.ok(inviteFor(inv, "l1", now)); assert.equal(inviteFor(inv, "l1", now + 2000), null, "lapsed"); assert.equal(inviteFor(inv, "l2", now), null);
// permissions: the host all; a moderator what was ticked; the presets; unknown ones dropped
assert.deepEqual(cleanPerms(["mic", "x", "approve"]), ["approve", "mic"]);
assert.deepEqual(cleanPerms(undefined), MOD_PRESETS[0].perms, "Basic by default");
assert.equal(MOD_PRESETS[1].perms.includes("end"), false, "Full leaves ending the live with the host");
const modRoom = { hostUid: "h", mods: { b: { name: "B", avatar: "", perms: MOD_PRESETS[0].perms }, b2: { name: "B2", avatar: "", perms: MOD_PRESETS[0].perms }, f: { name: "F", avatar: "", perms: MOD_PRESETS[1].perms } } };
assert.deepEqual(permsOf(modRoom, "h"), ALL_MOD_PERMS); assert.deepEqual(permsOf(modRoom, "l1"), []);
assert.equal(roomCan(modRoom, "b", "mic"), true); assert.equal(roomCan(modRoom, "b", "mode"), false); assert.equal(roomCan(modRoom, "f", "mode"), true);
assert.equal(strictlyWithin(["a"], ["a", "b"]), true); assert.equal(strictlyWithin(["a", "b"], ["a", "b"]), false); assert.equal(strictlyWithin(["c"], ["a", "b"]), false);
assert.equal(mayActOn(modRoom, "b", "h"), false, "never the host");
assert.equal(mayActOn(modRoom, "h", "f"), true, "the host over anyone");
assert.equal(mayActOn(modRoom, "b", "l1"), true, "a moderator over a listener");
assert.equal(mayActOn(modRoom, "b", "b2"), false, "equal say: no");
assert.equal(mayActOn(modRoom, "f", "b"), true, "Full over Basic");
assert.equal(mayActOn(modRoom, "b", "f"), false, "Basic over Full: no");
// a microphone turned off: not sent, not pulled
const relayRoom = { hostUid: "h", speakers: ["s1"], joined: { h: p(), s1: p(), l1: p() }, status: "live" as const, mode: "relay" as const, published: { h: "t1", s1: "t2" }, micMuted: { s1: "t3" } };
assert.equal(canPush(relayRoom, "s1", now), false); assert.equal(canPush(relayRoom, "h", now), true);
assert.deepEqual(pullsFor(relayRoom, "l1", now).map((x) => x.uid), ["h"]);
console.log("ALL OK");
