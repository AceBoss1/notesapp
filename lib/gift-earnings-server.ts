import type { Firestore } from "firebase-admin/firestore";
import { GIFT_SETTINGS, giftNaira, lagosWeekOf, withdrawRoute, type GiftMotif } from "./gift-catalogue";
import type { GiftPoints, GiftReceived, WeeklyTotal } from "./gifts-server";
import type { LedgerEntry } from "./payments";
import { keptOffLists } from "./young";

// Received gifts, archive and withdraw (owner, 4 Nov 2026; docs/LIVE_ECONOMY.md phase 2). Server-only.
//
// Gifts are earnings. Each gift's share sits in the ledger (ledger/{ref}, kind "gift") for the 7-day review, as before. Withdraw
// gathers every gift entry of this member that is past its review into ONE payout entry (ledger/gw_{uid}_{time}, kind "gift_payout"),
// which is sent through the existing payout path (lib/payouts.ts releaseLedgerEntry: Paystack or Paylony, and the payout OTP when
// Paystack asks for one). The gifts it gathered are marked "withdrawn" with its id, so they can't be paid or refunded twice.
// Under the withdrawal line (Admin → Pricing → Gifts, GIFT_SETTINGS.economy.autoWithdrawMaxKobo) it goes straight away and with the
// scheduled payouts; from the line up it waits for a person to release it in Admin → Payments.
//   giftWithdrawals/{id}   the request: uid, amountKobo, entries[], route ("auto" or "approval"), createdAt. Server-only.

export class GiftEarningsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type ReceivedRow = { key: string; animId?: GiftMotif; name: string; count: number; valueKobo: number; archived: boolean };
export type WithdrawalRow = { id: string; amountKobo: number; route: "auto" | "approval"; status: string; createdAt: string; failureReason?: string };
export type ReceivedView = {
  owner: { uid: string; username: string; displayName: string };
  rows: ReceivedRow[]; // not archived, most value first
  archived: { kinds: number; count: number; valueKobo: number; rows: ReceivedRow[] };
  points: { total: number; thisWeek: number };
  week: { place: number | null; kobo: number };
  // Only for the member themselves:
  money?: { readyKobo: number; readyCount: number; inReviewKobo: number; nextReleaseAt: string | null; autoBelowKobo: number; payoutReady: boolean; withdrawals: WithdrawalRow[] };
};

const rowOf = (r: GiftReceived): ReceivedRow => ({ key: r.key, ...(r.animId ? { animId: r.animId } : {}), name: r.name, count: r.count, valueKobo: r.valueKobo, archived: r.archived === true });

// The gift entries of this member that can still be withdrawn: held (not disputed, refunded or paid), with what is past the review.
async function heldGiftEntries(db: Firestore, uid: string): Promise<LedgerEntry[]> {
  const snap = await db.collection("ledger").where("publisherUid", "==", uid).where("kind", "==", "gift").where("status", "==", "held").limit(5000).get();
  return snap.docs.map((d) => d.data() as LedgerEntry);
}
export function splitByReview(entries: Pick<LedgerEntry, "netKobo" | "releaseAfter">[], now = new Date()) {
  let readyKobo = 0, readyCount = 0, inReviewKobo = 0;
  let next: string | null = null;
  for (const e of entries) {
    if (Date.parse(e.releaseAfter) <= now.getTime()) { readyKobo += e.netKobo; readyCount++; }
    else { inReviewKobo += e.netKobo; if (!next || e.releaseAfter < next) next = e.releaseAfter; }
  }
  return { readyKobo, readyCount, inReviewKobo, nextReleaseAt: next };
}

// A member's received gifts, as their profile shows them (after Media). Everyone sees the gifts, counts and values; a member kept off
// lists (teen mode) shows them only to themselves and people they follow. The money and withdrawals are for the member alone.
export async function receivedGifts(db: Firestore, viewer: { uid: string } | null, username: string, now = new Date()): Promise<ReceivedView | null> {
  if (!/^[a-z0-9_-]{2,30}$/.test(username)) return null;
  const uid = String((await db.doc(`usernames/${username}`).get()).data()?.uid ?? "");
  if (!uid) return null;
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true) return null;
  const self = viewer?.uid === uid;
  if (!self && keptOffLists(u)) {
    const follows = !!viewer && (await db.doc(`follows/${viewer.uid}_${username}`).get()).exists;
    if (!follows) return null;
  }
  const week = lagosWeekOf(now);
  const [rec, pts, mine, wk] = await Promise.all([
    db.collection("giftReceived").where("uid", "==", uid).limit(200).get(),
    db.doc(`giftPoints/${uid}`).get(),
    db.doc(`giftWeekly/${week}_${uid}`).get(),
    db.collection("giftWeekly").where("week", "==", week).orderBy("grossKobo", "desc").limit(100).get(),
  ]);
  const all = rec.docs.map((d) => rowOf(d.data() as GiftReceived)).sort((a, b) => b.valueKobo - a.valueKobo);
  const archivedRows = all.filter((r) => r.archived);
  const p = pts.data() as GiftPoints | undefined;
  const myWeek = mine.data() as WeeklyTotal | undefined;
  const placeIdx = wk.docs.findIndex((d) => d.id === `${week}_${uid}`);
  const view: ReceivedView = {
    owner: { uid, username, displayName: String(u.displayName || username) },
    rows: all.filter((r) => !r.archived),
    archived: { kinds: archivedRows.length, count: archivedRows.reduce((n, r) => n + r.count, 0), valueKobo: archivedRows.reduce((n, r) => n + r.valueKobo, 0), rows: archivedRows },
    points: { total: p?.total ?? 0, thisWeek: p?.week === week ? p.thisWeek : 0 },
    week: { place: placeIdx >= 0 ? placeIdx + 1 : null, kobo: myWeek?.grossKobo ?? 0 },
  };
  if (self) {
    const [held, wd, payout] = await Promise.all([
      heldGiftEntries(db, uid),
      db.collection("giftWithdrawals").where("uid", "==", uid).limit(50).get(),
      db.doc(`payoutAccounts/${uid}`).get(),
    ]);
    const withdrawals = await Promise.all(wd.docs.map(async (d) => {
      const w = d.data();
      const l = (await db.doc(`ledger/${d.id}`).get()).data() as LedgerEntry | undefined;
      const status = !l ? "unknown" : l.status === "held" ? (w.route === "approval" ? "waiting for approval" : "sending") : l.status === "transferring" ? "sending" : l.status === "paid_out" ? "paid" : l.status.replace("_", " ");
      return { id: d.id, amountKobo: Number(w.amountKobo), route: w.route, status, createdAt: String(w.createdAt), ...(l?.failureReason ? { failureReason: l.failureReason } : {}) } as WithdrawalRow;
    }));
    view.money = { ...splitByReview(held, now), autoBelowKobo: GIFT_SETTINGS.economy.autoWithdrawMaxKobo, payoutReady: !!payout.data()?.recipientCode, withdrawals: withdrawals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10) };
  }
  return view;
}

// Archive moves a gift out of the main list; it keeps its count and value and still shows under "Archived". Earnings are untouched.
export async function setArchived(db: Firestore, uid: string, key: unknown, archived: boolean, now = new Date()): Promise<void> {
  if (typeof key !== "string" || !/^[a-z]{2,20}$/.test(key)) throw new GiftEarningsError("Which gift?");
  const ref = db.doc(`giftReceived/${uid}_${key}`);
  if (!(await ref.get()).exists) throw new GiftEarningsError("That gift isn't in your list.", 404);
  await ref.update(archived ? { archived: true, archivedAt: now.toISOString() } : { archived: false });
}

// Withdraw everything past the review. Returns the payout entry's id and which way it goes; the caller sends an "auto" one at once
// (releaseLedgerEntry) and the scheduled payouts pick it up again if that fails.
export async function withdrawGifts(db: Firestore, uid: string, now = new Date()): Promise<{ id: string; amountKobo: number; count: number; route: "auto" | "approval" }> {
  const payout = (await db.doc(`payoutAccounts/${uid}`).get()).data();
  if (!payout?.recipientCode) throw new GiftEarningsError("Add your bank account under Rates & payouts first, then withdraw.", 409);
  const ids = (await heldGiftEntries(db, uid)).filter((e) => Date.parse(e.releaseAfter) <= now.getTime()).map((e) => e.reference);
  if (!ids.length) throw new GiftEarningsError("Nothing is past its review yet. Each gift is ready 7 days after it was sent.", 409);
  const id = `gw_${uid}_${now.getTime()}`;
  return db.runTransaction(async (t) => {
    const refs = ids.map((r) => db.doc(`ledger/${r}`));
    const snaps = await t.getAll(...refs);
    const user = (await t.get(db.doc(`users/${uid}`))).data();
    // Read again inside the transaction: an entry a person just disputed, refunded or released is left out.
    const ready = snaps.map((s) => s.data() as LedgerEntry | undefined).filter((e): e is LedgerEntry => !!e && e.status === "held" && e.kind === "gift" && e.publisherUid === uid && Date.parse(e.releaseAfter) <= now.getTime());
    const amountKobo = ready.reduce((n, e) => n + e.netKobo, 0);
    if (amountKobo <= 0) throw new GiftEarningsError("Nothing is past its review yet.", 409);
    const route = withdrawRoute(amountKobo);
    const at = now.toISOString();
    const entry: LedgerEntry = {
      reference: id, kind: "gift_payout", publisherUid: uid, publisherUsername: String(user?.username ?? ""), payerUid: uid,
      grossKobo: amountKobo, commissionKobo: 0, netKobo: amountKobo, status: "held", releaseAfter: at, createdAt: at,
      withdrawalOf: ready.length, ...(route === "approval" ? { needsApproval: true } : {}),
    };
    t.set(db.doc(`ledger/${id}`), entry);
    for (const e of ready) t.update(db.doc(`ledger/${e.reference}`), { status: "withdrawn", withdrawalId: id, withdrawnAt: at });
    t.set(db.doc(`giftWithdrawals/${id}`), { id, uid, amountKobo, count: ready.length, entries: ready.map((e) => e.reference), route, createdAt: at });
    return { id, amountKobo, count: ready.length, route };
  });
}

export const withdrawDoneText = (r: { amountKobo: number; route: "auto" | "approval" }) => r.route === "auto"
  ? `${giftNaira(r.amountKobo)} is on its way to your bank account. Transfers usually arrive within minutes.`
  : `${giftNaira(r.amountKobo)} is waiting for our team to approve it, usually within a day. You'll get an email when it's sent.`;
