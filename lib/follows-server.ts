import type { Firestore } from "firebase-admin/firestore";
import { NA_NOTESAPP_PROFILE, OFFICIAL_NOTESAPP_PROFILE, SYNTHETIC_JOURNALS, isAutoFollowed, type JournalDirectoryEntry } from "./journals-directory";
import {
  NA_UID, PAGE_SIZE, MAX_STATUS_LOOKUPS, canSeeOnline, canViewList, isOnline, visibilityOf,
  type FollowPage, type ListedPerson, type PresenceStatus, type Visibility,
} from "./social-graph";

export class FollowError extends Error {
  constructor(public status: number, message: string, public reason?: string) { super(message); }
}

const asPerson = (e: JournalDirectoryEntry): ListedPerson => ({ username: e.username, displayName: e.displayName, avatar: e.avatar, isOrg: false, channel: true });
const syntheticByName = (username: string) => SYNTHETIC_JOURNALS.find((j) => j.username === username);

type Who = { uid: string | null; username: string; vis: Visibility; person: ListedPerson };

// A username, whether a member, an organisation or one of the official channels (@notesapp, @na-notesapp).
export async function whoIs(db: Firestore, usernameRaw: string): Promise<Who | null> {
  const username = usernameRaw.trim().toLowerCase().replace(/^@/, "");
  if (!username) return null;
  const syn = syntheticByName(username);
  if (syn) return { uid: null, username, vis: { showOnline: false, showLists: true }, person: asPerson(syn) };
  const claim = (await db.doc(`usernames/${username}`).get()).data();
  const uid = claim?.uid ? String(claim.uid) : null;
  if (!uid) return null;
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) return null;
  return { uid, username: String(u.username ?? username), vis: visibilityOf(u), person: { username: String(u.username ?? username), displayName: String(u.displayName ?? "Member"), avatar: String(u.avatar ?? ""), isOrg: u.accountKind === "organisation", channel: false } };
}

export async function visibilityFor(db: Firestore, uid: string): Promise<{ username: string; vis: Visibility }> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  return { username: String(u?.username ?? ""), vis: visibilityOf(u) };
}

async function peopleByUid(db: Firestore, uids: string[]): Promise<Map<string, ListedPerson>> {
  const out = new Map<string, ListedPerson>();
  const real = uids.filter((u) => u !== NA_UID);
  if (real.length) {
    const snaps = await db.getAll(...real.map((u) => db.doc(`users/${u}`)));
    for (const s of snaps) {
      const u = s.data();
      if (u) out.set(s.id, { username: String(u.username ?? ""), displayName: String(u.displayName ?? "Member"), avatar: String(u.avatar ?? ""), isOrg: u.accountKind === "organisation", channel: false });
    }
  }
  if (uids.includes(NA_UID)) out.set(NA_UID, asPerson(NA_NOTESAPP_PROFILE));
  return out;
}

async function peopleByUsername(db: Firestore, names: string[]): Promise<Map<string, ListedPerson>> {
  const out = new Map<string, ListedPerson>();
  const real: string[] = [];
  for (const n of names) {
    const syn = syntheticByName(n);
    if (syn) out.set(n, asPerson(syn)); else real.push(n);
  }
  for (let i = 0; i < real.length; i += 30) {
    const snap = await db.collection("users").where("username", "in", real.slice(i, i + 30)).get();
    snap.docs.forEach((d) => {
      const u = d.data();
      out.set(String(u.username), { username: String(u.username), displayName: String(u.displayName ?? "Member"), avatar: String(u.avatar ?? ""), isOrg: u.accountKind === "organisation", channel: false });
    });
  }
  return out;
}

// The followers of a username, or the accounts a username's owner follows. Pages of 30, by document id.
export async function listFollows(db: Firestore, viewerUid: string, kind: "followers" | "following", usernameRaw: string, after: string | null): Promise<FollowPage> {
  const target = await whoIs(db, usernameRaw);
  if (!target) throw new FollowError(404, "We couldn't find that account.");
  const viewer = await visibilityFor(db, viewerUid);
  const decision = canViewList({ self: target.uid === viewerUid, viewerShowLists: viewer.vis.showLists, targetShowLists: target.vis.showLists });
  if (!decision.ok) {
    throw new FollowError(403, decision.reason === "viewer-off"
      ? "You have your own lists switched off, so you can't see other people's. Turn them on in your message settings to see them."
      : `@${target.username} keeps their followers and following private.`, decision.reason);
  }

  // @na-notesapp's own follows are recorded under NA_UID; a member's under their uid. The official @notesapp channel follows no one.
  const followerKey = target.username === NA_NOTESAPP_PROFILE.username ? NA_UID : target.uid;
  if (kind === "following" && !followerKey) return { people: [], next: null, total: 0 };

  const base = kind === "followers"
    ? db.collection("follows").where("username", "==", target.username)
    : db.collection("follows").where("followerUid", "==", followerKey!);
  let q = base.orderBy("__name__").limit(PAGE_SIZE);
  if (after) q = q.startAfter(db.doc(`follows/${after}`));
  const [snap, count] = await Promise.all([q.get(), after ? Promise.resolve(null) : base.count().get()]);

  const rows = snap.docs.map((d) => d.data());
  const people = kind === "followers"
    ? await peopleByUid(db, rows.map((r) => String(r.followerUid)))
    : await peopleByUsername(db, rows.map((r) => String(r.username)));
  const list = rows
    .map((r) => people.get(kind === "followers" ? String(r.followerUid) : String(r.username)))
    .filter((p): p is ListedPerson => !!p && !!p.username);
  const last = snap.docs[snap.docs.length - 1];
  const page: FollowPage = { people: list, next: snap.docs.length === PAGE_SIZE && last ? last.id : null, total: count ? count.data().count : null };
  return page;
}

// ---------- @na-notesapp: follows made in the official account's name, by the owner alone ----------

export const naFollowId = (username: string) => `${NA_UID}_${username}`;

export async function naFollowing(db: Firestore): Promise<string[]> {
  const snap = await db.collection("follows").where("followerUid", "==", NA_UID).get();
  return snap.docs.map((d) => String(d.data().username)).sort();
}

// Follow or unfollow as @na-notesapp. Works for members, organisations and the founders' channels; not for @na-notesapp itself.
export async function setNaFollow(db: Firestore, usernameRaw: string, follow: boolean): Promise<{ username: string }> {
  const target = await whoIs(db, usernameRaw);
  if (!target) throw new FollowError(404, "We couldn't find that account.");
  if (target.username === NA_NOTESAPP_PROFILE.username) throw new FollowError(400, "@na-notesapp can't follow itself.");
  if (target.username === OFFICIAL_NOTESAPP_PROFILE.username) throw new FollowError(400, "@notesapp is the platform channel; there is nothing to follow there.");
  const ref = db.doc(`follows/${naFollowId(target.username)}`);
  if (follow) await ref.set({ followerUid: NA_UID, username: target.username, followedAt: new Date().toISOString(), mandatory: false, official: true });
  else await ref.delete();
  return { username: target.username };
}

// ---------- Online and last seen ----------

const memo = new Map<string, { at: number; data: PresenceStatus | null }>();
const MEMO_MS = 60_000;

// For the people asked about, the status the viewer is allowed to see; anyone else is left out of the answer entirely (so "hidden" and "not following back" look the same).
export async function presenceFor(db: Firestore, viewerUid: string, targetUidsRaw: string[]): Promise<{ statuses: Record<string, PresenceStatus>; viewerOff: boolean }> {
  const viewer = await visibilityFor(db, viewerUid);
  if (!viewer.vis.showOnline) return { statuses: {}, viewerOff: true };
  const now = Date.now();
  const targets = Array.from(new Set(targetUidsRaw.filter((u) => u && u !== viewerUid && u !== NA_UID))).slice(0, MAX_STATUS_LOOKUPS);
  const statuses: Record<string, PresenceStatus> = {};
  const todo: string[] = [];
  for (const t of targets) {
    const hit = memo.get(`${viewerUid}|${t}`);
    if (hit && now - hit.at < MEMO_MS) { if (hit.data) statuses[t] = hit.data; } else todo.push(t);
  }
  if (!todo.length) return { statuses, viewerOff: false };

  const users = await db.getAll(...todo.map((t) => db.doc(`users/${t}`)));
  const info = users.map((s) => ({ uid: s.id, username: String(s.data()?.username ?? ""), vis: visibilityOf(s.data()), exists: s.exists }));
  const live = info.filter((i) => i.exists && i.username && i.vis.showOnline);
  const refs = live.flatMap((i) => [db.doc(`follows/${viewerUid}_${i.username}`), db.doc(`follows/${i.uid}_${viewer.username}`), db.doc(`presence/${i.uid}`)]);
  const snaps = refs.length && viewer.username ? await db.getAll(...refs) : [];
  const seen = new Map<string, PresenceStatus | null>();
  live.forEach((i, n) => {
    const [mineToThem, themToMine, pres] = [snaps[n * 3], snaps[n * 3 + 1], snaps[n * 3 + 2]];
    const mutual = (!!mineToThem?.exists || isAutoFollowed(i.username)) && (!!themToMine?.exists || isAutoFollowed(viewer.username));
    if (!canSeeOnline({ viewerShowOnline: viewer.vis.showOnline, targetShowOnline: i.vis.showOnline, mutual })) { seen.set(i.uid, null); return; }
    const ts = pres?.data()?.lastSeen;
    const ms = ts && typeof ts.toMillis === "function" ? (ts.toMillis() as number) : typeof ts === "number" ? ts : null;
    seen.set(i.uid, ms === null ? { online: false, lastSeen: null } : { online: isOnline(ms, now), lastSeen: new Date(ms).toISOString() });
  });
  for (const t of todo) {
    const data = seen.get(t) ?? null;
    memo.set(`${viewerUid}|${t}`, { at: now, data });
    if (data) statuses[t] = data;
  }
  return { statuses, viewerOff: false };
}
