import type { Firestore } from "firebase-admin/firestore";
import {
  FAN_ACTIONS, TOP_FANS, applyFanSettings, cleanFanOverrides, entranceChoices, entranceVehicle, fanSettings, firstName, isVehicle, moneyPoints,
  nextBand, rankBadge, tierOf, type Entrance, type FanAction, type FanSettings, type RankBadge, type SubTier, type Vehicle,
} from "./fans";
import { keptOffLists } from "./young";
export type { Entrance } from "./fans";

// Server side of fan levels and subscription tiers (lib/fans.ts). Collections, all server-only in firestore.rules:
//   fanScores/{creatorUid}_{fanUid}  a fan's all-time points with one creator, and today's counted actions (the daily caps)
//   fanPrefs/{fanUid}                the vehicles a fan picked for their live entrances
//   serverConfig/fans                Admin → Limits → Subscriptions and fans (tier price ranges and the VIP/VVIP commission shares)
// A subscriber's tier is on their subscriptions/{uid}_{username} record (public, as before), Premium when missing.

// ── Settings: a 30-second cache, like the plan limits ──
let settingsCache: { at: number; data: FanSettings } | null = null;
const TTL_MS = 30_000;
export async function getFanSettings(db: Firestore, now = Date.now()): Promise<FanSettings> {
  if (settingsCache && now - settingsCache.at < TTL_MS) return settingsCache.data;
  let overrides = {};
  try { overrides = cleanFanOverrides((await db.doc("serverConfig/fans").get()).data()?.overrides); } catch { overrides = {}; }
  const data = fanSettings(overrides);
  settingsCache = { at: now, data };
  applyFanSettings(data);
  return data;
}
export async function saveFanSettings(db: Firestore, input: unknown, adminUid: string, now = new Date()): Promise<FanSettings> {
  const overrides = cleanFanOverrides(input);
  await db.doc("serverConfig/fans").set({ overrides, updatedAt: now.toISOString(), updatedBy: adminUid });
  settingsCache = { at: now.getTime(), data: fanSettings(overrides) };
  applyFanSettings(settingsCache.data);
  topCache.clear();
  return settingsCache.data;
}
export const resetFanCaches = () => { settingsCache = null; topCache.clear(); };

// ── Points ──
const lagosDay = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10);
export type FanScore = { creatorUid: string; fanUid: string; points: number; day: string; dayCounts: Partial<Record<FanAction, number>>; updatedAt: string };

// Adds points for an action (within today's cap) or money paid (kobo). Never for a member and themselves. Returns the points added.
export async function addFanPoints(db: Firestore, creatorUid: string | null | undefined, fanUid: string | null | undefined, what: { action: FanAction } | { kobo: number }, now = new Date()): Promise<number> {
  if (!creatorUid || !fanUid || creatorUid === fanUid) return 0;
  const ref = db.doc(`fanScores/${creatorUid}_${fanUid}`);
  const day = lagosDay(now);
  const added = await db.runTransaction(async (t) => {
    const prev = (await t.get(ref)).data() as FanScore | undefined;
    const counts = prev && prev.day === day ? { ...prev.dayCounts } : {};
    let pts = 0;
    if ("action" in what) {
      const rule = FAN_ACTIONS[what.action];
      const used = counts[what.action] ?? 0;
      if (used >= rule.perDay) return 0;
      counts[what.action] = used + 1;
      pts = rule.points;
    } else pts = moneyPoints(what.kobo);
    if (pts <= 0) return 0;
    t.set(ref, { creatorUid, fanUid, points: (prev?.points ?? 0) + pts, day, dayCounts: counts, updatedAt: now.toISOString() } satisfies FanScore);
    return pts;
  });
  if (added > 0) topCache.delete(creatorUid);
  return added;
}
// For callers that know the creator by username (shares carry the creator's handle).
export async function addFanPointsByUsername(db: Firestore, creatorUsername: string | null | undefined, fanUid: string, what: { action: FanAction } | { kobo: number }) {
  if (!creatorUsername) return 0;
  const uid = (await db.doc(`usernames/${creatorUsername}`).get()).data()?.uid;
  return uid ? addFanPoints(db, String(uid), fanUid, what) : 0;
}

// ── The top 99 for a creator, cached a minute per server ──
type Top = { uid: string; points: number }[];
const topCache = new Map<string, { at: number; list: Top }>();
const TOP_TTL = 60_000;
export async function topFanList(db: Firestore, creatorUid: string, now = Date.now()): Promise<Top> {
  const hit = topCache.get(creatorUid);
  if (hit && now - hit.at < TOP_TTL) return hit.list;
  const snap = await db.collection("fanScores").where("creatorUid", "==", creatorUid).orderBy("points", "desc").limit(TOP_FANS).get();
  const list = snap.docs.map((d) => ({ uid: String(d.data().fanUid), points: Number(d.data().points) || 0 })).filter((r) => r.points > 0);
  topCache.set(creatorUid, { at: now, list });
  return list;
}
// A place on the list, ties sharing the higher place's order as Firestore returned it (most points first).
const placeIn = (list: Top, uid: string) => { const i = list.findIndex((r) => r.uid === uid); return i < 0 ? null : i + 1; };

async function activeTier(db: Firestore, fanUid: string, creatorUsername: string): Promise<SubTier | null> {
  const s = (await db.doc(`subscriptions/${fanUid}_${creatorUsername}`).get()).data();
  if (!s) return null;
  const on = s.status === "demo" || (!!s.currentPeriodEnd && Date.parse(String(s.currentPeriodEnd)) > Date.now());
  return on ? tierOf(s) : null;
}

// The badges next to names in a creator's space (comments on their journal, shop, courses, Media and profile picture): each uid's
// place on the creator's list (top 99 only) and subscription tier. Badges show even when the creator hides the list.
export type FanBadge = { rank?: RankBadge & { place: number }; tier?: SubTier };
export async function fanBadges(db: Firestore, creatorUsername: string, uids: string[]): Promise<{ creatorFirstName: string; badges: Record<string, FanBadge> }> {
  const claim = (await db.doc(`usernames/${creatorUsername}`).get()).data();
  const creatorUid = claim?.uid ? String(claim.uid) : "";
  const creator = creatorUid ? (await db.doc(`users/${creatorUid}`).get()).data() : null;
  const name = firstName(String(creator?.displayName || creatorUsername));
  const badges: Record<string, FanBadge> = {};
  if (!creatorUid) return { creatorFirstName: name, badges };
  const list = await topFanList(db, creatorUid);
  const want = Array.from(new Set(uids.filter((u) => /^[A-Za-z0-9_-]{1,128}$/.test(u)))).slice(0, 100);
  const tiers = await Promise.all(want.map((u) => activeTier(db, u, creatorUsername).catch(() => null)));
  want.forEach((u, i) => {
    const place = placeIn(list, u);
    const r = rankBadge(place, name);
    const b: FanBadge = {};
    if (r && place) b.rank = { ...r, place };
    if (tiers[i]) b.tier = tiers[i]!;
    if (b.rank || b.tier) badges[u] = b;
  });
  return { creatorFirstName: name, badges };
}

// ── The Top fans page (/u/{username}/fans) ──
export type FanRow = { place: number; uid: string; username: string; displayName: string; avatar: string; points: number; tier?: SubTier; badge: RankBadge };
export type FanBoard = {
  creator: { uid: string; username: string; displayName: string };
  hidden: boolean; // the creator hid the list, or is in teen mode (badges still show)
  rows: FanRow[];
  me: { points: number; place: number | null; fans: number; tier: SubTier | null; next: { place: number; needed: number } | null; vehicles: Vehicle[] | null; picks: Partial<Record<string, Vehicle>> } | null;
};
export async function fanBoard(db: Firestore, viewer: { uid: string; username?: string } | null, creatorUsername: string): Promise<FanBoard | null> {
  const claim = (await db.doc(`usernames/${creatorUsername}`).get()).data();
  if (!claim?.uid) return null;
  const creatorUid = String(claim.uid);
  const [creatorSnap, pub] = await Promise.all([db.doc(`users/${creatorUid}`).get(), db.doc(`publisherSettings/${creatorUid}`).get()]);
  const creator = creatorSnap.data() ?? {};
  if (creator.suspended === true) return null;
  const name = String(creator.displayName || creatorUsername);
  const self = viewer?.uid === creatorUid;
  const hidden = !self && (pub.data()?.fansHidden === true || keptOffLists(creator));
  const list = await topFanList(db, creatorUid);
  const rows: FanRow[] = [];
  if (!hidden) {
    const users = await Promise.all(list.map((r) => db.doc(`users/${r.uid}`).get()));
    for (let i = 0; i < list.length; i++) {
      const u = users[i].data();
      if (!u || u.suspended === true || !u.username) continue;
      // Teens (and adults who kept the protection) show only to themselves and to people who follow them.
      if (keptOffLists(u) && viewer?.uid !== list[i].uid) {
        const follows = !!viewer?.username && (await db.doc(`follows/${viewer.uid}_${u.username}`).get()).exists;
        if (!follows) continue;
      }
      const tier = await activeTier(db, list[i].uid, creatorUsername).catch(() => null);
      rows.push({ place: i + 1, uid: list[i].uid, username: String(u.username), displayName: String(u.displayName || u.username), avatar: String(u.avatar ?? ""), points: list[i].points, ...(tier ? { tier } : {}), badge: rankBadge(i + 1, firstName(name))! });
    }
  }
  let me: FanBoard["me"] = null;
  if (viewer && !self) {
    const mine = (await db.doc(`fanScores/${creatorUid}_${viewer.uid}`).get()).data();
    const points = Number(mine?.points) || 0;
    let place = placeIn(list, viewer.uid);
    if (!place && points > 0) place = (await db.collection("fanScores").where("creatorUid", "==", creatorUid).where("points", ">", points).count().get()).data().count + 1;
    const fans = (await db.collection("fanScores").where("creatorUid", "==", creatorUid).count().get()).data().count;
    const tier = await activeTier(db, viewer.uid, creatorUsername).catch(() => null);
    const prefs = (await db.doc(`fanPrefs/${viewer.uid}`).get()).data()?.vehicles ?? {};
    me = {
      points, place: points > 0 ? place : null, fans, tier,
      next: nextBand(points > 0 ? place : null, points, (p) => (list[p - 1] ? list[p - 1].points : null)),
      vehicles: entranceChoices(place, tier), picks: prefs,
    };
  }
  return { creator: { uid: creatorUid, username: creatorUsername, displayName: name }, hidden, rows, me };
}

// A fan picks one of their two vehicles for a place (1, 2 or 3).
export async function setVehicle(db: Firestore, fanUid: string, place: unknown, vehicle: unknown): Promise<void> {
  const p = Number(place);
  if (![1, 2, 3].includes(p) || !isVehicle(vehicle)) throw Object.assign(new Error("Pick a vehicle for your place."), { status: 400 });
  const allowed = entranceChoices(p, p === 1 ? "vvip" : "premium");
  if (!allowed || !allowed.includes(vehicle)) throw Object.assign(new Error("That vehicle isn't one of the two for that place."), { status: 400 });
  await db.doc(`fanPrefs/${fanUid}`).set({ vehicles: { [String(p)]: vehicle }, updatedAt: new Date().toISOString() }, { merge: true });
}

// ── Live entrances (lib/rooms-server.ts calls this when someone joins or leaves a host's room) ──
export async function liveEntrance(db: Firestore, hostUid: string, fanUid: string, way: "in" | "out", now = new Date()): Promise<Entrance | null> {
  if (hostUid === fanUid) return null;
  const host = (await db.doc(`users/${hostUid}`).get()).data();
  if (!host?.username) return null;
  const list = await topFanList(db, hostUid);
  const place = placeIn(list, fanUid);
  if (!place || place > 3) return null;
  const tier = await activeTier(db, fanUid, String(host.username)).catch(() => null);
  const picks = (await db.doc(`fanPrefs/${fanUid}`).get()).data()?.vehicles ?? {};
  const vehicle = entranceVehicle(place, tier, picks);
  if (!vehicle || !tier) return null;
  const fan = (await db.doc(`users/${fanUid}`).get()).data();
  if (!fan || fan.suspended === true) return null;
  const badge = rankBadge(place, firstName(String(host.displayName || host.username)))!;
  return { uid: fanUid, name: String(fan.displayName || fan.username || "A fan"), vehicle, place, tier, badge: `${badge.emoji} ${badge.label}`, way, at: now.toISOString() };
}
