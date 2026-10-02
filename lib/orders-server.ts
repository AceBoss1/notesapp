import { createHash, randomBytes } from "crypto";
import { getAdminDb, getUserEmail } from "./firebase-admin";
import { sendEmail } from "./email";
import { FieldValue } from "firebase-admin/firestore";
import { ESCROW_AUTO_RELEASE_DAYS, StoreOrder } from "./orders";
import { formatNaira } from "./booking-time";

// Server-only helpers for seller orders and parcel links.
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newLinkToken = () => randomBytes(18).toString("base64url");
export const holderUrl = (token: string) => `${site()}/p/${token}`;

// Buyer confirmed (or the 7 days ran out, or an admin resolved a dispute): the
// seller's money stops being held and becomes payable.
export async function confirmOrder(reference: string, by: "buyer" | "auto" | "admin"): Promise<void> {
  const db = getAdminDb();
  const oref = db.doc(`storeOrders/${reference}`);
  const now = new Date().toISOString();
  let order: StoreOrder | undefined;
  await db.runTransaction(async (t) => {
    const snap = await t.get(oref);
    order = snap.data() as StoreOrder | undefined;
    if (!order) throw new Error("Order not found");
    if (order.status === "confirmed" || order.status === "refunded") return;
    const lref = db.doc(`ledger/${reference}`);
    const l = (await t.get(lref)).data();
    t.update(oref, { status: "confirmed", confirmedAt: now, ...(by === "auto" ? { autoConfirmed: true } : {}) });
    t.update(db.doc(`parcels/${order.parcelId}`), { status: "confirmed" });
    if (l && ["held", "disputed"].includes(l.status)) t.update(lref, { releaseAfter: now, ...(l.status === "disputed" && by === "admin" ? { status: "held" } : {}) });
  });
  if (order && by !== "buyer") {
    const to = await getUserEmail(order.sellerUid);
    if (to) await sendEmail({ to, subject: "Your order payout is ready", text: `The order for ${order.itemTitle} (${formatNaira(order.amountKobo)}) is ${by === "auto" ? "automatically confirmed after the 7-day window" : "confirmed"}, so your money is no longer held and will be paid out to your bank.\n\n#NotesApp` }).catch(() => {});
  }
}

// Called by the daily cron: orders marked delivered whose 7 days are up.
export async function releaseDueOrders(): Promise<number> {
  const db = getAdminDb();
  const snap = await db.collection("storeOrders").where("status", "==", "delivered").get();
  let n = 0;
  for (const d of snap.docs) {
    const o = d.data() as StoreOrder;
    if (o.autoReleaseAt && new Date(o.autoReleaseAt).getTime() <= Date.now()) {
      await confirmOrder(o.reference, "auto").catch((e) => console.error("auto-confirm failed", o.reference, e));
      n++;
    }
  }
  return n;
}

export const autoReleaseAt = () => new Date(Date.now() + ESCROW_AUTO_RELEASE_DAYS * 86_400_000).toISOString();

// A holder's no-login link works only until the NEXT party confirms custody.
export async function expireLinks(parcelId: string, exceptEntryId?: string): Promise<void> {
  const db = getAdminDb();
  const snap = await db.collection("parcelLinks").where("parcelId", "==", parcelId).where("active", "==", true).get();
  const batch = db.batch();
  snap.docs.forEach((d) => {
    if (d.data().entryId !== exceptEntryId) batch.update(d.ref, { active: false });
  });
  await batch.commit();
}

// ---- Managed stock ----------------------------------------------------------
// A sellable item has a stock count. Starting a checkout RESERVES the quantity (so two
// buyers can't both get the last one); an unpaid reservation is given back after
// RESERVATION_MINUTES. Reaching zero stops all orders; the seller restocking (or a
// refund returning an unshipped order) tells everyone who asked to be notified.
export const RESERVATION_MINUTES = 30;

export class StockError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function reserveStock(itemId: string, qty: number): Promise<void> {
  const db = getAdminDb();
  const ref = db.doc(`storeItems/${itemId}`);
  await db.runTransaction(async (t) => {
    const item = (await t.get(ref)).data();
    if (!item || item.sellable !== true) throw new StockError("This item isn't for sale here.");
    const stock = Number.isInteger(item.stock) ? Number(item.stock) : 0;
    if (stock < qty) throw new StockError(stock > 0 ? `Only ${stock} left.` : "Sold out.");
    t.update(ref, { stock: stock - qty });
  });
}

export async function returnStock(itemId: string, qty: number): Promise<void> {
  const ref = getAdminDb().doc(`storeItems/${itemId}`);
  if ((await ref.get()).exists) await ref.update({ stock: FieldValue.increment(qty) });
}

// Give back reservations whose payment was never completed. Runs before each checkout
// for that item, and for all items from the daily cron.
export async function releaseExpiredReservations(itemId?: string): Promise<number> {
  const db = getAdminDb();
  let q = db.collection("payments").where("kind", "==", "store").where("status", "==", "pending");
  if (itemId) q = q.where("store.itemId", "==", itemId);
  const snap = await q.get();
  let n = 0;
  for (const d of snap.docs) {
    const p = d.data();
    if (p.reservationReleased || !p.reservedUntil || new Date(p.reservedUntil).getTime() > Date.now()) continue;
    const claimed = await db.runTransaction(async (t) => {
      const cur = (await t.get(d.ref)).data();
      if (!cur || cur.status !== "pending" || cur.reservationReleased) return false;
      t.update(d.ref, { reservationReleased: true });
      return true;
    });
    if (!claimed) continue;
    await returnStock(p.store.itemId, p.store.quantity).catch((e) => console.error("returnStock failed", e));
    n++;
    if (p.store?.itemId) await notifyBackInStock(p.store.itemId).catch(() => {});
  }
  return n;
}

// Tell the people who asked ("notify me") that the item can be ordered again — in their bell.
export async function notifyBackInStock(itemId: string): Promise<number> {
  const db = getAdminDb();
  const item = (await db.doc(`storeItems/${itemId}`).get()).data();
  if (!item || item.sellable !== true || !(Number(item.stock) > 0)) return 0;
  const watches = await db.collection("stockWatches").where("itemId", "==", itemId).get();
  if (watches.empty) return 0;
  const owner = (await db.doc(`users/${item.ownerUid}`).get()).data();
  const now = new Date().toISOString();
  const batch = db.batch();
  watches.docs.forEach((w) => {
    batch.set(db.collection("notifications").doc(), {
      recipientUid: w.data().uid, type: "stock", read: false, createdAt: now,
      message: `${item.title} is back in stock${owner ? ` at ${owner.displayName}'s store` : ""}.`,
      linkHref: `/shop/${itemId}`,
    });
    batch.delete(w.ref);
  });
  await batch.commit();
  return watches.size;
}

// Who may run a seller's orders and items: the seller themselves, or — for an
// organisation's store — a team member the owner gave store access (while the
// organisation is on a team plan). Funds and liability stay with the seller account.
export async function canActForSeller(uid: string, sellerUid: string): Promise<boolean> {
  if (uid === sellerUid) return true;
  const db = getAdminDb();
  const m = (await db.doc(`orgMembers/${sellerUid}_${uid}`).get()).data();
  if (!m || m.store !== true) return false;
  const org = (await db.doc(`users/${sellerUid}`).get()).data();
  return !!org && org.suspended !== true && ["business", "enterprise"].includes(org.accountTier);
}
