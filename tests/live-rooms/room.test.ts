// The LiveRoom Durable Object (workers/live-rooms/src/room.ts) against a small in-memory stand-in for the Workers runtime: storage with
// an alarm, hibernatable sockets with attachments and tags, and a recording fetch for our server. A second LiveRoom on the same state
// stands in for the object waking from hibernation. Run: npm run test:live-rooms → "ALL OK".
import assert from "node:assert/strict";
import { LiveRoom } from "../../workers/live-rooms/src/room";
import type { Env } from "../../workers/live-rooms/src/cf";
import { FakeState, FakeWS } from "./fakes";
import { LIVE_SIG_HEADER, signBody, signLiveToken, verifyBody, type LiveClaims } from "../../lib/live-token";
import { LIVE_BATCH_MS, LIVE_COUNT_PUSH_MS, LIVE_FRAME_MAX, type LiveBatch, type LiveConfig, type LiveServerMsg, type LiveServerOp } from "../../lib/live-rooms";

const SECRET = "test-secret-test-secret-room";
let clock = Date.parse("2026-11-02T10:00:00Z");
const state = new FakeState();
const env = { LIVE_ROOMS_SECRET: SECRET } as Env;
const posts: { url: string; body: LiveBatch; sigOk: boolean }[] = [];
let serverUp = true;
const make = () => {
  const room = new LiveRoom(state, env);
  room.now = () => clock;
  let n = 0;
  room.rand = () => `r${++n}`;
  room.post = async (url, init) => {
    const body = String(init.body);
    const sigOk = await verifyBody(SECRET, body, (init.headers as Record<string, string>)[LIVE_SIG_HEADER], clock);
    posts.push({ url, body: JSON.parse(body), sigOk });
    return new Response("{}", { status: serverUp ? 200 : 500 });
  };
  room.upgrade = () => { const server = new FakeWS(); return { client: null, server, response: () => new Response(null, { status: 200 }) }; };
  return room;
};
let room = make();
const ROOM = "1700000000000_abcde";
const token = (u: string, role: LiveClaims["role"], extra: Partial<LiveClaims> = {}) =>
  signLiveToken(SECRET, { r: ROOM, u, role, n: u.toUpperCase(), a: "", mod: false, exp: Math.floor(clock / 1000) + 600, ...extra });
const connect = async (u: string, role: LiveClaims["role"], extra: Partial<LiveClaims> = {}, headers: Record<string, string> = { upgrade: "websocket" }) => {
  const before = state.sockets.length;
  const res = await room.fetch(new Request(`https://w.test/rooms/${ROOM}/ws?t=${encodeURIComponent(await token(u, role, extra))}`, { headers }));
  return { res, ws: state.sockets.length > before ? state.sockets[state.sockets.length - 1] : null };
};
const server = async (op: LiveServerOp, sign = true) => {
  const body = JSON.stringify(op);
  return room.fetch(new Request(`https://w.test/rooms/${ROOM}/server`, { method: "POST", body, headers: sign ? { [LIVE_SIG_HEADER]: await signBody(SECRET, body, clock) } : {} }));
};
const say = (ws: FakeWS, m: unknown) => room.webSocketMessage(ws, typeof m === "string" ? m : JSON.stringify(m));
const runAlarm = async () => { assert.ok(state.storage.alarm !== null, "an alarm is set"); clock = Math.max(clock, state.storage.alarm!); await room.alarm(); };

(async () => {
  const config: LiveConfig = { roomId: ROOM, callback: "https://site.test/api/community/rooms/edge", hostUid: "host", slowAbove: 200, slowSeconds: 10 };
  // ── our server's channel: signed only ──
  assert.equal((await server({ op: "config", config }, false)).status, 401, "unsigned: refused");
  assert.equal((await server({ op: "config", config: { ...config, roomId: "other" } })).status, 400, "another room's config");
  assert.equal((await server({ op: "config", config })).status, 200);

  // ── connecting: a valid token for this room, over a WebSocket upgrade ──
  assert.equal((await connect("l1", "listener", {}, {})).res.status, 426, "not a WebSocket");
  assert.equal((await connect("l1", "listener", { r: "elsewhere" })).res.status, 401, "a token for another room");
  assert.equal((await connect("l1", "listener", { exp: Math.floor(clock / 1000) - 1 })).res.status, 401, "expired");
  const bad = await room.fetch(new Request(`https://w.test/rooms/${ROOM}/ws?t=nope`, { headers: { upgrade: "websocket" } }));
  assert.equal(bad.status, 401);
  assert.equal((await room.fetch(new Request("https://w.test/rooms/../ws"))).status, 404);
  const host = (await connect("host", "host")).ws!;
  const spk = (await connect("spk", "speaker")).ws!;
  const l1 = (await connect("l1", "listener")).ws!;
  const l2 = (await connect("l2", "listener")).ws!;
  const mod = (await connect("mod", "listener", { mod: true })).ws!;
  const l1b = (await connect("l1", "listener")).ws!; // a second tab
  assert.deepEqual(state.sockets.map((s) => s.tags), [["host"], ["spk"], ["l1"], ["l2"], ["mod"], ["l1"]], "tagged by uid");
  const hello = l2.last("hello")!;
  assert.equal(hello.you.role, "listener"); assert.equal(hello.count, 0, "the last count broadcast (none yet: the alarm counts, not each join)");
  assert.equal(room.counts().listeners, 3, "people, not tabs: l1, l2, mod");
  // the alarm counts (at most every 2 s) and tells everyone; the first count also goes to our server
  await runAlarm();
  assert.equal(host.last("count")!.n, 3); assert.equal(l1b.last("count")!.n, 3);
  assert.deepEqual([posts.length, posts[0].body.count, posts[0].body.peak], [1, 3, 5]);
  assert.deepEqual((posts[0].body.sessions ?? []).map((e) => `${e.u}:${e.e}:${e.role}`), ["host:in:host", "spk:in:speaker", "l1:in:listener", "l2:in:listener", "mod:in:listener"], "each person's first tab opens their session");
  posts.length = 0;

  // ── chat: broadcast to everyone, kept for our server ──
  await say(l1, { t: "chat", text: "  Amen  ", nonce: "n1" });
  const m1 = host.last("chat")!.m;
  assert.deepEqual([m1.from, m1.name, m1.text], ["l1", "L1", "Amen"]);
  assert.match(m1.id, /^\d{13}_r1$/);
  for (const s of [spk, l1, l2, mod, l1b]) assert.equal(s.last("chat")!.m.id, m1.id, "everyone gets it");
  assert.deepEqual(await state.storage.get(`p:${m1.id}`), m1, "waiting for our server, in storage");
  await say(l1, { t: "chat", text: "   " }); assert.equal(host.all("chat").length, 1, "empty: nothing");
  await say(l1, JSON.stringify({ t: "chat", text: "x".repeat(LIVE_FRAME_MAX) }));
  assert.equal(l1.last("err")!.msg, "That message is too big.");
  await say(l1, "not json"); await say(l1, "ping"); // ignored (the runtime answers "ping" itself)

  // ── slow mode: the host switches it on; listeners wait, the stage doesn't ──
  await say(l1, { t: "slow", on: true }); assert.equal(l1.last("slow"), undefined, "only the host");
  await say(host, { t: "slow", on: true });
  assert.deepEqual(l2.last("slow"), { t: "slow", slow: 10, hostSlow: true });
  clock += 3000;
  await say(l1, { t: "chat", text: "too soon", nonce: "n2" });
  assert.deepEqual(l1.last("err"), { t: "err", msg: "Slow mode is on in this big room: you can send again in 7 seconds.", nonce: "n2", wait: 7 });
  await say(l2, { t: "chat", text: "first from l2" }); assert.equal(host.last("chat")!.m.text, "first from l2", "l2 hasn't sent yet");
  await say(spk, { t: "chat", text: "speakers aren't slowed" }); await say(spk, { t: "chat", text: "again" });
  assert.equal(host.last("chat")!.m.text, "again");
  await say(host, { t: "slow", on: null });
  assert.deepEqual(host.last("slow"), { t: "slow", slow: 0, hostSlow: null }, "automatic: 3 listeners is under 200");
  // the rate limit: a burst of 5, then refused
  for (let i = 0; i < 4; i++) await say(spk, { t: "chat", text: `burst ${i}` });
  assert.match(spk.last("err")!.msg, /sending fast/);

  // ── hands, the stage (from our server only), video ──
  await say(l2, { t: "hand", up: true });
  assert.deepEqual(host.last("hand"), { t: "hand", uid: "l2", up: true, name: "L2", avatar: "", at: new Date(clock).toISOString() });
  await say(spk, { t: "hand", up: true }); assert.equal(host.last("hand")!.uid, "l2", "the stage doesn't raise hands");
  // cameras: our server decides (lib/rooms-live-server.ts markVideoOn/Off) and tells the room; a browser can't say so itself
  await say(spk, { t: "video", on: true }); assert.equal(host.last("video"), undefined, "a browser's own video signal is ignored");
  await server({ op: "video", uid: "spk", on: true }); assert.deepEqual(l1.last("video"), { t: "video", uid: "spk", on: true });
  assert.equal((await server({ op: "role", uid: "l2", role: "speaker" })).status, 200);
  assert.deepEqual(l1.last("stage"), { t: "stage", uid: "l2", role: "speaker" });
  assert.deepEqual(l1.last("hand"), { t: "hand", uid: "l2", up: false }, "brought up: the hand goes down");
  assert.equal((l2.deserializeAttachment() as { role: string }).role, "speaker", "their socket knows");
  assert.equal(room.counts().listeners, 2, "a speaker isn't a listener");
  await server({ op: "video", uid: "l2", on: true }); assert.equal(host.last("video")!.uid, "l2");
  await server({ op: "role", uid: "l2", role: "listener" });
  await server({ op: "video", uid: "l2", on: false });
  assert.deepEqual(host.last("video"), { t: "video", uid: "l2", on: false }, "back to listening: our server takes the camera down");
  assert.deepEqual(l1.last("hello")!.video, {}, "l1 joined before any camera");
  assert.equal((await server({ op: "ping" })).status, 200, "the /status check touches nothing");
  // a reconnect with an older token still gets the role our server gave last
  await server({ op: "role", uid: "l1", role: "speaker" });
  const l1c = (await connect("l1", "listener")).ws!;
  assert.equal(l1c.last("hello")!.you.role, "speaker");
  await server({ op: "role", uid: "l1", role: "listener" });

  // ── moderation: remove, mute, ban (host and moderators only) ──
  const target = host.all("chat").find((x) => x.m.from === "l2")!.m;
  await say(l1, { t: "del", id: target.id }); assert.equal(host.last("del"), undefined, "a listener can't remove");
  await say(mod, { t: "del", id: target.id });
  assert.deepEqual(l1.last("del"), { t: "del", id: target.id });
  assert.equal(await state.storage.get(`p:${target.id}`), undefined, "not sent to our server after all");
  await say(mod, { t: "mute", uid: "host", on: true }); assert.equal(host.last("muted"), undefined, "nobody mutes the host");
  await say(host, { t: "mute", uid: "l2", on: true });
  clock += 20_000;
  await say(l2, { t: "chat", text: "can I?" });
  assert.match(l2.last("err")!.msg, /muted/);
  assert.deepEqual((await connect("mod", "listener", { mod: true })).ws!.last("hello")!.mutedList, ["l2"], "moderators see who is muted (to unmute)");
  assert.equal(l1c.last("hello")!.mutedList, undefined, "listeners don't");
  await say(mod, { t: "mute", uid: "l2", on: false });
  assert.deepEqual(host.last("muted"), { t: "muted", uid: "l2", on: false });
  await say(l2, { t: "chat", text: "unmuted" }); assert.equal(host.last("chat")!.m.text, "unmuted");
  await say(host, { t: "mute", uid: "l2", on: true });
  await say(l2, { t: "hand", up: true }); // a hand, then a ban
  await say(mod, { t: "ban", uid: "l2" });
  assert.deepEqual(l2.closed, { code: 4003, reason: "removed" });
  assert.deepEqual(host.last("hand"), { t: "hand", uid: "l2", up: false });
  assert.equal((await connect("l2", "listener")).res.status, 403, "banned for the room");

  // ── the alarm: the count to the sockets, a signed batch to our server ──
  await runAlarm();
  assert.equal(host.last("count")!.n, 2, "l1 and mod");
  assert.equal(posts.length, 1);
  const p1 = posts[0];
  assert.equal(p1.url, config.callback); assert.ok(p1.sigOk, "signed with the shared secret");
  assert.ok(p1.body.chat.length >= 5 && p1.body.chat.every((c) => c.id !== target.id), "the chat, without the removed one");
  assert.deepEqual(p1.body.banned, ["l2"]); assert.equal(p1.body.count, 2); assert.equal(p1.body.peak, 5, "everyone at once");
  // raised hands' changes, for our server to keep: l2's hand went up, came down when brought up, went up again, came down at the ban
  assert.deepEqual(p1.body.hands, { l2: null });
  // sessions: l1c (a reconnect while l1 was still connected) and the second mod tab didn't open new sessions; the ban closed l2's
  const ev = (b: LiveBatch) => (b.sessions ?? []).map((e) => `${e.u}:${e.e}`);
  assert.deepEqual(ev(p1.body), ["l2:out"]);
  assert.equal([...state.storage.map.keys()].filter((k) => k.startsWith("p:")).length, 0, "sent: no longer waiting");

  // our server down: kept, tried again later with a growing wait
  serverUp = false;
  clock += 25_000;
  await say(l1, { t: "chat", text: "while the site is down" });
  clock += LIVE_BATCH_MS;
  await room.alarm();
  assert.equal(posts.length, 2); assert.equal([...state.storage.map.keys()].filter((k) => k.startsWith("p:")).length, 1, "kept");
  const failedAt = clock;
  clock += 2000; await room.alarm();
  assert.equal(posts.length, 2, "waits before trying again");
  const retryAt = failedAt + 5000;
  assert.ok(state.storage.alarm !== null && state.storage.alarm <= retryAt, "an alarm for the retry");
  for (let i = 0; i < 3; i++) { clock = Math.max(clock, state.storage.alarm!); if (clock >= retryAt) break; await room.alarm(); }
  assert.equal(posts.length, 2, "alarms in the wait don't send (and don't spin)");
  serverUp = true;

  // hibernation: a fresh object on the same state picks up the room from storage and the sockets' attachments
  room = make();
  clock = retryAt; await room.alarm();
  assert.equal(posts.length, 3); assert.equal(posts[2].body.chat[0].text, "while the site is down");
  const late = (await connect("late", "listener")).ws!;
  const recent = late.last("hello")!.recent.map((x) => x.text);
  assert.ok(recent.includes("Amen") && !recent.includes(target.text), "a newcomer sees the recent chat, without removed messages");
  await say(late, { t: "chat", text: "after waking" });
  assert.equal(host.last("chat")!.m.text, "after waking", "the old sockets are still reached");

  // a message our server took (someone on the Firestore fallback) is broadcast, not sent back
  const before = posts.length;
  await server({ op: "chat", m: { id: `${clock}_srv1`, from: "l1", name: "L1", avatar: "", text: "via the server", at: new Date(clock).toISOString() } });
  assert.equal(host.last("chat")!.m.text, "via the server");
  clock += LIVE_COUNT_PUSH_MS; await runAlarm();
  assert.ok(posts.slice(before).every((p) => !p.body.chat.some((c) => c.text === "via the server")), "already in Firestore");

  // a socket closing: its hand goes down once their last tab is gone; the count follows
  await say(late, { t: "hand", up: true });
  late.close(1001); await room.webSocketClose(late);
  assert.deepEqual(host.last("hand"), { t: "hand", uid: "late", up: false });
  l1.close(1001); await room.webSocketClose(l1);
  clock += 2000; await room.alarm();
  assert.equal(host.last("count")!.n, 2, "l1 still has two tabs; late left");

  // ── the stage (lib/rooms.ts "Stage seats"): our server's stage mode, hands, microphones, invitations and the moderators' permissions ──
  const m2 = (await connect("m2", "listener")).ws!;
  const x1 = (await connect("x1", "listener")).ws!;
  await server({ op: "hand", uid: "x1", up: true, name: "X1", avatar: "", at: new Date(clock).toISOString() });
  assert.equal(host.last("hand")!.uid, "x1", "a request through our server reaches the sockets");
  await server({ op: "stagemode", mode: "solo" });
  assert.deepEqual(m2.last("stagemode"), { t: "stagemode", mode: "solo" });
  assert.deepEqual(host.last("hand"), { t: "hand", uid: "x1", up: false }, "Solo: every hand goes down");
  await say(x1, { t: "hand", up: true });
  assert.match(x1.last("err")!.msg, /keeping the stage/, "and none goes up");
  await server({ op: "hand", uid: "x1", up: true, name: "X1" });
  assert.deepEqual(host.last("hand"), { t: "hand", uid: "x1", up: false }, "not even through our server");
  await server({ op: "stagemode", mode: "approve" });
  await say(x1, { t: "hand", up: true });
  assert.equal(host.last("hand")!.up, true);
  await server({ op: "hand", uid: "x1", up: false }); // declined
  assert.deepEqual(host.last("hand"), { t: "hand", uid: "x1", up: false });
  await server({ op: "mic", uid: "spk", on: true });
  assert.deepEqual(x1.last("mic"), { t: "mic", uid: "spk", on: true });
  assert.deepEqual((await connect("x2", "listener")).ws!.last("hello")!.mics, ["spk"], "a newcomer learns whose mic is off");
  await server({ op: "invite", uid: "x1", on: true, by: "HOST" });
  assert.deepEqual(x1.last("invite"), { t: "invite", on: true, by: "HOST" });
  assert.equal(m2.last("invite"), undefined, "only the invited person hears it");
  // a moderator named for the live holds only what the host ticked
  await say(m2, { t: "chat", text: "from m2" });
  await say(host, { t: "chat", text: "from the host" });
  const hostMsg = host.last("chat")!.m.id;
  await say(x1, { t: "chat", text: "from x1" });
  const x1Msg = host.last("chat")!.m.id;
  await say(m2, { t: "del", id: x1Msg });
  assert.notEqual(host.last("del")?.id, x1Msg, "no permission yet: nothing");
  await server({ op: "mods", mods: { m2: ["chatRemove"], x2: ["chatRemove", "chatMute"] } });
  await say(m2, { t: "del", id: x1Msg });
  assert.deepEqual(host.last("del"), { t: "del", id: x1Msg });
  await say(m2, { t: "del", id: hostMsg });
  assert.match(m2.last("err")!.msg, /Only the host/, "never the host's message");
  await say(m2, { t: "mute", uid: "x1", on: true });
  assert.notDeepEqual(host.last("muted"), { t: "muted", uid: "x1", on: true }, "no chat-mute permission");
  await say(m2, { t: "slow", on: true });
  assert.notEqual(host.last("slow")?.hostSlow, true, "no slow-mode permission");
  await say(m2, { t: "ban", uid: "x1" });
  assert.equal(x1.closed, null, "no removal permission");
  await server({ op: "mods", mods: { m2: ["chatRemove", "chatMute", "ban", "slow"], x2: ["chatRemove", "chatMute"] } });
  await say(m2, { t: "slow", on: true });
  assert.equal(host.last("slow")!.hostSlow, true);
  await say(m2, { t: "slow", on: null });
  await say(m2, { t: "mute", uid: "x2", on: true });
  assert.deepEqual(host.last("muted"), { t: "muted", uid: "x2", on: true }, "over a moderator with less say");
  await say((await connect("x2", "listener")).ws!, { t: "ban", uid: "m2" });
  assert.equal(m2.closed, null, "never over one with more say");
  // removed through our server: closed now, kept out (not reported back: our server already has it)
  await server({ op: "ban", uid: "x1" });
  assert.equal((x1.closed as { code?: number } | null)?.code, 4003);
  assert.equal((await connect("x1", "listener")).res.status, 403);
  clock += LIVE_BATCH_MS + LIVE_COUNT_PUSH_MS; await runAlarm();
  const logged = posts.flatMap((p) => p.body.modLog ?? []).map((e) => `${e.by}:${e.action}`);
  for (const want of ["m2:remove a chat message", "m2:slow mode: on", "m2:mute in the chat"]) assert.ok(logged.includes(want), `logged: ${want}`);
  assert.equal(logged.some((x) => x.startsWith("host:")), false);
  assert.equal(posts.flatMap((p) => p.body.banned).includes("x1"), false);

  // ── the end: everyone told and disconnected, the last batch with the peak, and no way back in ──
  await say(l1b, { t: "chat", text: "last word" });
  const n = posts.length;
  await server({ op: "end" });
  assert.deepEqual(host.last("ended"), { t: "ended" }); assert.equal(host.closed?.code, 4000);
  const fin = posts[n];
  assert.equal(fin.body.final, true); assert.equal(fin.body.peak, 6, "the most at once, as the alarm counted (the stage checks brought newcomers)"); assert.equal(fin.body.chat[0].text, "last word");
  const all = posts.flatMap((p) => ev(p.body));
  assert.ok(all.includes("late:in") && all.includes("late:out"), "late came and went");
  for (const u of ["host", "spk", "mod", "l1"]) assert.ok(ev(fin.body).includes(`${u}:out`), `the end closes ${u}'s session`);
  assert.equal([...state.storage.map.keys()].filter((k) => k.startsWith("o:")).length, 0);
  assert.equal((await connect("l1", "listener")).res.status, 410);
  assert.equal(state.storage.alarm, null);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
