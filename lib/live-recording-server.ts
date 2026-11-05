import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { setting } from "@/lib/config";
import { SITE_URL } from "./host";
import { CommunityError, activeRole, memberOf } from "./community-server";
import { getLimitOverrides } from "./limits-server";
import { limitFor } from "./limits";
import { memberTier } from "./nana-meter";
import { getTierConfig } from "./tiers";
import { slugify } from "./firestore-notes";
import { pullsFor, presentIn, type RoomDoc, type RoomRelayRecord } from "./rooms";
import { videoPullsFor } from "./rooms-live";
import { RelayError, cleanSdp, relayClient, type RelayClient } from "./rooms-relay-server";
import { readRecorderToken, recorderToken, signBody } from "./recorder-sign";
import { recordingHoursWithPass } from "./staff-pass";
import { hasStaffPass, roomOnPass } from "./staff-pass-server";
import { holdsLiveTicket } from "./live-door-server";
import {
  CHUNK_MAX_BYTES, RECORDING_FILES, afterUnpublish, audienceFor, cleanRecordingOverrides, cleanReplayTitle, dueForDeletion, isListed, keepUntilFrom,
  mayWatch, partReady, recordingFigures, recordingSettings, replayJournalDraft, shouldRecord,
  type RecordingDoc, type RecordingFigures, type RecordingFile, type RecordingFileKind, type RecordingSettings, type ReplayDoc, type RoomRecordingState,
} from "./live-recording";

// Server side of live recording and replays (lib/live-recording.ts). Everything that touches storage, the recorder, Cloudflare Stream,
// transcription or Nana goes through RecordingDeps, so the emulator tests run it against stand-ins.
//
// The recorder protocol (services/room-recorder, docs/RECORDER.md). Every request either way is signed (lib/recorder-sign.ts).
//   app → recorder  POST {RECORDER_URL}/start { rid, roomId, pageUrl, maxSeconds, chunkSeconds, uploadUrl }   when a recorded room starts
//                   POST {RECORDER_URL}/stop  { rid }                                                           when it ends
//   recorder → app  POST /api/rooms/recorder?rid=&file=stage|audio&seq=n   (the chunk's bytes)              every ~10 seconds per file
//                   POST /api/rooms/recorder { action: "status", rid, status: "recording" | "failed", why? }
//                   POST /api/rooms/recorder { action: "finalize", rid, hadVideo, seconds }                    after it stopped
//   recorder page   POST /api/rooms/recorder { action: "state" | "relay", token, … }   the page's room token: receive-only (no push)
// Chunks are written to the private bucket. A multipart part must be at least 5 MiB (but the last), so chunks wait as small objects
// (…/pending/{seq}) until there's enough for a part; finalize sends the rest as the last part and completes the upload.

export const RECORDER_UID = "__recorder"; // the recorder's Cloudflare session record: communityRooms/{id}/relay/__recorder
export const recorderConfigured = () => !!(setting("RECORDER_URL") || "").trim() && !!(setting("RECORDER_SECRET") || "").trim();
const secret = () => (setting("RECORDER_SECRET") || "").trim();

// ── Settings (Admin → Limits → Live recording) ──
const TTL_MS = 30_000;
let settingsCache: { at: number; data: RecordingSettings } | null = null;
export async function getRecordingSettings(db: Firestore, now = Date.now()): Promise<RecordingSettings> {
  if (settingsCache && now - settingsCache.at < TTL_MS) return settingsCache.data;
  const data = recordingSettings(cleanRecordingOverrides((await db.doc("serverConfig/recording").get()).data()?.overrides));
  settingsCache = { at: now, data };
  return data;
}
export async function saveRecordingSettings(db: Firestore, input: unknown, adminUid: string, now = new Date()): Promise<RecordingSettings> {
  const overrides = cleanRecordingOverrides(input);
  await db.doc("serverConfig/recording").set({ overrides, updatedAt: now.toISOString(), updatedBy: adminUid });
  settingsCache = { at: now.getTime(), data: recordingSettings(overrides) };
  return settingsCache.data;
}
export const resetRecordingSettingsCache = () => { settingsCache = null; };
export const transcriptionProvider = () => { const v = (setting("REPLAY_TRANSCRIBE") || "").trim().toLowerCase(); return v === "nkenne-english" || v === "nkenne-swahili" ? v : ""; };
export async function liveRecordingFigures(db: Firestore): Promise<RecordingFigures> {
  return recordingFigures(await getRecordingSettings(db).catch(() => recordingSettings()), recorderConfigured(), !!transcriptionProvider() && !!(setting("NKENNE_API_KEY") || "").trim());
}
// The Start a room form: whether this host can switch recording on (and whether it's forced on). A team member on the staff test pass
// (lib/staff-pass.ts) can, whatever their plan's switch says.
export async function recordingChoice(db: Firestore, uid: string): Promise<RecordingFigures & { canRecord: boolean }> {
  const f = await liveRecordingFigures(db);
  const allowed = limitFor("liveRecording", await memberTier(db, uid), await getLimitOverrides(db)) > 0 || (await hasStaffPass(db, uid));
  return { ...f, canRecord: f.available && (f.forced || allowed) };
}

// ── Stand-ins for tests ──
export type RecordingStore = {
  put(key: string, bytes: Uint8Array, type: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  del(key: string): Promise<void>;
  createMultipart(key: string, type: string): Promise<string>;
  uploadPart(key: string, uploadId: string, n: number, bytes: Uint8Array): Promise<string>;
  complete(key: string, uploadId: string, parts: { n: number; etag: string }[]): Promise<void>;
  abort(key: string, uploadId: string): Promise<void>;
  signedGet(key: string, seconds: number, type: string): Promise<string>;
};
export type RecorderClient = { start(body: Record<string, unknown>): Promise<void>; stop(rid: string): Promise<void> };
// mark: the host's Stream watermark profile for a replay's frame (lib/media-mark-server.ts), so a video replay carries the NotesApp mark.
export type StreamClient = { copy(url: string, creator: string, name: string, watermarkUid?: string): Promise<string>; mark(db: Firestore, host: { uid: string; username: string }): Promise<string>; get(uid: string): Promise<{ ready: boolean; duration?: number } | null>; remove(uid: string): Promise<void>; player(uid: string): Promise<string> };
export type Transcriber = (audio: Uint8Array, type: string) => Promise<string>;
export type Summariser = (db: Firestore, uid: string, title: string, transcript: string) => Promise<string | null>;
export type RecordingDeps = { store: () => RecordingStore; recorder: () => RecorderClient; stream: () => StreamClient; relay: () => RelayClient; transcriber: () => Transcriber | null; summarise: Summariser };

export class RecordingError extends CommunityError {}
const fail = (status: number, msg: string) => new RecordingError(status, msg);

// ── The real ones ──
function r2Store(): RecordingStore {
  // Loaded lazily so tests (and the edge of the app that never records) don't need the AWS SDK set up.
  const lib = async () => {
    const s3 = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { getR2Client } = await import("./r2");
    const { privateBucket } = await import("./private-files");
    const Bucket = privateBucket();
    if (!Bucket) throw new Error("R2_PRIVATE_BUCKET isn't set: recordings are kept in the private bucket.");
    return { s3, getSignedUrl, c: getR2Client(), Bucket };
  };
  return {
    async put(key, bytes, type) { const { s3, c, Bucket } = await lib(); await c.send(new s3.PutObjectCommand({ Bucket, Key: key, Body: bytes, ContentType: type })); },
    async get(key) {
      const { s3, c, Bucket } = await lib();
      try { const r = await c.send(new s3.GetObjectCommand({ Bucket, Key: key })); return r.Body ? await r.Body.transformToByteArray() : null; } catch { return null; }
    },
    async del(key) { const { s3, c, Bucket } = await lib(); await c.send(new s3.DeleteObjectCommand({ Bucket, Key: key })).catch(() => {}); },
    async createMultipart(key, type) { const { s3, c, Bucket } = await lib(); const r = await c.send(new s3.CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: type })); return String(r.UploadId); },
    async uploadPart(key, uploadId, n, bytes) { const { s3, c, Bucket } = await lib(); const r = await c.send(new s3.UploadPartCommand({ Bucket, Key: key, UploadId: uploadId, PartNumber: n, Body: bytes })); return String(r.ETag); },
    async complete(key, uploadId, parts) { const { s3, c, Bucket } = await lib(); await c.send(new s3.CompleteMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.n, ETag: p.etag })) } })); },
    async abort(key, uploadId) { const { s3, c, Bucket } = await lib(); await c.send(new s3.AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId })).catch(() => {}); },
    async signedGet(key, seconds, type) { const { s3, getSignedUrl, c, Bucket } = await lib(); return getSignedUrl(c, new s3.GetObjectCommand({ Bucket, Key: key, ResponseContentType: type }), { expiresIn: seconds }); },
  };
}
function httpRecorder(): RecorderClient {
  const call = async (path: string, body: Record<string, unknown>) => {
    const base = (setting("RECORDER_URL") || "").trim().replace(/\/$/, "");
    if (!base || !secret()) throw new Error("the recorder isn't set up (RECORDER_URL and RECORDER_SECRET)");
    const raw = JSON.stringify(body);
    const r = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Recorder-Signature": signBody(secret(), raw) }, body: raw, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!r.ok) throw new Error(`the recorder answered ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  };
  return { start: (body) => call("/start", body), stop: (rid) => call("/stop", { rid }) };
}
function cloudflareStream(): StreamClient {
  return {
    async copy(url, creator, name, watermarkUid) { const s = await import("./stream"); if (!s.streamConfigured()) throw fail(503, "Replays need Cloudflare Stream (CLOUDFLARE_STREAM_TOKEN), which isn't set up yet."); return (await s.copyFromUrl(url, creator, name, watermarkUid)).uid; },
    // The recorder films the room page at 1280 × 800 (services/room-recorder), so a replay's frame is 16:10.
    async mark(db, host) { const [{ markProfile }, { mediaDeps }] = await Promise.all([import("./media-mark-server"), import("./media-api")]); return markProfile(db, host, "16x10", mediaDeps().stream); },
    async get(uid) { const s = await import("./stream"); const v = await s.getVideo(uid); return v ? { ready: v.readyToStream, duration: v.duration } : null; },
    async remove(uid) { const s = await import("./stream"); await s.deleteVideo(uid); },
    async player(uid) { const s = await import("./stream"); return s.playerUrl(await s.playbackToken(uid, 6 * 3600)); },
  };
}
// Transcription is a pluggable step, off until REPLAY_TRANSCRIBE names a provider. The one we have is NKENNEAi's speech to text (the
// same account as the Kiswahili voice notes), limited to files under its 25 MB limit.
function settingTranscriber(): Transcriber | null {
  const p = transcriptionProvider();
  const key = (setting("NKENNE_API_KEY") || "").trim();
  if (!p || !key) return null;
  return async (audio, type) => {
    const n = await import("./nkenne");
    if (audio.byteLength > n.AUDIO_MAX_BYTES) throw fail(413, "too-long");
    const out = await n.transcribe({ key: n.cleanKey(key), base: (setting("NKENNE_API_URL") || "").trim() || undefined, timeoutMs: 55_000 }, new Blob([new Uint8Array(audio)], { type }), p === "nkenne-swahili" ? "swahili" : "english", "replay.webm");
    return out.text;
  };
}
const SUMMARY_TASK = "Below is the transcript of a live audio room. Write, for the host to edit before publishing: a two or three sentence summary, then a heading \"## Chapters\" with 3 to 8 lines \"- <rough minute>: <what was covered>\" in order. Use only what the transcript says; never invent names, numbers or quotes. Plain Markdown, no introduction.";
const nanaSummary: Summariser = async (db, uid, title, transcript) => {
  const { runAi, realDeps } = await import("./nana-server");
  const deps = realDeps();
  const now = deps.now();
  const ran = await runAi(db, deps, now, uid, { system: [{ type: "text", text: "You are Nana AI inside #NotesApp, helping a host turn a live session into a journal post." }], messages: [{ role: "user", content: `${SUMMARY_TASK}\n\nTitle: ${title}\n\nTranscript:\n${transcript.slice(0, 60_000)}` }], maxTokens: 1500 }, 20, { uid, tier: await memberTier(db, uid), gem: "pearl", effort: "low" });
  return ran.completion && !ran.completion.refused ? ran.completion.text.trim() : null;
};
export const realRecordingDeps = (): RecordingDeps => ({ store: r2Store, recorder: httpRecorder, stream: cloudflareStream, relay: () => relayClient(), transcriber: settingTranscriber, summarise: nanaSummary });

const recRef = (db: Firestore, rid: string) => db.doc(`roomRecordings/${rid}`);
async function readRec(db: Firestore, rid: unknown): Promise<{ ref: FirebaseFirestore.DocumentReference; r: RecordingDoc }> {
  const id = String(rid ?? "");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) throw fail(404, "That recording wasn't found.");
  const ref = recRef(db, id);
  const r = (await ref.get()).data() as RecordingDoc | undefined;
  if (!r) throw fail(404, "That recording wasn't found.");
  return { ref, r };
}
const fileKey = (rid: string, kind: RecordingFileKind) => `recordings/${rid}/${kind}.webm`;
const fileType = (kind: RecordingFileKind) => (kind === "stage" ? "video/webm" : "audio/webm");

// ── Starting and stopping (called from lib/rooms-server.ts) ──
// Whether a room being opened now records, and its first state for the room doc. note: why it doesn't, for the host.
// staffPass: the host is a team member on the staff test pass (lib/staff-pass.ts), so their plan's switch doesn't stop them.
export async function recordingPlan(db: Firestore, hostUid: string, asked: unknown, relay: boolean, staffPass = false): Promise<{ state: RoomRecordingState | null; note?: string }> {
  if (asked !== true && !recorderConfigured()) return { state: null };
  const s = await getRecordingSettings(db);
  const planAllows = staffPass || limitFor("liveRecording", await memberTier(db, hostUid), await getLimitOverrides(db)) > 0;
  if (shouldRecord({ asked: asked === true, s, recorderReady: recorderConfigured(), relay, planAllows })) {
    return { state: { on: true, rid: `${Date.now()}_${randomBytes(6).toString("hex")}`, status: "starting", ...(s.forceRecord > 0 && asked !== true ? { forced: true } : {}) } };
  }
  if (asked !== true) return { state: null };
  if (!recorderConfigured()) return { state: null, note: "Recording isn't available yet, so this live isn't recorded." };
  if (!relay) return { state: null, note: "This room runs phone to phone, which can't be recorded, so this live isn't recorded." };
  return { state: null, note: "Your plan doesn't include recording, so this live isn't recorded." };
}

// After the room doc is written: the recording's own doc, then the recorder is asked to join. If it can't, the room goes on with the
// notice still showing (nobody is told less than the truth) and the host sees why.
export async function startRoomRecording(db: Firestore, roomId: string, now = new Date(), deps: RecordingDeps = realRecordingDeps()): Promise<void> {
  const roomRef = db.doc(`communityRooms/${roomId}`);
  const room = (await roomRef.get()).data() as RoomDoc | undefined;
  const st = room?.recording;
  if (!room || !st?.on) return;
  const s = await getRecordingSettings(db);
  // A room on the staff test pass (lib/staff-pass.ts) records up to the top of the "Longest recording" range.
  const pass = await roomOnPass(db, room, now);
  const hours = recordingHoursWithPass(s.maxHours, pass);
  const rec: RecordingDoc = {
    roomId, cid: room.cid, communityName: room.communityName, title: room.title, hostUid: room.hostUid, hostName: room.hostName,
    status: "starting", startedAt: now.toISOString(), published: false, files: {}, stage: [room.hostUid], ...(st.forced ? { forced: true } : {}), ...(pass ? { staffPass: true } : {}),
    ...(room.paid ? { liveEventId: room.paid.eventId, ...(room.paid.record !== "replay" ? { safetyOnly: true } : {}) } : {}),
  };
  await recRef(db, st.rid).set(rec);
  const token = recorderToken(secret(), { rid: st.rid, roomId }, now.getTime(), hours * 3600 + 3600);
  try {
    await deps.recorder().start({
      rid: st.rid, roomId, maxSeconds: hours * 3600, chunkSeconds: 10,
      pageUrl: `${SITE_URL}/rooms/record/${encodeURIComponent(roomId)}?token=${encodeURIComponent(token)}`,
      uploadUrl: `${SITE_URL}/api/rooms/recorder`,
    });
  } catch (e) {
    const why = e instanceof Error ? e.message.slice(0, 200) : "the recorder didn't answer";
    console.warn("[recording] the recorder couldn't start:", why);
    await recRef(db, st.rid).update({ status: "failed", why, endedAt: now.toISOString(), keepUntil: keepUntilFrom(now, s.keepDays), firstKeepUntil: keepUntilFrom(now, s.keepDays) });
    await roomRef.update({ "recording.status": "failed", "recording.why": "The recorder couldn't join, so this live isn't being recorded." }).catch(() => {});
  }
}

// When the room ends: the recorder is told to stop and send what's left; the keep timer starts from the end.
export async function stopRoomRecording(db: Firestore, room: Pick<RoomDoc, "recording">, now = new Date(), deps: RecordingDeps = realRecordingDeps()): Promise<void> {
  const rid = room.recording?.rid;
  if (!room.recording?.on || !rid) return;
  const s = await getRecordingSettings(db);
  const ref = recRef(db, rid);
  const r = (await ref.get()).data() as RecordingDoc | undefined;
  if (!r || r.endedAt) return;
  const keepUntil = keepUntilFrom(now, s.keepDays);
  await ref.update({ endedAt: now.toISOString(), keepUntil, firstKeepUntil: keepUntil, ...(r.status === "starting" || r.status === "recording" ? { status: "finalizing" } : {}) });
  if (r.status === "starting" || r.status === "recording") await deps.recorder().stop(rid).catch((e) => console.warn("[recording] stop failed:", e instanceof Error ? e.message : e));
}

// A speaker's one tap: they agree to speak on the record, and their microphone may go up (lib/rooms.ts canPush).
export async function consentToRecording(db: Firestore, uid: string, roomId: unknown, now = new Date()): Promise<{ ok: true }> {
  const ref = db.doc(`communityRooms/${String(roomId ?? "")}`);
  const r = (await ref.get()).data() as RoomDoc | undefined;
  if (!r || r.status !== "live") throw fail(410, "The room has ended.");
  if (!r.recording?.on) return { ok: true };
  if (!r.speakers.includes(uid) || !presentIn(r, now.getTime()).includes(uid)) throw fail(409, "You're not on stage.");
  await ref.update({ [`consent.${uid}`]: now.toISOString() });
  const teen = (await db.doc(`users/${uid}`).get()).data()?.teen === true;
  await recRef(db, r.recording.rid).update({ stage: FieldValue.arrayUnion(uid), ...(teen ? { teenOnStage: true } : {}) }).catch(() => {});
  return { ok: true };
}

// ── The recorder page: a room token, receive-only ──
async function tokenRoom(db: Firestore, token: unknown) {
  const t = readRecorderToken(secret(), token);
  if (!t) throw fail(401, "That recorder link has expired.");
  const ref = db.doc(`communityRooms/${t.roomId}`);
  const r = (await ref.get()).data() as RoomDoc | undefined;
  if (!r || r.recording?.rid !== t.rid) throw fail(404, "That room wasn't found.");
  return { t, ref, r };
}
// What the page needs to record: whether the room is still on, the stage (names for the title card), the poster shown while no camera is
// up (Live mode's `poster`: an upload, the host's picture or the challenge art; a title card when there's none), and which tracks to
// receive: every stage microphone that's up, and every stage camera that's up (Live mode puts each camera up as its own track, `videoOn`).
// The recorder isn't a listener: it never has a people/ doc or a heartbeat, so it's in no listener count, no drop prompt and no
// challenge figure, and pulling cameras never touches the video-minutes budget (that counts cameras up, not viewers).
export async function recorderState(db: Firestore, token: unknown, now = new Date()) {
  const { r } = await tokenRoom(db, token);
  const poster = typeof r.poster === "string" ? r.poster : "";
  return {
    live: r.status === "live", mode: r.mode, title: r.title, communityName: r.communityName, hostName: r.hostName, poster,
    stage: [r.hostUid, ...r.speakers].filter((u) => r.joined?.[u]).map((u) => ({ uid: u, name: r.joined[u].name })),
    pulls: r.status === "live" ? pullsFor(r, RECORDER_UID, now.getTime()) : [],
    videoPulls: r.status === "live" && r.mode === "relay" ? videoPullsFor(r, RECORDER_UID, false, now.getTime()) : [],
    hostUid: r.hostUid,
  };
}
// The page's steps with Cloudflare: pull (sound, or cameras with video: true), answer and close only. It can never send.
export async function recorderRelay(db: Firestore, token: unknown, body: Record<string, unknown>, deps: Pick<RecordingDeps, "relay"> = realRecordingDeps(), now = new Date()) {
  const { ref, r } = await tokenRoom(db, token);
  if (r.status !== "live" || r.mode !== "relay") throw fail(410, "The room has ended.");
  const mine = ref.collection("relay").doc(RECORDER_UID);
  const relay = deps.relay();
  try {
    switch (body.op) {
      case "pull": {
        const video = body.video === true;
        const want = (Array.isArray(body.uids) ? body.uids : []).map(String).slice(0, 10);
        const stage = new Set((video ? videoPullsFor(r, RECORDER_UID, false, now.getTime()) : pullsFor(r, RECORDER_UID, now.getTime())).map((p) => p.uid));
        const allowed = want.filter((u) => stage.has(u));
        const records = allowed.length ? await db.getAll(...allowed.map((u) => ref.collection("relay").doc(u))) : [];
        const from = records.flatMap((d, i) => {
          const x = d.data() as RoomRelayRecord | undefined;
          const track = video ? x?.video?.trackName : x?.push?.trackName;
          return x?.sessionId && track ? [{ uid: allowed[i], sessionId: String(x.sessionId), trackName: String(track) }] : [];
        });
        if (!from.length) throw fail(409, video ? "Nobody on stage has video on right now." : "Nobody on stage is sending sound right now.");
        let sessionId = String((await mine.get()).data()?.sessionId ?? "");
        if (!sessionId || body.fresh === true) { sessionId = await relay.newSession(); await mine.set({ sessionId, at: now.toISOString(), push: null }); }
        const res = await relay.pull(sessionId, from.map((f) => ({ sessionId: f.sessionId, trackName: f.trackName })));
        const tracks = res.tracks.flatMap((t) => { const f = from.find((x) => x.trackName === t.trackName); return f && t.mid && !t.errorCode ? [{ uid: f.uid, mid: t.mid, ...(video ? { kind: "video" as const } : {}) }] : []; });
        return { offer: res.offer, renegotiate: res.renegotiate, tracks };
      }
      case "answer": {
        const answer = cleanSdp(body.answer, "answer");
        const sessionId = String((await mine.get()).data()?.sessionId ?? "");
        if (!answer || !sessionId) throw fail(400, "The answer is missing.");
        await relay.renegotiate(sessionId, answer);
        return { ok: true };
      }
      case "close": {
        const mids = (Array.isArray(body.mids) ? body.mids : []).map((m) => String(m).slice(0, 32)).filter(Boolean).slice(0, 20);
        const sessionId = String((await mine.get()).data()?.sessionId ?? "");
        if (sessionId && mids.length) await relay.close(sessionId, mids);
        return { ok: true };
      }
      default: throw fail(400, "The recorder can only receive.");
    }
  } catch (e) {
    if (e instanceof RelayError) throw fail(502, `The relay didn't answer: ${e.why}`);
    throw e;
  }
}

// ── From the recorder service (signed requests; the route checks the signature) ──
export async function recorderStatus(db: Firestore, rid: unknown, status: unknown, why: unknown, now = new Date()): Promise<{ ok: true }> {
  const { ref, r } = await readRec(db, rid);
  if (status === "recording" && r.status === "starting") {
    await ref.update({ status: "recording" });
    await db.doc(`communityRooms/${r.roomId}`).update({ "recording.status": "on" }).catch(() => {});
  } else if (status === "failed" && (r.status === "starting" || r.status === "recording")) {
    const s = await getRecordingSettings(db);
    const w = String(why ?? "").slice(0, 200) || "the recorder stopped";
    await ref.update({ status: r.files.stage || r.files.audio ? "finalizing" : "failed", why: w, ...(r.keepUntil ? {} : { keepUntil: keepUntilFrom(now, s.keepDays), firstKeepUntil: keepUntilFrom(now, s.keepDays) }) });
    await db.doc(`communityRooms/${r.roomId}`).update({ "recording.status": "failed", "recording.why": "The recorder stopped, so the rest of this live isn't being recorded." }).catch(() => {});
  }
  return { ok: true };
}

// One chunk (~10 seconds) of one file. Chunks of a file come in order, one at a time (the recorder waits for each answer); a chunk sent
// twice (a retry) is taken once.
export async function ingestChunk(db: Firestore, rid: unknown, kindIn: unknown, seqIn: unknown, bytes: Uint8Array, deps: Pick<RecordingDeps, "store"> = realRecordingDeps(), now = new Date()): Promise<{ ok: true; duplicate?: boolean; parts: number }> {
  const { ref, r } = await readRec(db, rid);
  const kind = kindIn as RecordingFileKind;
  if (!RECORDING_FILES.includes(kind)) throw fail(400, "Which file?");
  const seq = Number(seqIn);
  if (!Number.isInteger(seq) || seq < 1 || seq > 100_000) throw fail(400, "Which chunk?");
  if (!bytes.byteLength || bytes.byteLength > CHUNK_MAX_BYTES) throw fail(413, "A chunk must be under 4 MB.");
  if (r.status !== "starting" && r.status !== "recording" && r.status !== "finalizing") throw fail(409, "This recording is closed.");
  const s = await getRecordingSettings(db);
  const hours = recordingHoursWithPass(s.maxHours, await roomOnPass(db, r, now));
  if (now.getTime() - Date.parse(r.startedAt) > (hours * 3600 + 300) * 1000) throw fail(413, "The recording has reached its longest length.");
  const store = deps.store();
  const prev = r.files[kind];
  if (prev && seq <= prev.lastSeq) return { ok: true, duplicate: true, parts: prev.parts.length };
  const f: RecordingFile = prev ?? { key: fileKey(ref.id, kind), type: fileType(kind), uploadId: await store.createMultipart(fileKey(ref.id, kind), fileType(kind)), parts: [], pending: [], lastSeq: 0, size: 0, done: false };
  const pendingKey = `recordings/${ref.id}/pending/${kind}/${String(seq).padStart(6, "0")}`;
  await store.put(pendingKey, bytes, f.type);
  f.pending = [...f.pending, { seq, size: bytes.byteLength, key: pendingKey }];
  f.lastSeq = seq; f.size += bytes.byteLength;
  if (partReady(f.pending)) await flushPart(store, f);
  await ref.update({ [`files.${kind}`]: f, ...(r.status === "starting" ? { status: "recording" } : {}) });
  return { ok: true, parts: f.parts.length };
}
// The waiting chunks, joined in order into the next part (the small objects go once the part is up).
async function flushPart(store: RecordingStore, f: RecordingFile): Promise<void> {
  if (!f.pending.length) return;
  const chunks: Uint8Array[] = [];
  for (const p of [...f.pending].sort((a, b) => a.seq - b.seq)) {
    const b = await store.get(p.key);
    if (!b) throw fail(500, "A chunk went missing in storage.");
    chunks.push(b);
  }
  const total = chunks.reduce((a, c) => a + c.byteLength, 0);
  const joined = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { joined.set(c, at); at += c.byteLength; }
  const n = f.parts.length + 1;
  const etag = await store.uploadPart(f.key, f.uploadId, n, joined);
  for (const p of f.pending) await store.del(p.key);
  f.parts = [...f.parts, { n, etag, size: total }];
  f.pending = [];
}

// After the recorder stopped: what's left of each file becomes its last part and the upload is completed. The recording is then
// ready to play; the keep timer runs from the end of the live.
export async function finalizeRecording(db: Firestore, rid: unknown, info: { hadVideo?: unknown; seconds?: unknown }, deps: Pick<RecordingDeps, "store"> = realRecordingDeps(), now = new Date()): Promise<{ status: RecordingDoc["status"] }> {
  const { ref, r } = await readRec(db, rid);
  if (r.status === "ready" || r.status === "deleted") return { status: r.status };
  const store = deps.store();
  const files: RecordingDoc["files"] = {};
  for (const kind of RECORDING_FILES) {
    const f = r.files[kind];
    if (!f) continue;
    if (!f.done) {
      if (f.pending.length) await flushPart(store, f);
      if (f.parts.length) { await store.complete(f.key, f.uploadId, f.parts.map((p) => ({ n: p.n, etag: p.etag }))); f.done = true; }
      else await store.abort(f.key, f.uploadId);
    }
    if (f.done) files[kind] = f;
  }
  const s = await getRecordingSettings(db);
  const ended = r.endedAt ?? now.toISOString();
  const keepUntil = r.keepUntil ?? keepUntilFrom(ended, s.keepDays);
  const seconds = Number(info.seconds);
  const status: RecordingDoc["status"] = Object.keys(files).length ? "ready" : "failed";
  await ref.update({
    files, status, readyAt: now.toISOString(), endedAt: ended, keepUntil, firstKeepUntil: r.firstKeepUntil ?? keepUntil,
    hadVideo: info.hadVideo === true || r.hadVideo === true, ...(Number.isFinite(seconds) && seconds > 0 ? { seconds: Math.round(seconds) } : {}),
    ...(status === "failed" && !r.why ? { why: "Nothing was recorded." } : {}),
  });
  // Stopped at its longest length while the room goes on: the room says so (the notice stays, since the start was recorded).
  await db.doc(`communityRooms/${r.roomId}`).update({ "recording.status": "stopped" }).catch(() => {});
  return { status };
}

// ── Deleting ──
async function removeFiles(store: RecordingStore, r: RecordingDoc): Promise<void> {
  for (const kind of RECORDING_FILES) {
    const f = r.files[kind];
    if (!f) continue;
    for (const p of f.pending) await store.del(p.key);
    if (f.done) await store.del(f.key); else await store.abort(f.key, f.uploadId);
  }
}
// The recording's files go; the doc stays as a short note (when and why), with no way back to the media.
async function deleteRecordingNow(db: Firestore, ref: FirebaseFirestore.DocumentReference, r: RecordingDoc, why: NonNullable<RecordingDoc["deletedWhy"]>, deps: Pick<RecordingDeps, "store">, now: Date) {
  await removeFiles(deps.store(), r);
  await ref.update({ status: "deleted", deletedAt: now.toISOString(), deletedWhy: why, files: {}, published: false, replayId: FieldValue.delete() });
}

// The cron (app/api/cron/reminders, job "recordings"): recordings past their keep date and not published are deleted; a recording the
// recorder never finished (it crashed) is finished from what arrived, a few hours after its longest length.
export async function sweepRecordings(db: Firestore, deps: RecordingDeps = realRecordingDeps(), now = new Date()): Promise<{ deleted: number; finished: number }> {
  const s = await getRecordingSettings(db);
  let deleted = 0, finished = 0;
  const due = await db.collection("roomRecordings").where("keepUntil", "<=", now.toISOString()).limit(200).get();
  for (const d of due.docs) {
    const r = d.data() as RecordingDoc;
    if (!dueForDeletion(r, s.keepDays, now.getTime())) continue;
    await deleteRecordingNow(db, d.ref, r, "kept-days", deps, now).then(() => deleted++).catch((e) => console.error("[recording] couldn't delete", d.id, e));
  }
  const open = await db.collection("roomRecordings").where("status", "in", ["starting", "recording", "finalizing"]).limit(50).get();
  for (const d of open.docs) {
    const r = d.data() as RecordingDoc;
    const quiet = now.getTime() - Date.parse(r.endedAt ?? r.startedAt) > (r.endedAt ? 2 * 3600_000 : (recordingHoursWithPass(s.maxHours, r.staffPass === true) + 2) * 3600_000);
    if (!quiet) continue;
    await finalizeRecording(db, d.id, {}, deps, now).then(() => finished++).catch((e) => console.error("[recording] couldn't finish", d.id, e));
  }
  return { deleted, finished };
}

// ── For the host and for safety review ──
export type RecordingRow = { id: string; title: string; communityName: string; status: RecordingDoc["status"]; why?: string; startedAt: string; endedAt?: string; keepUntil?: string; published: boolean; replayId?: string; seconds?: number; hadVideo?: boolean; hostName?: string; forced?: boolean; teenOnStage?: boolean; paidLive?: boolean; safetyOnly?: boolean };
const row = (id: string, r: RecordingDoc): RecordingRow => ({
  id, title: r.title, communityName: r.communityName, status: r.status, ...(r.why ? { why: r.why } : {}), startedAt: r.startedAt, endedAt: r.endedAt, keepUntil: r.keepUntil,
  published: r.published, replayId: r.replayId, seconds: r.seconds, hadVideo: r.hadVideo, hostName: r.hostName, forced: r.forced, teenOnStage: r.teenOnStage,
  ...(r.liveEventId ? { paidLive: true } : {}), ...(r.safetyOnly ? { safetyOnly: true } : {}),
});
export async function myRecordings(db: Firestore, uid: string): Promise<RecordingRow[]> {
  const snap = await db.collection("roomRecordings").where("hostUid", "==", uid).limit(200).get();
  return snap.docs.map((d) => row(d.id, d.data() as RecordingDoc)).filter((x) => x.status !== "deleted").sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export async function allRecordings(db: Firestore): Promise<RecordingRow[]> {
  const snap = await db.collection("roomRecordings").orderBy("startedAt", "desc").limit(100).get();
  return snap.docs.map((d) => row(d.id, d.data() as RecordingDoc));
}
// A link to play a recording (15 minutes): the host for their own, an admin with the moderation role for any.
export async function playRecording(db: Firestore, uid: string, rid: unknown, admin: boolean, deps: Pick<RecordingDeps, "store"> = realRecordingDeps()): Promise<{ url: string; type: string }> {
  const { r } = await readRec(db, rid);
  if (r.hostUid !== uid && !admin) throw fail(404, "That recording wasn't found.");
  const f = r.files.stage?.done ? r.files.stage : r.files.audio?.done ? r.files.audio : null;
  if (!f) throw fail(409, r.status === "deleted" ? "This recording was deleted." : "This recording isn't ready yet.");
  return { url: await deps.store().signedGet(f.key, 900, f.type), type: f.type };
}
export async function deleteRecording(db: Firestore, uid: string, rid: unknown, deps: RecordingDeps = realRecordingDeps(), now = new Date()): Promise<{ ok: true }> {
  const { ref, r } = await readRec(db, rid);
  if (r.hostUid !== uid) throw fail(404, "That recording wasn't found.");
  if (r.status === "starting" || r.status === "recording") throw fail(409, "End the live first.");
  if (r.published && r.replayId) await removeReplay(db, r.replayId, deps);
  if (r.status !== "deleted") await deleteRecordingNow(db, ref, r, "host", deps, now);
  return { ok: true };
}

// ── Replays ──
const replayRef = (db: Firestore, id: string) => db.doc(`replays/${id}`);
async function readReplay(db: Firestore, id: unknown) {
  const s = String(id ?? "");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(s)) throw fail(404, "That replay wasn't found.");
  const ref = replayRef(db, s);
  const r = (await ref.get()).data() as ReplayDoc | undefined;
  if (!r) throw fail(404, "That replay wasn't found.");
  return { ref, r };
}
// Publishing: the recording is copied to Cloudflare Stream (so it streams well and plays only with a signed token), and the replay shows
// in the host's Media area and, when it's for everyone or subscribers, on Explore and Trending. Not a journal post (Share to Journal).
export async function publishReplay(db: Firestore, uid: string, rid: unknown, input: { title?: unknown; audience?: unknown }, deps: RecordingDeps = realRecordingDeps(), now = new Date()): Promise<{ id: string; audience: ReplayDoc["audience"]; why?: string }> {
  const { ref, r } = await readRec(db, rid);
  if (r.hostUid !== uid) throw fail(404, "That recording wasn't found.");
  if (r.status !== "ready") throw fail(409, r.status === "deleted" ? "This recording was deleted." : "This recording isn't ready yet.");
  if (r.published && r.replayId) return { id: r.replayId, audience: (await readReplay(db, r.replayId)).r.audience };
  // A paid live recorded for safety only (the host's choice, announced to everyone as they joined) is never offered as a replay.
  if (r.safetyOnly) throw fail(409, "This paid live was recorded for safety review only, so it can't be offered as a replay.");
  // A team member on the staff test pass (lib/staff-pass.ts) skips the plan switch; teen rules and the audience checks below still apply.
  if (limitFor("replayPublish", await memberTier(db, uid), await getLimitOverrides(db)) <= 0 && !(await hasStaffPass(db, uid, now))) throw fail(403, "Your plan doesn't include publishing replays.");
  const host = (await db.doc(`users/${uid}`).get()).data() ?? {};
  const { audience, why } = audienceFor(input.audience, { hostTeen: host.teen === true, teenOnStage: r.teenOnStage === true });
  const f = r.files.stage?.done ? r.files.stage : r.files.audio?.done ? r.files.audio : null;
  if (!f) throw fail(409, "This recording has nothing to play.");
  const title = cleanReplayTitle(input.title) || r.title;
  // A video replay is copied to Stream with the host's NotesApp mark burned in (owner, 5 Nov 2026), so no unmarked replay is ever on
  // Stream. An audio replay has no picture to mark. The recording in the private bucket isn't served to viewers; it keeps its own keep rules.
  const video = f === r.files.stage && r.hadVideo === true;
  const hostUsername = String(host.username ?? "");
  const watermarkUid = video && hostUsername ? await deps.stream().mark(db, { uid, username: hostUsername }) : undefined;
  const streamUid = await deps.stream().copy(await deps.store().signedGet(f.key, 6 * 3600, f.type), uid, title, watermarkUid);
  const id = `${now.getTime().toString(36)}${randomBytes(5).toString("hex")}`;
  const doc: ReplayDoc = {
    rid: ref.id, roomId: r.roomId, cid: r.cid, communityName: r.communityName, hostUid: uid, hostUsername: String(host.username ?? ""), hostName: String(host.displayName ?? r.hostName), hostAvatar: String(host.avatar ?? ""),
    title, audience, listed: isListed(audience) && host.teen !== true && host.keepHidden !== true, kind: r.hadVideo ? "video" : "audio",
    status: "processing", streamUid, ...(watermarkUid ? { marked: true } : {}), createdAt: r.startedAt, publishedAt: now.toISOString(), views: 0,
    transcript: deps.transcriber() && r.files.audio?.done ? { status: "queued" } : { status: "off" },
    ...(r.liveEventId ? { liveEventId: r.liveEventId } : {}),
  };
  await replayRef(db, id).set(doc);
  await ref.update({ published: true, replayId: id });
  return { id, audience, ...(why ? { why } : {}) };
}
async function removeReplay(db: Firestore, replayId: string, deps: Pick<RecordingDeps, "stream">) {
  const ref = replayRef(db, replayId);
  const r = (await ref.get()).data() as ReplayDoc | undefined;
  if (!r) return;
  if (r.noteId) await db.doc(`notes/${r.noteId}`).delete().catch(() => {});
  if (r.streamUid) await deps.stream().remove(r.streamUid).catch(() => {});
  await ref.delete();
}
// Unpublishing: the replay and its journal post go. Inside the recording's first keep window the timer restarts; after it, the
// recording is deleted too.
export async function unpublishReplay(db: Firestore, uid: string, replayId: unknown, deps: RecordingDeps = realRecordingDeps(), now = new Date()): Promise<{ kept: boolean; keepUntil?: string }> {
  const { r } = await readReplay(db, replayId);
  if (r.hostUid !== uid) throw fail(404, "That replay wasn't found.");
  await removeReplay(db, String(replayId), deps);
  const rec = await recRef(db, r.rid).get();
  const rd = rec.data() as RecordingDoc | undefined;
  if (!rd || rd.status === "deleted") return { kept: false };
  const s = await getRecordingSettings(db);
  const next = afterUnpublish(rd, s.keepDays, now.getTime());
  if (next.keep) { await rec.ref.update({ published: false, replayId: FieldValue.delete(), keepUntil: next.keepUntil }); return { kept: true, keepUntil: next.keepUntil }; }
  await deleteRecordingNow(db, rec.ref, rd, "unpublished-late", deps, now);
  return { kept: false };
}

// Whether a viewer may watch, from the replay's audience (lib/live-recording.ts mayWatch).
async function viewerCan(db: Firestore, r: ReplayDoc, uid: string | undefined): Promise<boolean> {
  if (r.audience === "public" || (uid && uid === r.hostUid)) return true;
  if (!uid) return false;
  if (r.audience === "subscribers") {
    const sub = (await db.doc(`subscriptions/${uid}_${r.hostUsername}`).get()).data();
    const subscribed = !!sub && (sub.status === "demo" || (!!sub.currentPeriodEnd && Date.parse(sub.currentPeriodEnd) > Date.now()));
    return mayWatch(r, { uid, subscribed, member: false });
  }
  if (r.liveEventId) return mayWatch(r, { uid, subscribed: false, member: await holdsLiveTicket(db, r.liveEventId, uid) });
  return mayWatch(r, { uid, subscribed: false, member: !!activeRole(await memberOf(db, r.cid, uid)) });
}
export type ReplayCard = Pick<ReplayDoc, "title" | "hostUid" | "hostName" | "hostUsername" | "hostAvatar" | "communityName" | "audience" | "kind" | "status" | "duration" | "publishedAt" | "views"> & { id: string; noteId?: string };
const card = (id: string, r: ReplayDoc): ReplayCard => ({ id, title: r.title, hostUid: r.hostUid, hostName: r.hostName, hostUsername: r.hostUsername, hostAvatar: r.hostAvatar, communityName: r.communityName, audience: r.audience, kind: r.kind, status: r.status, duration: r.duration, publishedAt: r.publishedAt, views: r.views, ...(r.noteId ? { noteId: r.noteId } : {}) });
// Stream finishes copying in a minute or two: the first look after that marks the replay ready.
async function freshen(db: Firestore, id: string, r: ReplayDoc, deps: Pick<RecordingDeps, "stream">): Promise<ReplayDoc> {
  if (r.status !== "processing") return r;
  const v = await deps.stream().get(r.streamUid).catch(() => null);
  if (!v?.ready) return r;
  const next = { ...r, status: "ready" as const, ...(v.duration ? { duration: Math.round(v.duration) } : {}) };
  await replayRef(db, id).update({ status: "ready", ...(v.duration ? { duration: Math.round(v.duration) } : {}) });
  return next;
}
// One replay for its page: the card, whether this viewer may watch, and the player link (signed, hours long) when they may.
export async function replayForViewer(db: Firestore, viewer: string | undefined, id: unknown, deps: RecordingDeps = realRecordingDeps()): Promise<{ replay: ReplayCard; canWatch: boolean; player?: string; mine: boolean; transcript?: ReplayDoc["transcript"] }> {
  const { r: r0 } = await readReplay(db, id);
  const r = await freshen(db, String(id), r0, deps);
  const canWatch = await viewerCan(db, r, viewer);
  const mine = viewer === r.hostUid;
  return { replay: card(String(id), r), canWatch, mine, ...(canWatch && r.status === "ready" ? { player: await deps.stream().player(r.streamUid) } : {}), ...(mine ? { transcript: r.transcript } : {}) };
}
// The host's Media area.
export async function myReplays(db: Firestore, uid: string): Promise<ReplayCard[]> {
  const snap = await db.collection("replays").where("hostUid", "==", uid).limit(200).get();
  return snap.docs.map((d) => card(d.id, d.data() as ReplayDoc)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
// Explore (newest) and Trending (most watched in the last days, from the pageViews buckets kind "replay"): listed replays only.
export async function listedReplays(db: Firestore, o: { sort: "new" | "trending"; days?: number }): Promise<ReplayCard[]> {
  const snap = await db.collection("replays").where("listed", "==", true).limit(300).get();
  const rows = snap.docs.map((d) => card(d.id, d.data() as ReplayDoc)).filter((x) => x.status === "ready");
  if (o.sort === "new") return rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40);
  const cutoff = new Date(Date.now() - Math.min(30, Math.max(1, o.days ?? 7)) * 86_400_000).toISOString().slice(0, 10);
  const views = await db.collection("pageViews").where("day", ">=", cutoff).get();
  const count = new Map<string, number>();
  views.docs.forEach((d) => { const b = d.data(); if (b.kind === "replay") count.set(String(b.id), (count.get(String(b.id)) ?? 0) + (Number(b.count) || 0)); });
  return rows.map((x) => ({ ...x, views: count.get(x.id) ?? 0 })).filter((x) => x.views > 0).sort((a, b) => b.views - a.views).slice(0, 20);
}

// Share to Journal: a journal draft (the host edits and publishes it from the editor, free or for subscribers like any post) with the
// replay embedded (the post's replayId), Nana's summary and chapters, and the transcript when there is one. A "Book a session" card
// stays under it, as under every post. A replay kept inside its community can't become a post.
export async function shareReplayToJournal(db: Firestore, uid: string, replayId: unknown, deps: RecordingDeps = realRecordingDeps(), now = new Date()): Promise<{ noteId: string; editHref: string; summary: boolean; transcript: boolean }> {
  const { ref, r } = await readReplay(db, replayId);
  if (r.hostUid !== uid) throw fail(404, "That replay wasn't found.");
  if (r.audience === "community") throw fail(409, "This replay stays inside its community, so it can't become a journal post.");
  if (r.noteId && (await db.doc(`notes/${r.noteId}`).get()).exists) return { noteId: r.noteId, editHref: `/write/${r.noteId}/edit`, summary: false, transcript: false };
  const u = (await db.doc(`users/${uid}`).get()).data() ?? {};
  if (!getTierConfig(await memberTier(db, uid)).canPublish) throw fail(403, "Journal posts need a publishing plan (Free Basic or above).");
  const transcript = r.transcript?.status === "ready" ? r.transcript.text ?? "" : "";
  const summary = transcript ? await deps.summarise(db, uid, r.title, transcript).catch(() => null) : null;
  const transcriptNote = r.transcript?.status === "queued" ? "The transcript is still being made; add it later from your Media area." : r.transcript?.status === "too-long" ? "This live was too long for a transcript." : undefined;
  let slug = slugify(r.title) || "replay";
  if (!(await db.collection("notes").where("slug", "==", slug).limit(1).get()).empty) slug = `${slug}-${randomBytes(3).toString("hex")}`;
  const note = {
    viewCount: 0, likeCount: 0, shareCount: 0, slug, title: r.title, date: now.toISOString(), categories: [], tags: [], featured_image: "",
    content: replayJournalDraft({ title: r.title, summary: summary ?? undefined, transcript, replayPath: `/replays/${ref.id}`, transcriptNote }),
    author: String(u.displayName ?? r.hostName), author_role: "", author_avatar: String(u.avatar ?? ""), authorUid: uid, authorUsername: String(u.username ?? ""),
    status: "draft", premium: r.audience === "subscribers", replayId: ref.id, from: "replay",
  };
  const added = await db.collection("notes").add(note);
  await ref.update({ noteId: added.id });
  return { noteId: added.id, editHref: `/write/${added.id}/edit`, summary: !!summary, transcript: !!transcript };
}

// The cron's transcript step: a few queued replays at a time, from the recording's sound file.
export async function transcribeReplays(db: Firestore, deps: RecordingDeps = realRecordingDeps()): Promise<number> {
  const t = deps.transcriber();
  if (!t) return 0;
  const snap = await db.collection("replays").where("transcript.status", "==", "queued").limit(3).get();
  let done = 0;
  for (const d of snap.docs) {
    const r = d.data() as ReplayDoc;
    const rec = (await recRef(db, r.rid).get()).data() as RecordingDoc | undefined;
    const f = rec?.files.audio;
    if (!f?.done) { await d.ref.update({ transcript: { status: "failed", why: "no sound file" } }); continue; }
    if (f.size > 25 * 1024 * 1024) { await d.ref.update({ transcript: { status: "too-long" } }); continue; }
    try {
      const bytes = await deps.store().get(f.key);
      if (!bytes) throw new Error("the sound file is missing");
      const text = (await t(bytes, f.type)).trim().slice(0, 200_000);
      await d.ref.update({ transcript: text ? { status: "ready", text } : { status: "failed", why: "nothing could be heard" } });
      done++;
    } catch (e) {
      const tooLong = e instanceof RecordingError && e.message === "too-long";
      await d.ref.update({ transcript: tooLong ? { status: "too-long" } : { status: "failed", why: e instanceof Error ? e.message.slice(0, 160) : "failed" } });
    }
  }
  return done;
}
