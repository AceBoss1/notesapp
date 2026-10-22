import type { Firestore } from "firebase-admin/firestore";
import { isAutoFollowed } from "@/lib/journals-directory";
import { canShowPlayer, lifePrivacyOf } from "./social";

// Server-only. Notes Life on NotesApp: does this member play (as this viewer may see it), and the feed card's line about friends.
// "Friends" are people the viewer follows who follow them back, have "Show that I play Notes Life" on and aren't in teen mode.
const mutualPair = async (db: Firestore, a: { uid: string; username: string }, b: { uid: string; username: string }) => {
  const [ab, ba] = await db.getAll(db.doc(`follows/${a.uid}_${b.username}`), db.doc(`follows/${b.uid}_${a.username}`));
  return (ab.exists || isAutoFollowed(b.username)) && (ba.exists || isAutoFollowed(a.username));
};

export async function playsNotesLife(db: Firestore, viewerUid: string | null, targetUid: string): Promise<{ plays: boolean; username?: string }> {
  if (!viewerUid || !targetUid || viewerUid === targetUid) return { plays: false };
  const [v, t, player] = await db.getAll(db.doc(`users/${viewerUid}`), db.doc(`users/${targetUid}`), db.doc(`lifePlayers/${targetUid}`));
  if (!v.exists || !t.exists || !player.exists) return { plays: false };
  const viewer = { uid: viewerUid, username: String(v.data()?.username ?? "") }, them = { uid: targetUid, username: String(t.data()?.username ?? "") };
  if (!viewer.username || !them.username) return { plays: false };
  const vp = lifePrivacyOf(v.data()), tp = lifePrivacyOf(t.data());
  if (!vp || vp.teen || !tp.lifeShow) return { plays: false }; // no follow lookups when it can't show anyway
  const ok = canShowPlayer({ viewer: vp, player: tp, mutual: await mutualPair(db, viewer, them), plays: true });
  return ok ? { plays: true, username: them.username } : { plays: false };
}

const memo = new Map<string, { at: number; v: FeedCard }>();
export type FeedCard = { show: boolean; playing: boolean; friends: { count: number; sample: { name: string; avatar: string }[] } };
// The feed card for this viewer. Signed out: the card with no friends line. Teen mode or "Notes Life card in my feed" off: no card.
export async function feedCard(db: Firestore, viewerUid: string | null, now = Date.now()): Promise<FeedCard> {
  const none = { count: 0, sample: [] };
  if (!viewerUid) return { show: true, playing: false, friends: none };
  const hit = memo.get(viewerUid);
  if (hit && now - hit.at < 10 * 60_000) return hit.v;
  const [me, mine] = await db.getAll(db.doc(`users/${viewerUid}`), db.doc(`lifePlayers/${viewerUid}`));
  const p = lifePrivacyOf(me.data());
  if (p.teen || !p.lifeCard) return { show: false, playing: mine.exists, friends: none };
  const myName = String(me.data()?.username ?? "");
  const following = (await db.collection("follows").where("followerUid", "==", viewerUid).limit(300).get()).docs.map((d) => String(d.data().username ?? "")).filter(Boolean);
  const people: { uid: string; name: string; avatar: string }[] = [];
  for (let i = 0; i < following.length; i += 30) {
    const s = await db.collection("users").where("username", "in", following.slice(i, i + 30)).get();
    s.docs.forEach((d) => { if (lifePrivacyOf(d.data()).lifeShow && d.id !== viewerUid) people.push({ uid: d.id, name: String(d.data().displayName || d.data().username), avatar: String(d.data().avatar ?? "") }); });
  }
  const plays = people.length ? await db.getAll(...people.map((x) => db.doc(`lifePlayers/${x.uid}`))) : [];
  const players = people.filter((_, i) => plays[i]?.exists);
  const back = players.length && myName ? await db.getAll(...players.map((x) => db.doc(`follows/${x.uid}_${myName}`))) : [];
  const friends = players.filter((x, i) => back[i]?.exists);
  const v: FeedCard = { show: true, playing: mine.exists, friends: { count: friends.length, sample: friends.slice(0, 3).map(({ name, avatar }) => ({ name, avatar })) } };
  if (memo.size > 2000) memo.clear();
  memo.set(viewerUid, { at: now, v });
  return v;
}

export async function setLifePrivacy(db: Firestore, uid: string, patch: { lifeShow?: unknown; lifeCard?: unknown }) {
  const p = lifePrivacyOf((await db.doc(`users/${uid}`).get()).data());
  if (p.teen) return p; // teen mode keeps both off
  const next: Record<string, boolean> = {};
  if (typeof patch.lifeShow === "boolean") next.lifeShow = patch.lifeShow;
  if (typeof patch.lifeCard === "boolean") next.lifeCard = patch.lifeCard;
  if (Object.keys(next).length) await db.doc(`users/${uid}`).set(next, { merge: true });
  memo.delete(uid);
  return { ...p, ...next };
}
