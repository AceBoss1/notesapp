// Audio rooms on the Cloudflare relay against the Firestore emulator, with a stand-in Cloudflare client (no network): which mode a room
// opens in, the fallback when Cloudflare fails, who may send and receive, the listener cap from the settings, and the clean-up.
// Run: npm run test:rooms-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import { RelayError, type RelayClient, type Sdp } from "../../lib/rooms-relay-server";
import type { RoomDoc, RoomRelayRecord } from "../../lib/rooms";
import { teamSignals } from "../../lib/team-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof C.CommunityError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const user = (uid: string) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: "basic" });

// The stand-in Cloudflare: records every call, numbers sessions, and can be told to fail.
type Log = { op: string; sessionId?: string; detail?: unknown };
const log: Log[] = [];
let down: string | null = null, sessions = 0;
const offer: Sdp = { type: "offer", sdp: "v=0 browser-offer" }, answer: Sdp = { type: "answer", sdp: "v=0 browser-answer" };
const fake: RelayClient = {
  async newSession() { if (down) throw new RelayError(down); log.push({ op: "new" }); return `sess-${++sessions}`; },
  async push(sessionId, o, tracks) { if (down) throw new RelayError(down); log.push({ op: "push", sessionId, detail: { o, tracks } }); return { answer: { type: "answer", sdp: "v=0 sfu-answer" }, tracks: tracks.map((t) => ({ location: "local" as const, ...t })) }; },
  async pull(sessionId, tracks) { if (down) throw new RelayError(down); log.push({ op: "pull", sessionId, detail: tracks }); return { offer: { type: "offer", sdp: "v=0 sfu-offer" }, renegotiate: true, tracks: tracks.map((t, i) => ({ location: "remote" as const, mid: String(10 + i), ...t })) }; },
  async renegotiate(sessionId, a) { log.push({ op: "renegotiate", sessionId, detail: a }); },
  async close(sessionId, mids) { log.push({ op: "close", sessionId, detail: mids }); },
};
const deps: R.RoomDeps = { relay: () => fake };
const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
const rec = async (id: string, uid: string) => (await db.doc(`communityRooms/${id}/relay/${uid}`).get()).data() as RoomRelayRecord | undefined;
const step = (uid: string, id: string, body: Record<string, unknown>) => R.relayStep(db, uid, id, body, new Date(), deps);

(async () => {
  const ppl = ["host", "spk", "l1", "l2", "l3"];
  await Promise.all([...ppl, "outsider"].map(user));
  const c = await C.createCommunity(db, "host", { name: "Relay Chapel" });
  await Promise.all(ppl.slice(1).map((u) => db.doc(`communityMembers/${c.id}_${u}`).set({ cid: c.id, uid: u, role: "member", status: "active", joinedAt: new Date().toISOString() })));

  // ── without the keys: phone to phone, Cloudflare never called ──
  delete process.env.CLOUDFLARE_REALTIME_APP_ID; delete process.env.CLOUDFLARE_REALTIME_APP_TOKEN;
  R.resetRoomSettingsCache();
  const p2p = await R.startRoom(db, "host", c.id, "Phone room", new Date(), deps);
  assert.equal(p2p.mode, "p2p"); assert.equal(log.length, 0, "no keys: no Cloudflare call");
  assert.equal((await R.joinRoom(db, "l1", p2p.id)).cap, 20);
  await fails(step("host", p2p.id, { op: "push", offer, mid: "0", fresh: true }), 409, /phone to phone/);
  assert.deepEqual(await R.liveRoomFigures(db), { relay: false, listeners: 20, p2pListeners: 20, relayListeners: 500, speakers: 4, chatSlowAbove: 200, chatSlowSeconds: 10 });
  // the Team hub's standing reminder: while the keys are missing, with the figures from the settings
  const reminder = async () => (await teamSignals(db)).find((x) => x.id === "rooms-relay");
  assert.match((await reminder())!.label, /phone to phone \(up to 20 listeners\).*CLOUDFLARE_REALTIME_APP_ID.*up to 500/);

  // ── keys set: a new room uses the relay; the room already open keeps its mode ──
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "token";
  assert.equal((await R.liveRoomFigures(db)).listeners, 500);
  assert.equal(await reminder(), undefined, "keys set: no more nagging");
  const room = await R.startRoom(db, "host", c.id, "Town hall", new Date(), deps); // closes the host's earlier room (one live room per host)
  assert.equal(room.mode, "relay"); assert.equal(room.note, undefined);
  assert.equal((await roomDoc(p2p.id)).status, "ended");
  assert.deepEqual(log.map((l) => l.op), ["new"], "Cloudflare is asked first");
  assert.equal((await db.doc("serverConfig/roomsRelay").get()).data()!.ok, true);
  for (const u of ["spk", "l1", "l2"]) assert.deepEqual(await R.joinRoom(db, u, room.id), { ok: true, mode: "relay", cap: 500 });
  await fails(R.joinRoom(db, "outsider", room.id), 403);

  // ── presence at scale: listeners are in people/, not the room doc; the count is aggregated at most every ROOM_COUNT_EVERY_MS ──
  assert.deepEqual(Object.keys((await roomDoc(room.id)).joined), ["host"], "only the stage beats into the room doc");
  assert.equal((await db.collection(`communityRooms/${room.id}/people`).get()).size, 3);
  assert.equal((await roomDoc(room.id)).listening, 0, "counted at the start; the next count waits for its window");
  assert.equal(await R.recount(db, room.id), null, "not due yet: nobody recounts");
  assert.equal(await R.recount(db, room.id, new Date(), true), 3);
  assert.equal((await roomDoc(room.id)).listening, 3);
  const later = new Date(Date.now() + 16_000);
  assert.deepEqual(await R.beatRoom(db, "l1", room.id, later), { live: true });
  assert.equal((await db.doc(`communityRooms/${room.id}/people/l1`).get()).data()!.seen, later.toISOString(), "a listener beats into their own doc");
  assert.equal((await roomDoc(room.id)).countedAt, later.toISOString(), "a beat after the window recounts");
  assert.equal(await R.recount(db, room.id, new Date(later.getTime() + 1000)), null, "and the next beat in the window doesn't");
  assert.deepEqual(await R.beatRoom(db, "outsider", room.id), { live: false });
  assert.equal((await R.liveRooms(db, "l1", c.id))[0].listening, 4, "the card: the stage plus the count");
  const page = await R.roomPeople(db, "l1", room.id, null);
  assert.deepEqual(page.people.map((x) => x.uid).sort(), ["l1", "l2", "spk"]); assert.equal(page.next, null);
  await fails(R.roomPeople(db, "outsider", room.id, null), 409);
  // a raised hand carries the listener's name for the host
  await R.raiseHand(db, "l2", room.id, true);
  assert.deepEqual((await roomDoc(room.id)).handInfo?.l2, { name: "L2", avatar: "" });
  await R.raiseHand(db, "l2", room.id, false);
  assert.equal((await roomDoc(room.id)).handInfo?.l2, undefined);
  await fails(R.raiseHand(db, "outsider", room.id, true), 409);
  // the chat through the server, with slow mode for listeners once the room is big
  await R.sendRoomChat(db, "l1", room.id, "Amen");
  await R.sendRoomChat(db, "l1", room.id, "Amen again"); // slow mode off: fine
  await db.doc(`communityRooms/${room.id}`).update({ chatSlow: 10 });
  await fails(R.sendRoomChat(db, "l1", room.id, "Too soon"), 429, /Slow mode.*10 seconds/);
  await R.sendRoomChat(db, "l1", room.id, "Later", new Date(Date.now() + 11_000));
  await R.sendRoomChat(db, "host", room.id, "Hosts are never slowed"); await R.sendRoomChat(db, "host", room.id, "Again");
  await fails(R.sendRoomChat(db, "outsider", room.id, "hi"), 409);
  await fails(R.sendRoomChat(db, "l1", room.id, "   "), 400);
  const chat = (await db.collection(`communityRooms/${room.id}/chat`).orderBy("at").get()).docs.map((d) => d.data());
  assert.equal(chat.length, 5); assert.deepEqual([chat[0].from, chat[0].name], ["l1", "L1"]);
  await db.doc(`communityRooms/${room.id}`).update({ chatSlow: 0 });

  // the host sends their microphone: a fresh session, a local track, an answer back, and the room marks them as sending
  log.length = 0;
  const up = await step("host", room.id, { op: "push", offer, mid: "0", fresh: true });
  assert.deepEqual(up.answer, { type: "answer", sdp: "v=0 sfu-answer" });
  assert.deepEqual(log.map((l) => l.op), ["new", "push"]);
  const hostRec = (await rec(room.id, "host"))!;
  assert.equal(hostRec.sessionId, "sess-2"); assert.equal(hostRec.push?.mid, "0"); assert.match(hostRec.push!.trackName, /^host-mic-/);
  assert.ok((await roomDoc(room.id)).published?.host, "the room says the host is sending");
  assert.ok(!JSON.stringify(await roomDoc(room.id)).includes("sess-"), "the room (which members read) never holds a Cloudflare session");

  // a listener may not send; bad offers are refused before Cloudflare hears of them
  await fails(step("l1", room.id, { op: "push", offer, mid: "0", fresh: true }), 403, /host and speakers/);
  await fails(step("host", room.id, { op: "push", offer: { type: "answer", sdp: "x" }, mid: "0" }), 400);
  await fails(step("outsider", room.id, { op: "pull", uids: ["host"], fresh: true }), 409, /Join/);

  // a listener receives the host: their own session, the host's track, Cloudflare's offer, then their answer
  log.length = 0;
  const pulled = await step("l1", room.id, { op: "pull", uids: ["host", "spk", "l2"], fresh: true });
  assert.deepEqual(pulled.tracks, [{ uid: "host", mid: "10" }], "only stage members who are sending");
  assert.equal(pulled.renegotiate, true); assert.equal(pulled.offer?.type, "offer");
  assert.deepEqual(log[1], { op: "pull", sessionId: "sess-3", detail: [{ sessionId: "sess-2", trackName: hostRec.push!.trackName }] });
  await step("l1", room.id, { op: "answer", answer });
  assert.deepEqual(log[2], { op: "renegotiate", sessionId: "sess-3", detail: answer });
  await fails(step("l1", room.id, { op: "pull", uids: ["spk"] }), 409, /Nobody on stage/);

  // the host brings spk up; spk sends on their existing session (not fresh); l1 then pulls spk on the same session
  await R.setSpeaker(db, "host", room.id, "spk", true, new Date(), deps);
  assert.ok((await roomDoc(room.id)).joined.spk, "up on stage: onto the room doc"); assert.equal(await rec(room.id, "nobody"), undefined);
  assert.equal((await db.doc(`communityRooms/${room.id}/people/spk`).get()).exists, false, "and out of people/");
  await step("spk", room.id, { op: "pull", uids: ["host"], fresh: true });
  const spkSession = (await rec(room.id, "spk"))!.sessionId;
  await step("spk", room.id, { op: "push", offer, mid: "3" });
  assert.equal((await rec(room.id, "spk"))!.sessionId, spkSession, "one session for receiving and sending");
  assert.deepEqual((await step("l1", room.id, { op: "pull", uids: ["spk"] })).tracks, [{ uid: "spk", mid: "10" }]);
  assert.equal(log.filter((l) => l.op === "new").length, 1 + 1, "l1's session was reused");

  // moved off stage: no longer marked, their microphone is cut at Cloudflare, and nobody can pull it
  log.length = 0;
  await R.setSpeaker(db, "host", room.id, "spk", false, new Date(), deps);
  assert.equal((await roomDoc(room.id)).published?.spk, undefined);
  assert.deepEqual(log, [{ op: "close", sessionId: spkSession, detail: ["3"] }]);
  assert.equal((await rec(room.id, "spk"))!.push, null);
  assert.equal((await roomDoc(room.id)).joined.spk, undefined, "back with the listeners: off the room doc");
  assert.equal((await db.doc(`communityRooms/${room.id}/people/spk`).get()).exists, true, "and into people/");
  await fails(step("l2", room.id, { op: "pull", uids: ["spk"], fresh: true }), 409);
  await fails(step("spk", room.id, { op: "push", offer, mid: "4" }), 403, /host and speakers/); // back with the listeners: can't send again
  // a listener stops receiving tracks on their own session
  log.length = 0;
  await step("l1", room.id, { op: "close", mids: ["10"] });
  assert.deepEqual(log, [{ op: "close", sessionId: "sess-3", detail: ["10"] }]);

  // ── the cap is the relay setting, read live; someone already in always gets back in ──
  await R.joinRoom(db, "l3", room.id); // listening now: spk (a listener again), l1, l2, l3
  await R.saveRoomSettings(db, { relayListeners: 3 }, "admin");
  await user("l4"); await db.doc(`communityMembers/${c.id}_l4`).set({ cid: c.id, uid: "l4", role: "member", status: "active", joinedAt: new Date().toISOString() });
  await fails(R.joinRoom(db, "l4", room.id), 409, /The room is full: 3 people can listen at a time\./);
  await R.joinRoom(db, "l1", room.id); // a reload
  await R.saveRoomSettings(db, {}, "admin");

  // a speaker leaving: off stage, unmarked, their microphone cut, their session record gone
  await R.setSpeaker(db, "host", room.id, "l2", true, new Date(), deps);
  await step("l2", room.id, { op: "push", offer, mid: "0", fresh: true });
  assert.ok((await roomDoc(room.id)).published?.l2);
  log.length = 0;
  await R.leaveRoom(db, "l2", room.id, new Date(), deps);
  assert.equal((await roomDoc(room.id)).published?.l2, undefined); assert.equal(await rec(room.id, "l2"), undefined);
  assert.equal(log[0]?.op, "close");

  // a Cloudflare failure mid-room: a plain message, and /status learns why
  down = "Cloudflare refused the token: CLOUDFLARE_REALTIME_APP_TOKEN must be the App Token";
  await fails(step("l3", room.id, { op: "pull", uids: ["host"], fresh: true }), 502, /relay didn't answer/);
  assert.match((await db.doc("serverConfig/roomsRelay").get()).data()!.why, /refused the token/);

  // ending: the session records and the listeners go with the room
  await R.closeRoom(db, "host", room.id);
  assert.equal((await db.collection(`communityRooms/${room.id}/relay`).get()).size, 0);
  assert.equal((await db.collection(`communityRooms/${room.id}/people`).get()).size, 0);

  // ── Cloudflare down at the start: the room opens phone to phone, and the host is told ──
  const fb = await R.startRoom(db, "host", c.id, "Fallback room", new Date(), deps);
  assert.equal(fb.mode, "p2p"); assert.match(fb.note!, /phone to phone: up to 20 listeners/);
  assert.equal((await roomDoc(fb.id)).note, fb.note);
  assert.equal((await R.joinRoom(db, "l1", fb.id)).cap, 20);
  down = null;

  // ── switched off by an admin: phone to phone even with the keys ──
  await R.saveRoomSettings(db, { relayOn: false }, "admin");
  log.length = 0;
  assert.equal((await R.startRoom(db, "host", c.id, "Switched off", new Date(), deps)).mode, "p2p");
  assert.equal(log.length, 0);
  assert.equal((await R.liveRoomFigures(db)).relay, false);
  await R.saveRoomSettings(db, {}, "admin");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
