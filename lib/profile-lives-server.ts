import type { Firestore } from "firebase-admin/firestore";
import { CommunityError } from "./community-server";
import { cleanRoomTitle, isProfileLiveAudience, isStageMode, type ProfileLiveAudience, type RoomDoc, type RoomMode } from "./rooms";
import { mayWatchProfileLive, posterFor, startProfileRoom, type RoomDeps } from "./rooms-server";
import { hasStaffPass } from "./staff-pass-server";
import { keptOffLists } from "./young";
import { notifyBell } from "./email";
import { sendPush } from "./push-server";

// 🔴 Go live from your profile (docs/GO_LIVE.md, mockups in docs/mockups/go-live): a free live with no ticket and no community, on the
// same rooms as community and paid lives (lib/rooms-server.ts). Starting one is for #NotesApp team accounts while the staff test pass is
// on (owner, 7 Nov 2026: "the gate is to stop non-team members from starting a live"); joining is for whoever the host lets watch:
// everyone signed in, their followers, or their subscribers (rooms-server mayEnter). When it opens to everyone, `mayStart` changes.

export const PROFILE_LIVE_GATE_TEXT = "Going live from your profile is being tried by the #NotesApp team first. It opens to everyone soon.";
// Followers told when a live starts, at most this many (the most recent follows first); the rest find it on the profile and Live now.
export const PROFILE_LIVE_NOTIFY_MAX = 2_000;

export async function mayStartProfileLive(db: Firestore, uid: string, now = new Date()): Promise<boolean> {
  return hasStaffPass(db, uid, now);
}

export type ProfileLiveInput = { title?: unknown; audience?: unknown; stageMode?: unknown; mods?: unknown; gifts?: unknown; record?: unknown; notify?: unknown; poster?: { source?: unknown; url?: unknown } };

export async function startProfileLive(db: Firestore, uid: string, input: ProfileLiveInput, now = new Date(), deps?: RoomDeps, tell = tellFollowers): Promise<{ id: string; mode: RoomMode; note?: string; recording?: boolean; told?: number }> {
  if (!(await mayStartProfileLive(db, uid, now))) throw new CommunityError(403, PROFILE_LIVE_GATE_TEXT);
  const u = (await db.doc(`users/${uid}`).get()).data() ?? {};
  if (u.suspended === true) throw new CommunityError(403, "Your account can't go live right now.");
  const hostUsername = String(u.username ?? "");
  if (!hostUsername) throw new CommunityError(400, "Choose a username first (Edit profile).");
  const title = cleanRoomTitle(input.title);
  if (title.length < 3) throw new CommunityError(400, "Give your live a title, like Sunday chat.");
  const audience: ProfileLiveAudience = isProfileLiveAudience(input.audience) ? input.audience : "everyone";
  const notify = input.notify !== false;
  // The poster: the profile picture unless they chose another (and none, rather than an error, when they have no picture yet).
  const src = input.poster?.source;
  const poster = !src || src === "profile" ? String(u.avatar ?? "") : await posterFor(db, uid, src, input.poster?.url);
  const r = await startProfileRoom(db, uid, {
    title, poster, record: input.record === true,
    profile: { audience, hostUsername, gifts: input.gifts !== false, notified: notify },
  }, now, deps, { stageMode: isStageMode(input.stageMode) ? input.stageMode : "approve", mods: input.mods });
  let told = 0;
  if (notify) told = await tell(db, { roomId: r.id, hostUid: uid, hostUsername, hostName: String(u.displayName || hostUsername), title, audience }).catch((e) => { console.error("[profile-live] telling followers", e); return 0; });
  return { ...r, told };
}

// The bell (and a push, where they turned it on) to the host's followers: the most recent PROFILE_LIVE_NOTIFY_MAX. A subscribers-only live
// tells only followers who subscribe. Never blocks the live.
export async function tellFollowers(db: Firestore, l: { roomId: string; hostUid: string; hostUsername: string; hostName: string; title: string; audience: ProfileLiveAudience }): Promise<number> {
  const snap = await db.collection("follows").where("username", "==", l.hostUsername).limit(PROFILE_LIVE_NOTIFY_MAX).get();
  const uids = snap.docs.map((d) => String(d.data().followerUid ?? "")).filter((x) => x && x !== l.hostUid);
  const href = `/live/${l.roomId}`;
  const message = `${l.hostName} (@${l.hostUsername}) is live: ${l.title}`;
  let n = 0;
  for (let i = 0; i < uids.length; i += 50) {
    await Promise.all(uids.slice(i, i + 50).map(async (uid) => {
      if (l.audience === "subscribers" && !(await mayWatchProfileLive(db, { audience: "subscribers", hostUsername: l.hostUsername, gifts: true, notified: true }, uid))) return;
      await notifyBell({ uid, type: "event", linkHref: href, message }).catch(() => {});
      await sendPush(db, uid, { title: `🔴 ${l.hostName} is live`, body: l.title, url: href }).catch(() => 0);
      n++;
    }));
  }
  return n;
}

// ── Finding lives ──
export type LiveCard = { id: string; title: string; hostUid: string; hostName: string; hostUsername: string; hostAvatar: string; poster: string; watching: number; startedAt: string; audience: ProfileLiveAudience };
const cardOf = (id: string, r: RoomDoc, avatar: string): LiveCard => ({
  id, title: r.title, hostUid: r.hostUid, hostName: r.hostName, hostUsername: r.profile!.hostUsername, hostAvatar: avatar, poster: r.poster ?? "",
  watching: Math.max(r.listening ?? 0, Object.keys(r.joined ?? {}).length), startedAt: r.createdAt, audience: r.profile!.audience,
});
async function avatars(db: Firestore, uids: string[]): Promise<Record<string, { avatar: string; hidden: boolean }>> {
  if (!uids.length) return {};
  const docs = await db.getAll(...uids.map((u) => db.doc(`users/${u}`)));
  return Object.fromEntries(docs.map((d) => [d.id, { avatar: String(d.data()?.avatar ?? ""), hidden: keptOffLists((d.data() ?? {}) as Record<string, unknown>) || d.data()?.suspended === true }]));
}

// Live now (the feed and Explore): public profile lives on right now, the busiest first. Members kept off lists (teen mode) are left out.
let liveNowCache: { at: number; data: LiveCard[] } | null = null;
export async function liveNow(db: Firestore, limit = 20, now = Date.now()): Promise<LiveCard[]> {
  if (liveNowCache && now - liveNowCache.at < 15_000) return liveNowCache.data.slice(0, limit);
  liveNowCache = { at: now, data: await readLiveNow(db) };
  return liveNowCache.data.slice(0, limit);
}
export const resetLiveNowCache = () => { liveNowCache = null; };
async function readLiveNow(db: Firestore, limit = 50): Promise<LiveCard[]> {
  const snap = await db.collection("communityRooms").where("status", "==", "live").limit(200).get();
  const rooms = snap.docs.map((d) => ({ id: d.id, r: d.data() as RoomDoc })).filter((x) => x.r.profile?.audience === "everyone");
  const av = await avatars(db, [...new Set(rooms.map((x) => x.r.hostUid))]);
  return rooms.filter((x) => !av[x.r.hostUid]?.hidden).map((x) => cardOf(x.id, x.r, av[x.r.hostUid]?.avatar ?? "")).sort((a, b) => b.watching - a.watching).slice(0, limit);
}

// The live a member is in right now from their profile, if this viewer may watch it (the LIVE ring and Join the live on the profile).
export async function profileLiveOf(db: Firestore, hostUsername: string, viewerUid: string | null): Promise<(LiveCard & { canJoin: boolean }) | null> {
  const u = await db.collection("usernames").doc(hostUsername.toLowerCase()).get();
  const hostUid = String(u.data()?.uid ?? "");
  if (!hostUid) return null;
  const snap = await db.collection("communityRooms").where("hostUid", "==", hostUid).where("status", "==", "live").limit(5).get();
  const d = snap.docs.find((x) => !!(x.data() as RoomDoc).profile);
  if (!d) return null;
  const r = d.data() as RoomDoc;
  const canJoin = !!viewerUid && (viewerUid === hostUid || (await mayWatchProfileLive(db, r.profile!, viewerUid)));
  // Followers- or subscribers-only lives still show as live to others (canJoin false), so they can follow or subscribe.
  const av = await avatars(db, [hostUid]);
  return { ...cardOf(d.id, r, av[hostUid]?.avatar ?? ""), canJoin };
}

// The lobby of one live (/live/[id]): what anyone may know before joining.
export async function profileLiveLobby(db: Firestore, id: string, viewerUid: string | null): Promise<{ live: LiveCard; status: "live" | "ended"; canJoin: boolean; host: boolean } | null> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
  const doc = await db.doc(`communityRooms/${id}`).get();
  const r = doc.data() as RoomDoc | undefined;
  if (!r?.profile) return null;
  const host = viewerUid === r.hostUid;
  const canJoin = r.status === "live" && !!viewerUid && (host || !!r.mods?.[viewerUid] || (await mayWatchProfileLive(db, r.profile, viewerUid)));
  const av = await avatars(db, [r.hostUid]);
  return { live: cardOf(id, r, av[r.hostUid]?.avatar ?? ""), status: r.status, canJoin, host };
}

// ── When it ends: the host's summary (screen 6) ──
export type LiveSummary = { id: string; title: string; hostUsername: string; status: "live" | "ended"; minutes: number; joined: number; peak: number; giftKobo: number; gifts: number; topGifters: { name: string; kobo: number }[]; newFollowers: number | null; recorded: boolean };
export async function profileLiveSummary(db: Firestore, uid: string, id: string): Promise<LiveSummary> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new CommunityError(404, "That live wasn't found.");
  const ref = db.doc(`communityRooms/${id}`);
  const r = (await ref.get()).data() as RoomDoc | undefined;
  if (!r?.profile) throw new CommunityError(404, "That live wasn't found.");
  if (r.hostUid !== uid) throw new CommunityError(403, "Only the host sees the summary.");
  const end = r.endedAt ?? new Date().toISOString();
  const [people, gifts] = await Promise.all([
    ref.collection("people").count().get().then((c) => c.data().count).catch(() => 0),
    db.collection("gifts").where("liveId", "==", id).limit(2_000).get(),
  ]);
  const by = new Map<string, number>();
  let giftKobo = 0;
  for (const g of gifts.docs) {
    const x = g.data();
    giftKobo += Number(x.amountKobo ?? 0);
    const who = x.anonymous ? "Someone" : String(x.senderName || "Someone");
    by.set(who, (by.get(who) ?? 0) + Number(x.amountKobo ?? 0));
  }
  // New followers while it was on (follows: username + followedAt; needs the index in firestore.indexes.json, so null until it's deployed).
  const newFollowers = await db.collection("follows").where("username", "==", r.profile.hostUsername).where("followedAt", ">=", r.createdAt).where("followedAt", "<=", end).count().get()
    .then((c) => c.data().count).catch(() => null);
  return {
    id, title: r.title, hostUsername: r.profile.hostUsername, status: r.status, minutes: Math.max(1, Math.round((Date.parse(end) - Date.parse(r.createdAt)) / 60_000)),
    joined: Math.max(people + 1, r.peak ?? 1), peak: r.peak ?? 1, giftKobo, gifts: gifts.size,
    topGifters: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, kobo]) => ({ name, kobo })),
    newFollowers, recorded: !!r.recording,
  };
}
