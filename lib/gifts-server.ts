import type { Firestore, Transaction } from "firebase-admin/firestore";
import { animatedGiftPrice, senderVerified, addGift, dailyId, lagosDayOf, shelfOrder, countedKobo, GIFT_SETTINGS, type AnimatedGift, type DailyTotal, type GiftMotif } from "./gift-catalogue";
import type { UserProfile } from "./users";
import { keptOffLists } from "./young";
import { storedSnapshot } from "./stat-cache";

// Server side of animated gifts and daily gift targets (lib/gift-catalogue.ts). Collections, all server-only in firestore.rules:
//   giftDaily/{day}_{uid}  one receiver's gifts on one Lagos day (totals, distinct senders, when the target was reached)
//   statCache/giftShelf_{day}  the cached "Top gifted today" list (lib/stat-cache.ts)
// and giftShows/{uid}, the last animated gift a member received, which signed-in visitors of their page read to play it.

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
export function writeGiftShow(t: Transaction, db: Firestore, toUid: string, s: { reference: string; giftId: GiftMotif; name: string; priceKobo: number; senderName: string; at: string }) {
  t.set(db.doc(`giftShows/${toUid}`), s);
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
