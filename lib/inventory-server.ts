import type { Firestore, Transaction } from "firebase-admin/firestore";
import { effectiveTier, type UserProfile } from "./users";
import { currentPricing } from "./pricing";
import { canManageItems, notifyBackInStock } from "./orders-server";
import { notifyBell } from "./email";
import {
  addonExtendedUntil, crossedLow, inventoryAccess, inventoryDocOf, isManualReason, stockLines, summary,
  cleanSku, cleanLowAt, cleanCostKobo, type ImportChange, type InventoryAccess, type InventoryAccount, type InventoryDoc, type Move, type MoveReason,
} from "./inventory";

// Inventory on the server (the rules are lib/inventory.ts). Store items stay where they are (storeItems, public); the private side is
// inventory/{itemId} and inventoryMoves/{id}, server-only in firestore.rules.
export class InventoryError extends Error { constructor(public status: number, message: string) { super(message); } }

type Owner = UserProfile & { inventoryAccount?: InventoryAccount };
const ownerOf = async (db: Firestore, uid: string) => (await db.doc(`users/${uid}`).get()).data() as Owner | undefined;
const tierOf = (p: Owner) => effectiveTier({ username: p.username ?? "", role: p.role ?? "reader", accountTier: p.accountTier ?? "standard" });
export const accessFor = (p: Owner, now = new Date()): InventoryAccess => (p.suspended ? { ok: false, canTrial: false } : inventoryAccess(tierOf(p), p.inventoryAccount, now, currentPricing().inventory.trialDays));

// Who may work on a store's inventory: whoever may manage its items (the owner, or an organisation's teammates with store access and its
// admins), while the store has inventory.
async function guard(db: Firestore, actorUid: string, ownerUid: string, now: Date): Promise<Owner> {
  if (!(await canManageItems(actorUid, ownerUid))) throw new InventoryError(403, "You can't manage this store's inventory.");
  const p = await ownerOf(db, ownerUid);
  if (!p) throw new InventoryError(404, "Account not found.");
  const a = accessFor(p, now);
  if (!a.ok) throw new InventoryError(402, a.canTrial ? "Inventory comes with Business. On Free Basic and Pro, start the free trial or add it." : "Inventory comes with Business. On Free Basic and Pro, add it a month at a time.");
  return p;
}

export async function startInventoryTrial(db: Firestore, uid: string, now = new Date()): Promise<InventoryAccess> {
  const p = await ownerOf(db, uid);
  if (!p) throw new InventoryError(404, "Account not found.");
  const a = accessFor(p, now);
  if (a.ok) throw new InventoryError(409, a.via === "plan" ? "Your plan already includes inventory." : "Inventory is already on.");
  if (!a.canTrial) throw new InventoryError(403, p.inventoryAccount?.trialStartedAt ? "You've had your free trial. Add inventory to carry on." : "Inventory is for accounts that publish.");
  await db.doc(`users/${uid}`).set({ inventoryAccount: { ...(p.inventoryAccount ?? {}), trialStartedAt: now.toISOString() } }, { merge: true });
  return accessFor({ ...p, inventoryAccount: { ...p.inventoryAccount, trialStartedAt: now.toISOString() } }, now);
}

// A paid month of the add-on, inside fulfillPayment's transaction.
export function extendInventoryAddon(t: Transaction, db: Firestore, uid: string, acc: InventoryAccount | undefined, now: Date) {
  const until = addonExtendedUntil(acc, now, currentPricing().inventory.trialDays);
  t.set(db.doc(`users/${uid}`), { inventoryAccount: { ...(acc ?? {}), addonUntil: until } }, { merge: true });
  return until;
}

type Item = { id: string; title: string; stock?: number; variantStock?: Record<string, number>; priceKobo?: number; image?: string; options?: unknown[] };
async function itemsOf(db: Firestore, ownerUid: string): Promise<Item[]> {
  const snap = await db.collection("storeItems").where("ownerUid", "==", ownerUid).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Item, "id"> & { sellable?: boolean; kind?: string }) }))
    .filter((i) => i.sellable === true && i.kind !== "digital")
    .map(({ id, title, stock, variantStock, priceKobo, image, options }) => ({ id, title, stock, variantStock, priceKobo, image, options }));
}
async function docsOf(db: Firestore, ownerUid: string, ids: string[]): Promise<Record<string, InventoryDoc>> {
  if (!ids.length) return {};
  const snaps = await db.getAll(...ids.map((id) => db.doc(`inventory/${id}`)));
  const out: Record<string, InventoryDoc> = {};
  for (const s of snaps) if (s.exists && s.data()?.ownerUid === ownerUid) out[s.id] = inventoryDocOf(s.data(), ownerUid);
  return out;
}

export async function readInventory(db: Firestore, actorUid: string, ownerUid: string, now = new Date()) {
  const p = await guard(db, actorUid, ownerUid, now);
  const items = await itemsOf(db, ownerUid);
  const inv = await docsOf(db, ownerUid, items.map((i) => i.id));
  const lines = stockLines(items, inv);
  return { access: accessFor(p, now), items: items.map((i) => ({ id: i.id, title: i.title, image: i.image ?? "", hasOptions: Array.isArray(i.options) && i.options.length > 0 })), inv, lines, summary: summary(lines) };
}

// The item's private details: SKU (and per option), cost price, low-stock level.
export async function saveDetails(db: Firestore, actorUid: string, ownerUid: string, itemId: string, raw: Record<string, unknown>, now = new Date()): Promise<InventoryDoc> {
  await guard(db, actorUid, ownerUid, now);
  const item = (await db.doc(`storeItems/${itemId}`).get()).data();
  if (!item || item.ownerUid !== ownerUid) throw new InventoryError(404, "Item not found.");
  const ref = db.doc(`inventory/${itemId}`);
  const cur = inventoryDocOf((await ref.get()).data(), ownerUid);
  const next: InventoryDoc = {
    ownerUid,
    sku: raw.sku === undefined ? cur.sku : cleanSku(raw.sku),
    variantSku: raw.variantSku === undefined ? cur.variantSku : inventoryDocOf({ variantSku: raw.variantSku }, ownerUid).variantSku,
    costKobo: raw.costKobo === undefined ? cur.costKobo : cleanCostKobo(raw.costKobo),
    lowAt: raw.lowAt === undefined ? cur.lowAt : cleanLowAt(raw.lowAt),
  };
  await ref.set({ ...next, updatedAt: now.toISOString() });
  return next;
}

// A stock change by hand: add (a restock, or a negative number for damage) or set the count, with a reason; recorded in the history.
export async function adjustStock(
  db: Firestore, actorUid: string, ownerUid: string, itemId: string,
  raw: { variant?: unknown; mode?: unknown; amount?: unknown; reason?: unknown; note?: unknown }, now = new Date(),
): Promise<{ stock: number; move: Move }> {
  await guard(db, actorUid, ownerUid, now);
  const mode = raw.mode === "set" ? "set" : "add";
  const amount = Math.trunc(Number(raw.amount));
  if (!Number.isFinite(amount) || Math.abs(amount) > 1_000_000 || (mode === "set" && amount < 0)) throw new InventoryError(400, "Enter a whole number.");
  const reason: MoveReason = isManualReason(raw.reason) ? raw.reason : mode === "set" ? "count" : amount >= 0 ? "restock" : "damaged";
  const note = String(raw.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const r = await changeStock(db, ownerUid, itemId, typeof raw.variant === "string" ? raw.variant : undefined, (cur) => (mode === "set" ? amount : cur + amount), { reason, note, by: actorUid, at: now.toISOString() });
  return r;
}

// The one place stock is changed for inventory: in a transaction, never below 0, the item's total kept in step with its options, and a
// history line written. Returns the new count.
async function changeStock(
  db: Firestore, ownerUid: string, itemId: string, variant: string | undefined, to: (cur: number) => number,
  meta: { reason: MoveReason; note?: string; by: string; at: string; orderRef?: string },
): Promise<{ stock: number; move: Move }> {
  const ref = db.doc(`storeItems/${itemId}`);
  const moveRef = db.collection("inventoryMoves").doc();
  const res = await db.runTransaction(async (t) => {
    const item = (await t.get(ref)).data();
    if (!item || item.ownerUid !== ownerUid || item.kind === "digital") throw new InventoryError(404, "Item not found.");
    const vs = item.variantStock && typeof item.variantStock === "object" ? (item.variantStock as Record<string, number>) : null;
    const hasOptions = !!vs && Object.keys(vs).length > 0;
    if (hasOptions && (!variant || !(variant in vs!))) throw new InventoryError(400, "Choose which option.");
    const before = hasOptions ? Number(vs![variant!]) || 0 : Number.isInteger(item.stock) ? Number(item.stock) : 0;
    const after = Math.max(0, Math.min(1_000_000, Math.trunc(to(before))));
    if (hasOptions) {
      const next = { ...vs!, [variant!]: after };
      t.update(ref, { variantStock: next, stock: Object.values(next).reduce((n, v) => n + (Number(v) > 0 ? Number(v) : 0), 0) });
    } else t.update(ref, { stock: after });
    const move: Move = { ownerUid, itemId, ...(hasOptions ? { variant } : {}), delta: after - before, after, reason: meta.reason, ...(meta.note ? { note: meta.note } : {}), by: meta.by, at: meta.at, ...(meta.orderRef ? { orderRef: meta.orderRef } : {}) };
    t.set(moveRef, move);
    return { stock: after, move: { ...move, id: moveRef.id }, title: String(item.title ?? ""), before };
  });
  // Back from sold out: everyone who asked to be told (stockWatches) hears about it.
  if (res.before <= 0 && res.stock > 0) await notifyBackInStock(itemId).catch(() => {});
  return { stock: res.stock, move: res.move };
}

// A spreadsheet import, already checked by planImport: details, then stock (as a count correction), item by item.
export async function applyImport(db: Firestore, actorUid: string, ownerUid: string, changes: ImportChange[], now = new Date()): Promise<number> {
  await guard(db, actorUid, ownerUid, now);
  let n = 0;
  for (const c of changes.slice(0, 2000)) {
    const details: Record<string, unknown> = {};
    if (c.lowAt !== undefined) details.lowAt = c.lowAt;
    if (c.costKobo !== undefined) details.costKobo = c.costKobo;
    if (c.sku !== undefined) {
      if (c.variant) {
        const cur = inventoryDocOf((await db.doc(`inventory/${c.itemId}`).get()).data(), ownerUid);
        details.variantSku = { ...cur.variantSku, [c.variant]: c.sku };
      } else details.sku = c.sku;
    }
    if (Object.keys(details).length) await saveDetails(db, actorUid, ownerUid, c.itemId, details, now);
    if (c.stock !== undefined) await changeStock(db, ownerUid, c.itemId, c.variant, () => c.stock!, { reason: "count", note: "Spreadsheet import", by: actorUid, at: now.toISOString() });
    n++;
  }
  return n;
}

// The history: the latest moves for the store or one item (newest first).
export async function historyOf(db: Firestore, actorUid: string, ownerUid: string, itemId?: string, now = new Date()): Promise<Move[]> {
  await guard(db, actorUid, ownerUid, now);
  let q = db.collection("inventoryMoves").where("ownerUid", "==", ownerUid);
  if (itemId) q = q.where("itemId", "==", itemId);
  let docs;
  try {
    docs = (await q.orderBy("at", "desc").limit(200).get()).docs;
  } catch (e) {
    // The composite index isn't built yet (code 9): read them all and sort here.
    if ((e as { code?: number }).code !== 9) throw e;
    docs = (await q.get()).docs.sort((a, b) => String(b.data().at).localeCompare(String(a.data().at))).slice(0, 200);
  }
  return docs.map((d) => ({ id: d.id, ...(d.data() as Move) }));
}

// ---- Called by orders ----
// A paid store order (inside fulfillPayment's transaction): the stock was taken when checkout started; this records it in the history.
export function recordSale(t: Transaction, db: Firestore, m: { ownerUid: string; itemId: string; variant?: string; quantity: number; after: number; buyerUid: string; orderRef: string; at: string }) {
  const move: Move = { ownerUid: m.ownerUid, itemId: m.itemId, ...(m.variant ? { variant: m.variant } : {}), delta: -m.quantity, after: m.after, reason: "sale", by: m.buyerUid, at: m.at, orderRef: m.orderRef };
  t.set(db.collection("inventoryMoves").doc(), move);
}
// A refunded order put back on the shelf (lib/orders-server.ts returnStock): recorded in the history.
export async function recordReturn(db: Firestore, m: { ownerUid: string; itemId: string; variant?: string; quantity: number; by: string; orderRef?: string }) {
  const item = (await db.doc(`storeItems/${m.itemId}`).get()).data();
  const after = m.variant && item?.variantStock ? Number(item.variantStock[m.variant]) || 0 : Number(item?.stock) || 0;
  await db.collection("inventoryMoves").add({ ownerUid: m.ownerUid, itemId: m.itemId, ...(m.variant ? { variant: m.variant } : {}), delta: m.quantity, after, reason: "return", by: m.by, at: new Date().toISOString(), ...(m.orderRef ? { orderRef: m.orderRef } : {}) });
}
// After a sale: tell the seller when the item (or option) reaches its low-stock level, or runs out, if they have inventory.
export async function lowStockAlert(db: Firestore, m: { ownerUid: string; itemId: string; variant?: string; quantity: number }) {
  const p = await ownerOf(db, m.ownerUid);
  if (!p || !accessFor(p).ok) return false;
  const [item, inv] = await Promise.all([db.doc(`storeItems/${m.itemId}`).get(), db.doc(`inventory/${m.itemId}`).get()]);
  const it = item.data();
  if (!it) return false;
  const after = m.variant && it.variantStock ? Number(it.variantStock[m.variant]) || 0 : Number(it.stock) || 0;
  const lowAt = inventoryDocOf(inv.data(), m.ownerUid).lowAt;
  if (!crossedLow(after + m.quantity, after, lowAt)) return false;
  const what = `${it.title}${m.variant ? ` (${m.variant.replace(/\|/g, ", ")})` : ""}`;
  await notifyBell({ uid: m.ownerUid, type: "stock", linkHref: "/profile/inventory", message: after <= 0 ? `${what} has sold out. Restock it in Inventory.` : `${what} is running low: ${after} left.` });
  return true;
}
