import { createHmac } from "crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { CommunityError } from "./community-server";
import { canPull, stageOf, type RoomChat, type RoomDoc } from "./rooms";
import { canPullVideo } from "./rooms-live";
import { defaultDeps, getRoomSettings, type RoomDeps } from "./rooms-server";
import { RelayError } from "./rooms-relay-server";
import { GUEST_GONE_MS, guestChat, guestLimit, guestNo, isGuestId, type GuestChatLine, type GuestNo } from "./live-guests";

// Watching a live without an account (docs/GUEST_LIVES.md): the server side. Server only.
//   communityRooms/{id}/guests/{guestId}: { at, seen, sessionId? }: a guest watching now (their relay session, receive only).
//   liveGuestStats/{YYYY-MM-DD}: { views, joined, signedIn, seconds }: the day's guest views, the guests who joined #NotesApp or signed
//   in from a live, and the seconds guests spent watching (for the cost), for Admin → Limits.
// A guest never reads Firestore: everything they see comes through /api/lives/watch, from guestView below.

const STATS = "liveGuestStats";
const day = (now: Date) => now.toISOString().slice(0, 10);
const bump = (db: Firestore, now: Date, f: Record<string, number>) =>
  db.collection(STATS).doc(day(now)).set({ day: day(now), ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, FieldValue.increment(v)])) }, { merge: true });

// The key guest passes are signed with: derived from the server's own secret, never the secret itself. Without one, guests are off.
export function guestKey(): Buffer | null {
  const raw = setting("ACCOUNT_DATA_KEY") || setting("LIVE_ROOMS_SECRET");
  return raw ? createHmac("sha256", raw).update("notesapp-live-guest-v1").digest() : null;
}

type Room = { ref: FirebaseFirestore.DocumentReference; r: RoomDoc };
async function roomOf(db: Firestore, id: unknown): Promise<Room> {
  const s = String(id ?? "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(s)) throw new CommunityError(404, "That live wasn't found.");
  const ref = db.doc(`communityRooms/${s}`);
  const r = (await ref.get()).data() as RoomDoc | undefined;
  if (!r) throw new CommunityError(404, "That live wasn't found.");
  return { ref, r };
}
const hostTeenCache = new Map<string, { at: number; teen: boolean }>();
async function hostIsTeen(db: Firestore, uid: string, now: number): Promise<boolean> {
  const c = hostTeenCache.get(uid);
  if (c && now - c.at < 60_000) return c.teen;
  const teen = (await db.doc(`users/${uid}`).get()).data()?.teen === true;
  hostTeenCache.set(uid, { at: now, teen });
  return teen;
}
const guestsOf = (ref: FirebaseFirestore.DocumentReference) => ref.collection("guests");
async function guestsNow(ref: FirebaseFirestore.DocumentReference, now: Date): Promise<number> {
  return guestsOf(ref).where("seen", ">=", new Date(now.getTime() - GUEST_GONE_MS).toISOString()).count().get().then((c) => c.data().count);
}

// ── What a guest sees ────────────────────────────────────────────────────────────────────────────────────────────────────────
export type GuestView = {
  id: string; status: "live" | "ended"; title: string; poster: string;
  host: { name: string; username: string; avatar: string };
  no: GuestNo | null; // why they can't watch, or null when they can
  watching: number; guests: number; likes: number;
  // The stage: who is on it, and what to receive from each (the key changes when a microphone or camera goes up again).
  stage: { uid: string; name: string; avatar: string; sound: string | null; video: string | null }[];
  chat: GuestChatLine[]; pinned: string;
};
// Each live's view is shared by every guest for a moment, so a big audience costs a handful of reads, not one per guest.
const views = new Map<string, { at: number; v: GuestView }>();
const VIEW_MS = 2_000;
export const resetGuestViews = () => { views.clear(); hostTeenCache.clear(); };

export async function guestView(db: Firestore, id: unknown, now = new Date()): Promise<GuestView> {
  const key = String(id ?? "");
  const hit = views.get(key);
  if (hit && now.getTime() - hit.at < VIEW_MS) return hit.v;
  const { ref, r } = await roomOf(db, key);
  const settings = await getRoomSettings(db);
  const teen = await hostIsTeen(db, r.hostUid, now.getTime());
  const no = guestNo(r, settings, { hostTeen: teen, guests: r.guests ?? 0 });
  const t = now.getTime();
  const host = { name: r.hostName, username: r.profile?.hostUsername ?? r.hostUsername ?? "", avatar: r.joined?.[r.hostUid]?.avatar ?? "" };
  let stage: GuestView["stage"] = [], chat: GuestChatLine[] = [];
  if (!no) {
    stage = stageOf(r, t).map((u) => ({
      uid: u, name: r.joined[u]?.name ?? "", avatar: r.joined[u]?.avatar ?? "",
      sound: r.published?.[u] && !r.micMuted?.[u] ? `${u}@${r.published[u]}` : null,
      video: r.videoOn?.[u] ? `${u}@${r.videoOn[u]}` : null,
    }));
    const snap = await ref.collection("chat").orderBy("at", "desc").limit(60).get();
    chat = guestChat(snap.docs.reverse().map((d) => ({ id: d.id, m: d.data() as RoomChat & { teen?: boolean } })));
  }
  const v: GuestView = {
    id: key, status: r.status, title: r.title, poster: r.poster ?? "", host, no,
    watching: Math.max(r.listening ?? 0, Object.keys(r.joined ?? {}).length) + (r.guests ?? 0), guests: r.guests ?? 0, likes: r.likes ?? 0,
    stage, chat, pinned: r.pinned?.text ?? "",
  };
  views.set(key, { at: now.getTime(), v });
  return v;
}

// ── Coming in, staying, leaving ──────────────────────────────────────────────────────────────────────────────────────────────
export async function guestJoin(db: Firestore, id: unknown, gid: string, now = new Date()): Promise<{ ok: true }> {
  if (!isGuestId(gid)) throw new CommunityError(401, "Open the live again.");
  const { ref, r } = await roomOf(db, id);
  const settings = await getRoomSettings(db);
  const g = guestsOf(ref).doc(gid);
  const already = (await g.get()).exists;
  const count = already ? 0 : await guestsNow(ref, now);
  const no = guestNo(r, settings, { hostTeen: await hostIsTeen(db, r.hostUid, now.getTime()), guests: count, joining: !already });
  if (no) throw new CommunityError(no === "ended" ? 410 : 403, no);
  const at = now.toISOString();
  await g.set({ at, seen: at }, { merge: true });
  if (!already) await Promise.all([bump(db, now, { views: 1 }), recountGuests(db, ref, now, true)]);
  return { ok: true };
}
// "Still watching": every GUEST_BEAT_MS. Adds to the day's guest time, and recounts the live's guests when the count is due.
export async function guestBeat(db: Firestore, id: unknown, gid: string, now = new Date()): Promise<{ live: boolean }> {
  if (!isGuestId(gid)) throw new CommunityError(401, "Open the live again.");
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") return { live: false };
  const g = guestsOf(ref).doc(gid);
  const cur = (await g.get()).data() as { seen?: string } | undefined;
  if (!cur?.seen) throw new CommunityError(409, "Open the live again.");
  const gap = Math.min(60, Math.max(0, Math.round((now.getTime() - Date.parse(cur.seen)) / 1000)));
  await g.update({ seen: now.toISOString() });
  await Promise.all([bump(db, now, { seconds: gap }), recountGuests(db, ref, now)]);
  return { live: true };
}
export async function guestLeave(db: Firestore, id: unknown, gid: string, deps: RoomDeps = defaultDeps): Promise<void> {
  if (!isGuestId(gid)) return;
  const { ref } = await roomOf(db, id);
  const g = guestsOf(ref).doc(gid);
  const cur = (await g.get()).data() as { sessionId?: string; mids?: string[] } | undefined;
  await g.delete();
  if (cur?.sessionId && cur.mids?.length) await deps.relay().close(cur.sessionId, cur.mids).catch(() => {});
}
// The live's guest count on its doc (for everyone's count and the host's "as guests"), at most every 15 seconds unless forced.
async function recountGuests(db: Firestore, ref: FirebaseFirestore.DocumentReference, now: Date, force = false) {
  const claimed = await db.runTransaction(async (t) => {
    const r = (await t.get(ref)).data() as RoomDoc | undefined;
    if (!r || r.status !== "live") return false;
    if (!force && r.guestsCountedAt && now.getTime() - Date.parse(r.guestsCountedAt) < 15_000) return false;
    t.update(ref, { guestsCountedAt: now.toISOString() });
    return true;
  });
  if (claimed) await ref.update({ guests: await guestsNow(ref, now) });
}

// ── The stream: receive only ─────────────────────────────────────────────────────────────────────────────────────────────────
// A guest's relay steps: pull the stage's microphones and cameras, answer, close. Never push. Each guest has their own session.
export async function guestRelay(db: Firestore, id: unknown, gid: string, body: Record<string, unknown>, deps: RoomDeps = defaultDeps, now = new Date()) {
  if (!isGuestId(gid)) throw new CommunityError(401, "Open the live again.");
  const { ref, r } = await roomOf(db, id);
  const settings = await getRoomSettings(db);
  const no = guestNo(r, settings, { hostTeen: await hostIsTeen(db, r.hostUid, now.getTime()), guests: 0 });
  if (no) throw new CommunityError(no === "ended" ? 410 : 403, no);
  const g = guestsOf(ref).doc(gid);
  const cur = (await g.get()).data() as { seen?: string; sessionId?: string; mids?: string[] } | undefined;
  if (!cur?.seen || now.getTime() - Date.parse(cur.seen) > GUEST_GONE_MS) throw new CommunityError(409, "Open the live again.");
  const relay = deps.relay();
  const session = async () => {
    if (cur.sessionId && body.fresh !== true) return cur.sessionId;
    const sessionId = await relay.newSession();
    await g.update({ sessionId, mids: [] });
    cur.sessionId = sessionId; cur.mids = [];
    return sessionId;
  };
  try {
    switch (body.op) {
      case "pull": {
        const video = body.video === true;
        const t = now.getTime();
        const want = (Array.isArray(body.uids) ? body.uids : []).map(String).slice(0, 8);
        // As a listener who is here (the guest's own presence was checked above).
        const allowed = want.filter((u) => (video ? canPullVideo(r, gid, u, t, true) : canPull(r, gid, u, t, true)));
        if (!allowed.length) throw new CommunityError(409, video ? "Nobody on stage has video on right now." : "Nobody on stage is sending sound right now.");
        const records = await db.getAll(...allowed.map((u) => ref.collection("relay").doc(u)));
        const from = records.flatMap((d, i) => {
          const rec = d.data() as { sessionId?: string; push?: { trackName: string } | null; video?: { trackName: string } | null } | undefined;
          const track = video ? rec?.video?.trackName : rec?.push?.trackName;
          return rec?.sessionId && track ? [{ uid: allowed[i], sessionId: rec.sessionId, trackName: track }] : [];
        });
        if (!from.length) throw new CommunityError(409, "Nobody on stage is sending right now.");
        const sessionId = await session();
        const res = await relay.pull(sessionId, from.map((f) => ({ sessionId: f.sessionId, trackName: f.trackName })));
        const tracks = res.tracks.flatMap((x) => {
          const f = from.find((y) => y.trackName === x.trackName);
          return f && x.mid && !x.errorCode ? [{ uid: f.uid, mid: x.mid, ...(video ? { kind: "video" as const } : {}) }] : [];
        });
        if (tracks.length) await g.update({ mids: FieldValue.arrayUnion(...tracks.map((x) => x.mid)) });
        return { offer: res.offer, renegotiate: res.renegotiate, tracks };
      }
      case "answer": {
        const a = body.answer as { type?: unknown; sdp?: unknown } | undefined;
        if (!cur.sessionId || a?.type !== "answer" || typeof a.sdp !== "string" || a.sdp.length > 200_000) throw new CommunityError(400, "The answer is missing.");
        await relay.renegotiate(cur.sessionId, { type: "answer", sdp: a.sdp });
        return { ok: true };
      }
      case "close": {
        const mids = (Array.isArray(body.mids) ? body.mids : []).map((m) => String(m).slice(0, 32)).filter(Boolean).slice(0, 20);
        if (cur.sessionId && mids.length) {
          await relay.close(cur.sessionId, mids);
          await g.update({ mids: FieldValue.arrayRemove(...mids) });
        }
        return { ok: true };
      }
      default: throw new CommunityError(400, "Guests can only watch.");
    }
  } catch (e) {
    if (e instanceof RelayError) throw new CommunityError(502, "The live's relay didn't answer. Try again in a moment.");
    throw e;
  }
}

// ── A guest who joined, or signed in, from a live ────────────────────────────────────────────────────────────────────────────
// Called once by the page when someone arrives signed in with a guest pass for this live: counted on the live (for the host) and the
// day (for Admin) as joined (an account made in the last two hours) or signed in. Each guest counts once.
export async function guestConverted(db: Firestore, id: unknown, gid: string, uid: string, now = new Date()): Promise<{ counted: boolean; joined: boolean }> {
  if (!isGuestId(gid)) return { counted: false, joined: false };
  const { ref } = await roomOf(db, id);
  const g = guestsOf(ref).doc(gid);
  const user = (await db.doc(`users/${uid}`).get()).data() ?? {};
  const created = Date.parse(String(user.createdAt ?? ""));
  const joined = Number.isFinite(created) && now.getTime() - created < 2 * 3_600_000;
  const counted = await db.runTransaction(async (t) => {
    const cur = (await t.get(g)).data() as { convertedBy?: string } | undefined;
    if (!cur || cur.convertedBy) return false;
    t.update(g, { convertedBy: uid });
    t.update(ref, { [joined ? "guestJoins" : "guestSignIns"]: FieldValue.increment(1) });
    return true;
  });
  if (counted) await bump(db, now, joined ? { joined: 1 } : { signedIn: 1 });
  return { counted, joined };
}

// ── For Admin → Limits ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The last seven days: guest views, the guests who joined or signed in, and the minutes guests watched.
export async function guestStats(db: Firestore, now = new Date()): Promise<{ views: number; joined: number; signedIn: number; minutes: number }> {
  const days = Array.from({ length: 7 }, (_, i) => day(new Date(now.getTime() - i * 86_400_000)));
  const docs = await db.getAll(...days.map((d) => db.collection(STATS).doc(d)));
  const sum = (k: string) => docs.reduce((n, d) => n + (Number(d.data()?.[k]) || 0), 0);
  return { views: sum("views"), joined: sum("joined"), signedIn: sum("signedIn"), minutes: Math.round(sum("seconds") / 60) };
}
