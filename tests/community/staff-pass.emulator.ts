// The staff test pass (lib/staff-pass.ts) against the Firestore emulator, with the stand-in Cloudflare client (no network) and a
// stand-in recorder: only super admins change it, every change is logged, it ends by itself; while it's on a team account skips the
// listener cap (joining any room, and every room it hosts), the video-minutes budget in rooms it hosts, the longest recording and the
// plan switches for recording and publishing replays; members who aren't on the team don't; turning it off puts every limit back.
// Run: npm run test:rooms-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import * as P from "../../lib/staff-pass-server";
import * as S from "../../lib/live-recording-server";
import { saveLimitOverrides, resetLimitCache } from "../../lib/limits-server";
import { ROOM_LISTENERS_CEILING, type RoomDoc } from "../../lib/rooms";
import { STAFF_PASS_RECORDING_HOURS, STAFF_PASS_VIDEO_MINUTES } from "../../lib/staff-pass";
import type { RecordingDoc } from "../../lib/live-recording";
import type { RelayClient, Sdp } from "../../lib/rooms-relay-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => (e instanceof C.CommunityError || e instanceof P.StaffPassError) && (e as { status: number }).status === status && (!re || re.test((e as Error).message)), `expected ${status} ${re ?? ""}`); };
const user = (uid: string, extra: Record<string, unknown> = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: "basic", ...extra });

let sessions = 0;
const offer: Sdp = { type: "offer", sdp: "v=0 browser-offer" };
const relay: RelayClient = {
  async newSession() { return `sp-sess-${++sessions}`; },
  async push(_s, _o, tracks) { return { answer: { type: "answer", sdp: "v=0 sfu-answer" }, tracks: tracks.map((t) => ({ location: "local" as const, ...t })) }; },
  async pull(_s, tracks) { return { offer: { type: "offer", sdp: "v=0 sfu-offer" }, renegotiate: true, tracks: tracks.map((t, i) => ({ location: "remote" as const, mid: String(20 + i), ...t })) }; },
  async renegotiate() {}, async close() {},
};
const starts: Record<string, unknown>[] = [];
const objects = new Map<string, Uint8Array>();
const store = {
  async put(k: string, b: Uint8Array) { objects.set(k, b); }, async get(k: string) { return objects.get(k) ?? null; }, async del(k: string) { objects.delete(k); },
  async createMultipart() { return "up1"; }, async uploadPart(_k: string, _id: string, n: number) { return `etag-${n}`; }, async complete() {}, async abort() {},
  async signedGet(key: string) { return `https://r2.test/${key}`; },
} as unknown as S.RecordingStore;
const recDeps: S.RecordingDeps = {
  ...S.realRecordingDeps(), store: () => store, relay: () => relay,
  recorder: () => ({ async start(b) { starts.push(b); }, async stop() {} }),
  stream: () => ({ async copy() { return "vid-1"; }, async get() { return { ready: true }; }, async remove() {}, async player(u: string) { return `https://player.test/${u}`; } }) as unknown as S.StreamClient,
};
const deps: R.RoomDeps = { relay: () => relay, recording: recDeps };
const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
const OFF = { standard: 0, basic: 0, pro: 0, business: 0, enterprise: 0 };

(async () => {
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "token";
  R.resetRoomSettingsCache(); P.resetStaffPassCache(); resetLimitCache();
  // A small room: two listeners on the relay, one video minute per live.
  await R.saveRoomSettings(db, { relayListeners: 2, videoBudgetMinutes: 1, videoGraceSeconds: 5 }, "admin");
  await db.doc("serverConfig/staffPass").delete();
  await Promise.all([user("sp-host"), user("sp-team", { role: "staff" }), user("sp-teamhost", { role: "staff" }), user("sp-teamhost2", { role: "staff" }), user("sp-host2"), user("sp-writer", { role: "volunteer" }),
    user("sp-gone", { role: "staff", suspended: true }), user("sp-l1"), user("sp-l2"), user("sp-l3"), user("sp-l4")]);
  const c = await C.createCommunity(db, "sp-host", { name: "Pass Chapel" });
  const join = (u: string, role = "member") => db.doc(`communityMembers/${c.id}_${u}`).set({ cid: c.id, uid: u, role, status: "active", joinedAt: new Date().toISOString() });
  await Promise.all([join("sp-team"), join("sp-teamhost", "moderator"), join("sp-teamhost2", "moderator"), join("sp-host2", "moderator"), join("sp-writer"), join("sp-gone"), join("sp-l1"), join("sp-l2"), join("sp-l3"), join("sp-l4")]);
  const T = Date.now();
  const t = (secs: number) => new Date(T + secs * 1000);

  // ── off: the usual limits for everyone, the team too ──
  const a = await R.startRoom(db, "sp-host", c.id, "Ordinary room", t(0), deps);
  assert.equal((await roomDoc(a.id)).staffPass, undefined);
  await R.joinRoom(db, "sp-l1", a.id, t(1));
  await R.joinRoom(db, "sp-l2", a.id, t(1));
  await fails(R.joinRoom(db, "sp-l3", a.id, t(2)), 409, /full/);
  await fails(R.joinRoom(db, "sp-team", a.id, t(2)), 409, /full/);

  // ── only super admins change it; a bad end is refused; every change is logged with who made it ──
  await fails(P.saveStaffPass(db, { uid: "boss2", email: "admin@x.test", super: false }, { on: true }, t(3)), 403);
  await fails(P.saveStaffPass(db, { uid: "boss", email: "boss@x.test", super: true }, { on: true, until: t(-60).toISOString() }, t(3)), 400, /future/);
  await fails(P.saveStaffPass(db, { uid: "boss", email: "boss@x.test", super: true }, { on: true, until: new Date(T + 40 * 86_400_000).toISOString() }, t(3)), 400, /30 days/);
  const on = await P.saveStaffPass(db, { uid: "boss", email: "boss@x.test", super: true }, { on: true }, t(3));
  assert.equal(on.on, true); assert.equal(on.byEmail, "boss@x.test");
  assert.equal(Date.parse(on.until!), t(3).getTime() + 7 * 86_400_000, "7 days by default");
  let log = await P.staffPassLog(db);
  assert.equal(log[0].byEmail, "boss@x.test"); assert.equal(log[0].before, "off"); assert.match(log[0].after, /^on until /);
  P.resetStaffPassCache();
  assert.equal((await P.getStaffPass(db, t(4).getTime())).on, true, "read back from serverConfig/staffPass");

  // ── who it covers: the team (staff, admin, guest writers), never a suspended account or an ordinary member ──
  assert.equal(await P.hasStaffPass(db, "sp-team", t(4)), true);
  assert.equal(await P.hasStaffPass(db, "sp-writer", t(4)), true);
  assert.equal(await P.hasStaffPass(db, "sp-gone", t(4)), false);
  assert.equal(await P.hasStaffPass(db, "sp-l3", t(4)), false);

  // ── joining: a team member gets into a full room (up to the hard ceiling); an ordinary member still doesn't ──
  const tj = await R.joinRoom(db, "sp-team", a.id, t(5));
  assert.equal(tj.cap, ROOM_LISTENERS_CEILING);
  await fails(R.joinRoom(db, "sp-l3", a.id, t(5)), 409, /full/);
  // safety stays: a suspended team account can't join at all
  await fails(R.joinRoom(db, "sp-gone", a.id, t(5)), 403);

  // ── hosting: a team member's room is on the pass: no listener cap below the ceiling, no video budget ──
  const b = await R.startRoom(db, "sp-teamhost", c.id, "Staff test", t(10), deps);
  assert.equal((await roomDoc(b.id)).staffPass, true);
  for (const u of ["sp-l1", "sp-l2", "sp-l3", "sp-l4"]) assert.equal((await R.joinRoom(db, u, b.id, t(11))).cap, ROOM_LISTENERS_CEILING);
  const step = (uid: string, id: string, body: Record<string, unknown>, secs: number) => R.relayStep(db, uid, id, body, t(secs), deps);
  await step("sp-teamhost", b.id, { op: "push", offer, mid: "0", fresh: true }, 12);
  const up = await step("sp-teamhost", b.id, { op: "video", offer, mid: "1" }, 12);
  assert.equal(up.host?.staffPass, true); assert.equal(up.host?.budgetMinutes, STAFF_PASS_VIDEO_MINUTES);
  // the ordinary host's room: one video minute
  await step("sp-host", a.id, { op: "push", offer, mid: "0", fresh: true }, 12);
  const upA = await step("sp-host", a.id, { op: "video", offer, mid: "1" }, 12);
  assert.equal(upA.host?.staffPass, undefined); assert.equal(upA.host?.minutesLeft, 1);
  // three minutes later: the ordinary room's grace has started; the pass room's camera carries on
  const beatA = await R.beatRoom(db, "sp-host", a.id, t(192), deps);
  assert.ok(beatA.host?.graceUntil, "the budget ran out in the ordinary room");
  const beatB = await R.beatRoom(db, "sp-teamhost", b.id, t(192), deps);
  assert.equal(beatB.host?.graceUntil, null); assert.equal(beatB.host?.videoOn, true); assert.equal(beatB.host?.staffPass, true);
  // camera off and on again after the minutes would have run out: fine on the pass
  await step("sp-teamhost", b.id, { op: "unvideo" }, 193);
  await step("sp-teamhost", b.id, { op: "video", offer, mid: "1" }, 194);
  await R.beatRoom(db, "sp-teamhost", b.id, t(300), deps);
  assert.ok((await roomDoc(b.id)).videoOn?.["sp-teamhost"], "still up past the normal budget and grace");

  // ── recording: the plan switches are off for every plan; the pass lets the team record and publish, with the longest length ──
  await saveLimitOverrides(db, { liveRecording: OFF, replayPublish: OFF }, "admin");
  process.env.RECORDER_URL = "https://recorder.test"; process.env.RECORDER_SECRET = "secret";
  assert.equal((await S.recordingChoice(db, "sp-host")).canRecord, false, "the plan switch holds for members");
  assert.equal((await S.recordingChoice(db, "sp-teamhost2")).canRecord, true, "the pass skips it for the team");
  const rc = await R.startRoom(db, "sp-teamhost2", c.id, "Recorded staff test", t(400), deps, undefined, { record: true });
  assert.equal(rc.recording, true);
  const rid = (await roomDoc(rc.id)).recording!.rid;
  const recd = (await db.doc(`roomRecordings/${rid}`).get()).data() as RecordingDoc;
  assert.equal(recd.staffPass, true);
  assert.equal(starts[starts.length - 1].maxSeconds, STAFF_PASS_RECORDING_HOURS * 3600, "the longest recording on the pass");
  // recording notices and consent still apply: the room is marked recorded for everyone
  assert.equal((await roomDoc(rc.id)).recording?.on, true);
  // a chunk five hours in (past the 4-hour default) is taken on the pass
  const late = new Date(Date.parse(recd.startedAt) + 5 * 3600_000);
  await S.ingestChunk(db, rid, "audio", 1, new Uint8Array(10).fill(1), { store: () => store }, late);
  // the ordinary host asking to record: refused by their plan, the room still opens
  const rd = await R.startRoom(db, "sp-host2", c.id, "Plan says no", t(410), deps, undefined, { record: true });
  assert.equal(rd.recording, undefined); assert.match(rd.note ?? "", /plan doesn't include recording/);
  // publishing a replay: refused by the plan for a member, allowed on the pass
  const ready = (host: string, id: string) => db.doc(`roomRecordings/${id}`).set({
    roomId: "x", cid: c.id, communityName: "Pass Chapel", title: "Ready", hostUid: host, hostName: host, status: "ready", startedAt: t(0).toISOString(), published: false,
    files: { audio: { key: `recordings/${id}/audio.webm`, type: "audio/webm", uploadId: "u", parts: [], pending: [], lastSeq: 1, size: 10, done: true } }, stage: [host],
  } satisfies RecordingDoc);
  await ready("sp-host", "sp-rec-member"); await ready("sp-teamhost", "sp-rec-team");
  await fails(S.publishReplay(db, "sp-host", "sp-rec-member", { audience: "public" }, recDeps, t(420)), 403, /plan/);
  const pub = await S.publishReplay(db, "sp-teamhost", "sp-rec-team", { audience: "public" }, recDeps, t(420));
  assert.equal(pub.audience, "public");

  // ── off again (logged): every limit is back, even in the rooms opened under it ──
  await P.saveStaffPass(db, { uid: "boss", email: "boss@x.test", super: true }, { on: false }, t(500));
  log = await P.staffPassLog(db);
  assert.equal(log[0].after, "off"); assert.match(log[0].before, /^on until /);
  // keep the ordinary room going (the host and its two listeners beat), then it's full again for the team too
  for (const u of ["sp-host", "sp-l1", "sp-l2"]) await R.beatRoom(db, u, a.id, t(499), deps);
  await fails(R.joinRoom(db, "sp-l3", a.id, t(501)), 409, /full/);
  await fails(R.joinRoom(db, "sp-l4", a.id, t(501)), 409, /full/);
  assert.equal(await P.hasStaffPass(db, "sp-team", t(501)), false);
  const after = await R.beatRoom(db, "sp-teamhost", b.id, t(502), deps);
  assert.equal(after.host?.staffPass, undefined); assert.ok(after.host?.graceUntil, "the budget applies again: the grace starts");
  await fails(S.ingestChunk(db, rid, "audio", 2, new Uint8Array(10).fill(2), { store: () => store }, late), 413, /longest length/);
  assert.equal((await S.recordingChoice(db, "sp-teamhost2")).canRecord, false);

  // ── it ends by itself at its end time ──
  const short = new Date(t(600).getTime() + 3600_000).toISOString();
  await P.saveStaffPass(db, { uid: "boss", email: "boss@x.test", super: true }, { on: true, until: short }, t(600));
  assert.equal(await P.hasStaffPass(db, "sp-team", t(601)), true);
  assert.equal(await P.hasStaffPass(db, "sp-team", new Date(Date.parse(short) + 1000)), false, "past its end: off");

  // tidy up for any test after this one
  await P.saveStaffPass(db, { uid: "boss", email: "boss@x.test", super: true }, { on: false }, t(700));
  await saveLimitOverrides(db, {}, "admin");
  await R.saveRoomSettings(db, {}, "admin");
  delete process.env.RECORDER_URL; delete process.env.RECORDER_SECRET;
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
