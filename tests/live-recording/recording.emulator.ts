// Live recording and replays against the Firestore emulator (lib/live-recording-server.ts), with stand-ins for storage, Cloudflare
// Stream, the relay, transcription and Nana, and a real local HTTP server standing in for the recorder service (it checks every
// signature the app sends, with the service's own sign.mjs). Covers: the switch and its fallbacks, the start and stop calls, consent
// before a speaker's microphone, the receive-only page token, chunk ingest into multipart parts and finalize, playing for the host and
// for safety review, the keep-days cron (unpublished deleted, published kept), publishing, audiences and teen mode, transcripts,
// Share to Journal and unpublishing. Run: npm run test:recording-server → "ALL OK".
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import * as S from "../../lib/live-recording-server";
import { DAY_MS, type RecordingDoc, type ReplayDoc } from "../../lib/live-recording";
import { RelayError, type RelayClient, type Sdp } from "../../lib/rooms-relay-server";
import type { RoomDoc } from "../../lib/rooms";
import { CHALLENGE_POSTER } from "../../lib/rooms-live";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const SECRET = "recorder-test-secret";
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof C.CommunityError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const user = (uid: string, extra: Record<string, unknown> = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: "basic", ...extra });

(async () => {
  const svc = await import("../../services/room-recorder/sign.mjs");
  // ── The stand-in recorder service: a real HTTP server ──
  const calls: { path: string; body: Record<string, unknown>; signed: boolean }[] = [];
  let recorderDown = false;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks);
    calls.push({ path: String(req.url), body: JSON.parse(raw.toString() || "{}"), signed: svc.verifySignature(SECRET, req.headers["x-recorder-signature"], raw) });
    res.writeHead(recorderDown ? 503 : 202, { "Content-Type": "application/json" }); res.end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const recorderUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // ── Stand-ins: storage, Stream, relay, transcription, Nana ──
  const objects = new Map<string, Uint8Array>();
  const uploads = new Map<string, { key: string; parts: Map<number, Uint8Array> }>();
  let uploadN = 0;
  const store: S.RecordingStore = {
    async put(k, b) { objects.set(k, b); },
    async get(k) { return objects.get(k) ?? null; },
    async del(k) { objects.delete(k); },
    async createMultipart(key) { const id = `up${++uploadN}`; uploads.set(id, { key, parts: new Map() }); return id; },
    async uploadPart(key, id, n, b) { const u = uploads.get(id)!; assert.equal(u.key, key); u.parts.set(n, b); return `etag-${n}`; },
    async complete(key, id, parts) {
      const u = uploads.get(id)!;
      const bytes = parts.map((p) => { assert.equal(p.etag, `etag-${p.n}`); return u.parts.get(p.n)!; });
      const all = new Uint8Array(bytes.reduce((a, b) => a + b.byteLength, 0)); let at = 0; for (const b of bytes) { all.set(b, at); at += b.byteLength; }
      objects.set(key, all); uploads.delete(id);
    },
    async abort(_k, id) { uploads.delete(id); },
    async signedGet(key, seconds) { return `https://r2.test/${key}?exp=${seconds}`; },
  };
  const streamVideos = new Map<string, { url: string; ready: boolean }>(); let streamN = 0;
  const stream: S.StreamClient = {
    async copy(url) { const uid = `vid${++streamN}`; streamVideos.set(uid, { url, ready: true }); return uid; },
    async get(uid) { const v = streamVideos.get(uid); return v ? { ready: v.ready, duration: 1800 } : null; },
    async remove(uid) { streamVideos.delete(uid); },
    async player(uid) { return `https://player.test/${uid}`; },
  };
  let sessions = 0, relayDown = false;
  const relay: RelayClient = {
    async newSession() { if (relayDown) throw new RelayError("down"); return `sess-${++sessions}`; },
    async push(_s, _o, tracks) { return { answer: { type: "answer", sdp: "v=0 a" }, tracks: tracks.map((t) => ({ location: "local" as const, ...t })) }; },
    async pull(_s, tracks) { return { offer: { type: "offer", sdp: "v=0 o" }, renegotiate: true, tracks: tracks.map((t, i) => ({ location: "remote" as const, mid: String(i), ...t })) }; },
    async renegotiate() {}, async close() {},
  };
  let transcribed = 0;
  const deps: S.RecordingDeps = {
    ...S.realRecordingDeps(), store: () => store, stream: () => stream, relay: () => relay,
    transcriber: () => async (audio) => { transcribed++; return `Hello from ${audio.byteLength} bytes.`; },
    summarise: async (_db, _uid, title, transcript) => `Summary of ${title}: ${transcript.slice(0, 10)}\n\n## Chapters\n- 0: opening`,
  };
  const roomDeps: R.RoomDeps = { relay: () => relay, recording: deps };
  const offer: Sdp = { type: "offer", sdp: "v=0 browser" };
  const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
  const recDoc = async (rid: string) => (await db.doc(`roomRecordings/${rid}`).get()).data() as RecordingDoc;
  const MiB = 1024 * 1024;
  const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);

  for (const u of ["host", "spk", "l1", "outsider", "admin"]) await user(u);
  await user("teen", { teen: true });
  const c = await C.createCommunity(db, "host", { name: "Recorded Chapel" });
  for (const u of ["spk", "l1", "teen"]) await db.doc(`communityMembers/${c.id}_${u}`).set({ cid: c.id, uid: u, role: "member", status: "active", joinedAt: new Date().toISOString() });
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "token";
  R.resetRoomSettingsCache(); S.resetRecordingSettingsCache();

  // ── Without the recorder: the switch is unavailable and asking does nothing (the host is told) ──
  delete process.env.RECORDER_URL; delete process.env.RECORDER_SECRET;
  assert.equal((await S.recordingChoice(db, "host")).canRecord, false);
  const plain = await R.startRoom(db, "host", c.id, "Not recorded", new Date(), roomDeps, undefined, { record: true });
  assert.equal(plain.recording, undefined); assert.match(plain.note ?? "", /Recording isn't available yet/);
  assert.equal((await roomDoc(plain.id)).recording, undefined);
  assert.equal(calls.length, 0);

  process.env.RECORDER_URL = recorderUrl; process.env.RECORDER_SECRET = SECRET;
  assert.deepEqual(await S.recordingChoice(db, "host"), { available: true, forced: false, keepDays: 30, maxHours: 4, transcripts: false, canRecord: true });
  // Phone to phone (the relay didn't answer): not recorded, and the host is told why.
  relayDown = true;
  const p2p = await R.startRoom(db, "host", c.id, "Fallback", new Date(), roomDeps, undefined, { record: true });
  assert.equal(p2p.mode, "p2p"); assert.match(p2p.note ?? "", /phone to phone, which can't be recorded/);
  relayDown = false;
  // Off by default: a relay room without the switch isn't recorded.
  const off = await R.startRoom(db, "host", c.id, "Off by default", new Date(), roomDeps);
  assert.equal(off.mode, "relay"); assert.equal((await roomDoc(off.id)).recording, undefined); assert.equal(calls.length, 0);

  // ── A recorded room: the recorder is asked to join, signed, with a receive-only page token ──
  const t0 = new Date();
  const room = await R.startRoom(db, "host", c.id, "Town hall", t0, roomDeps, undefined, { record: true });
  assert.equal(room.mode, "relay"); assert.equal(room.recording, true);
  const r0 = await roomDoc(room.id);
  assert.equal(r0.recording?.on, true); assert.equal(r0.recording?.status, "starting"); assert.ok(r0.consent?.host, "the host agreed by switching it on");
  const rid = r0.recording!.rid;
  assert.equal((await recDoc(rid)).status, "starting");
  const start = calls.find((x) => x.path === "/start")!;
  assert.ok(start.signed, "the start call is signed");
  assert.equal(start.body.rid, rid); assert.equal(start.body.roomId, room.id); assert.equal(start.body.maxSeconds, 4 * 3600); assert.equal(start.body.chunkSeconds, 10);
  assert.match(String(start.body.uploadUrl), /\/api\/rooms\/recorder$/);
  const token = new URL(String(start.body.pageUrl)).searchParams.get("token")!;
  assert.match(String(start.body.pageUrl), new RegExp(`/rooms/record/${room.id}\\?token=`));
  assert.deepEqual((await R.liveRooms(db, "l1", c.id)).find((x) => x.id === room.id)?.recorded, true, "the Rooms card says it's recorded");

  // The page: the room's state, receiving only.
  const st = await S.recorderState(db, token);
  assert.equal(st.live, true); assert.equal(st.title, "Town hall"); assert.deepEqual(st.pulls, []);
  await fails(S.recorderState(db, "forged.token"), 401);
  await R.relayStep(db, "host", room.id, { op: "push", offer, mid: "0", fresh: true }, new Date(), roomDeps);
  assert.deepEqual((await S.recorderState(db, token)).pulls.map((p) => p.uid), ["host"]);
  const pulled = await S.recorderRelay(db, token, { op: "pull", uids: ["host"], fresh: true }, deps);
  assert.deepEqual(pulled.tracks, [{ uid: "host", mid: "0" }]);
  await fails(S.recorderRelay(db, token, { op: "push", offer, mid: "1" }, deps), 400, /only receive/);
  assert.ok((await db.doc(`communityRooms/${room.id}/relay/__recorder`).get()).exists, "its own relay session record");
  await S.recorderStatus(db, rid, "recording", "");
  assert.equal((await roomDoc(room.id)).recording?.status, "on"); assert.equal((await recDoc(rid)).status, "recording");

  // ── A speaker agrees before their microphone goes up ──
  for (const u of ["spk", "l1"]) await R.joinRoom(db, u, room.id);
  await R.setSpeaker(db, "host", room.id, "spk", true, new Date(), roomDeps);
  await fails(R.relayStep(db, "spk", room.id, { op: "push", offer, mid: "0", fresh: true }, new Date(), roomDeps), 403);
  await fails(S.consentToRecording(db, "l1", room.id), 409, /not on stage/);
  // Live mode (2a): the speaker's camera waits for their agreement too.
  await R.setStageVideo(db, "host", room.id, true);
  await fails(R.relayStep(db, "spk", room.id, { op: "video", offer, mid: "1", fresh: true }, new Date(), roomDeps), 403, /Agree to speak on the record/);
  await S.consentToRecording(db, "spk", room.id);
  assert.ok((await roomDoc(room.id)).consent?.spk);
  await R.relayStep(db, "spk", room.id, { op: "push", offer, mid: "0", fresh: true }, new Date(), roomDeps);
  assert.deepEqual((await recDoc(rid)).stage, ["host", "spk"]); assert.equal((await recDoc(rid)).teenOnStage, undefined);

  // ── Live mode (2a) in the recording: the poster while cameras are off, each camera pulled as video when it's up ──
  await R.setPoster(db, "host", room.id, "challenge", undefined);
  let rs = await S.recorderState(db, token);
  assert.equal(rs.poster, CHALLENGE_POSTER, "the poster the room shows"); assert.deepEqual(rs.videoPulls, []);
  await R.relayStep(db, "host", room.id, { op: "video", offer, mid: "1" }, new Date(), roomDeps);
  await R.relayStep(db, "spk", room.id, { op: "video", offer, mid: "1" }, new Date(), roomDeps);
  rs = await S.recorderState(db, token);
  assert.deepEqual(rs.videoPulls.map((p) => p.uid).sort(), ["host", "spk"], "the host's and the allowed speaker's cameras");
  const cam = await S.recorderRelay(db, token, { op: "pull", uids: ["host", "spk"], video: true }, deps);
  assert.deepEqual((cam.tracks ?? []).map((t) => [t.uid, t.kind]), [["host", "video"], ["spk", "video"]]);
  assert.equal((await db.doc(`communityRooms/${room.id}/people/${S.RECORDER_UID}`).get()).exists, false, "the recorder is no listener");
  assert.equal(await R.recount(db, room.id, new Date(), true), 1, "only l1 is counted");
  await R.relayStep(db, "spk", room.id, { op: "unvideo" }, new Date(), roomDeps);
  await R.relayStep(db, "host", room.id, { op: "unvideo" }, new Date(), roomDeps);
  assert.deepEqual((await S.recorderState(db, token)).videoPulls, [], "cameras off: back to the poster");
  await fails(S.recorderRelay(db, token, { op: "pull", uids: ["host"], video: true }, deps), 409, /video on/);

  // ── Chunks: small ones wait, then become a 5 MiB+ part; a retry is taken once ──
  assert.equal((await S.ingestChunk(db, rid, "stage", 1, bytes(3 * MiB, 1), deps)).parts, 0);
  assert.equal(objects.size, 1, "the first chunk waits as a small object");
  assert.equal((await S.ingestChunk(db, rid, "stage", 2, bytes(3 * MiB, 2), deps)).parts, 1, "two chunks make the first part");
  assert.equal([...objects.keys()].filter((k) => k.includes("/pending/")).length, 0, "and the small objects go");
  assert.deepEqual(await S.ingestChunk(db, rid, "stage", 2, bytes(3 * MiB, 2), deps), { ok: true, duplicate: true, parts: 1 });
  await S.ingestChunk(db, rid, "stage", 3, bytes(1024, 3), deps);
  await S.ingestChunk(db, rid, "audio", 1, bytes(100 * 1024, 4), deps);
  await fails(S.ingestChunk(db, rid, "stage", 4, bytes(4 * MiB + 1), deps), 413);
  await fails(S.ingestChunk(db, rid, "video", 4, bytes(10), deps), 400);
  await fails(S.ingestChunk(db, rid, "stage", 4, bytes(10), deps, new Date(t0.getTime() + 5 * 3600_000)), 413, /longest/);
  await fails(S.ingestChunk(db, "nope-not-here", "stage", 1, bytes(10), deps), 404);

  // ── The room ends: the recorder is told to stop; the keep timer starts ──
  const tEnd = new Date();
  await R.closeRoom(db, "host", room.id, tEnd, { recording: deps });
  const stop = calls.find((x) => x.path === "/stop")!;
  assert.ok(stop.signed); assert.equal(stop.body.rid, rid);
  let rec = await recDoc(rid);
  assert.equal(rec.status, "finalizing"); assert.equal(rec.keepUntil, new Date(tEnd.getTime() + 30 * DAY_MS).toISOString());
  await fails(S.recorderState(db, token).then((x) => { if (!x.live) throw new C.CommunityError(410, "ended"); }), 410);
  // Finalize: the rest is the last part and each file is completed.
  assert.deepEqual(await S.finalizeRecording(db, rid, { hadVideo: false, seconds: 1800 }, deps), { status: "ready" });
  rec = await recDoc(rid);
  assert.equal(rec.status, "ready"); assert.equal(rec.seconds, 1800);
  assert.equal(objects.get(rec.files.stage!.key)!.byteLength, 6 * MiB + 1024, "the whole stage file, in order");
  assert.equal(objects.get(rec.files.stage!.key)![3 * MiB], 2); assert.equal(objects.get(rec.files.stage!.key)![6 * MiB], 3);
  assert.equal(objects.get(rec.files.audio!.key)!.byteLength, 100 * 1024);
  assert.equal([...objects.keys()].filter((k) => k.includes("/pending/")).length, 0);
  await fails(S.ingestChunk(db, rid, "stage", 9, bytes(10), deps), 409, /closed/);

  // ── Playing: the host, and Trust & safety; nobody else ──
  assert.match((await S.playRecording(db, "host", rid, false, deps)).url, /^https:\/\/r2\.test\/recordings\/.+stage\.webm\?exp=900$/);
  await fails(S.playRecording(db, "l1", rid, false, deps), 404);
  assert.ok((await S.playRecording(db, "admin", rid, true, deps)).url);
  assert.deepEqual((await S.myRecordings(db, "host")).map((x) => x.id).includes(rid), true);
  assert.equal((await S.myRecordings(db, "l1")).length, 0);

  // ── A second recording, left unpublished, for the keep-days cron ──
  const room2 = await R.startRoom(db, "host", c.id, "Midweek", new Date(), roomDeps, undefined, { record: true });
  const rid2 = (await roomDoc(room2.id)).recording!.rid;
  await S.ingestChunk(db, rid2, "stage", 1, bytes(2048), deps);
  await R.closeRoom(db, "host", room2.id, new Date(), { recording: deps });
  await S.finalizeRecording(db, rid2, {}, deps);
  const key2 = (await recDoc(rid2)).files.stage!.key;
  assert.ok(objects.has(key2));

  // ── Publishing: to Stream, listed, transcript queued ──
  await fails(S.publishReplay(db, "l1", rid, {}, deps), 404);
  const pub = await S.publishReplay(db, "host", rid, { title: "Town hall replay", audience: "public" }, deps);
  assert.equal(pub.audience, "public");
  let rp = (await db.doc(`replays/${pub.id}`).get()).data() as ReplayDoc;
  assert.equal(rp.status, "processing"); assert.equal(rp.listed, true); assert.equal(rp.kind, "audio"); assert.equal(rp.transcript?.status, "queued");
  assert.match(streamVideos.get(rp.streamUid)!.url, /stage\.webm\?exp=21600$/, "Stream copies from a short-lived private link");
  assert.equal((await recDoc(rid)).published, true);
  assert.equal((await S.publishReplay(db, "host", rid, {}, deps)).id, pub.id, "publishing twice gives the same replay");
  const seen = await S.replayForViewer(db, undefined, pub.id, deps);
  assert.equal(seen.canWatch, true); assert.equal(seen.replay.status, "ready", "the first look after Stream finishes marks it ready"); assert.equal(seen.player, `https://player.test/${rp.streamUid}`);
  assert.deepEqual((await S.listedReplays(db, { sort: "new" })).map((x) => x.id), [pub.id], "on Explore");
  // Transcript (the cron's step), then Share to Journal: a draft with the replay, Nana's summary and the transcript.
  assert.equal(await S.transcribeReplays(db, deps), 1); assert.equal(transcribed, 1);
  rp = (await db.doc(`replays/${pub.id}`).get()).data() as ReplayDoc;
  assert.deepEqual(rp.transcript, { status: "ready", text: `Hello from ${100 * 1024} bytes.` });
  const j = await S.shareReplayToJournal(db, "host", pub.id, deps);
  assert.equal(j.summary, true); assert.equal(j.transcript, true); assert.equal(j.editHref, `/write/${j.noteId}/edit`);
  const note = (await db.doc(`notes/${j.noteId}`).get()).data()!;
  assert.equal(note.status, "draft", "never published by itself"); assert.equal(note.replayId, pub.id); assert.equal(note.premium, false); assert.equal(note.authorUid, "host");
  assert.match(note.content, /^\*A replay of the live "Town hall replay"/); assert.match(note.content, /Summary of Town hall replay/); assert.match(note.content, /## Transcript\n\nHello from/);
  assert.equal((await S.shareReplayToJournal(db, "host", pub.id, deps)).noteId, j.noteId, "one post per replay");
  await fails(S.shareReplayToJournal(db, "l1", pub.id, deps), 404);

  // A subscribers' replay: only subscribers (and the host) get the player.
  const sub = await S.publishReplay(db, "host", rid2, { audience: "subscribers" }, deps);
  assert.equal((await S.replayForViewer(db, "l1", sub.id, deps)).canWatch, false);
  assert.equal((await S.replayForViewer(db, "l1", sub.id, deps)).player, undefined);
  await db.doc("subscriptions/l1_host").set({ subscriberUid: "l1", username: "host", status: "active", currentPeriodEnd: new Date(Date.now() + DAY_MS).toISOString() });
  assert.equal((await S.replayForViewer(db, "l1", sub.id, deps)).canWatch, true);
  assert.equal((await S.shareReplayToJournal(db, "host", sub.id, deps)).noteId.length > 0, true);
  const subNote = (await db.doc(`notes/${(await db.doc(`replays/${sub.id}`).get()).data()!.noteId}`).get()).data()!;
  assert.equal(subNote.premium, true, "a subscribers' replay becomes a premium post");
  // Unpublishing inside the first window: the replay, its post and its Stream copy go; the timer restarts.
  const tUn = new Date();
  const un = await S.unpublishReplay(db, "host", sub.id, deps, tUn);
  assert.deepEqual(un, { kept: true, keepUntil: new Date(tUn.getTime() + 30 * DAY_MS).toISOString() });
  assert.equal((await db.doc(`replays/${sub.id}`).get()).exists, false);
  assert.equal((await db.collection("notes").where("replayId", "==", sub.id).get()).size, 0, "its journal post is removed");
  assert.equal((await recDoc(rid2)).published, false);

  // ── The cron: past the keep date, unpublished goes; published stays ──
  assert.deepEqual(await S.sweepRecordings(db, deps, new Date(Date.now() + 29 * DAY_MS)), { deleted: 0, finished: 0 });
  const swept = await S.sweepRecordings(db, deps, new Date(Date.now() + 31 * DAY_MS));
  assert.ok(swept.deleted >= 1);
  const gone = await recDoc(rid2);
  assert.equal(gone.status, "deleted"); assert.equal(gone.deletedWhy, "kept-days"); assert.deepEqual(gone.files, {});
  assert.equal(objects.has(key2), false, "its file is deleted from the bucket");
  assert.equal((await recDoc(rid)).status, "ready", "the published one stays");
  assert.ok(objects.has((await recDoc(rid)).files.stage!.key));
  await fails(S.playRecording(db, "host", rid2, false, deps), 409, /deleted/);

  // Unpublishing after the first window: the recording is deleted too.
  const late = await S.unpublishReplay(db, "host", pub.id, deps, new Date(Date.now() + 31 * DAY_MS));
  assert.deepEqual(late, { kept: false });
  assert.equal((await recDoc(rid)).status, "deleted"); assert.equal((await recDoc(rid)).deletedWhy, "unpublished-late");
  assert.equal((await db.doc(`notes/${j.noteId}`).get()).exists, false); assert.equal(streamVideos.size, 0);

  // ── Teen mode: a teen on stage keeps the replay inside the community ──
  const room3 = await R.startRoom(db, "host", c.id, "Youth hour", new Date(), roomDeps, undefined, { record: true });
  const rid3 = (await roomDoc(room3.id)).recording!.rid;
  await R.joinRoom(db, "teen", room3.id);
  await R.setSpeaker(db, "host", room3.id, "teen", true, new Date(), roomDeps);
  await S.consentToRecording(db, "teen", room3.id);
  assert.equal((await recDoc(rid3)).teenOnStage, true);
  await S.ingestChunk(db, rid3, "stage", 1, bytes(10), deps);
  await R.closeRoom(db, "host", room3.id, new Date(), { recording: deps });
  await S.finalizeRecording(db, rid3, {}, deps);
  const tp = await S.publishReplay(db, "host", rid3, { audience: "public" }, deps);
  assert.equal(tp.audience, "community"); assert.match(tp.why ?? "", /teen mode/);
  assert.equal(((await db.doc(`replays/${tp.id}`).get()).data() as ReplayDoc).listed, false);
  assert.equal((await S.replayForViewer(db, "outsider", tp.id, deps)).canWatch, false, "not a member");
  assert.equal((await S.replayForViewer(db, "l1", tp.id, deps)).canWatch, true, "a member");
  await fails(S.shareReplayToJournal(db, "host", tp.id, deps), 409, /inside its community/);
  assert.equal((await S.listedReplays(db, { sort: "new" })).some((x) => x.id === tp.id), false, "not on Explore");

  // ── The recorder can't start: the room goes on, the host is told, the recording is kept as a failed note ──
  recorderDown = true;
  const room4 = await R.startRoom(db, "host", c.id, "Recorder down", new Date(), roomDeps, undefined, { record: true });
  const r4 = await roomDoc(room4.id);
  assert.equal(r4.status, "live"); assert.equal(r4.recording?.status, "failed"); assert.match(r4.recording?.why ?? "", /couldn't join/);
  assert.equal((await recDoc(r4.recording!.rid)).status, "failed");
  recorderDown = false;
  // Admin's force switch: recorded without asking (and a stuck recording is finished by the cron).
  await S.saveRecordingSettings(db, { forceRecord: 1 }, "admin");
  const forced = await R.startRoom(db, "host", c.id, "Forced", new Date(), roomDeps);
  const rf = await roomDoc(forced.id);
  assert.equal(rf.recording?.forced, true);
  await S.ingestChunk(db, rf.recording!.rid, "audio", 1, bytes(10), deps);
  const finishedLater = await S.sweepRecordings(db, deps, new Date(Date.now() + 7 * 3600_000));
  assert.ok(finishedLater.finished >= 1); assert.equal((await recDoc(rf.recording!.rid)).status, "ready");
  await S.saveRecordingSettings(db, {}, "admin");

  server.close();
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
