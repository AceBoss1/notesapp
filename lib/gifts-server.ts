import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  animatedGiftPrice, senderVerified, addGift, dailyId, lagosDayOf, shelfOrder, countedKobo, isGrand, isGiftMotif, GIFT_SETTINGS, giftPointsFor, lagosWeekOf,
  receivedKey, teenGiftAllowed, TEEN_GIFT_OFF, weekBefore, type AnimatedGift, type DailyTotal, type GiftMotif,
} from "./gift-catalogue";
import type { UserProfile } from "./users";
import { keptOffLists } from "./young";
import { storedSnapshot } from "./stat-cache";
import { postRoomEvent } from "./room-events-server";

// Server side of animated gifts and daily gift targets (lib/gift-catalogue.ts). Collections, all server-only in firestore.rules:
//   giftDaily/{day}_{uid}  one receiver's gifts on one Lagos day (totals, distinct senders, when the target was reached)
//   statCache/giftShelf_{day}  the cached "Top gifted today" list (lib/stat-cache.ts)
// and giftShows/{uid}, the last animated gift a member received, which signed-in visitors of their page read to play it.
// Gifting everywhere (v0.140.0, docs/LIVE_ECONOMY.md phase 2), also server-only:
//   giftWeekly/{week}_{uid}                    one receiver's gifts in one Lagos week (Monday 00:00): the weekly "Top gifted" board
//   gifterWeekly/{week}_{toUid}_{fromUid}       one sender's gifts to one creator in a week: that creator's weekly "Top gifters"
//   giftPoints/{uid}                           a sender's gift points (1 per ₦100 spent on gifts): all time and this week
//   giftReceived/{uid}_{key}                   a receiver's gifts grouped by gift (count, value), and whether they archived it

export class GiftError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export { senderVerified } from "./gift-catalogue";

// The price of an animated gift for this sender, from the catalogue in force (the caller has run ensurePricing).
export async function priceAnimatedGift(db: Firestore, senderUid: string, giftId: unknown): Promise<AnimatedGift> {
  const sender = (await db.doc(`users/${senderUid}`).get()).data() as UserProfile | undefined;
  const r = animatedGiftPrice(giftId, senderVerified(sender));
  if (!r.ok) throw new GiftError(r.error, r.status);
  return r.gift;
}

// ── Inside fulfillPayment's transaction (lib/payments.ts): read first, then write ─────────────────────────────────────────────────
export async function readGiftDaily(t: Transaction, db: Firestore, uid: string, at: string): Promise<DailyTotal | null> {
  const snap = await t.get(db.doc(`giftDaily/${dailyId(lagosDayOf(at), uid)}`));
  return snap.exists ? (snap.data() as DailyTotal) : null;
}

export function writeGiftDaily(t: Transaction, db: Firestore, prev: DailyTotal | null, g: { uid: string; fromUid: string; grossKobo: number; netKobo: number; at: string; liveId?: string }): DailyTotal {
  const next = addGift(prev, g);
  t.set(db.doc(`giftDaily/${dailyId(next.day, g.uid)}`), next);
  return next;
}

// What visitors of the receiver's page (and, later, a live room) play. Anonymous senders stay anonymous.
export function writeGiftShow(t: Transaction, db: Firestore, toUid: string, s: { reference: string; giftId: GiftMotif; name: string; priceKobo: number; senderName: string; at: string; quantity?: number }) {
  t.set(db.doc(`giftShows/${toUid}`), s);
}

// ── Grand gifts: the sitewide announcement ────────────────────────────────────────────────────────────────────────────────────────
// giftBursts/latest (public read, server-written): the last grand gift, which every open page shows as a banner with a link to watch it
// (components/GiftBurstBanner.tsx). Sent during a live that's still on, the link opens that live; otherwise the receiver's page. Never
// for a receiver kept off lists (teen mode), and anonymous senders stay anonymous. Called after the payment is fulfilled.
export type GiftBurst = { reference: string; giftId: GiftMotif; name: string; priceKobo: number; senderName: string; toName: string; toUsername: string; href: string; live: boolean; at: string };
export async function announceGrandGift(db: Firestore, g: { reference: string; giftId?: unknown; name?: string; priceKobo: number; senderName: string; toUid: string; toUsername: string; liveId?: string; at?: string }): Promise<GiftBurst | null> {
  if (!isGiftMotif(g.giftId) || !isGrand(g.priceKobo) || !GIFT_SETTINGS.grand.announce) return null;
  const u = (await db.doc(`users/${g.toUid}`).get()).data() as UserProfile | undefined;
  if (!u || u.suspended === true || keptOffLists(u as unknown as Record<string, unknown>)) return null;
  let href = `/u/${encodeURIComponent(g.toUsername)}`;
  let live = false;
  if (g.liveId) {
    const room = (await db.doc(`communityRooms/${g.liveId}`).get()).data();
    if (room && room.status === "live" && room.profile) { href = `/live/${encodeURIComponent(g.liveId)}`; live = true; } // a live from a profile
    else if (room && room.status === "live" && typeof room.cid === "string" && room.cid) { href = `/c/${encodeURIComponent(room.cid)}?room=${encodeURIComponent(g.liveId)}`; live = true; }
  }
  const burst: GiftBurst = { reference: g.reference, giftId: g.giftId, name: g.name || "", priceKobo: g.priceKobo, senderName: g.senderName, toName: u.displayName || g.toUsername, toUsername: g.toUsername, href, live, at: g.at ?? new Date().toISOString() };
  await db.doc("giftBursts/latest").set(burst);
  // Burst mode in the live it came from: a line in its chat (owner, 7 Nov 2026).
  if (live && g.liveId) await postRoomEvent(db, g.liveId, "burst", `🎆 Burst mode: ${g.senderName ? g.senderName + "'s " : ""}${g.name || "grand gift"} to ${burst.toName} is showing across #NotesApp`).catch(() => false);
  return burst;
}

// ── The "Top gifted today" shelf ──────────────────────────────────────────────────────────────────────────────────────────────────
export type ShelfRow = { uid: string; username: string; displayName: string; avatar: string; kobo: number; count: number; senders: number; reachedAt: string; liveId?: string; protected: boolean };
const SHELF_TTL_MS = 60_000;
const SHELF_READ = 200; // the day's biggest totals read to build the list (Firestore can't filter on the number of senders)
const SHELF_KEEP = 50; // kept in the cache, so hiding protected members from a viewer still leaves enough to fill the places

async function buildShelf(db: Firestore, day: string): Promise<ShelfRow[]> {
  const s = GIFT_SETTINGS.daily;
  const snap = await db.collection("giftDaily").where("day", "==", day).orderBy(s.basis === "net" ? "netKobo" : "grossKobo", "desc").limit(SHELF_READ).get();
  const ordered = shelfOrder(snap.docs.map((d) => d.data() as DailyTotal), day, s).slice(0, SHELF_KEEP);
  const users = await Promise.all(ordered.map((r) => db.doc(`users/${r.uid}`).get()));
  const rows: ShelfRow[] = [];
  ordered.forEach((r, i) => {
    const u = users[i].data() as UserProfile | undefined;
    if (!u || u.suspended === true || !u.username) return;
    rows.push({
      uid: r.uid, username: u.username, displayName: u.displayName || u.username, avatar: u.avatar || "",
      kobo: countedKobo(r, s), count: r.count, senders: r.senders.length, reachedAt: r.reachedAt ?? r.lastAt,
      ...(r.liveId ? { liveId: r.liveId } : {}), protected: keptOffLists(u as unknown as Record<string, unknown>),
    });
  });
  return rows;
}

// The shelf for one viewer. Teens (and adults who kept teen mode's listing protection) only show to people who follow them; signed-out
// visitors never see them. Built from a list cached for a minute, so opening Trending or Explore costs one read plus the follow checks.
export async function topGiftedToday(db: Firestore, viewer: { uid: string; username?: string } | null, now = new Date(), opts: { fresh?: boolean } = {}): Promise<{ day: string; rows: Omit<ShelfRow, "protected">[]; asOf: string; target: { kobo: number; basis: "gross" | "net"; minSenders: number } }> {
  const day = lagosDayOf(now);
  const { data, asOf } = await storedSnapshot(db, `giftShelf_${day}`, SHELF_TTL_MS, () => buildShelf(db, day), opts);
  const rows: Omit<ShelfRow, "protected">[] = [];
  for (const { protected: kept, ...r } of data) {
    if (rows.length >= GIFT_SETTINGS.daily.slots) break;
    if (kept) {
      const self = viewer?.uid === r.uid;
      const follows = !!viewer && !self && (await db.doc(`follows/${viewer.uid}_${r.username}`).get()).exists;
      if (!self && !follows) continue;
    }
    rows.push(r);
  }
  return { day, rows, asOf, target: { kobo: GIFT_SETTINGS.daily.targetKobo, basis: GIFT_SETTINGS.daily.basis, minSenders: GIFT_SETTINGS.daily.minSenders } };
}

// ── Who may gift whom (gifting everywhere) ────────────────────────────────────────────────────────────────────────────────────────
// Checked when the gift action is drawn (GET /api/gifts/can) and again at checkout: never yourself, never someone who switched gifts
// off, has no payout account, is suspended or has blocked you, and a member in teen mode only from mutual followers (owner, 4 Nov 2026).
export type GiftGate =
  | { ok: true; uid: string; username: string; name: string }
  | { ok: false; reason: "missing" | "self" | "off" | "no-payout" | "teen" | "blocked"; message: string; uid?: string; username?: string; name?: string };
export async function giftGate(db: Firestore, senderUid: string | null, to: { uid?: string; username?: string }): Promise<GiftGate> {
  let uid = to.uid && /^[A-Za-z0-9_-]{1,128}$/.test(to.uid) ? to.uid : "";
  if (!uid && to.username && /^[a-z0-9_-]{2,30}$/.test(to.username)) uid = String((await db.doc(`usernames/${to.username}`).get()).data()?.uid ?? "");
  if (!uid) return { ok: false, reason: "missing", message: "That member wasn't found." };
  const [u, pub, payout] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`publisherSettings/${uid}`).get(), db.doc(`payoutAccounts/${uid}`).get()]);
  const user = u.data();
  if (!user || user.suspended === true || !user.username) return { ok: false, reason: "missing", message: "That member wasn't found." };
  const who = { uid, username: String(user.username), name: String(user.displayName || user.username) };
  const first = who.name.split(" ")[0];
  if (senderUid && senderUid === uid) return { ok: false, reason: "self", message: "You can't gift yourself.", ...who };
  if (pub.data()?.gifts?.enabled === false) return { ok: false, reason: "off", message: `${first} isn't accepting gifts.`, ...who };
  if (!(payout.exists && payout.data()?.recipientCode)) return { ok: false, reason: "no-payout", message: `${first} hasn't set up payouts yet, so gifts can't reach them.`, ...who };
  if (senderUid) {
    if ((await db.doc(`dmBlocks/${uid}_${senderUid}`).get()).exists) return { ok: false, reason: "blocked", message: `You can't send ${first} a gift.`, ...who };
    if (user.teen === true) {
      const sender = (await db.doc(`users/${senderUid}`).get()).data();
      const sUser = String(sender?.username ?? "");
      const [a, b] = sUser ? await Promise.all([db.doc(`follows/${senderUid}_${who.username}`).get(), db.doc(`follows/${uid}_${sUser}`).get()]) : [null, null];
      if (!teenGiftAllowed({ receiverTeen: true, mutual: !!a?.exists && !!b?.exists })) return { ok: false, reason: "teen", message: TEEN_GIFT_OFF(first), ...who };
    }
  } else if (user.teen === true) return { ok: false, reason: "teen", message: TEEN_GIFT_OFF(first), ...who };
  return { ok: true, ...who };
}

// ── Weekly boards, gift points and received gifts: inside fulfillPayment's transaction (read first, then write) ─────────────────
export type WeeklyTotal = { week: string; uid: string; grossKobo: number; count: number; senders: string[]; lastAt: string };
export type GifterWeekly = { week: string; toUid: string; fromUid: string; kobo: number; count: number; lastAt: string };
export type GiftPoints = { uid: string; total: number; week: string; thisWeek: number; lastWeek: number; lastWeekOf?: string; updatedAt: string };
export type GiftReceived = { uid: string; key: string; animId?: GiftMotif; name: string; count: number; valueKobo: number; archived: boolean; archivedAt?: string; lastAt: string };
export type TallyInput = { toUid: string; fromUid: string; anonymous: boolean; grossKobo: number; quantity: number; animId?: GiftMotif; name: string; at: string };
type TallyRead = { weekly?: WeeklyTotal; gifter?: GifterWeekly; points?: GiftPoints; received?: GiftReceived };

const tallyRefs = (db: Firestore, g: TallyInput) => {
  const week = lagosWeekOf(g.at);
  return {
    week,
    weekly: db.doc(`giftWeekly/${week}_${g.toUid}`),
    gifter: db.doc(`gifterWeekly/${week}_${g.toUid}_${g.fromUid}`),
    points: db.doc(`giftPoints/${g.fromUid}`),
    received: db.doc(`giftReceived/${g.toUid}_${receivedKey(g.animId)}`),
  };
};
export async function readGiftTallies(t: Transaction, db: Firestore, g: TallyInput): Promise<TallyRead> {
  const r = tallyRefs(db, g);
  const [w, gf, p, rc] = await Promise.all([t.get(r.weekly), t.get(r.gifter), t.get(r.points), t.get(r.received)]);
  return { weekly: w.data() as WeeklyTotal | undefined, gifter: gf.data() as GifterWeekly | undefined, points: p.data() as GiftPoints | undefined, received: rc.data() as GiftReceived | undefined };
}
// Pure: what the four tallies become after one gift (a send of N counts N gifts and the whole amount). Nothing for a gift to yourself.
export function nextTallies(prev: TallyRead, g: TallyInput): Required<Omit<TallyRead, "gifter">> & { gifter?: GifterWeekly } {
  const week = lagosWeekOf(g.at);
  // Each week is its own document, so a total from another week is never carried over (checked here too, not only by the id read).
  const w = prev.weekly?.week === week ? prev.weekly : { week, uid: g.toUid, grossKobo: 0, count: 0, senders: [], lastAt: g.at };
  const gp = prev.gifter?.week === week ? prev.gifter : undefined;
  const weekly: WeeklyTotal = { ...w, senders: [...w.senders], grossKobo: w.grossKobo + g.grossKobo, count: w.count + g.quantity, lastAt: g.at };
  if (!weekly.senders.includes(g.fromUid) && weekly.senders.length < 100) weekly.senders.push(g.fromUid);
  // Anonymous gifts count for the receiver and the sender's own points, but never put the sender's name on a creator's Top gifters.
  const gifter = g.anonymous ? undefined : { week, toUid: g.toUid, fromUid: g.fromUid, kobo: (gp?.kobo ?? 0) + g.grossKobo, count: (gp?.count ?? 0) + g.quantity, lastAt: g.at };
  const p = prev.points;
  const pts = giftPointsFor(g.grossKobo);
  const same = p?.week === week;
  const points: GiftPoints = {
    uid: g.fromUid, total: (p?.total ?? 0) + pts, week, thisWeek: (same ? p!.thisWeek : 0) + pts,
    lastWeek: same ? p!.lastWeek : p?.week === weekBefore(week) ? p.thisWeek : 0, lastWeekOf: weekBefore(week), updatedAt: g.at,
  };
  const key = receivedKey(g.animId);
  const rc = prev.received;
  const received: GiftReceived = {
    uid: g.toUid, key, ...(g.animId ? { animId: g.animId } : {}), name: g.animId ? g.name || rc?.name || key : "Other amounts",
    count: (rc?.count ?? 0) + g.quantity, valueKobo: (rc?.valueKobo ?? 0) + g.grossKobo, archived: rc?.archived ?? false, ...(rc?.archivedAt ? { archivedAt: rc.archivedAt } : {}), lastAt: g.at,
  };
  return { weekly, gifter, points, received };
}
export function writeGiftTallies(t: Transaction, db: Firestore, prev: TallyRead, g: TallyInput): void {
  if (g.fromUid === g.toUid) return;
  const r = tallyRefs(db, g);
  const n = nextTallies(prev, g);
  t.set(r.weekly, n.weekly);
  if (n.gifter) t.set(r.gifter, n.gifter);
  t.set(r.points, n.points);
  t.set(r.received, n.received);
}

// ── Weekly boards ("Top gifted" sitewide and each creator's "Top gifters") ────────────────────────────────────────────────────────
export type BoardRow = { place: number; uid: string; username: string; displayName: string; avatar: string; kobo: number; count: number };
const BOARD_SIZE = 20;
// Members kept off lists (teen mode, or kept after 18) show only to themselves and people who follow them; signed-out visitors never.
async function boardRows(db: Firestore, viewer: { uid: string } | null, list: { uid: string; kobo: number; count: number }[]): Promise<BoardRow[]> {
  const users = await Promise.all(list.map((r) => db.doc(`users/${r.uid}`).get()));
  const rows: BoardRow[] = [];
  for (let i = 0; i < list.length && rows.length < BOARD_SIZE; i++) {
    const u = users[i].data();
    if (!u || u.suspended === true || !u.username) continue;
    if (keptOffLists(u) && viewer?.uid !== list[i].uid) {
      const follows = !!viewer && (await db.doc(`follows/${viewer.uid}_${u.username}`).get()).exists;
      if (!follows) continue;
    }
    rows.push({ place: rows.length + 1, uid: list[i].uid, username: String(u.username), displayName: String(u.displayName || u.username), avatar: String(u.avatar ?? ""), kobo: list[i].kobo, count: list[i].count });
  }
  return rows;
}
// `which`: this week (resets at midnight going into Monday, Lagos) or last week (kept, so last week's result stays viewable).
export async function weeklyBoards(db: Firestore, viewer: { uid: string } | null, opts: { which?: "this" | "last"; creatorUsername?: string; now?: Date } = {}) {
  const thisWeek = lagosWeekOf(opts.now ?? new Date());
  const week = opts.which === "last" ? weekBefore(thisWeek) : thisWeek;
  const top = await db.collection("giftWeekly").where("week", "==", week).orderBy("grossKobo", "desc").limit(BOARD_SIZE * 3).get();
  const gifted = await boardRows(db, viewer, top.docs.map((d) => { const x = d.data() as WeeklyTotal; return { uid: x.uid, kobo: x.grossKobo, count: x.count }; }));
  let gifters: BoardRow[] | null = null;
  let creator: { uid: string; username: string; displayName: string } | null = null;
  if (opts.creatorUsername && /^[a-z0-9_-]{2,30}$/.test(opts.creatorUsername)) {
    const uid = String((await db.doc(`usernames/${opts.creatorUsername}`).get()).data()?.uid ?? "");
    const cu = uid ? (await db.doc(`users/${uid}`).get()).data() : null;
    if (cu && cu.suspended !== true) {
      creator = { uid, username: opts.creatorUsername, displayName: String(cu.displayName || opts.creatorUsername) };
      // A creator kept off lists has no public Top gifters (they see their own).
      if (!keptOffLists(cu) || viewer?.uid === uid) {
        const snap = await db.collection("gifterWeekly").where("week", "==", week).where("toUid", "==", uid).orderBy("kobo", "desc").limit(BOARD_SIZE * 3).get();
        gifters = await boardRows(db, viewer, snap.docs.map((d) => { const x = d.data() as GifterWeekly; return { uid: x.fromUid, kobo: x.kobo, count: x.count }; }));
      } else gifters = [];
    }
  }
  return { week, thisWeek, endsAt: new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86_400_000 - 3_600_000).toISOString(), gifted, gifters, creator };
}
