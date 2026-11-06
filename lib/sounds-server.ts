// NotesApp Sounds on the server (lib/songs.ts): the catalogue (house songs and approved artist songs), play counts, a song's page,
// the artist's analytics, artist verification, artist uploads and their review, and the monthly royalty in ad share.
//
// Collections (all server-written; firestore.rules refuse browsers):
//   sounds/{id}            an artist song: title, artist, owner, files (our bucket), status (pending → approved / rejected / removed)
//   soundUploads/{id}      an upload in progress (the song and its cover), until it's finished; removed after two days if not
//   soundArtists/{uid}     an artist application and its decision
//   songPlays/{song}_{day} plays of a song on a day, by where (media, moment, live, life), with the owner and the month
//   songTotals/{song}      plays of a song since the start, by where, and how many posts and moments use it
//   songPlayOnce/{uid}_{song}_{day}  Notes Life: one play a day per player per song (removed by the TTL on expireAt)
//   settings/sounds        { poolPercent }: the part of a month's ad revenue that goes to artists
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import {
  ARTIST_LINKS_MAX, SONG, SONGS, SOUND_MAX_BYTES, SOUND_MAX_SECONDS, SOUND_SOURCES, SOUND_TITLE_MAX, SOUND_TYPES, SOUNDS_POOL_DEFAULT_PERCENT,
  emptyPlays, isSoundIdShape, sniffSong,
  type ArtistApplication, type ArtistStatus, type PlayCounts, type Song, type SongStatus, type SoundSource,
} from "./songs";

export class SoundError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type SoundDoc = {
  title: string; artist: string; ownerUid: string; ownerUsername: string;
  key: string; coverKey: string; durationSec: number; hook: number; size: number; contentType: string;
  status: SongStatus; createdAt: string; decidedAt?: string; note?: string; decidedBy?: string;
};
export type SoundDeps = {
  publicUrl: (key: string) => string;
  presign: (key: string, contentType: string, size: number) => Promise<string>;
  head: (key: string) => Promise<{ size: number } | null>;
  readStart: (key: string) => Promise<Uint8Array>;
  remove: (key: string) => Promise<void>;
};

const dayOf = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const monthOf = (d: Date) => d.toISOString().slice(0, 7);

// ── The catalogue ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const toSong = (id: string, s: SoundDoc, deps: Pick<SoundDeps, "publicUrl">): Song => ({
  id, title: s.title, artist: s.artist, ownerUsername: s.ownerUsername,
  src: deps.publicUrl(s.key), cover: s.coverKey ? deps.publicUrl(s.coverKey) : "", durationSec: s.durationSec, hook: s.hook,
});

// A song anyone may use now: a house song, or an approved artist song. Anything else is undefined.
export async function findSong(db: Firestore, id: unknown, deps: Pick<SoundDeps, "publicUrl">): Promise<Song | undefined> {
  const h = SONG(id);
  if (h) return h;
  if (!isSoundIdShape(id)) return undefined;
  const s = (await db.doc(`sounds/${id}`).get()).data() as SoundDoc | undefined;
  return s && s.status === "approved" ? toSong(id, s, deps) : undefined;
}
export async function songIdOk(db: Firestore, id: unknown): Promise<boolean> {
  return !!(await findSong(db, id, { publicUrl: (k) => k }));
}

// Every song anyone may use: house songs first, then approved artist songs, newest first.
export async function listSongs(db: Firestore, deps: Pick<SoundDeps, "publicUrl">): Promise<Song[]> {
  const snap = await db.collection("sounds").where("status", "==", "approved").get();
  const artists = snap.docs.map((d) => ({ id: d.id, s: d.data() as SoundDoc })).sort((a, b) => b.s.createdAt.localeCompare(a.s.createdAt)).map((x) => toSong(x.id, x.s, deps));
  return [...SONGS, ...artists];
}

// Whose song it is (uid). House songs belong to the owner's profile (looked up once by username).
const ownerCache = new Map<string, string>();
async function uidOfUsername(db: Firestore, username: string): Promise<string> {
  const hit = ownerCache.get(username); if (hit) return hit;
  const uid = String((await db.doc(`usernames/${username.toLowerCase()}`).get()).data()?.uid ?? "");
  if (uid) ownerCache.set(username, uid);
  return uid;
}
async function ownerOfSong(db: Firestore, id: string): Promise<{ uid: string; username: string } | null> {
  const h = SONG(id);
  if (h) { const uid = await uidOfUsername(db, h.ownerUsername); return uid ? { uid, username: h.ownerUsername } : null; }
  const s = (await db.doc(`sounds/${id}`).get()).data() as SoundDoc | undefined;
  return s ? { uid: s.ownerUid, username: s.ownerUsername } : null;
}

// ── Counting ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// n plays of a song from one place (never throws: counting must not break the thing being watched).
export async function countPlay(db: Firestore, songId: string | undefined, source: SoundSource, n = 1, now = new Date()): Promise<void> {
  if (!songId || !(n > 0)) return;
  try {
    const owner = await ownerOfSong(db, songId);
    if (!owner) return;
    const day = dayOf(now);
    const inc = { [source]: FieldValue.increment(n), total: FieldValue.increment(n) };
    const batch = db.batch();
    batch.set(db.doc(`songPlays/${songId}_${day}`), { songId, ownerUid: owner.uid, day, month: monthOf(now), ...inc }, { merge: true });
    batch.set(db.doc(`songTotals/${songId}`), { songId, ownerUid: owner.uid, ...inc }, { merge: true });
    await batch.commit();
  } catch (e) { console.error("[sounds] couldn't count a play", songId, source, e); }
}
// A post or a moment made with the song (or one taken down: -1).
export async function countUse(db: Firestore, songId: string | undefined, kind: "posts" | "moments", n = 1): Promise<void> {
  if (!songId) return;
  try {
    const owner = await ownerOfSong(db, songId);
    if (owner) await db.doc(`songTotals/${songId}`).set({ songId, ownerUid: owner.uid, [kind]: FieldValue.increment(n) }, { merge: true });
  } catch (e) { console.error("[sounds] couldn't count a use", songId, e); }
}
// Notes Life: a player heard a song at the hotel. Once a day per player per song.
export async function countLifePlay(db: Firestore, uid: string, songId: unknown, now = new Date()): Promise<boolean> {
  if (!(await songIdOk(db, songId))) throw new SoundError(400, "That song isn't in NotesApp Sounds.");
  const ref = db.doc(`songPlayOnce/${uid}_${songId}_${dayOf(now)}`);
  const fresh = await db.runTransaction(async (t) => {
    if ((await t.get(ref)).exists) return false;
    t.set(ref, { uid, songId, at: now.toISOString(), expireAt: new Date(now.getTime() + 2 * 86_400_000) });
    return true;
  });
  if (fresh) await countPlay(db, String(songId), "life", 1, now);
  return fresh;
}

const playsOf = (x: Record<string, unknown> | undefined): PlayCounts => {
  const p = emptyPlays();
  if (!x) return p;
  for (const s of SOUND_SOURCES) p[s] = Number(x[s] ?? 0) || 0;
  p.total = Number(x.total ?? 0) || 0;
  return p;
};

// ── A song's page ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type SoundArtist = { uid: string; username: string; displayName: string; avatar: string; verified: boolean };
export type SoundPageHead = { song: Song; artist: SoundArtist | null; plays: PlayCounts; posts: number; moments: number };
export async function soundHead(db: Firestore, id: string, deps: Pick<SoundDeps, "publicUrl">): Promise<SoundPageHead> {
  const song = await findSong(db, id, deps);
  if (!song) throw new SoundError(404, "That sound isn't available.");
  const [owner, totals] = await Promise.all([ownerOfSong(db, id), db.doc(`songTotals/${id}`).get()]);
  let artist: SoundArtist | null = null;
  if (owner) {
    const u = (await db.doc(`users/${owner.uid}`).get()).data();
    if (u && u.suspended !== true) artist = { uid: owner.uid, username: String(u.username ?? owner.username), displayName: String(u.displayName ?? owner.username), avatar: String(u.avatar ?? ""), verified: true };
  }
  const t = totals.data();
  return { song, artist, plays: playsOf(t), posts: Math.max(0, Number(t?.posts ?? 0)), moments: Math.max(0, Number(t?.moments ?? 0)) };
}

// ── The artist's analytics (/profile/sounds, and the Sounds part of /profile/analytics) ──────────────────────────────────────────
export type MySong = Song & { status: SongStatus; note?: string; plays: PlayCounts; thisMonth: PlayCounts; lastMonth: PlayCounts; posts: number; moments: number; daily: { day: string; total: number }[] };
export type RoyaltyLine = { month: string; plays: number; shareKobo: number; status: string };
export type MySounds = { artist: ArtistApplication | null; isHouse: boolean; songs: MySong[]; royalties: RoyaltyLine[]; poolPercent: number };

export async function mySounds(db: Firestore, uid: string, username: string, deps: Pick<SoundDeps, "publicUrl">, now = new Date()): Promise<MySounds> {
  const app = (await db.doc(`soundArtists/${uid}`).get()).data() as ArtistApplication | undefined;
  const house = SONGS.filter((s) => s.ownerUsername.toLowerCase() === username.toLowerCase());
  const mine = await db.collection("sounds").where("ownerUid", "==", uid).get();
  const uploads = mine.docs.map((d) => ({ id: d.id, s: d.data() as SoundDoc })).filter((x) => x.s.status !== "removed").sort((a, b) => b.s.createdAt.localeCompare(a.s.createdAt));
  const ids = [...house.map((s) => s.id), ...uploads.map((x) => x.id)];
  const thisM = monthOf(now);
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)); const lastM = monthOf(prev);
  const since = dayOf(new Date(now.getTime() - 29 * 86_400_000));
  // One query for the owner's daily rows since the start of last month (an index on ownerUid + day).
  const rows = ids.length ? (await db.collection("songPlays").where("ownerUid", "==", uid).where("day", ">=", `${lastM.replace("-", "")}01`).get()).docs.map((d) => d.data()) : [];
  const totals = ids.length ? await db.getAll(...ids.map((id) => db.doc(`songTotals/${id}`))) : [];
  const sum = (songId: string, month: string) => {
    const p = emptyPlays();
    for (const r of rows) if (r.songId === songId && r.month === month) { for (const s of SOUND_SOURCES) p[s] += Number(r[s] ?? 0) || 0; p.total += Number(r.total ?? 0) || 0; }
    return p;
  };
  const build = (song: Song, status: SongStatus, i: number, note?: string): MySong => {
    const t = totals[i]?.data();
    const daily = rows.filter((r) => r.songId === song.id && String(r.day) >= since).map((r) => ({ day: String(r.day), total: Number(r.total ?? 0) || 0 })).sort((a, b) => a.day.localeCompare(b.day));
    return { ...song, status, ...(note ? { note } : {}), plays: playsOf(t), thisMonth: sum(song.id, thisM), lastMonth: sum(song.id, lastM), posts: Number(t?.posts ?? 0), moments: Number(t?.moments ?? 0), daily };
  };
  const songs = [
    ...house.map((s, i) => build(s, "approved", i)),
    ...uploads.map((x, j) => build(toSong(x.id, x.s, deps), x.s.status, house.length + j, x.s.status === "rejected" ? x.s.note : undefined)),
  ];
  const st = await db.collection("adShareStatements").where("uid", "==", uid).get();
  const royalties = st.docs.map((d) => d.data()).filter((s) => s.kind === "sounds")
    .map((s) => ({ month: String(s.month), plays: Number(s.impressions ?? 0), shareKobo: Number(s.shareKobo ?? 0), status: String(s.status) }))
    .sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
  return { artist: app ?? null, isHouse: house.length > 0, songs, royalties, poolPercent: await poolPercent(db) };
}

// ── Artists: apply, and the team's decision ──────────────────────────────────────────────────────────────────────────────────────
export async function applyAsArtist(db: Firestore, me: { uid: string; username: string }, input: { stageName?: unknown; links?: unknown; about?: unknown; ownsRights?: unknown }, now = new Date()): Promise<ArtistApplication> {
  if (!me.username) throw new SoundError(400, "Finish setting up your profile first.");
  const stageName = String(input.stageName ?? "").trim().slice(0, 60);
  if (stageName.length < 2) throw new SoundError(400, "Write your artist name.");
  const links = (Array.isArray(input.links) ? input.links : []).map((l) => String(l).trim()).filter(Boolean).slice(0, ARTIST_LINKS_MAX);
  if (!links.length) throw new SoundError(400, "Add at least one link to your music (Audiomack, Boomplay, Spotify, YouTube, Apple Music…).");
  if (links.some((l) => !/^https:\/\/[^\s]+\.[^\s]+/.test(l))) throw new SoundError(400, "Links must start with https://");
  if (input.ownsRights !== true) throw new SoundError(400, "Confirm that you own the rights to the songs you'll add.");
  const ref = db.doc(`soundArtists/${me.uid}`);
  const was = (await ref.get()).data() as ArtistApplication | undefined;
  if (was?.status === "verified") throw new SoundError(409, "You're already a verified artist.");
  if (was?.status === "pending") throw new SoundError(409, "Your application is with the team. We'll let you know.");
  const app: ArtistApplication = { uid: me.uid, username: me.username, stageName, links, about: String(input.about ?? "").trim().slice(0, 600), ownsRights: true, status: "pending", appliedAt: now.toISOString() };
  await ref.set(app);
  return app;
}
export async function isVerifiedArtist(db: Firestore, uid: string, username: string): Promise<ArtistApplication | null> {
  const a = (await db.doc(`soundArtists/${uid}`).get()).data() as ArtistApplication | undefined;
  if (a?.status === "verified") return a;
  // The owner (whose songs are built in) is an artist without applying.
  if (SONGS.some((s) => s.ownerUsername.toLowerCase() === username.toLowerCase())) return { uid, username, stageName: SONGS.find((s) => s.ownerUsername.toLowerCase() === username.toLowerCase())!.artist, links: [], about: "", ownsRights: true, status: "verified", appliedAt: "" };
  return null;
}

// ── Artist uploads ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const COVER_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const COVER_MAX = 3 * 1024 * 1024;
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "song";

export async function startSongUpload(
  db: Firestore, me: { uid: string; username: string },
  input: { title?: unknown; size?: unknown; contentType?: unknown; durationSec?: unknown; hook?: unknown; coverType?: unknown; coverSize?: unknown },
  deps: Pick<SoundDeps, "presign">, now = new Date(),
): Promise<{ id: string; uploadUrl: string; coverUrl: string }> {
  const artist = await isVerifiedArtist(db, me.uid, me.username);
  if (!artist) throw new SoundError(403, "Only verified artists can add songs. Apply first.");
  const title = String(input.title ?? "").trim().slice(0, SOUND_TITLE_MAX);
  if (title.length < 1) throw new SoundError(400, "Give the song its title.");
  const contentType = String(input.contentType ?? ""); const ext = SOUND_TYPES[contentType];
  if (!ext) throw new SoundError(400, "Use an MP3 (or M4A) file.");
  const size = Number(input.size), durationSec = Number(input.durationSec);
  if (!Number.isInteger(size) || size <= 0) throw new SoundError(400, "That file looks empty.");
  if (size > SOUND_MAX_BYTES) throw new SoundError(413, `Songs can be up to ${SOUND_MAX_BYTES / 1048576} MB. Export it at 128 kbps.`);
  if (!Number.isFinite(durationSec) || durationSec < 5) throw new SoundError(400, "We couldn't read the song's length.");
  if (durationSec > SOUND_MAX_SECONDS) throw new SoundError(413, `Songs can be up to ${SOUND_MAX_SECONDS / 60} minutes.`);
  const hook = Math.max(0, Math.min(Math.floor(Number(input.hook) || 0), Math.max(0, Math.floor(durationSec) - 5)));
  const coverType = String(input.coverType ?? ""), coverSize = Number(input.coverSize), cext = COVER_TYPES[coverType];
  if (!cext) throw new SoundError(400, "Add a cover picture (JPEG, PNG or WebP).");
  if (!Number.isInteger(coverSize) || coverSize <= 0 || coverSize > COVER_MAX) throw new SoundError(413, "The cover can be up to 3 MB.");
  const recent = await db.collection("sounds").where("ownerUid", "==", me.uid).get();
  if (recent.docs.filter((d) => d.data().status === "pending").length >= 10) throw new SoundError(429, "You have 10 songs waiting for review. Add more once they're checked.");
  const id = `${slug(title)}-${randomBytes(3).toString("hex")}`;
  const key = `sounds/${me.uid}/${id}.${ext}`, coverKey = `sounds/${me.uid}/${id}-cover.${cext}`;
  const [uploadUrl, coverUrl] = await Promise.all([deps.presign(key, contentType, size), deps.presign(coverKey, coverType, coverSize)]);
  await db.doc(`soundUploads/${id}`).set({
    uid: me.uid, username: me.username, artist: artist.stageName, title, key, coverKey, size, coverSize, contentType, durationSec: Math.round(durationSec), hook,
    createdAt: now.toISOString(), expireAt: new Date(now.getTime() + 2 * 86_400_000),
  });
  return { id, uploadUrl, coverUrl };
}

export async function finishSongUpload(db: Firestore, me: { uid: string }, id: unknown, deps: Omit<SoundDeps, "presign">, now = new Date()): Promise<Song & { status: SongStatus }> {
  if (!isSoundIdShape(id)) throw new SoundError(400, "That upload wasn't found.");
  const ref = db.doc(`soundUploads/${id}`);
  const u = (await ref.get()).data();
  if (!u || u.uid !== me.uid) throw new SoundError(404, "That upload wasn't found.");
  const reject = async (why: string): Promise<never> => {
    await Promise.all([deps.remove(u.key), deps.remove(u.coverKey)].map((p) => p.catch(() => {})));
    await ref.delete().catch(() => {});
    throw new SoundError(400, why);
  };
  const [h, c] = await Promise.all([deps.head(u.key), deps.head(u.coverKey)]);
  if (!h || !c) throw new SoundError(409, "The upload hasn't finished yet.");
  if (h.size !== u.size || c.size !== u.coverSize) return reject("The uploaded files didn't match. Try again.");
  if (!sniffSong(await deps.readStart(u.key))) return reject("That doesn't look like an MP3 or M4A song.");
  const doc: SoundDoc = {
    title: u.title, artist: u.artist, ownerUid: u.uid, ownerUsername: u.username, key: u.key, coverKey: u.coverKey,
    durationSec: u.durationSec, hook: u.hook, size: u.size, contentType: u.contentType, status: "pending", createdAt: now.toISOString(),
  };
  await db.doc(`sounds/${id}`).set(doc);
  await ref.delete();
  return { ...toSong(String(id), doc, deps), status: "pending" };
}

// The artist takes their own song down (posts and moments that used it keep the name, but it no longer plays or shows in the picker).
export async function removeMySong(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<void> {
  if (!isSoundIdShape(id)) throw new SoundError(404, "Song not found.");
  const ref = db.doc(`sounds/${id}`);
  const s = (await ref.get()).data() as SoundDoc | undefined;
  if (!s || s.ownerUid !== uid) throw new SoundError(404, "Song not found.");
  await ref.update({ status: "removed", decidedAt: now.toISOString(), note: "Taken down by the artist" });
}

// ── The team (Admin → Sounds) ────────────────────────────────────────────────────────────────────────────────────────────────────
export async function poolPercent(db: Firestore): Promise<number> {
  const v = Number((await db.doc("settings/sounds").get()).data()?.poolPercent);
  return Number.isFinite(v) && v >= 0 && v <= 50 ? v : SOUNDS_POOL_DEFAULT_PERCENT;
}
export async function setPoolPercent(db: Firestore, pct: unknown, by: string): Promise<number> {
  const v = Number(pct);
  if (!Number.isFinite(v) || v < 0 || v > 50) throw new SoundError(400, "The pool is 0 to 50% of the month's ad revenue.");
  await db.doc("settings/sounds").set({ poolPercent: Math.round(v * 10) / 10, updatedBy: by, updatedAt: new Date().toISOString() }, { merge: true });
  return v;
}
export type AdminSounds = {
  artists: ArtistApplication[];
  songs: (Song & { status: SongStatus; createdAt: string; note?: string; ownerUid: string })[];
  poolPercent: number;
};
export async function adminSounds(db: Firestore, deps: Pick<SoundDeps, "publicUrl">): Promise<AdminSounds> {
  const [a, s] = await Promise.all([db.collection("soundArtists").get(), db.collection("sounds").get()]);
  const order: Record<string, number> = { pending: 0, verified: 1, approved: 1, rejected: 2, removed: 3 };
  const artists = a.docs.map((d) => d.data() as ArtistApplication).sort((x, y) => order[x.status] - order[y.status] || y.appliedAt.localeCompare(x.appliedAt));
  const songs = s.docs.map((d) => ({ id: d.id, x: d.data() as SoundDoc }))
    .sort((p, q) => order[p.x.status] - order[q.x.status] || q.x.createdAt.localeCompare(p.x.createdAt))
    .map(({ id, x }) => ({ ...toSong(id, x, deps), status: x.status, createdAt: x.createdAt, ownerUid: x.ownerUid, ...(x.note ? { note: x.note } : {}) }));
  return { artists, songs, poolPercent: await poolPercent(db) };
}
export async function decideArtist(db: Firestore, uid: unknown, status: unknown, note: unknown, by: string, now = new Date()): Promise<void> {
  if (status !== "verified" && status !== "rejected") throw new SoundError(400, "Verify or reject.");
  const ref = db.doc(`soundArtists/${String(uid)}`);
  if (!(await ref.get()).exists) throw new SoundError(404, "Application not found.");
  await ref.update({ status: status as ArtistStatus, decidedAt: now.toISOString(), decidedBy: by, note: String(note ?? "").slice(0, 300) });
}
export async function decideSong(db: Firestore, id: unknown, status: unknown, note: unknown, by: string, now = new Date()): Promise<void> {
  if (status !== "approved" && status !== "rejected" && status !== "removed") throw new SoundError(400, "Approve, reject or take down.");
  if (!isSoundIdShape(id)) throw new SoundError(404, "Song not found.");
  const ref = db.doc(`sounds/${id}`);
  if (!(await ref.get()).exists) throw new SoundError(404, "Song not found.");
  await ref.update({ status, decidedAt: now.toISOString(), decidedBy: by, note: String(note ?? "").slice(0, 300) });
}

// ── Royalties (run with Admin → Ad share → Compute statements) ──────────────────────────────────────────────────────────────────
// The pool (poolPercent of the month's ad revenue) is split over every play of every song that month; each artist gets a statement in
// adShareStatements (kind "sounds", id `${month}_${uid}_sounds`, impressions = plays), reviewed, approved and paid like ad share.
export async function computeSoundRoyalties(db: Firestore, month: string, revenueKobo: number, nowIso: string): Promise<{ statements: number; poolKobo: number; plays: number }> {
  const pct = await poolPercent(db);
  const poolKobo = Math.floor((revenueKobo * pct) / 100);
  const rows = (await db.collection("songPlays").where("month", "==", month).get()).docs.map((d) => d.data());
  const byOwner = new Map<string, { plays: number; days: Set<string> }>();
  for (const r of rows) {
    const t = byOwner.get(r.ownerUid) ?? { plays: 0, days: new Set<string>() };
    t.plays += Number(r.total ?? 0) || 0; t.days.add(String(r.day)); byOwner.set(r.ownerUid, t);
  }
  const plays = [...byOwner.values()].reduce((n, t) => n + t.plays, 0);
  if (!(poolKobo > 0) || !(plays > 0)) return { statements: 0, poolKobo, plays };
  const perPlay = poolKobo / plays;
  let statements = 0;
  for (const [uid, t] of byOwner) {
    const u = (await db.doc(`users/${uid}`).get()).data();
    if (!u || u.suspended) continue;
    const id = `${month}_${uid}_sounds`;
    const ref = db.doc(`adShareStatements/${id}`);
    const existing = (await ref.get()).data();
    if (existing && existing.status !== "pending_review") continue; // decided statements are locked
    const shareKobo = Math.floor(t.plays * perPlay);
    await ref.set({
      id, uid, username: u.username, month, kind: "sounds",
      impressions: t.plays, clicks: 0, rpmKobo: perPlay, grossKobo: shareKobo, rate: 1, shareKobo,
      flags: t.days.size === 1 && t.plays >= 500 ? ["one-day spike in plays"] : [],
      status: "pending_review", createdAt: existing?.createdAt ?? nowIso,
    });
    statements++;
  }
  return { statements, poolKobo, plays };
}
