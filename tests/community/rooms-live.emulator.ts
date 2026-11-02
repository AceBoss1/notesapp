// Live mode in a relay room against the Firestore emulator, with the stand-in Cloudflare client of rooms-relay.emulator.ts (no network):
// the poster, the host's camera as a second track, speakers' video only when the host allows, viewers pulling video, off without
// reconnecting, the video minutes counted by the server (idempotent), the drop prompt from the listener samples, the budget's grace
// and enforcement, and the clean-up when the room ends.
// Run: npm run test:rooms-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import * as L from "../../lib/rooms-live-server";
import { CHALLENGE_POSTER } from "../../lib/rooms-live";
import type { RoomDoc, RoomRelayRecord } from "../../lib/rooms";
import type { RelayClient, Sdp } from "../../lib/rooms-relay-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof C.CommunityError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const user = (uid: string, extra: Record<string, unknown> = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: "basic", ...extra });

type Log = { op: string; sessionId?: string; detail?: unknown };
const log: Log[] = [];
let sessions = 0;
const offer: Sdp = { type: "offer", sdp: "v=0 browser-offer" };
const fake: RelayClient = {
  async newSession() { log.push({ op: "new" }); return `sess-${++sessions}`; },
  async push(sessionId, o, tracks) { log.push({ op: "push", sessionId, detail: tracks }); return { answer: { type: "answer", sdp: "v=0 sfu-answer" }, tracks: tracks.map((t) => ({ location: "local" as const, ...t })) }; },
  async pull(sessionId, tracks) { log.push({ op: "pull", sessionId, detail: tracks }); return { offer: { type: "offer", sdp: "v=0 sfu-offer" }, renegotiate: true, tracks: tracks.map((t, i) => ({ location: "remote" as const, mid: String(20 + i), ...t })) }; },
  async renegotiate(sessionId, a) { log.push({ op: "renegotiate", sessionId, detail: a }); },
  async close(sessionId, mids) { log.push({ op: "close", sessionId, detail: mids }); },
};
const deps: R.RoomDeps = { relay: () => fake };
const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
const rec = async (id: string, uid: string) => (await db.doc(`communityRooms/${id}/relay/${uid}`).get()).data() as RoomRelayRecord | undefined;
const state = (id: string) => L.readLive(db, id);

(async () => {
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "token";
  // NEXT_PUBLIC_R2_PUBLIC_URL=https://media.test is set by the npm script (public settings are read when lib/config.ts loads).
  R.resetRoomSettingsCache();
  await R.saveRoomSettings(db, {}, "admin");
  await Promise.all([user("host", { avatar: "https://media.test/avatars/host/me.webp" }), user("spk"), user("l1"), user("l2"), user("bare")]);
  await db.doc("publisherSettings/host").set({ session: { enabled: true } });
  const c = await C.createCommunity(db, "host", { name: "Live Chapel" });
  await Promise.all(["spk", "l1", "l2", "bare"].map((u) => db.doc(`communityMembers/${c.id}_${u}`).set({ cid: c.id, uid: u, role: "member", status: "active", joinedAt: new Date().toISOString() })));

  // ── a poster chosen at the start; the host's "Book a session" stays in view ──
  await fails(R.startRoom(db, "host", c.id, "Bad poster", new Date(), deps, { source: "upload", url: "https://elsewhere.test/x.webp" }), 400);
  const T = Date.now();
  const t = (secs: number) => new Date(T + secs * 1000);
  const { id, mode } = await R.startRoom(db, "host", c.id, "Live night", t(0), deps, { source: "challenge" });
  assert.equal(mode, "relay");
  let r = await roomDoc(id);
  assert.equal(r.poster, CHALLENGE_POSTER); assert.equal(r.hostBooks, true); assert.equal(r.hostUsername, "host");
  assert.deepEqual(r.videoOn, {}); assert.equal(r.stageVideo, false);
  for (const u of ["spk", "l1", "l2"]) await R.joinRoom(db, u, id, t(1));
  await R.setSpeaker(db, "host", id, "spk", true, t(2), deps);
  // the poster changes: the host's own upload folder only, the profile picture, or none; only the host
  assert.deepEqual(await R.setPoster(db, "host", id, "upload", "https://media.test/posters/host/1-p.webp"), { poster: "https://media.test/posters/host/1-p.webp" });
  await fails(R.setPoster(db, "host", id, "upload", "https://media.test/posters/spk/1-p.webp"), 400, /Upload the poster/);
  await fails(R.setPoster(db, "spk", id, "challenge", null), 403);
  assert.deepEqual(await R.setPoster(db, "host", id, "profile", null), { poster: "https://media.test/avatars/host/me.webp" });
  await fails(R.posterFor(db, "bare", "profile", null), 400, /profile picture/);
  await fails(R.setPoster(db, "host", id, "video", null), 400);
  await R.setPoster(db, "host", id, "none", null);
  assert.equal((await roomDoc(id)).poster, undefined);
  await R.setPoster(db, "host", id, "challenge", null);

  // ── the host's microphone, then the camera as a second track on the same session ──
  const step = (uid: string, body: Record<string, unknown>, secs: number) => R.relayStep(db, uid, id, body, t(secs), deps);
  await step("host", { op: "push", offer, mid: "0", fresh: true }, 3);
  log.length = 0;
  const up = await step("host", { op: "video", offer, mid: "1" }, 4);
  assert.equal(up.answer?.type, "answer");
  assert.deepEqual(log.map((x) => x.op), ["push"], "no new session: the same connection");
  const hostRec = (await rec(id, "host"))!;
  assert.match(hostRec.video!.trackName, /^host-cam-/); assert.equal(hostRec.video!.mid, "1"); assert.equal(hostRec.push?.mid, "0", "the microphone stays");
  assert.equal((await roomDoc(id)).videoOn?.host, t(4).toISOString());
  assert.equal(up.host?.minutesLeft, 15); assert.equal(up.host?.videoOn, true);
  assert.ok(!JSON.stringify(await roomDoc(id)).includes("-cam-"), "the room (read by everyone) never names a track");

  // listeners and speakers can't turn video on unless allowed; a listener receives the host's camera
  await fails(step("l1", { op: "video", offer, mid: "0", fresh: true }, 5), 403);
  await fails(step("spk", { op: "video", offer, mid: "1", fresh: true }, 5), 403, /when the host allows/);
  await fails(R.setStageVideo(db, "spk", id, true, t(5), deps), 403);
  log.length = 0;
  const pv = await step("l1", { op: "pull", uids: ["host", "spk"], video: true, fresh: true }, 6);
  assert.deepEqual(pv.tracks, [{ uid: "host", mid: "20", kind: "video" }], "only cameras that are up");
  assert.deepEqual((log.find((x) => x.op === "pull")!.detail as { trackName: string }[]).map((x) => x.trackName), [hostRec.video!.trackName]);
  const pa = await step("l1", { op: "pull", uids: ["host"] }, 6);
  assert.deepEqual(pa.tracks, [{ uid: "host", mid: "20" }], "the microphone is pulled apart (Audio only pulls just this)");

  // the host allows speakers: spk's camera goes up; taking it back cuts it at Cloudflare and stops its minutes
  await R.setStageVideo(db, "host", id, true, t(7), deps);
  await step("spk", { op: "pull", uids: ["host"], fresh: true }, 8);
  await step("spk", { op: "video", offer, mid: "2" }, 8);
  assert.ok((await roomDoc(id)).videoOn?.spk);
  log.length = 0;
  await R.setStageVideo(db, "host", id, false, t(18), deps);
  assert.equal((await roomDoc(id)).videoOn?.spk, undefined); assert.equal((await rec(id, "spk"))!.video, null);
  assert.deepEqual(log.filter((x) => x.op === "close").map((x) => x.detail), [["2"]]);
  let st = await state(id);
  assert.equal(st.usedMs, 10_000, "spk's 10 seconds are counted"); assert.ok(st.open.host);

  // the host goes back to sound only (no reconnecting): the camera is closed, the minutes stop
  await R.beatRoom(db, "host", id, t(50), deps); // the host stays present
  log.length = 0;
  const down = await step("host", { op: "unvideo" }, 64);
  assert.deepEqual(log, [{ op: "close", sessionId: hostRec.sessionId, detail: ["1"] }]);
  assert.deepEqual((await roomDoc(id)).videoOn, {}); assert.equal((await rec(id, "host"))!.push?.mid, "0", "the microphone carries on");
  st = await state(id);
  assert.equal(st.usedMs, 10_000 + 60_000); assert.deepEqual(st.open, {});
  assert.equal(down.host?.minutesLeft, 13, "15 less 70 seconds: 13 whole minutes");
  // idempotent: a second off (or one from a retry) counts nothing more
  await step("host", { op: "unvideo" }, 90);
  await L.markVideoOff(db, id, ["host", "spk"], t(95));
  assert.equal((await state(id)).usedMs, 70_000);

  // ── the drop prompt: from the listener samples, only while video is off and minutes are left ──
  const S = await R.getRoomSettings(db);
  await L.noteListenerSample(db, id, 100, S, t(65));
  await L.noteListenerSample(db, id, 99, S, t(70)); // within 15 s: ignored
  await L.noteListenerSample(db, id, 85, S, t(81));
  assert.deepEqual((await state(id)).samples.slice(-2).map((x) => x.n), [100, 85], "one sample per count window");
  assert.deepEqual(await R.beatRoom(db, "l1", id, t(82), deps), { live: true }, "a listener's beat carries nothing more");
  const b1 = await R.beatRoom(db, "host", id, t(83), deps);
  assert.equal(b1.host?.prompt?.kind, "drop"); assert.equal(b1.host?.prompt?.text, "Listeners are dropping. Try 2 minutes of video?");
  assert.equal((await R.beatRoom(db, "host", id, t(90), deps)).host?.prompt, null, "once per drop window");
  await fails(R.roomLiveStatus(db, "l1", id), 403);

  // ── the budget: used up → the host is told, video goes off after the grace, and no camera can go up again ──
  await R.saveRoomSettings(db, { videoBudgetMinutes: 2, videoGraceSeconds: 10 }, "admin");
  const v3 = await step("host", { op: "video", offer, mid: "3" }, 100); // 70 s used; 50 s left
  assert.equal(v3.host?.prompt?.kind, "back", "few minutes left: back to audio, said as the camera goes up");
  assert.equal((await R.beatRoom(db, "host", id, t(140), deps)).host?.prompt, null, "once per burst");
  const b3 = await R.beatRoom(db, "host", id, t(151), deps);
  assert.equal(b3.host?.prompt?.kind, "budget"); assert.match(b3.host!.prompt!.text, /turns off in 10 seconds/);
  assert.equal(b3.host?.graceUntil, t(161).toISOString()); assert.equal(b3.host?.minutesLeft, 0);
  assert.ok((await roomDoc(id)).videoOn?.host, "still on during the grace");
  log.length = 0;
  const b4 = await R.beatRoom(db, "host", id, t(162), deps);
  assert.equal(b4.host?.videoOn, false); assert.deepEqual((await roomDoc(id)).videoOn, {});
  assert.deepEqual(log.filter((x) => x.op === "close").map((x) => x.detail), [["3"]], "cut at Cloudflare");
  const used = (await state(id)).usedMs;
  assert.equal(used, 70_000 + 62_000);
  log.length = 0;
  await fails(step("host", { op: "video", offer, mid: "5" }, 170), 409, /video minutes are used up/);
  assert.equal(log.filter((x) => x.op === "push").length, 0, "refused before Cloudflare hears of it");
  assert.equal((await roomDoc(id)).poster, CHALLENGE_POSTER, "the poster carries on");

  // ── Live mode switched off by an admin: no camera at all ──
  await R.saveRoomSettings(db, { videoOn: false }, "admin");
  await fails(step("host", { op: "video", offer, mid: "6" }, 171), 403, /switched off/);
  await R.saveRoomSettings(db, {}, "admin");

  // ── ending: the minutes are kept on the room, the live state goes ──
  await R.closeRoom(db, "host", id, t(175));
  r = await roomDoc(id);
  assert.equal(r.videoUsedMs, used); assert.deepEqual(r.videoOn, {});
  assert.equal((await db.collection(`communityRooms/${id}/live`).get()).size, 0);
  // a camera on when the room ends is counted up to the end
  const { id: id2 } = await R.startRoom(db, "host", c.id, "Second", t(200), deps);
  await R.relayStep(db, "host", id2, { op: "video", offer, mid: "1", fresh: true }, t(201), deps);
  await R.closeRoom(db, "host", id2, t(231));
  assert.equal((await roomDoc(id2)).videoUsedMs, 30_000);
  // a room started without a poster has none; a host without sessions has no Book a session
  await db.doc("publisherSettings/host").set({ session: { enabled: false } });
  const { id: id3 } = await R.startRoom(db, "host", c.id, "Third", t(240), deps);
  assert.equal((await roomDoc(id3)).poster, undefined); assert.equal((await roomDoc(id3)).hostBooks, false);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
