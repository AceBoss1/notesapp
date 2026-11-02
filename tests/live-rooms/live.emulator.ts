// The live-rooms worker's server side against the Firestore emulator (lib/live-rooms-server.ts, the hooks in lib/rooms-server.ts):
// rooms open on the worker when it's set; tokens only for people the room let in, with the role the room gives them, and never past a
// ban; the worker's signed batches write the chat's record, removals, bans and the count; stage moves, server-sent chat, removals and
// the end are pushed to the room. The last part runs a real LiveRoom (in memory, tests/live-rooms/fakes.ts) wired to our server's code,
// so a message over the socket ends up in Firestore. Run: npm run test:live-rooms-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import * as S from "../../lib/live-rooms-server";
import { liveRoomsOn, setLiveTransport } from "../../lib/live-rooms-edge";
import { LIVE_SIG_HEADER, signBody, verifyLiveToken } from "../../lib/live-token";
import type { LiveBatch, LiveServerOp } from "../../lib/live-rooms";
import { EDGE_STALE_MS } from "../../lib/rooms";
import { markVideoOff, markVideoOn, readLive } from "../../lib/rooms-live-server";
import type { ListenTime } from "../../lib/live-rooms-server";
import type { RelayClient } from "../../lib/rooms-relay-server";
import type { RoomDoc } from "../../lib/rooms";
import { LiveRoom } from "../../workers/live-rooms/src/room";
import type { Env } from "../../workers/live-rooms/src/cf";
import { FakeState, FakeWS } from "./fakes";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const SECRET = process.env.LIVE_ROOMS_SECRET!;
assert.ok(SECRET && process.env.NEXT_PUBLIC_LIVE_ROOMS_URL, "run through npm run test:live-rooms-server (it sets the two settings)");
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof C.CommunityError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const user = (uid: string) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: "basic", avatar: `https://img/${uid}.png` });
const member = (cid: string, uid: string, role = "member") => db.doc(`communityMembers/${cid}_${uid}`).set({ cid, uid, role, status: "active", joinedAt: new Date().toISOString() });
const relay: RelayClient = {
  async newSession() { return "sess"; }, async push() { return { answer: { type: "answer", sdp: "v=0" }, tracks: [] }; },
  async pull() { return { offer: null, renegotiate: false, tracks: [] }; }, async renegotiate() {}, async close() {},
};
const deps: R.RoomDeps = { relay: () => relay };
const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
const chatIds = async (id: string) => (await db.collection(`communityRooms/${id}/chat`).orderBy("at").get()).docs.map((d) => d.id);
// The stand-in worker: records what our server tells each room, or hands it to a real LiveRoom.
const told: { url: string; op: LiveServerOp; sigOk: boolean }[] = [];
let workerUp = true;
let forward: ((req: Request) => Promise<Response>) | null = null;
setLiveTransport(async (url, init) => {
  if (!workerUp) throw new Error("connect ECONNREFUSED");
  const body = String(init.body);
  const { verifyBody } = await import("../../lib/live-token");
  told.push({ url, op: JSON.parse(body), sigOk: await verifyBody(SECRET, body, (init.headers as Record<string, string>)[LIVE_SIG_HEADER]) });
  return forward ? forward(new Request(url, init)) : new Response("{}", { status: 200 });
});
const lastOp = () => told[told.length - 1]?.op;
const batch = async (b: Partial<LiveBatch> & { roomId: string }, at = Date.now(), secret = SECRET) => {
  const raw = JSON.stringify({ chat: [], removed: [], banned: [], ...b });
  return S.ingestLive(db, raw, await signBody(secret, raw, at));
};

(async () => {
  for (const u of ["host", "mod", "l1", "l2", "l3", "outsider"]) await user(u);
  const c = await C.createCommunity(db, "host", { name: "Edge Chapel" });
  for (const u of ["l1", "l2", "l3"]) await member(c.id, u);
  await member(c.id, "mod", "moderator");
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "token";
  R.resetRoomSettingsCache();
  assert.equal(liveRoomsOn(), true);

  // ── a new relay room opens on the worker, which is told its settings and where to report ──
  const room = await R.startRoom(db, "host", c.id, "Big town hall", new Date(), deps);
  const id = room.id;
  assert.equal(room.mode, "relay"); assert.equal((await roomDoc(id)).edge, true);
  const cfg = lastOp();
  assert.equal(cfg?.op, "config"); assert.ok(told[0].sigOk, "signed");
  assert.match(told[0].url, new RegExp(`^https://live\\.test/rooms/${id}/server$`), "the wss setting, as https, for our server's calls");
  assert.ok(cfg?.op === "config" && cfg.config.callback.endsWith("/api/community/rooms/edge") && cfg.config.slowAbove === 200 && cfg.config.slowSeconds === 10 && cfg.config.hostUid === "host");

  // ── tokens: only for people the room let in, with their role now ──
  const host = await S.mintLiveToken(db, "host", id);
  assert.equal(host.url, "wss://live.test");
  const hc = (await verifyLiveToken(SECRET, host.token))!;
  assert.deepEqual([hc.r, hc.u, hc.role, hc.n, hc.mod], [id, "host", "host", "HOST", true]);
  assert.ok(hc.exp * 1000 - Date.now() <= 600_000 && hc.exp * 1000 - Date.now() > 590_000, "ten minutes");
  await fails(S.mintLiveToken(db, "l1", id), 409, /Join the room first/);
  await fails(S.mintLiveToken(db, "outsider", id), 409, /Join/);
  await fails(R.joinRoom(db, "outsider", id), 403);
  await R.joinRoom(db, "l1", id); await R.joinRoom(db, "mod", id);
  const l1 = (await verifyLiveToken(SECRET, (await S.mintLiveToken(db, "l1", id)).token))!;
  assert.deepEqual([l1.role, l1.mod, l1.a], ["listener", false, "https://img/l1.png"]);
  assert.equal((await verifyLiveToken(SECRET, (await S.mintLiveToken(db, "mod", id)).token))!.mod, true, "moderators may moderate the chat");
  await fails(S.mintLiveToken(db, "l1", "nope"), 404);
  const configs = told.filter((t) => t.op.op === "config").length;
  assert.equal(configs, 2, "the config again with the first token (then at most every 10 minutes)");

  // ── the cap: joining is what lets you in, and the worker's live count counts too ──
  await R.saveRoomSettings(db, { relayListeners: 3, chatSlowAbove: 50 }, "admin");
  const pushed = lastOp();
  assert.ok(pushed?.op === "config" && pushed.config.slowAbove === 50, "changed settings reach rooms on the worker at once");
  await fails(batch({ roomId: id, count: 3 }, Date.now(), "wrong-secret-wrong-secret"), 401);
  await fails(S.ingestLive(db, JSON.stringify({ roomId: id }), null), 401);
  assert.equal((await batch({ roomId: id, count: 3, peak: 4 })).counted, true);
  let r = await roomDoc(id);
  assert.equal(r.listening, 3); assert.ok(r.edgeAt); assert.equal(r.peak, 4, "the stage (1) and the 3 connected");
  await fails(R.joinRoom(db, "l2", id), 409, /full: 3/);
  await R.saveRoomSettings(db, {}, "admin");
  await R.joinRoom(db, "l2", id);

  // the worker reports the count, so our server doesn't recount people/ while it's fresh, and does once it isn't
  const later = new Date(Date.now() + 16_000);
  assert.equal(await R.recount(db, id, later), null, "the edge's count stands");
  // the edge went quiet: listeners' apps heartbeat again (they fall back), and our server counts people/ again
  const quiet = new Date(Date.now() + EDGE_STALE_MS + 1000);
  for (const u of ["host", "l1", "mod", "l2"]) assert.equal((await R.beatRoom(db, u, id, quiet, deps)).live, true);
  assert.equal(await R.recount(db, id, quiet, true), 3, "counted from people/ again");
  assert.ok((await readLive(db, id)).samples.length >= 1, "Live mode's drop prompt got its samples from the worker's counts");

  // ── chat batches: the record in Firestore, removals, bans ──
  const t0 = Date.now();
  const m = (n: number, from: string, text: string) => ({ id: `${String(t0 + n).padStart(13, "0")}_e${n}`, from, name: from.toUpperCase(), avatar: "", text, at: new Date(t0 + n).toISOString() });
  const w = await batch({ roomId: id, chat: [m(1, "l1", "Amen"), m(2, "l2", "Hello"), m(3, "l2", "   "), { ...m(4, "l1", "x"), id: "../../bad" }, m(5, "l1", "y".repeat(800))] });
  assert.deepEqual([w.wrote, w.counted], [3, false], "empty and bad ids skipped");
  assert.deepEqual(await chatIds(id), [m(1, "", "").id, m(2, "", "").id, m(5, "", "").id]);
  assert.equal((await db.doc(`communityRooms/${id}/chat/${m(5, "", "").id}`).get()).data()!.text.length, 500);
  await batch({ roomId: id, chat: [m(1, "l1", "Amen")] }); assert.equal((await chatIds(id)).length, 3, "the same message twice is one message");
  await batch({ roomId: id, removed: [m(2, "", "").id], banned: ["l2", "host"] });
  assert.equal((await chatIds(id)).length, 2, "removed");
  await fails(S.mintLiveToken(db, "l2", id), 403, /removed from this room/);
  assert.ok((await S.mintLiveToken(db, "host", id)).token, "the host can't be banned");
  assert.equal((await batch({ roomId: "1_unknown" })).ignored, "not a live-rooms room", "a room we don't know: accepted and ignored, so the worker stops");

  // ── presence without heartbeats: the worker's join/leave reports, and each person's listening time ──
  const s0 = Date.now();
  const ses = (u: string, e: "in" | "out", at: number) => ({ u, e, at, role: "listener" as const });
  const sr = await batch({ roomId: id, count: 2, sessions: [ses("l1", "in", s0), ses("mod", "in", s0), ses("l1", "out", s0 + 60_000), ses("l1", "in", s0 + 70_000), ses("mod", "out", s0 + 5_000), ses("bad/uid", "in", s0)] });
  assert.equal(sr.sessions, 5, "a bad uid is skipped");
  const lt = async (u: string) => (await db.doc(`communityRooms/${id}/listenTime/${u}`).get()).data() as ListenTime;
  assert.deepEqual([(await lt("l1")).ms, (await lt("l1")).sessions, (await lt("l1")).open], [60_000, 2, true], "l1: a minute, then back in");
  assert.deepEqual([(await lt("mod")).ms, (await lt("mod")).open], [5_000, false]);
  const person = async (u: string) => (await db.doc(`communityRooms/${id}/people/${u}`).get()).data()!;
  assert.equal((await person("l1")).edgeIn, true); assert.equal((await person("mod")).edgeIn, false);
  assert.equal((await db.doc(`communityRooms/${id}/edge/state`).get()).data()!.count, 2, "the exact count, for the cap");
  assert.equal((await roomDoc(id)).listening, 3, "the room doc (read by everyone) only every minute");
  // a connected listener's beat writes nothing; minutes later they're still here (tokens, pulls, Bring up) without a heartbeat
  const seenBefore = (await person("l1")).seen;
  const in90 = new Date(Date.now() + 90_000);
  assert.deepEqual(await R.beatRoom(db, "l1", id, in90, deps), { live: true });
  assert.equal((await person("l1")).seen, seenBefore, "no heartbeat write");
  assert.ok((await S.mintLiveToken(db, "l1", id, in90)).token, "still here: connected to the worker");
  await fails(S.mintLiveToken(db, "mod", id, new Date(Date.now() + 10 * 60_000)), 409, /Join/, );
  // raised hands are kept by our server, and the host's beat brings them (for when the host's socket is down)
  const hand = { name: "L1", avatar: "", at: new Date().toISOString() };
  await batch({ roomId: id, hands: { l1: hand, mod: hand } });
  await batch({ roomId: id, hands: { mod: null } });
  assert.deepEqual((await R.beatRoom(db, "host", id, new Date(), deps)).hands, { l1: hand }, "the host's beat carries the hands");

  // ── what our server pushes: the stage, chat sent through the server, removals ──
  await R.setSpeaker(db, "host", id, "l1", true, new Date(), deps);
  assert.deepEqual(lastOp(), { op: "role", uid: "l1", role: "speaker" });
  assert.equal((await db.doc(`communityRooms/${id}/edge/state`).get()).data()!.hands?.l1, undefined, "brought up: the kept hand goes");
  assert.equal((await verifyLiveToken(SECRET, (await S.mintLiveToken(db, "l1", id)).token))!.role, "speaker");
  await R.setSpeaker(db, "host", id, "l1", false, new Date(), deps);
  assert.deepEqual(lastOp(), { op: "role", uid: "l1", role: "listener" });
  await R.sendRoomChat(db, "mod", id, "Through the server");
  const sent = lastOp();
  assert.ok(sent?.op === "chat" && sent.m.text === "Through the server" && sent.m.from === "mod");
  assert.ok(sent?.op === "chat" && (await chatIds(id)).includes(sent.m.id), "the same id as in Firestore (so a removal finds it)");
  await R.removeChat(db, "host", id, sent?.op === "chat" ? sent.m.id : "");
  assert.deepEqual(lastOp(), { op: "unchat", id: sent?.op === "chat" ? sent.m.id : "" });
  // cameras: 2a's server state decides, and the worker mirrors it
  const settings = await R.getRoomSettings(db);
  await markVideoOn(db, id, "host", settings);
  assert.deepEqual(lastOp(), { op: "video", uid: "host", on: true });
  await markVideoOff(db, id, ["host"]);
  assert.deepEqual(lastOp(), { op: "video", uid: "host", on: false });
  // the worker down: the room carries on through Firestore
  workerUp = false;
  await R.sendRoomChat(db, "mod", id, "Worker down, still sent");
  assert.ok((await db.collection(`communityRooms/${id}/chat`).where("text", "==", "Worker down, still sent").get()).size === 1);
  workerUp = true;

  // ── end to end: a real LiveRoom (in memory) between the browsers and our server ──
  const state = new FakeState();
  const lr = new LiveRoom(state, { LIVE_ROOMS_SECRET: SECRET } as Env);
  lr.upgrade = () => { const server = new FakeWS(); return { client: null, server, response: () => new Response(null, { status: 200 }) }; };
  lr.post = async (_url, init) => {
    try { return Response.json(await S.ingestLive(db, String(init.body), (init.headers as Record<string, string>)[LIVE_SIG_HEADER])); }
    catch (e) { return new Response(String(e), { status: e instanceof C.CommunityError ? e.status : 500 }); }
  };
  forward = (req) => lr.fetch(req);
  // a fresh config reaches the object through our server's own call
  await R.saveRoomSettings(db, {}, "admin");
  const open = async (uid: string) => {
    const t = await S.mintLiveToken(db, uid, id);
    const before = state.sockets.length;
    const res = await lr.fetch(new Request(`https://live.test/rooms/${id}/ws?t=${encodeURIComponent(t.token)}`, { headers: { upgrade: "websocket" } }));
    assert.equal(res.status, 200, `${uid} connects`);
    return state.sockets[before];
  };
  const hs = await open("host"), ls = await open("l1"), ms = await open("mod");
  await R.joinRoom(db, "l3", id); const l3 = await open("l3");
  await lr.webSocketMessage(ls, JSON.stringify({ t: "chat", text: "Over the socket" }));
  assert.equal(hs.last("chat")!.m.text, "Over the socket");
  await lr.webSocketMessage(l3, JSON.stringify({ t: "hand", up: true }));
  assert.equal(hs.last("hand")!.uid, "l3");
  // the host brings l3 up through our server: the object hears it from us
  await R.setSpeaker(db, "host", id, "l3", true, new Date(), deps);
  assert.deepEqual(ls.last("stage"), { t: "stage", uid: "l3", role: "speaker" });
  assert.deepEqual(hs.last("hand"), { t: "hand", uid: "l3", up: false });
  await lr.webSocketMessage(ms, JSON.stringify({ t: "chat", text: "From the moderator" }));
  const doomed = hs.last("chat")!.m.id;
  await lr.webSocketMessage(ms, JSON.stringify({ t: "chat", text: "Kept" }));
  // the alarm: the batch reaches our server, and the count lands on the room doc
  await new Promise((res) => setTimeout(res, 5));
  await lr.alarm(); // the count, the first time
  const keptAfterFirst = await chatIds(id);
  assert.equal((await db.doc(`communityRooms/${id}/edge/state`).get()).data()!.count, 2, "l1 and mod connected as listeners (l3 is on stage)");
  await lr.webSocketMessage(hs, JSON.stringify({ t: "del", id: doomed }));
  lr.now = () => Date.now() + 4000; await lr.alarm();
  const ids = await chatIds(id);
  const texts = (await db.collection(`communityRooms/${id}/chat`).orderBy("at").get()).docs.map((d) => d.get("text"));
  assert.ok(texts.includes("Over the socket") && texts.includes("Kept"), "the socket's chat is in Firestore");
  assert.ok(!ids.includes(doomed), "and the removed one isn't (removed before or after it was written)");
  assert.ok(keptAfterFirst.length <= ids.length + 1);

  // ── the end: the object is told, everyone is closed, and the final peak is kept ──
  await R.closeRoom(db, "host", id);
  assert.equal(lastOp()?.op, "end");
  assert.deepEqual(ls.last("ended"), { t: "ended" }); assert.equal(ls.closed?.code, 4000);
  assert.equal((await roomDoc(id)).status, "ended");
  assert.ok(((await db.doc(`communityRooms/${id}/edge/state`).get()).data()?.finalPeak ?? 0) >= 4, "the room's final peak, for the records");
  await fails(S.mintLiveToken(db, "l1", id), 410);
  assert.equal((await db.collection(`communityRooms/${id}/listenTime`).where("open", "==", true).get()).size, 0, "every session closed at the end");
  assert.ok((await lt("l1")).ms >= 60_000 && (await lt("host")).sessions >= 1, "listening time kept after the room (for the challenge's records)");
  forward = null;

  // ── switched off (no secret): new rooms don't use the worker, and nothing is signed or accepted ──
  delete process.env.LIVE_ROOMS_SECRET;
  assert.equal(liveRoomsOn(), false);
  const plain = await R.startRoom(db, "host", c.id, "Plain relay room", new Date(), deps);
  assert.equal((await roomDoc(plain.id)).edge, undefined);
  await fails(S.mintLiveToken(db, "host", plain.id), 409);
  const raw = JSON.stringify({ roomId: plain.id, count: 9 });
  await fails(S.ingestLive(db, raw, await signBody(SECRET, raw)), 401, /signature/);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
