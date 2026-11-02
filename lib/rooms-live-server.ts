import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { RoomDoc, RoomRelayRecord, RoomSettings } from "./rooms";
import {
  addSample, budgetUsed, canVideo, emptyLive, liveVideoOff, liveVideoOn, minutesLeft, promptDue, promptFresh, promptText,
  type HostLive, type LiveState,
} from "./rooms-live";
import type { RelayClient } from "./rooms-relay-server";
import { CommunityError } from "./community-server";

// Live mode's server side (lib/rooms-live.ts): the video minutes, the cameras that are up, the listener samples and the host's prompts.
// Each piece of shared state sits behind one small function here (noteListenerSample, markVideoOn, markVideoOff, hostLive), so the
// transport underneath (Firestore today; a Durable Object for the live signals in step 2b) can change without touching the rules above.
//
// communityRooms/{id}/live/state: LiveState, server-only (firestore.rules). One doc per room, written on a camera on or off, a listener
// sample (at most one per ROOM_COUNT_EVERY_MS) and a prompt: never once per listener.

const stateRef = (db: Firestore, roomId: string) => db.doc(`communityRooms/${roomId}/live/state`);
const asState = (x: unknown): LiveState => ({ ...emptyLive(), ...((x as Partial<LiveState>) ?? {}) });
export async function readLive(db: Firestore, roomId: string): Promise<LiveState> {
  return asState((await stateRef(db, roomId).get()).data());
}

// The listener count, sampled for the drop prompt: called wherever the count is refreshed (lib/rooms-server.ts recount, at most every
// ROOM_COUNT_EVERY_MS; step 2b calls it from its own count). Only rooms with Live mode on keep samples.
export async function noteListenerSample(db: Firestore, roomId: string, n: number, s: RoomSettings, now = new Date()): Promise<void> {
  if (s.videoOn <= 0) return;
  const ref = stateRef(db, roomId);
  await db.runTransaction(async (t) => {
    const st = asState((await t.get(ref)).data());
    const samples = addSample(st.samples, n, now.toISOString(), s);
    if (samples !== st.samples) t.set(ref, { ...st, samples });
  });
}

// A camera goes up: checked again inside the transaction (still allowed, minutes left, not in the grace after the budget ran out), then
// the room says it's up (everyone pulls it) and the clock starts. Idempotent: a camera already up keeps its start.
export async function markVideoOn(db: Firestore, roomId: string, uid: string, s: RoomSettings, now = new Date()): Promise<void> {
  const room = db.doc(`communityRooms/${roomId}`), ref = stateRef(db, roomId);
  const at = now.toISOString();
  await db.runTransaction(async (t) => {
    const [r, raw] = [(await t.get(room)).data() as RoomDoc | undefined, (await t.get(ref)).data()];
    const st = asState(raw);
    if (!r || !canVideo(r, uid, s, now.getTime())) throw new CommunityError(403, "Only the host, and speakers when the host allows it, can turn video on.");
    if (!st.open[uid] && (budgetUsed(st, s, now.getTime()) || st.graceUntil)) throw new CommunityError(409, USED_UP);
    t.set(ref, liveVideoOn(st, uid, at));
    if (!r.videoOn?.[uid]) t.update(room, { [`videoOn.${uid}`]: at });
  });
}

// Before Cloudflare hears of a camera: refused once this live's minutes are used up (or the grace after them has started).
export async function videoBudgetLeft(db: Firestore, roomId: string, uid: string, s: RoomSettings, now = new Date()): Promise<void> {
  const st = await readLive(db, roomId);
  if (!st.open[uid] && (budgetUsed(st, s, now.getTime()) || st.graceUntil)) throw new CommunityError(409, USED_UP);
}
const USED_UP = "This live's video minutes are used up. Carry on with sound; your poster shows.";

// Cameras go down: their time is added and the room stops showing them. Idempotent: a camera that isn't up changes nothing.
export async function markVideoOff(db: Firestore, roomId: string, uids: string[], now = new Date()): Promise<void> {
  if (!uids.length) return;
  const room = db.doc(`communityRooms/${roomId}`), ref = stateRef(db, roomId);
  const at = now.toISOString();
  await db.runTransaction(async (t) => {
    const [r, raw] = [(await t.get(room)).data() as RoomDoc | undefined, (await t.get(ref)).data()];
    let st = asState(raw);
    for (const u of uids) st = liveVideoOff(st, u, at);
    if (raw || Object.keys(st.open).length) t.set(ref, st);
    const gone = uids.filter((u) => r?.videoOn?.[u]);
    if (r && gone.length) t.update(room, Object.fromEntries(gone.map((u) => [`videoOn.${u}`, FieldValue.delete()])));
  });
}

// Cuts someone's camera at Cloudflare (forced, no SDP exchange) and forgets the track; then marks it down.
export async function stopVideo(db: Firestore, roomId: string, uid: string, relay: () => RelayClient, now = new Date()): Promise<void> {
  const ref = db.doc(`communityRooms/${roomId}/relay/${uid}`);
  const cur = (await ref.get()).data() as RoomRelayRecord | undefined;
  if (cur?.video?.mid) {
    await ref.set({ video: null }, { merge: true });
    await relay().close(cur.sessionId, [cur.video.mid]).catch(() => {});
  }
  await markVideoOff(db, roomId, [uid], now);
}

// Enforces the budget: once the minutes are used up, the grace starts; once the grace is over, every camera goes down. Called on the
// beats of the stage (not the listeners', so a big room adds nothing) and from hostLive.
export async function enforceVideoBudget(db: Firestore, roomId: string, s: RoomSettings, relay: () => RelayClient, now = new Date()): Promise<LiveState> {
  const ref = stateRef(db, roomId);
  const st = await db.runTransaction(async (t) => {
    const cur = asState((await t.get(ref)).data());
    if (!Object.keys(cur.open).length || cur.graceUntil || !budgetUsed(cur, s, now.getTime())) return cur;
    const next = { ...cur, graceUntil: new Date(now.getTime() + s.videoGraceSeconds * 1000).toISOString() };
    t.set(ref, next);
    return next;
  });
  if (st.graceUntil && Date.parse(st.graceUntil) <= now.getTime() && Object.keys(st.open).length) {
    for (const u of Object.keys(st.open)) await stopVideo(db, roomId, u, relay, now);
    return readLive(db, roomId);
  }
  return st;
}

// What the host sees on each beat: minutes left, whether video is up, and a prompt when one is due (each prompt once in a while).
export async function hostLive(db: Firestore, roomId: string, s: RoomSettings, relay: () => RelayClient, now = new Date()): Promise<HostLive> {
  const st0 = await enforceVideoBudget(db, roomId, s, relay, now);
  const t = now.getTime();
  const kind = promptDue(st0, s, t);
  let prompt: HostLive["prompt"] = null;
  if (kind && promptFresh(st0, kind, s, t)) {
    const at = now.toISOString();
    await stateRef(db, roomId).set({ prompted: { ...(st0.prompted ?? {}), [kind]: at } }, { merge: true });
    prompt = { kind, text: promptText(kind, s), at };
  }
  return { budgetMinutes: s.videoBudgetMinutes, minutesLeft: minutesLeft(st0, s, t), videoOn: Object.keys(st0.open).length > 0, prompt, graceUntil: st0.graceUntil ?? null };
}

// When the room ends: the cameras' time is closed and the total returned (kept on the room doc for replays, step 2c).
export async function closeLive(db: Firestore, roomId: string, now = new Date()): Promise<number> {
  const st = await readLive(db, roomId);
  let done = st;
  for (const u of Object.keys(st.open)) done = liveVideoOff(done, u, now.toISOString());
  return done.usedMs;
}
