import { randomBytes } from "crypto";
import type { DocumentSnapshot, Firestore, Query } from "firebase-admin/firestore";
import { effectiveTier } from "./effective-tier";
import { booksCaps } from "./pricing";
import { ROOT_DOMAIN, SITE_URL } from "./host";
import { makeTicketCode } from "./tickets";
import { notifyBell, sendEmail } from "./email";
import { getUserEmail } from "./firebase-admin";
import { accessFor as inventoryAccessFor, bookStockMove, lowStockAlert } from "./inventory-server";
import { cleanSku, inventoryDocOf, stockLines, stockState, type InventoryAccount } from "./inventory";
import {
  BOOKS_UNDO_HOURS, DEFAULT_CATEGORIES, MAX_LINES, MAX_RECEIPT_PHOTOS, RECEIPT_PHOTO_MAX_BYTES, RECEIPT_PHOTO_TYPES, SALE_METHODS,
  booksAccess, canAddDebtor, capState, cashInHand, categoryLabel, changePct, cleanCategory, cleanKobo, cleanName, cleanQty, cleanText,
  debtors, firstName, isDay, isMethod, lagosDay, linesCost, linesTotal, naira, openKobo, periodOf, pnl, receiptText, reminderText, settleFifo, usageFor,
  waLink, waPhone, whatOf, type BooksAccess, type Caps, type Entry, type Line, type Method, type Party, type PeriodKind, type Usage,
} from "./books";
import {
  FIELDS, categoryFrom, cleanMapping, csvOf, customerKey, dedupe, expenseKey, guessMapping, missingRequired, presetOf, readRows, readSheet, refKey, saleKey,
  sourceOf, type BankRow, type ImportKind, type Mapping, type Problem, type SaleRow, type Sheet,
} from "./books-import";

// Business books on the server (docs/BUSINESS-BOOKS.md; the rules are lib/books.ts and lib/books-import.ts). Everything here is
// server-only in firestore.rules: the page talks to /api/books, which checks who is acting on every call.
//
//   bookEntries/{id}    sales, refunds, expenses, payments from customers, opening balances (lib/books.ts Entry)
//   bookParties/{id}    customers and suppliers, with what they owe (balanceKobo, written only here, with the entry)
//   bookItems/{id}      Books-only items (from a stock list import): a private price list with stock, never in the online store
//   bookReceipts/{code} what a receipt link shows: the shop, the lines, the total, how it was paid, what's still owed. No phone numbers.
//   bookReminders/{id}  each reminder or receipt sent: the customer, the channel (email, bell, whatsapp_link) and when
//   bookImports/{id}    each import, with what it changed, so it can be undone for 24 hours
//   bookSettings/{uid}  the seller's settings and this month's count of entries toward Free Basic's cap. Not on users/{uid}, which is public.
export class BooksError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }

type Profile = { uid?: string; username?: string; displayName?: string; avatar?: string; role?: string; accountTier?: string; suspended?: boolean; inventoryAccount?: InventoryAccount };
export type Settings = { floatKobo?: number; categories?: { id: string; label: string }[]; usage?: Usage; onlineSyncedAt?: string; mappings?: Record<string, Mapping> };
export type Ctx = { db: Firestore; actor: string; owner: string; profile: Profile; tier: string; caps: Caps; access: Extract<BooksAccess, { ok: true }>; inventory: boolean; settings: Settings; now: Date; today: string };

const iso = (d: Date) => d.toISOString();
const newCode = () => makeTicketCode((n) => randomBytes(n));
export const receiptUrl = (code: string) => `${SITE_URL}/receipt/${code}`;
export const statementUrl = (code: string) => `${SITE_URL}/statement/${code}`;
const shopName = (p: Profile) => p.displayName || (p.username ? `@${p.username}` : "My shop");
const entryOf = (d: DocumentSnapshot): Entry => ({ ...(d.data() as Omit<Entry, "id">), id: d.id });
const partyOf = (d: DocumentSnapshot): Party => ({ ...(d.data() as Omit<Party, "id">), id: d.id });

// ---- Who may use a seller's books: the seller, and an organisation's admins (while the organisation is on a team plan) ----
export async function canUseBooks(db: Firestore, actor: string, owner: string): Promise<boolean> {
  if (!actor || !owner) return false;
  if (actor === owner) return true;
  const m = (await db.doc(`orgMembers/${owner}_${actor}`).get()).data();
  if (!m || m.role !== "admin") return false;
  const org = (await db.doc(`users/${owner}`).get()).data();
  return !!org && org.suspended !== true && ["business", "enterprise"].includes(org.accountTier);
}
// The organisations whose books this person may keep (for the account switcher), besides their own.
export async function booksAccounts(db: Firestore, uid: string): Promise<{ uid: string; name: string }[]> {
  const memberOf = await db.collection("orgMembers").where("memberUid", "==", uid).get().catch(() => null);
  const orgs = (memberOf?.docs ?? []).map((d) => d.data()).filter((m) => m.role === "admin").map((m) => String(m.orgUid));
  const names = orgs.length ? await db.getAll(...orgs.map((u) => db.doc(`users/${u}`))) : [];
  return [{ uid, name: "My books" }, ...names.filter((d) => d.exists && ["business", "enterprise"].includes(d.data()?.accountTier)).map((d) => ({ uid: d.id, name: String(d.data()?.displayName ?? d.id) }))];
}

export async function context(db: Firestore, actor: string, owner: string, now = new Date()): Promise<Ctx> {
  if (!(await canUseBooks(db, actor, owner))) throw new BooksError(403, "You can't see these books.");
  const [p, s] = await Promise.all([db.doc(`users/${owner}`).get(), db.doc(`bookSettings/${owner}`).get()]);
  const profile = p.data() as Profile | undefined;
  if (!profile) throw new BooksError(404, "Account not found.");
  const tier = effectiveTier({ username: profile.username ?? "", role: (profile.role ?? "reader") as "reader", accountTier: (profile.accountTier ?? "standard") as "standard" });
  const caps = booksCaps();
  const access = booksAccess(tier, caps, profile.suspended === true);
  if (!access.ok) throw new BooksError(402, access.reason);
  const inventory = inventoryAccessFor(profile as Parameters<typeof inventoryAccessFor>[0], now).ok;
  return { db, actor, owner, profile, tier, caps, access, inventory, settings: (s.data() as Settings) ?? {}, now, today: lagosDay(now) };
}
const categoriesOf = (c: Ctx) => [...DEFAULT_CATEGORIES, ...(c.settings.categories ?? [])];

// Entries between two Lagos days. Needs the (ownerUid, on) index; until it's built (code 9), read the seller's entries and filter here.
async function entriesBetween(db: Firestore, owner: string, start: string, end: string): Promise<Entry[]> {
  const base = db.collection("bookEntries").where("ownerUid", "==", owner);
  try {
    return (await base.where("on", ">=", start).where("on", "<=", end).get()).docs.map(entryOf);
  } catch (e) {
    if ((e as { code?: number }).code !== 9) throw e;
    return (await base.get()).docs.map(entryOf).filter((x) => x.on >= start && x.on <= end);
  }
}
const sortNewest = (es: Entry[]) => es.sort((a, b) => b.at.localeCompare(a.at));

// ---- What can be sold: the store's physical items (and their options) and Books-only items ----
export type CatalogItem = { ref: string; itemId?: string; variant?: string; bookItemId?: string; title: string; sku: string; priceKobo: number; costKobo: number; stock: number | null; lowAt: number; image?: string; unit?: string };
export async function catalog(c: Pick<Ctx, "db" | "owner" | "inventory">): Promise<CatalogItem[]> {
  const { db, owner } = c;
  const [itemsSnap, bookSnap] = await Promise.all([db.collection("storeItems").where("ownerUid", "==", owner).get(), db.collection("bookItems").where("ownerUid", "==", owner).get()]);
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as { title: string; stock?: number; variantStock?: Record<string, number>; priceKobo?: number; image?: string; sellable?: boolean; kind?: string }) }))
    .filter((i) => i.sellable === true && i.kind !== "digital");
  const invSnaps = items.length ? await db.getAll(...items.map((i) => db.doc(`inventory/${i.id}`))) : [];
  const inv = Object.fromEntries(invSnaps.filter((s) => s.exists && s.data()?.ownerUid === owner).map((s) => [s.id, inventoryDocOf(s.data(), owner)]));
  const images = Object.fromEntries(items.map((i) => [i.id, i.image ?? ""]));
  const out: CatalogItem[] = stockLines(items, inv).map((l) => ({
    ref: `i:${l.itemId}:${l.variant ?? ""}`, itemId: l.itemId, ...(l.variant ? { variant: l.variant } : {}),
    title: l.variant ? `${l.title} (${l.variant.replace(/\|/g, ", ")})` : l.title, sku: l.sku, priceKobo: l.priceKobo, costKobo: l.costKobo,
    stock: c.inventory ? l.stock : null, lowAt: l.lowAt, image: images[l.itemId] || undefined,
  }));
  for (const d of bookSnap.docs) {
    const b = d.data();
    out.push({ ref: `b:${d.id}`, bookItemId: d.id, title: String(b.name), sku: String(b.sku ?? ""), priceKobo: Number(b.priceKobo) || 0, costKobo: Number(b.costKobo) || 0, stock: c.inventory && Number.isInteger(b.stock) ? Number(b.stock) : null, lowAt: Number.isInteger(b.lowAt) ? Number(b.lowAt) : 3, unit: b.unit || undefined });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

// ---- Customers and suppliers ----
async function findMember(db: Firestore, username: string): Promise<{ uid: string; username: string } | null> {
  const u = username.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_.-]{2,40}$/.test(u)) return null;
  const s = await db.collection("users").where("username", "==", u).limit(1).get();
  return s.empty ? null : { uid: s.docs[0].id, username: u };
}
export async function saveParty(c: Ctx, raw: Record<string, unknown>): Promise<Party> {
  const { db, owner } = c;
  const kind = raw.kind === "supplier" ? "supplier" : "customer";
  const name = cleanName(raw.name);
  if (!name) throw new BooksError(400, "Enter a name.");
  const phoneRaw = cleanText(raw.phone, 30);
  const phone = phoneRaw ? waPhone(phoneRaw) : "";
  if (phoneRaw && !phone) throw new BooksError(400, "That phone number doesn't look right (for example 0803 123 4567).");
  const member = raw.username ? await findMember(db, String(raw.username)) : null;
  if (raw.username && String(raw.username).trim() && !member) throw new BooksError(400, "No #NotesApp member has that username.");
  const id = typeof raw.id === "string" && raw.id ? raw.id : "";
  const fields: Record<string, unknown> = { name, phone: phone || "", ...(member ? { memberUid: member.uid, memberUsername: member.username } : { memberUid: "", memberUsername: "" }) };
  if (kind === "supplier") {
    const bal = raw.balanceKobo === undefined ? undefined : cleanKobo(raw.balanceKobo);
    if (bal === null) throw new BooksError(400, "Enter what you owe in naira.");
    if (bal !== undefined) fields.balanceKobo = bal;
    if (raw.dueOn !== undefined) { if (raw.dueOn && !isDay(raw.dueOn)) throw new BooksError(400, "Choose a due date."); fields.dueOn = raw.dueOn || ""; }
    if (raw.note !== undefined) fields.note = cleanText(raw.note, 200);
  }
  if (id) {
    const ref = db.doc(`bookParties/${id}`);
    const cur = await ref.get();
    if (!cur.exists || cur.data()?.ownerUid !== owner) throw new BooksError(404, "Not found.");
    await ref.update(fields);
    return partyOf(await ref.get());
  }
  // The same customer added again (same number, or the same name with no number) is the one already in the books.
  const same = (await db.collection("bookParties").where("ownerUid", "==", owner).where("kind", "==", kind).get()).docs.map(partyOf)
    .find((x) => (phone && x.phone === phone) || (!phone && x.name.trim().toLowerCase() === name.toLowerCase()));
  if (same) {
    const add: Record<string, unknown> = {};
    if (member && !same.memberUid) { add.memberUid = member.uid; add.memberUsername = member.username; }
    if (Object.keys(add).length) await db.doc(`bookParties/${same.id}`).update(add);
    return { ...same, ...add };
  }
  const ref = db.collection("bookParties").doc();
  const doc = { ownerUid: owner, kind, balanceKobo: 0, statementCode: kind === "customer" ? newCode() : "", createdAt: iso(c.now), ...fields };
  await ref.set(doc);
  return { ...(doc as Omit<Party, "id">), id: ref.id };
}
// A supplier paid (all or part): what you owe them goes down.
export async function supplierPaid(c: Ctx, partyId: string, amountKobo: unknown): Promise<Party> {
  const ref = c.db.doc(`bookParties/${partyId}`);
  const k = cleanKobo(amountKobo);
  if (!k) throw new BooksError(400, "Enter the amount you paid.");
  await c.db.runTransaction(async (t) => {
    const p = (await t.get(ref)).data();
    if (!p || p.ownerUid !== c.owner || p.kind !== "supplier") throw new BooksError(404, "Supplier not found.");
    const left = Math.max(0, (Number(p.balanceKobo) || 0) - k);
    t.update(ref, { balanceKobo: left, ...(left === 0 ? { dueOn: "" } : {}), lastPaidAt: iso(c.now) });
  });
  return partyOf(await ref.get());
}

// ---- Record a sale ----
export type SaleInput = { clientId?: unknown; lines?: unknown; method?: unknown; owes?: unknown; paidKobo?: unknown; partyId?: unknown; party?: unknown; dueOn?: unknown; note?: unknown };
const cleanClientId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : "");

export async function recordSale(c: Ctx, raw: SaleInput): Promise<{ entry: Entry; receiptUrl: string; duplicate?: boolean }> {
  const { db, owner } = c;
  const rawLines = Array.isArray(raw.lines) ? raw.lines.slice(0, MAX_LINES + 1) : [];
  if (!rawLines.length) throw new BooksError(400, "Add at least one item.");
  if (rawLines.length > MAX_LINES) throw new BooksError(400, `A sale can have up to ${MAX_LINES} lines.`);
  const cat = rawLines.some((l) => (l as { ref?: unknown })?.ref) ? await catalog(c) : [];
  const lines: Line[] = rawLines.map((r, n) => {
    const l = (r ?? {}) as Record<string, unknown>;
    const qty = cleanQty(l.qty);
    if (qty === null) throw new BooksError(400, `Line ${n + 1}: the quantity is a whole number, 1 or more.`);
    const unitKobo = cleanKobo(l.unitKobo);
    if (unitKobo === null) throw new BooksError(400, `Line ${n + 1}: enter the price in naira.`);
    if (l.ref) {
      const it = cat.find((x) => x.ref === l.ref);
      if (!it) throw new BooksError(400, `Line ${n + 1}: that item isn't in your store any more.`);
      return { ...(it.itemId ? { itemId: it.itemId } : {}), ...(it.variant ? { variant: it.variant } : {}), ...(it.bookItemId ? { bookItemId: it.bookItemId } : {}), title: it.title, qty, unitKobo, costKobo: it.costKobo, ...(it.costKobo ? {} : { noCost: true }) };
    }
    const title = cleanText(l.title, 120);
    if (!title) throw new BooksError(400, `Line ${n + 1}: say what was sold.`);
    const cost = l.costKobo === undefined || l.costKobo === "" ? 0 : cleanKobo(l.costKobo);
    if (cost === null) throw new BooksError(400, `Line ${n + 1}: the cost should be an amount in naira.`);
    return { title, qty, unitKobo, costKobo: cost };
  });
  const totalKobo = linesTotal(lines);
  if (totalKobo <= 0) throw new BooksError(400, "The sale comes to ₦0. Check the prices.");
  if (!isMethod(raw.method, SALE_METHODS)) throw new BooksError(400, "Choose how they paid: cash, transfer or POS.");
  const method = raw.method as Method;
  const owes = raw.owes === true;
  const paidKobo = owes ? cleanKobo(raw.paidKobo ?? 0) : totalKobo;
  if (paidKobo === null || paidKobo > totalKobo) throw new BooksError(400, "What they paid now can't be more than the total.");
  const owesKobo = totalKobo - paidKobo;
  if (owes && owesKobo === 0) throw new BooksError(400, "They've paid it all, so nobody owes anything. Turn off Customer owes.");
  const dueOn = owesKobo > 0 && raw.dueOn ? String(raw.dueOn) : "";
  if (dueOn && !isDay(dueOn)) throw new BooksError(400, "Choose a due date.");
  if (dueOn && dueOn < c.today) throw new BooksError(400, "The due date has already passed.");

  // Who owes: a customer already in the books, or a new one.
  let party: Party | null = null;
  if (owesKobo > 0) {
    if (typeof raw.partyId === "string" && raw.partyId) {
      const s = await db.doc(`bookParties/${raw.partyId}`).get();
      if (!s.exists || s.data()?.ownerUid !== owner || s.data()?.kind !== "customer") throw new BooksError(404, "Customer not found.");
      party = partyOf(s);
    } else if (raw.party && typeof raw.party === "object") {
      const pr = raw.party as Record<string, unknown>;
      if (!cleanName(pr.name)) throw new BooksError(400, "Who owes? Enter the customer's name.");
    } else throw new BooksError(400, "Who owes? Choose or add the customer.");
    const owing = (await db.collection("bookParties").where("ownerUid", "==", owner).where("kind", "==", "customer").get()).docs.filter((d) => (Number(d.data().balanceKobo) || 0) > 0);
    const already = !!party && (party.balanceKobo || 0) > 0;
    if (!canAddDebtor(c.access, c.caps, owing.length, already)) throw new BooksError(402, `Free Basic keeps up to ${c.caps.freeCustomers} customers owing at once. Record a payment from one, or move to Pro for no limit.`, "customers_cap");
    if (!party) party = await saveParty(c, { ...(raw.party as Record<string, unknown>), kind: "customer" });
  }

  const clientId = cleanClientId(raw.clientId);
  const ref = clientId ? db.doc(`bookEntries/${owner}_${clientId}`) : db.collection("bookEntries").doc();
  const setRef = db.doc(`bookSettings/${owner}`);
  const month = c.today.slice(0, 7);
  const bookItemRefs = c.inventory ? [...new Set(lines.filter((l) => l.bookItemId).map((l) => l.bookItemId!))].map((id) => db.doc(`bookItems/${id}`)) : [];
  const code = newCode();
  const res = await db.runTransaction(async (t) => {
    const existing = await t.get(ref);
    if (existing.exists) return { entry: entryOf(existing), duplicate: true, lows: [] as string[] };
    const st = (await t.get(setRef)).data() as Settings | undefined;
    const used = usageFor(st?.usage, month);
    const cap = capState(c.access, c.caps, used);
    if (cap.full) throw new BooksError(402, `Free Basic records ${c.caps.freeEntries} sales and expenses a month, and this month's are used. Online orders still come in. Move to Pro for no limit, or carry on on the 1st.`, "entries_cap");
    const partyRef = party ? db.doc(`bookParties/${party.id}`) : null;
    const pSnap = partyRef ? await t.get(partyRef) : null;
    const bSnaps = bookItemRefs.length ? await t.getAll(...bookItemRefs) : [];
    const entry: Omit<Entry, "id"> = {
      ownerUid: owner, kind: "sale", source: "walkin", on: c.today, at: iso(c.now), by: c.actor, lines, totalKobo, paidKobo, method,
      owesKobo, settledKobo: 0, open: owesKobo > 0, ...(party ? { partyId: party.id, partyName: party.name } : {}), ...(dueOn ? { dueOn } : {}),
      ...(raw.note ? { note: cleanText(raw.note, 200) } : {}), ...(clientId ? { clientId } : {}), receiptCode: code, counts: true, files: [],
    };
    t.set(ref, entry);
    t.set(db.doc(`bookReceipts/${code}`), receiptDoc(c, ref.id, entry, party));
    t.set(setRef, { usage: { month, entries: used + 1 } }, { merge: true });
    if (partyRef && pSnap) t.update(partyRef, { balanceKobo: (Number(pSnap.data()?.balanceKobo) || 0) + owesKobo });
    // Books-only items: stock down (never below 0; the sale is never refused for stock).
    const lows: string[] = [];
    for (const s of bSnaps) {
      const b = s.data();
      if (!b || b.ownerUid !== owner || !Number.isInteger(b.stock)) continue;
      const qty = lines.filter((l) => l.bookItemId === s.id).reduce((n, l) => n + l.qty, 0);
      const after = Math.max(0, b.stock - qty);
      t.update(s.ref, { stock: after });
      const lowAt = Number.isInteger(b.lowAt) ? b.lowAt : 3;
      if (after < b.stock && ((b.stock > lowAt && after <= lowAt) || (b.stock > 0 && after <= 0))) lows.push(after <= 0 ? `${b.name} has sold out.` : `${b.name} is running low: ${after} left.`);
    }
    return { entry: { ...entry, id: ref.id }, duplicate: false, lows };
  });
  if (res.duplicate) return { entry: res.entry, receiptUrl: receiptUrl(res.entry.receiptCode ?? ""), duplicate: true };
  // Store items: stock down through Inventory (reason sale, with this entry's reference), and its low-stock alert.
  if (c.inventory) {
    for (const l of lines.filter((x) => x.itemId)) {
      await bookStockMove(db, { ownerUid: owner, itemId: l.itemId!, variant: l.variant, delta: -l.qty, reason: "sale", note: "Walk-in sale (Business books)", by: c.actor, bookRef: ref.id }).catch((e) => console.error("books stock move failed", ref.id, e));
      await lowStockAlert(db, { ownerUid: owner, itemId: l.itemId!, variant: l.variant, quantity: l.qty }).catch(() => false);
    }
    for (const m of res.lows) await notifyBell({ uid: owner, type: "stock", linkHref: "/profile/books?tab=stock", message: m }).catch(() => {});
  }
  return { entry: res.entry, receiptUrl: receiptUrl(code) };
}

function receiptDoc(c: Ctx, entryId: string, e: Omit<Entry, "id">, party: Party | null) {
  return {
    ownerUid: c.owner, entryId, shopName: shopName(c.profile), shopUsername: c.profile.username ?? "", shopLogo: c.profile.avatar ?? "",
    lines: e.lines.map((l) => ({ title: l.title, qty: l.qty, unitKobo: l.unitKobo })), totalKobo: e.totalKobo, paidKobo: e.paidKobo, owesKobo: e.owesKobo,
    method: e.method, on: e.on, at: e.at, customer: party ? firstName(party.name) : "", ...(e.dueOn ? { dueOn: e.dueOn } : {}), voided: false,
  };
}

// ---- Expenses ----
export async function recordExpense(c: Ctx, raw: Record<string, unknown>): Promise<Entry> {
  const { db, owner } = c;
  const amount = cleanKobo(raw.amountKobo);
  if (!amount) throw new BooksError(400, "Enter the amount.");
  if (!isMethod(raw.method)) throw new BooksError(400, "Choose how you paid: cash, transfer, POS or card.");
  const on = raw.on ? String(raw.on) : c.today;
  if (!isDay(on) || on > c.today) throw new BooksError(400, "Choose the day you paid (today or before).");
  const cats = categoriesOf(c);
  let category = cleanCategory(raw.category);
  const known = cats.find((x) => x.id === category || x.label.toLowerCase() === String(raw.category ?? "").trim().toLowerCase());
  const newCat = !known && cleanText(raw.category, 40) ? { id: category, label: cleanText(raw.category, 40) } : null;
  if (known) category = known.id;
  const clientId = cleanClientId(raw.clientId);
  const ref = clientId ? db.doc(`bookEntries/${owner}_${clientId}`) : db.collection("bookEntries").doc();
  const setRef = db.doc(`bookSettings/${owner}`);
  const month = c.today.slice(0, 7);
  return db.runTransaction(async (t) => {
    const existing = await t.get(ref);
    if (existing.exists) return entryOf(existing);
    const st = (await t.get(setRef)).data() as Settings | undefined;
    const used = usageFor(st?.usage, month);
    if (capState(c.access, c.caps, used).full) throw new BooksError(402, `Free Basic records ${c.caps.freeEntries} sales and expenses a month, and this month's are used. Move to Pro for no limit, or carry on on the 1st.`, "entries_cap");
    const entry: Omit<Entry, "id"> = {
      ownerUid: owner, kind: "expense", source: "walkin", on, at: on === c.today ? iso(c.now) : `${on}T12:00:00.000Z`, by: c.actor, lines: [], totalKobo: amount,
      paidKobo: amount, method: raw.method as Method, owesKobo: 0, settledKobo: 0, open: false, category, ...(raw.note ? { note: cleanText(raw.note, 200) } : {}),
      files: [], counts: true, ...(clientId ? { clientId } : {}),
    };
    t.set(ref, entry);
    t.set(setRef, { usage: { month, entries: used + 1 }, ...(newCat ? { categories: [...(st?.categories ?? []), newCat].slice(-40) } : {}) }, { merge: true });
    return { ...entry, id: ref.id };
  });
}

// ---- A customer pays what they owe (all or part): oldest sales first ----
export async function recordPayment(c: Ctx, raw: Record<string, unknown>): Promise<Entry> {
  const { db, owner } = c;
  const partyRef = db.doc(`bookParties/${String(raw.partyId ?? "")}`);
  const amount = cleanKobo(raw.amountKobo);
  if (!amount) throw new BooksError(400, "Enter how much they paid.");
  if (!isMethod(raw.method, SALE_METHODS)) throw new BooksError(400, "Choose how they paid: cash, transfer or POS.");
  const clientId = cleanClientId(raw.clientId);
  const ref = clientId ? db.doc(`bookEntries/${owner}_${clientId}`) : db.collection("bookEntries").doc();
  return db.runTransaction(async (t) => {
    const existing = await t.get(ref);
    if (existing.exists) return entryOf(existing);
    const ps = await t.get(partyRef);
    if (!ps.exists || ps.data()?.ownerUid !== owner || ps.data()?.kind !== "customer") throw new BooksError(404, "Customer not found.");
    const open = (await t.get(db.collection("bookEntries").where("ownerUid", "==", owner).where("partyId", "==", partyRef.id).where("open", "==", true))).docs.map(entryOf).filter((e) => openKobo(e) > 0);
    const owed = open.reduce((n, e) => n + openKobo(e), 0);
    if (amount > owed) throw new BooksError(400, `${ps.data()?.name} owes ${naira(owed)}. Enter that or less.`);
    const { applied } = settleFifo(open.map((e) => ({ id: e.id, at: e.at, openKobo: openKobo(e) })), amount);
    const receipts = open.filter((e) => e.receiptCode && applied.some((a) => a.id === e.id));
    const rSnaps = receipts.length ? await t.getAll(...receipts.map((e) => db.doc(`bookReceipts/${e.receiptCode}`))) : [];
    for (const a of applied) {
      const e = open.find((x) => x.id === a.id)!;
      const settled = (e.settledKobo || 0) + a.kobo;
      t.update(db.doc(`bookEntries/${e.id}`), { settledKobo: settled, open: settled < e.owesKobo });
      const r = rSnaps.find((s) => s.id === e.receiptCode);
      if (r?.exists) t.update(r.ref, { owesKobo: e.owesKobo - settled, paidKobo: e.paidKobo + settled });
    }
    t.update(partyRef, { balanceKobo: Math.max(0, (Number(ps.data()?.balanceKobo) || 0) - amount), lastPaidAt: iso(c.now) });
    const entry: Omit<Entry, "id"> & { applied: { id: string; kobo: number }[] } = {
      ownerUid: owner, kind: "payment", source: "walkin", on: c.today, at: iso(c.now), by: c.actor, lines: [], totalKobo: amount, paidKobo: amount,
      method: raw.method as Method, owesKobo: 0, settledKobo: 0, open: false, partyId: partyRef.id, partyName: String(ps.data()?.name ?? ""), applied, files: [], counts: false,
      ...(clientId ? { clientId } : {}),
    };
    t.set(ref, entry);
    return { ...entry, id: ref.id };
  });
}

// ---- Void (walk-in entries only; online orders follow the order) ----
export async function voidEntry(c: Ctx, id: string, reason: unknown): Promise<Entry> {
  const { db, owner } = c;
  const why = cleanText(reason, 200);
  if (!why) throw new BooksError(400, "Say why (for example: entered twice).");
  const ref = db.doc(`bookEntries/${id}`);
  const before = await ref.get();
  const e0 = before.exists ? entryOf(before) : null;
  if (!e0 || e0.ownerUid !== owner) throw new BooksError(404, "Entry not found.");
  if (e0.source === "online") throw new BooksError(400, "Online orders follow the order: refund it from Orders.");
  if (e0.voidedAt) return e0;
  const e = await db.runTransaction(async (t) => {
    const e = entryOf(await t.get(ref));
    if (e.voidedAt) return e;
    if (e.kind === "sale" && (e.settledKobo || 0) > 0) throw new BooksError(409, "Part of what was owed on this sale has been paid back, so it can't be voided. Void that payment first.");
    const partyRef = e.partyId ? db.doc(`bookParties/${e.partyId}`) : null;
    const ps = partyRef ? await t.get(partyRef) : null;
    const applied = ((e as Entry & { applied?: { id: string; kobo: number }[] }).applied ?? []);
    const settledSnaps = e.kind === "payment" && applied.length ? await t.getAll(...applied.map((a) => db.doc(`bookEntries/${a.id}`))) : [];
    const bookItemSnaps = e.kind === "sale" && c.inventory ? await Promise.all([...new Set(e.lines.filter((l) => l.bookItemId).map((l) => l.bookItemId!))].map((bid) => t.get(db.doc(`bookItems/${bid}`)))) : [];
    t.update(ref, { voidedAt: iso(c.now), voidedBy: c.actor, voidReason: why, open: false });
    if (e.receiptCode) t.set(db.doc(`bookReceipts/${e.receiptCode}`), { voided: true }, { merge: true });
    if (ps?.exists) {
      const bal = Number(ps.data()?.balanceKobo) || 0;
      if (e.kind === "sale" || e.kind === "opening") t.update(partyRef!, { balanceKobo: Math.max(0, bal - openKobo({ ...e, voidedAt: undefined })) });
      if (e.kind === "payment") t.update(partyRef!, { balanceKobo: bal + e.totalKobo });
    }
    for (const s of settledSnaps) {
      const x = s.data(); const a = applied.find((y) => y.id === s.id)!;
      if (!x) continue;
      const settled = Math.max(0, (x.settledKobo || 0) - a.kobo);
      t.update(s.ref, { settledKobo: settled, open: !x.voidedAt && settled < x.owesKobo });
    }
    for (const s of bookItemSnaps) {
      const b = s.data();
      if (b && Number.isInteger(b.stock)) t.update(s.ref, { stock: b.stock + e.lines.filter((l) => l.bookItemId === s.id).reduce((n, l) => n + l.qty, 0) });
    }
    return { ...e, voidedAt: iso(c.now) };
  });
  // A voided walk-in sale goes back on the shelf.
  if (e.kind === "sale" && e.source === "walkin" && c.inventory) {
    for (const l of e.lines.filter((x) => x.itemId)) await bookStockMove(db, { ownerUid: owner, itemId: l.itemId!, variant: l.variant, delta: l.qty, reason: "return", note: `Walk-in sale voided: ${why}`, by: c.actor, bookRef: id }).catch(() => {});
  }
  return e;
}

// ---- Settings ----
export async function saveSettings(c: Ctx, raw: Record<string, unknown>): Promise<Settings> {
  const out: Settings = {};
  if (raw.floatKobo !== undefined) { const k = cleanKobo(raw.floatKobo); if (k === null) throw new BooksError(400, "Enter the opening float in naira."); out.floatKobo = k; }
  if (Array.isArray(raw.categories)) out.categories = raw.categories.slice(0, 40).map((x) => ({ id: cleanCategory((x as { id?: unknown }).id ?? (x as { label?: unknown }).label), label: cleanText((x as { label?: unknown }).label, 40) })).filter((x) => x.label && !DEFAULT_CATEGORIES.some((d) => d.id === x.id));
  await c.db.doc(`bookSettings/${c.owner}`).set(out, { merge: true });
  return { ...c.settings, ...out };
}

// ---- Online store orders flow in (docs/BUSINESS-BOOKS.md: written from the order's paid and refunded steps, never from the page) ----
// One sale per paid order (bookEntries/online_<reference>) and one refund when it's refunded (online_<reference>_refund), with the lines
// at their cost prices and our commission as an expense line. Creating a document that already exists does nothing, so this is safe
// to call more than once. The stock was already moved by the order, so it isn't moved again.
type OrderDoc = { reference: string; sellerUid: string; itemId: string; itemTitle: string; variantLabel?: string; quantity: number; unitKobo: number; deliveryKobo?: number; amountKobo: number; commissionKobo?: number; carrier?: unknown; status: string; paidAt: string };
export async function bookOnlineOrder(db: Firestore, reference: string, known?: OrderDoc): Promise<number> {
  const o = known ?? ((await db.doc(`storeOrders/${reference}`).get()).data() as OrderDoc | undefined);
  if (!o || !o.sellerUid || !o.paidAt) return 0;
  const inv = o.itemId ? (await db.doc(`inventory/${o.itemId}`).get()).data() : undefined;
  const cost = inv && inv.ownerUid === o.sellerUid ? Number(inv.costKobo) || 0 : 0;
  const totalKobo = o.carrier ? o.amountKobo - (o.deliveryKobo ?? 0) : o.amountKobo;
  const lines: Line[] = [{ ...(o.itemId ? { itemId: o.itemId } : {}), title: `${o.itemTitle}${o.variantLabel ? ` (${o.variantLabel})` : ""}`, qty: o.quantity, unitKobo: o.unitKobo, costKobo: cost, ...(cost ? {} : { noCost: true }) }];
  if (!o.carrier && (o.deliveryKobo ?? 0) > 0) lines.push({ title: "Delivery", qty: 1, unitKobo: o.deliveryKobo!, costKobo: 0 });
  const gap = totalKobo - linesTotal(lines);
  if (gap) lines.push({ title: gap < 0 ? "Discount" : "Other", qty: 1, unitKobo: gap, costKobo: 0 });
  const on = lagosDay(new Date(o.paidAt));
  const base = { ownerUid: o.sellerUid, source: "online" as const, on, at: o.paidAt, by: "order", lines, totalKobo, paidKobo: totalKobo, method: "card" as Method, owesKobo: 0, settledKobo: 0, open: false, partyName: "Online order", orderRef: reference, feeKobo: o.commissionKobo ?? 0, counts: false, files: [] };
  let made = 0;
  const create = async (id: string, doc: Omit<Entry, "id">) => {
    try { await db.doc(`bookEntries/${id}`).create(doc); made++; } catch (e) { if ((e as { code?: number }).code !== 6) throw e; } // 6: already exists
  };
  await create(`online_${reference}`, { ...base, kind: "sale" });
  if (o.status === "refunded") await create(`online_${reference}_refund`, { ...base, kind: "refund" });
  return made;
}
// When Books is opened: bring in paid orders since the last look (all of them the first time, so the first month isn't empty) and any
// refunded since. Covers orders paid before Books existed and any the paid step missed.
export async function syncOnlineOrders(c: Pick<Ctx, "db" | "owner" | "settings" | "now">): Promise<number> {
  const { db, owner } = c;
  const since = c.settings.onlineSyncedAt ? new Date(Date.parse(c.settings.onlineSyncedAt) - 2 * 86_400_000).toISOString() : "";
  const [all, refunded] = await Promise.all([
    db.collection("storeOrders").where("sellerUid", "==", owner).get(),
    db.collection("storeOrders").where("sellerUid", "==", owner).where("status", "==", "refunded").get(),
  ]);
  const want = new Map<string, OrderDoc>();
  for (const d of all.docs) { const o = d.data() as OrderDoc; if (o.paidAt && o.paidAt >= since) want.set(d.id, { ...o, reference: d.id }); }
  for (const d of refunded.docs) want.set(d.id, { ...(d.data() as OrderDoc), reference: d.id });
  if (!want.size) { if (!c.settings.onlineSyncedAt) await db.doc(`bookSettings/${owner}`).set({ onlineSyncedAt: iso(c.now) }, { merge: true }); return 0; }
  const ids = [...want.keys()];
  const have = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const snaps = await db.getAll(...ids.slice(i, i + 200).flatMap((r) => [db.doc(`bookEntries/online_${r}`), db.doc(`bookEntries/online_${r}_refund`)]));
    snaps.filter((s) => s.exists).forEach((s) => have.add(s.id));
  }
  let made = 0;
  for (const [r, o] of want) {
    const needSale = !have.has(`online_${r}`), needRefund = o.status === "refunded" && !have.has(`online_${r}_refund`);
    if (needSale || needRefund) made += await bookOnlineOrder(db, r, o);
  }
  await db.doc(`bookSettings/${owner}`).set({ onlineSyncedAt: iso(c.now) }, { merge: true });
  return made;
}

// ---- Views ----
const runningLow = (cat: CatalogItem[]) => cat.filter((x) => x.stock !== null && stockState(x.stock, x.lowAt) !== "ok").sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)).slice(0, 8).map((x) => ({ ref: x.ref, title: x.title, stock: x.stock, lowAt: x.lowAt }));
const stockValue = (cat: CatalogItem[]) => cat.reduce((n, x) => n + (x.stock ?? 0) * x.costKobo, 0);
async function customers(db: Firestore, owner: string) { return (await db.collection("bookParties").where("ownerUid", "==", owner).get()).docs.map(partyOf); }
async function openEntries(db: Firestore, owner: string) { return (await db.collection("bookEntries").where("ownerUid", "==", owner).where("open", "==", true).get()).docs.map(entryOf).filter((e) => openKobo(e) > 0); }

export async function homeView(ctx: Ctx) {
  let c = ctx;
  const { db, owner, today } = c;
  await syncOnlineOrders(c).catch((e) => console.error("books online sync failed", owner, e));
  c = { ...c, settings: ((await db.doc(`bookSettings/${owner}`).get()).data() as Settings) ?? {} }; // the month's count as it is now
  const week = periodOf("week", today);
  const weekAgo = periodOf("day", today, 7).start;
  const [entries, cat, parties, open] = await Promise.all([entriesBetween(db, owner, weekAgo < week.start ? weekAgo : week.start, today), catalog(c), customers(db, owner), openEntries(db, owner)]);
  const todays = sortNewest(entries.filter((e) => e.on === today));
  const p = pnl(todays, categoriesOf(c)), before = pnl(entries.filter((e) => e.on === weekAgo), categoriesOf(c));
  const weekP = pnl(entries.filter((e) => e.on >= week.start), categoriesOf(c));
  const owed = debtors(parties, open, today);
  const cap = capState(c.access, c.caps, usageFor(c.settings.usage, today.slice(0, 7)));
  return {
    today, shop: { name: shopName(c.profile), username: c.profile.username ?? "", tier: c.tier }, access: c.access, cap, caps: c.caps, inventory: c.inventory,
    pnl: p, change: changePct(p.netKobo, before.netKobo), weekday: today, cash: cashInHand(todays, c.settings.floatKobo ?? 0),
    owed: { totalKobo: owed.reduce((n, d) => n + d.openKobo, 0), overdueKobo: owed.reduce((n, d) => n + d.overdueKobo, 0), people: owed.length },
    entries: todays.slice(0, 60).map(publicEntry), low: runningLow(cat), best: weekP.best.slice(0, 5), noCostItems: weekP.noCostItems,
    youOwe: parties.filter((x) => x.kind === "supplier" && x.balanceKobo > 0).sort((a, b) => (a.dueOn || "9").localeCompare(b.dueOn || "9")).map((x) => ({ id: x.id, name: x.name, balanceKobo: x.balanceKobo, dueOn: x.dueOn })),
    categories: categoriesOf(c), floatKobo: c.settings.floatKobo ?? 0,
  };
}
// What the page gets for an entry: everything but the private file keys.
export const publicEntry = (e: Entry) => ({ ...e, files: (e.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })) });

export async function pnlView(c: Ctx, kind: PeriodKind, back: number) {
  if (kind === "month" && !c.access.monthPnl) throw new BooksError(402, "The month's profit and loss comes with Pro. Free Basic has the day and the week.", "month_pnl");
  const b = Math.max(0, Math.min(36, Math.floor(back) || 0));
  const cur = periodOf(kind, c.today, b), prev = periodOf(kind, c.today, b + 1);
  if (b === 0) await syncOnlineOrders(c).catch(() => 0);
  const [entries, cat, parties, open] = await Promise.all([entriesBetween(c.db, c.owner, prev.start, cur.end), catalog(c), customers(c.db, c.owner), openEntries(c.db, c.owner)]);
  const now = entries.filter((e) => e.on >= cur.start), was = entries.filter((e) => e.on < cur.start);
  const p = pnl(now, categoriesOf(c)), q = pnl(was, categoriesOf(c));
  // Bars: by day for a week, by week (1–5, 6–12, …) for a month. Sales, with the cost of what was sold.
  const bars: { label: string; salesKobo: number; costKobo: number }[] = [];
  if (kind !== "day") {
    let s = cur.start;
    while (s <= cur.end) {
      let e = s;
      if (kind === "month") { while (e < cur.end && new Date(`${e}T00:00:00Z`).getUTCDay() !== 0) e = periodOf("day", e, -1).start; }
      const part = pnl(now.filter((x) => x.on >= s && x.on <= e));
      bars.push({ label: kind === "week" ? new Date(`${s}T00:00:00Z`).toUTCString().slice(0, 3) : `${Number(s.slice(8))}–${Number(e.slice(8))}`, salesKobo: part.salesKobo - part.refundsKobo, costKobo: part.costKobo });
      s = periodOf("day", e, -1).start;
    }
  }
  const owed = debtors(parties, open, c.today);
  return {
    period: cur, kind, back: b, access: c.access, pnl: p, change: changePct(p.netKobo, q.netKobo), previousNetKobo: q.netKobo, bars,
    cash: cashInHand(now, kind === "day" ? c.settings.floatKobo ?? 0 : 0),
    // Counted separately (honest numbers): never added together.
    separate: { sales: p.sales, salesKobo: p.salesKobo, expenses: p.expenses, expensesKobo: p.expensesKobo, owedKobo: owed.reduce((n, d) => n + d.openKobo, 0), stockKobo: stockValue(cat), stockCounted: c.inventory },
  };
}

export async function entriesView(c: Ctx, kind: "sale" | "expense" | "all", period: PeriodKind, back: number) {
  const p = periodOf(period, c.today, Math.max(0, Math.min(36, Math.floor(back) || 0)));
  const es = sortNewest((await entriesBetween(c.db, c.owner, p.start, p.end)).filter((e) => kind === "all" || e.kind === kind || (kind === "sale" && e.kind === "refund")));
  return { period: p, entries: es.slice(0, 500).map(publicEntry), more: es.length > 500, categories: categoriesOf(c) };
}

export async function owedView(c: Ctx) {
  const { db, owner, today } = c;
  const [parties, open, month, reminders] = await Promise.all([
    customers(db, owner), openEntries(db, owner), entriesBetween(db, owner, periodOf("month", today).start, today),
    db.collection("bookReminders").where("ownerUid", "==", owner).get().then((s) => s.docs.map((d) => d.data())),
  ]);
  const rows = debtors(parties, open, today);
  const last = new Map<string, { at: string; channel: string }>();
  for (const r of reminders) if (r.kind === "reminder" && (!last.get(r.partyId) || last.get(r.partyId)!.at < r.at)) last.set(r.partyId, { at: r.at, channel: r.channel });
  return {
    today, shop: shopName(c.profile), access: c.access, caps: c.caps,
    debtors: rows.map((d) => ({ ...d, link: d.party.statementCode ? statementUrl(d.party.statementCode) : "", preview: reminderText({ customer: d.party.name, shop: shopName(c.profile), amountKobo: d.openKobo, what: d.what, since: d.since, dueOn: d.dueOn, today, link: d.party.statementCode ? statementUrl(d.party.statementCode) : statementUrl("…"), domain: ROOT_DOMAIN }), party: { ...d.party, statementCode: undefined, phone: undefined, hasPhone: !!d.party.phone, phoneMasked: d.party.phone ? maskForSeller(d.party.phone) : "", member: !!d.party.memberUid }, lastReminder: last.get(d.party.id) ?? null })),
    totals: { owedKobo: rows.reduce((n, d) => n + d.openKobo, 0), overdueKobo: rows.reduce((n, d) => n + d.overdueKobo, 0), people: rows.length, latePeople: rows.filter((d) => d.overdueKobo > 0).length, paidBackKobo: month.filter((e) => e.kind === "payment" && !e.voidedAt).reduce((n, e) => n + e.totalKobo, 0) },
    suppliers: parties.filter((x) => x.kind === "supplier").sort((a, b) => b.balanceKobo - a.balanceKobo || a.name.localeCompare(b.name)).map((x) => ({ id: x.id, name: x.name, balanceKobo: x.balanceKobo, dueOn: x.dueOn ?? "", note: x.note ?? "" })),
    customers: parties.filter((x) => x.kind === "customer").map((x) => ({ id: x.id, name: x.name, balanceKobo: x.balanceKobo, member: !!x.memberUid, hasPhone: !!x.phone })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
const maskForSeller = (p: string) => { const d = p.replace(/\D/g, ""); return d.startsWith("234") ? `0${d.slice(3, 6)} ··· ${d.slice(-4)}` : `+${d.slice(0, 3)} ··· ${d.slice(-4)}`; };

// ---- Reminders and receipts ----
// Members get email and the bell; everyone else WhatsApp, opened on the seller's own phone with the message written (we only know
// WhatsApp was opened, so that's what is recorded: channel whatsapp_link). One reminder a day per customer. A customer can stop
// reminders from their statement link; email stops then, and WhatsApp asks the seller to confirm.
export type ReminderChannel = "email" | "whatsapp";
export async function remind(c: Ctx, partyId: string, channel: ReminderChannel, force = false): Promise<{ channel: string; url?: string; text: string }> {
  const { db, owner, today } = c;
  const ref = db.doc(`bookParties/${partyId}`);
  const s = await ref.get();
  const party = s.exists ? partyOf(s) : null;
  if (!party || party.ownerUid !== owner || party.kind !== "customer") throw new BooksError(404, "Customer not found.");
  const open = (await db.collection("bookEntries").where("ownerUid", "==", owner).where("partyId", "==", partyId).where("open", "==", true).get()).docs.map(entryOf).filter((e) => openKobo(e) > 0);
  const row = debtors([party], open, today)[0];
  if (!row) throw new BooksError(400, `${party.name} doesn't owe anything.`);
  if (party.lastRemindedOn === today) throw new BooksError(429, `You reminded ${firstName(party.name)} today already. One reminder a day at most.`, "daily");
  if (party.remindersOff && (channel === "email" || !force)) throw new BooksError(409, `${firstName(party.name)} asked not to get reminders. ${channel === "whatsapp" ? "Send this one anyway?" : "Reminders by email have stopped."}`, "reminders_off");
  let code = party.statementCode;
  if (!code) { code = newCode(); await ref.update({ statementCode: code }); }
  const text = reminderText({ customer: party.name, shop: shopName(c.profile), amountKobo: row.openKobo, what: row.what, since: row.since, dueOn: row.dueOn, today, link: statementUrl(code), domain: ROOT_DOMAIN });
  let url: string | undefined;
  if (channel === "email") {
    if (!party.memberUid) throw new BooksError(400, `${firstName(party.name)} isn't on #NotesApp, so remind them by WhatsApp.`);
    const to = await getUserEmail(party.memberUid);
    if (to) await sendEmail({ to, subject: `A reminder from ${shopName(c.profile)}`, text: text.replace(/\n\n[\s\S]*$/, "\n\n#NotesApp"), action: { label: "See what you owe", url: statementUrl(code) }, bell: { uid: party.memberUid, type: "books", linkHref: `/statement/${code}`, message: `${shopName(c.profile)}: ${naira(row.openKobo)} for ${row.what}${row.dueOn ? `, due ${row.dueOn}` : ""}.` } });
    else await notifyBell({ uid: party.memberUid, type: "books", linkHref: `/statement/${code}`, message: `${shopName(c.profile)}: a reminder of ${naira(row.openKobo)} for ${row.what}.` });
  } else {
    const phone = waPhone(party.phone);
    if (!phone) throw new BooksError(400, `Add ${firstName(party.name)}'s phone number first.`);
    url = waLink(phone, text);
  }
  const ch = channel === "email" ? "email" : "whatsapp_link";
  await Promise.all([
    db.collection("bookReminders").add({ ownerUid: owner, partyId, kind: "reminder", channel: ch, at: iso(c.now), on: today, by: c.actor, amountKobo: row.openKobo }),
    ref.update({ lastRemindedAt: iso(c.now), lastRemindedOn: today, lastRemindedBy: c.actor }),
  ]);
  return { channel: ch, url, text };
}

// A receipt: by WhatsApp (to the customer's number, or one typed for a walk-in customer) or, for a member, by email and the bell.
export async function shareReceipt(c: Ctx, entryId: string, channel: ReminderChannel, phoneRaw?: unknown): Promise<{ channel: string; url?: string; text: string; link: string }> {
  const { db, owner } = c;
  const s = await db.doc(`bookEntries/${entryId}`).get();
  const e = s.exists ? entryOf(s) : null;
  if (!e || e.ownerUid !== owner || e.kind !== "sale" || !e.receiptCode) throw new BooksError(404, "Receipt not found.");
  if (e.voidedAt) throw new BooksError(400, "That sale was voided.");
  const party = e.partyId ? partyOf(await db.doc(`bookParties/${e.partyId}`).get()) : null;
  const link = receiptUrl(e.receiptCode);
  const text = receiptText({ customer: party?.name, shop: shopName(c.profile), totalKobo: e.totalKobo, what: whatOf(e.lines), paidKobo: e.paidKobo + (e.settledKobo || 0), method: e.method, owesKobo: openKobo(e), dueOn: e.dueOn, link, domain: ROOT_DOMAIN });
  let url: string | undefined;
  if (channel === "email") {
    if (!party?.memberUid) throw new BooksError(400, "Only customers on #NotesApp get receipts by email. Send it by WhatsApp.");
    const to = await getUserEmail(party.memberUid);
    if (to) await sendEmail({ to, subject: `Your receipt from ${shopName(c.profile)}`, text: text.replace(/\n\n[\s\S]*$/, "\n\n#NotesApp"), action: { label: "See the receipt", url: link }, bell: { uid: party.memberUid, type: "books", linkHref: `/receipt/${e.receiptCode}`, message: `Your receipt from ${shopName(c.profile)}: ${naira(e.totalKobo)}.` } });
  } else {
    const phone = waPhone(phoneRaw || party?.phone);
    if (!phone) throw new BooksError(400, "Enter the customer's WhatsApp number.");
    url = waLink(phone, text);
  }
  const ch = channel === "email" ? "email" : "whatsapp_link";
  await db.collection("bookReminders").add({ ownerUid: owner, ...(party ? { partyId: party.id } : {}), entryId, kind: "receipt", channel: ch, at: iso(c.now), on: c.today, by: c.actor });
  return { channel: ch, url, text, link };
}

// ---- Public pages (no sign-in): the receipt and the customer's statement. No phone numbers or emails, ever. ----
export async function publicReceipt(db: Firestore, code: string) {
  if (!/^[2-9A-HJKMNP-Z]{10}$/.test(code)) return null;
  const r = (await db.doc(`bookReceipts/${code}`).get()).data();
  if (!r) return null;
  return { shopName: String(r.shopName), shopUsername: String(r.shopUsername ?? ""), shopLogo: String(r.shopLogo ?? ""), lines: r.lines as { title: string; qty: number; unitKobo: number }[], totalKobo: r.totalKobo as number, paidKobo: r.paidKobo as number, owesKobo: r.owesKobo as number, method: r.method as Method, on: r.on as string, at: r.at as string, customer: String(r.customer ?? ""), dueOn: r.dueOn as string | undefined, voided: r.voided === true, code };
}
async function partyByCode(db: Firestore, code: string) {
  if (!/^[2-9A-HJKMNP-Z]{10}$/.test(code)) return null;
  const s = await db.collection("bookParties").where("statementCode", "==", code).limit(1).get();
  return s.empty ? null : partyOf(s.docs[0]);
}
export async function publicStatement(db: Firestore, code: string, now = new Date()) {
  const party = await partyByCode(db, code);
  if (!party) return null;
  const [shop, open] = await Promise.all([db.doc(`users/${party.ownerUid}`).get(), db.collection("bookEntries").where("ownerUid", "==", party.ownerUid).where("partyId", "==", party.id).where("open", "==", true).get()]);
  const row = debtors([party], open.docs.map(entryOf).filter((e) => openKobo(e) > 0), lagosDay(now))[0];
  return { shopName: shopName((shop.data() ?? {}) as Profile), shopUsername: String(shop.data()?.username ?? ""), customer: firstName(party.name), owesKobo: row?.openKobo ?? 0, overdueKobo: row?.overdueKobo ?? 0, entries: row?.entries.map((e) => ({ on: e.on, title: e.title, openKobo: e.openKobo, dueOn: e.dueOn })) ?? [], remindersOff: party.remindersOff === true };
}
export async function stopReminders(db: Firestore, code: string, off = true): Promise<boolean> {
  const party = await partyByCode(db, code);
  if (!party) return false;
  await db.doc(`bookParties/${party.id}`).update({ remindersOff: off, remindersOffAt: new Date().toISOString() });
  if (off) await notifyBell({ uid: party.ownerUid, type: "books", linkHref: "/profile/books?tab=owed", message: `${party.name} asked not to get reminders about what they owe.` }).catch(() => {});
  return true;
}

// ---- Receipt photos on expenses (private bucket, like message attachments; links are short-lived and only for the books' keepers) ----
const extOf = (n: string) => (n.split(".").pop() || "").toLowerCase();
const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(-80) || "receipt";
async function ownEntry(c: Ctx, id: string) {
  const s = await c.db.doc(`bookEntries/${id}`).get();
  const e = s.exists ? entryOf(s) : null;
  if (!e || e.ownerUid !== c.owner) throw new BooksError(404, "Entry not found.");
  return e;
}
export async function startPhoto(c: Ctx, entryId: string, file: { name?: unknown; size?: unknown }, presign: (key: string, type: string, size: number) => Promise<string>) {
  const e = await ownEntry(c, entryId);
  if (e.kind !== "expense") throw new BooksError(400, "Receipt photos go on expenses.");
  if ((e.files ?? []).length >= MAX_RECEIPT_PHOTOS) throw new BooksError(400, `An expense can have ${MAX_RECEIPT_PHOTOS} receipt photos.`);
  const name = String(file.name ?? ""), size = Number(file.size), type = RECEIPT_PHOTO_TYPES[extOf(name)];
  if (!type) throw new BooksError(400, "A receipt photo can be JPG, PNG, WEBP, HEIC or PDF.");
  if (!Number.isFinite(size) || size <= 0 || size > RECEIPT_PHOTO_MAX_BYTES) throw new BooksError(400, `Each photo can be up to ${RECEIPT_PHOTO_MAX_BYTES / 1024 / 1024} MB.`);
  const key = `books/${c.owner}/${entryId}/${c.now.getTime()}-${safeName(name)}`;
  return { key, contentType: type, uploadUrl: await presign(key, type, size) };
}
export async function attachPhoto(c: Ctx, entryId: string, file: { key?: unknown; name?: unknown }, head: (key: string) => Promise<{ size: number } | null>) {
  const key = String(file.key ?? "");
  if (!key.startsWith(`books/${c.owner}/${entryId}/`) || key.includes("..")) throw new BooksError(400, "That file doesn't belong to this entry.");
  const type = RECEIPT_PHOTO_TYPES[extOf(key)];
  if (!type) throw new BooksError(400, "That file type isn't allowed.");
  const obj = await head(key);
  if (!obj) throw new BooksError(400, "The upload didn't arrive. Try again.");
  if (obj.size > RECEIPT_PHOTO_MAX_BYTES) throw new BooksError(400, "That photo is too large.");
  const ref = c.db.doc(`bookEntries/${entryId}`);
  await c.db.runTransaction(async (t) => {
    const e = entryOf(await t.get(ref));
    if (e.ownerUid !== c.owner) throw new BooksError(404, "Entry not found.");
    const files = e.files ?? [];
    if (files.length >= MAX_RECEIPT_PHOTOS) throw new BooksError(400, `An expense can have ${MAX_RECEIPT_PHOTOS} receipt photos.`);
    if (files.some((f) => f.key === key)) return;
    t.update(ref, { files: [...files, { key, name: cleanText(file.name, 80) || "receipt", type, size: obj.size }] });
  });
}
export async function photoLink(c: Ctx, entryId: string, index: number, sign: (key: string, name: string, type: string) => Promise<string>) {
  const e = await ownEntry(c, entryId);
  const f = (e.files ?? [])[index];
  if (!f) throw new BooksError(404, "That photo wasn't found.");
  return { url: await sign(f.key, f.name, f.type), name: f.name, type: f.type };
}

// ---- Export: everything, as CSV (cells that start with = + - @ are escaped, lib/books-import.ts csvOf) ----
export async function exportAll(c: Ctx, from?: string, to?: string): Promise<{ name: string; csv: string }[]> {
  const start = from && isDay(from) ? from : "2000-01-01", end = to && isDay(to) ? to : c.today;
  const [entries, parties, cat] = await Promise.all([entriesBetween(c.db, c.owner, start, end), customers(c.db, c.owner), catalog(c)]);
  sortNewest(entries).reverse();
  const nameOf = new Map(parties.map((p) => [p.id, p]));
  const k = (n: number) => (n / 100).toFixed(2);
  const sales = entries.filter((e) => e.kind === "sale" || e.kind === "refund").map((e) => [e.on, e.at.slice(11, 16), e.kind, e.source, e.lines.map((l) => `${l.title} x${l.qty}`).join("; "), e.lines.reduce((n, l) => n + l.qty, 0), k(e.kind === "refund" ? -e.totalKobo : e.totalKobo), k(linesCost(e.lines)), k(e.paidKobo), k(openKobo(e)), e.method, e.partyName ?? "", e.dueOn ?? "", e.orderRef ?? "", k(e.feeKobo ?? 0), e.note ?? "", e.voidedAt ? `voided: ${e.voidReason ?? ""}` : ""]);
  const expenses = entries.filter((e) => e.kind === "expense").map((e) => [e.on, categoryLabel(e.category, categoriesOf(c)), e.note ?? "", k(e.totalKobo), e.method, (e.files ?? []).length, e.voidedAt ? `voided: ${e.voidReason ?? ""}` : ""]);
  const payments = entries.filter((e) => e.kind === "payment").map((e) => [e.on, e.partyName ?? "", k(e.totalKobo), e.method, e.voidedAt ? "voided" : ""]);
  const open = await openEntries(c.db, c.owner);
  const owed = debtors(parties, open, c.today).map((d) => [d.party.name, d.party.phone ?? "", k(d.openKobo), k(d.overdueKobo), d.since, d.dueOn ?? "", d.what]);
  const suppliers = parties.filter((p) => p.kind === "supplier").map((p) => [p.name, p.phone ?? "", k(p.balanceKobo), p.dueOn ?? "", p.note ?? ""]);
  const stock = cat.map((x) => [x.title, x.sku, x.stock ?? "", k(x.costKobo), k(x.priceKobo), x.bookItemId ? "books only" : "store"]);
  void nameOf;
  return [
    { name: "sales.csv", csv: csvOf([["date", "time", "kind", "source", "items", "units", "total_naira", "cost_naira", "paid_naira", "owed_naira", "method", "customer", "due_date", "order_ref", "notesapp_commission_naira", "note", "status"], ...sales]) },
    { name: "expenses.csv", csv: csvOf([["date", "category", "description", "amount_naira", "method", "receipt_photos", "status"], ...expenses]) },
    { name: "payments-received.csv", csv: csvOf([["date", "customer", "amount_naira", "method", "status"], ...payments]) },
    { name: "money-owed-to-you.csv", csv: csvOf([["customer", "phone", "owes_naira", "overdue_naira", "since", "due_date", "for"], ...owed]) },
    { name: "money-you-owe.csv", csv: csvOf([["supplier", "phone", "you_owe_naira", "due_date", "note"], ...suppliers]) },
    { name: "stock.csv", csv: csvOf([["item", "sku", "stock", "cost_naira", "price_naira", "where"], ...stock]) },
  ];
}

// ---- Import (docs/BUSINESS-BOOKS.md section 3): dry run, import, undo for 24 hours ----
// Sources (lib/books-import.ts PRESETS): a spreadsheet, Tralo, Shopify, WooCommerce, Selar, Bumpa, Paystack and bank statements. Rows with
// the source's own order number or reference are matched by it first (Entry.extRef), so importing the same export again adds nothing,
// and an order refunded since only adds its refund.
export type BankLine = Pick<BankRow, "row" | "on" | "narration" | "ref" | "inKobo" | "outKobo" | "as" | "category" | "tick" | "why"> & { dupe: boolean };
export type ImportPlan = {
  kind: ImportKind; source: string; headers: string[]; mapping: Mapping; samples: string[]; rows: number;
  counts: { fresh: number; updates: number; dupes: number; problems: number; skipped: number };
  problems: Problem[]; notes: { row: number; message: string }[]; skipped: Problem[]; missing: string[]; bank?: BankLine[];
};
type StockChange = { row: number; target: { itemId?: string; variant?: string; bookItemId?: string } | null; name: string; set: Record<string, unknown>; before: Record<string, unknown> };
type Plan<T> = { plan: ImportPlan; work: T };

async function planStock(c: Ctx, rows: ReturnType<typeof readRows<"stock">>["rows"]) {
  if (!c.inventory) throw new BooksError(402, "Stock lists need Inventory, which counts your stock (included on Business; an add-on with a free trial on Free Basic and Pro). Sales, expenses and customers import without it.", "inventory");
  const cat = await catalog(c);
  const bySku = new Map(cat.filter((x) => x.sku).map((x) => [x.sku.toUpperCase(), x]));
  const byName = new Map(cat.map((x) => [x.title.trim().toLowerCase().replace(/\s+/g, " "), x]));
  const seen = new Set<string>();
  const changes: StockChange[] = [], notes: ImportPlan["notes"] = [];
  let dupes = 0;
  for (const r of rows) {
    const key = r.sku ? `s:${r.sku}` : `n:${r.name.toLowerCase().replace(/\s+/g, " ")}`;
    if (seen.has(key)) { dupes++; notes.push({ row: r.row, message: `${r.sku || r.name} is in the file twice, so this row is skipped.` }); continue; }
    seen.add(key);
    const hit = (r.sku && bySku.get(r.sku)) || byName.get(r.name.toLowerCase().replace(/\s+/g, " "));
    if (!hit) { changes.push({ row: r.row, target: null, name: r.name, set: { name: r.name, sku: r.sku, category: r.category, unit: r.unit, priceKobo: r.priceKobo ?? 0, costKobo: r.costKobo ?? 0, stock: r.stock ?? 0, lowAt: r.lowAt ?? 3 }, before: {} }); continue; }
    const set: Record<string, unknown> = {}, before: Record<string, unknown> = {};
    if (r.stock !== undefined && r.stock !== hit.stock) { set.stock = r.stock; before.stock = hit.stock ?? 0; }
    if (r.costKobo !== undefined && r.costKobo !== hit.costKobo) { set.costKobo = r.costKobo; before.costKobo = hit.costKobo; }
    if (r.lowAt !== undefined && r.lowAt !== hit.lowAt) { set.lowAt = r.lowAt; before.lowAt = hit.lowAt; }
    if (r.sku && !hit.sku) { set.sku = r.sku; before.sku = ""; }
    if (hit.bookItemId && r.priceKobo !== undefined && r.priceKobo !== hit.priceKobo) { set.priceKobo = r.priceKobo; before.priceKobo = hit.priceKobo; }
    if (!Object.keys(set).length) { dupes++; continue; }
    changes.push({ row: r.row, target: { ...(hit.itemId ? { itemId: hit.itemId } : {}), ...(hit.variant ? { variant: hit.variant } : {}), ...(hit.bookItemId ? { bookItemId: hit.bookItemId } : {}) }, name: hit.title, set, before });
    if (notes.length < 40) notes.push({ row: r.row, message: `${hit.sku || hit.title} is already in your ${hit.bookItemId ? "books" : "shop"}: ${Object.keys(set).map((k) => k === "stock" ? `stock ${before.stock} → ${set.stock}` : k === "costKobo" ? `cost ${naira(before.costKobo as number)} → ${naira(set.costKobo as number)}` : k === "priceKobo" ? `price ${naira(before.priceKobo as number)} → ${naira(set.priceKobo as number)}` : k === "lowAt" ? `low-stock level ${before.lowAt} → ${set.lowAt}` : `SKU ${set.sku}`).join(", ")}.` });
  }
  return { changes, notes, dupes };
}

// What's already in the books for those days: each entry's import reference (extRef), and for those without one the day + amount + item
// (sales) or description (expenses). Refunds only by their reference.
async function existingKeys(c: Ctx, on: string[], kind: "sale" | "expense") {
  if (!on.length) return new Set<string>();
  const sorted = [...on].sort();
  const es = (await entriesBetween(c.db, c.owner, sorted[0], sorted[sorted.length - 1])).filter((e) => !e.voidedAt && (e.kind === kind || (kind === "sale" && e.kind === "refund")));
  const keys = new Set<string>();
  for (const e of es) {
    if (e.extRef) keys.add(`ref:${e.extRef}`);
    if (e.kind === "refund") continue;
    keys.add(kind === "sale" ? saleKey(e.on, e.totalKobo, e.lines[0]?.title ?? "") : expenseKey(e.on, e.totalKobo, e.note || categoryLabel(e.category, categoriesOf(c))));
  }
  return keys;
}
const saleRef = (src: string, r: Pick<SaleRow, "ref">) => (r.ref ? refKey(src, r.ref) : "");
const extRefOf = (key: string) => key.replace(/^ref:/, "");

export async function planImport(c: Ctx, raw: { kind?: unknown; csv?: unknown; mapping?: unknown; preset?: unknown }): Promise<Plan<{ sheet: Sheet; stock?: StockChange[]; fresh?: unknown[]; refunds?: SaleRow[] }>> {
  const kind = raw.kind as ImportKind;
  if (!FIELDS[kind]) throw new BooksError(400, "Choose what you're importing.");
  const sheet = readSheet(String(raw.csv ?? ""));
  if ("error" in sheet) throw new BooksError(400, sheet.error);
  if (sheet.rows.length > c.access.importRows) throw new BooksError(402, `Free Basic imports up to ${c.access.importRows} rows a file. Split the file, or move to Pro for up to 5,000.`, "import_rows");
  const preset = presetOf(raw.preset);
  const src = preset && preset.kind === kind ? preset.source : kind === "bank" ? "bank" : "csv";
  const saved = c.settings.mappings?.[`${kind}:${sheet.headers.join("|").toLowerCase()}`];
  const mapping = raw.mapping ? cleanMapping(raw.mapping, sheet.headers, kind) : saved ? cleanMapping(saved, sheet.headers, kind) : guessMapping(sheet.headers, kind, preset);
  const samples = sheet.headers.map((_, i) => (sheet.rows.find((r) => (r[i] ?? "").trim())?.[i] ?? "").slice(0, 40));
  const missing = missingRequired(mapping, kind);
  const empty: ImportPlan = { kind, source: src, headers: sheet.headers, mapping, samples, rows: sheet.rows.length, counts: { fresh: 0, updates: 0, dupes: 0, problems: 0, skipped: 0 }, problems: [], notes: [], skipped: [], missing };
  if (missing.length) return { plan: empty, work: { sheet } };
  const { rows, problems, skipped, notes: readNotes } = readRows(sheet, mapping, kind, c.today, preset);
  const plan: ImportPlan = { ...empty, problems: problems.slice(0, 200), skipped: skipped.slice(0, 200), counts: { ...empty.counts, problems: problems.length, skipped: skipped.length } };
  if (kind === "stock") {
    const s = await planStock(c, rows as ReturnType<typeof readRows<"stock">>["rows"]);
    plan.counts.fresh = s.changes.filter((x) => !x.target).length; plan.counts.updates = s.changes.length - plan.counts.fresh; plan.counts.dupes = s.dupes; plan.notes = [...readNotes, ...s.notes];
    return { plan, work: { sheet, stock: s.changes } };
  }
  if (kind === "sales") {
    let sales = rows as SaleRow[];
    const have = await existingKeys(c, sales.map((r) => r.on), "sale");
    // Paystack: a payment that was a #NotesApp order is already in the books (bookEntries/online_<reference>).
    if (preset?.rules?.ourRefs) {
      const refs = [...new Set(sales.map((r) => r.ref ?? "").filter((r) => r && !r.includes("/")))];
      const ours = new Set<string>();
      for (let i = 0; i < refs.length; i += 200) {
        const snaps = await c.db.getAll(...refs.slice(i, i + 200).map((r) => c.db.doc(`bookEntries/online_${r}`)));
        snaps.forEach((s) => { if (s.exists && s.data()?.ownerUid === c.owner) ours.add(s.id.slice("online_".length)); });
      }
      const mine = sales.filter((r) => r.ref && ours.has(r.ref));
      for (const r of mine) plan.skipped.push({ row: r.row, message: `${r.ref} was a #NotesApp order: it's already in your books.` });
      plan.counts.skipped += mine.length;
      sales = sales.filter((r) => !(r.ref && ours.has(r.ref)));
    }
    const { fresh, dupes } = dedupe(sales, (r) => saleRef(src, r) || saleKey(r.on, r.totalKobo, r.title), have);
    // An order already in the books that has been refunded since: only its refund comes in.
    const refunds = dupes.filter((r) => r.ref && r.refundKobo && have.has(saleRef(src, r)) && !have.has(`${saleRef(src, r)}:refund`));
    plan.counts.fresh = fresh.length; plan.counts.updates = refunds.length; plan.counts.dupes = dupes.length - refunds.length;
    const notes: ImportPlan["notes"] = [];
    const credit = fresh.filter((r) => r.paidKobo < r.totalKobo);
    if (credit.length) notes.push({ row: 0, message: `${credit.length} ${credit.length === 1 ? "sale was" : "sales were"} on credit, so ${naira(credit.reduce((n, r) => n + r.totalKobo - r.paidKobo, 0))} goes to Money owed to you.` });
    const refunded = fresh.filter((r) => r.refundKobo);
    if (refunded.length) notes.push({ row: 0, message: `${refunded.length} ${refunded.length === 1 ? "order was" : "orders were"} refunded: ${naira(refunded.reduce((n, r) => n + (r.refundKobo ?? 0), 0))} comes in as refunds, so your sales stay right.` });
    const fees = fresh.filter((r) => r.feeKobo);
    if (fees.length) notes.push({ row: 0, message: `${naira(fees.reduce((n, r) => n + (r.feeKobo ?? 0), 0))} in ${sourceOf(src)?.label ?? "payment"} fees comes in as expenses (Bank and POS charges), one a day.` });
    const buyers = new Set(fresh.map((r) => r.customer).filter(Boolean));
    if (buyers.size && preset?.rules?.online) notes.push({ row: 0, message: `${buyers.size} ${buyers.size === 1 ? "buyer is" : "buyers are"} added to your customers (or matched to ones you have).` });
    for (const r of refunds) notes.push({ row: r.row, message: `${r.ref} is already in your books and was refunded since: its refund of ${naira(r.refundKobo!)} comes in.` });
    for (const r of dupes.filter((x) => !refunds.includes(x)).slice(0, 40)) notes.push({ row: r.row, message: r.ref ? `${r.ref} is already in your books, so it's skipped.` : "Already in your books (same day, amount and item), so it's skipped." });
    plan.notes = [...notes, ...readNotes];
    return { plan, work: { sheet, fresh, refunds } };
  }
  if (kind === "expenses") {
    const typed = rows as ReturnType<typeof readRows<"expenses">>["rows"];
    const have = await existingKeys(c, typed.map((r) => r.on), "expense");
    const { fresh, dupes } = dedupe(typed, (r) => expenseKey(r.on, r.amountKobo, r.description || categoryLabel(r.category, categoriesOf(c))), have);
    plan.counts.fresh = fresh.length; plan.counts.dupes = dupes.length;
    plan.notes = dupes.slice(0, 40).map((r) => ({ row: r.row, message: "Already in your books (same day, amount and item), so it's skipped." }));
    return { plan, work: { sheet, fresh } };
  }
  if (kind === "bank") {
    // Every line goes back to the seller to tick and label; lines already in the books (same reference, or same day, amount and
    // narration) are shown greyed out and never imported.
    const lines = rows as BankRow[];
    const ons = lines.map((r) => r.on);
    const have = new Set([...(await existingKeys(c, ons, "sale")), ...(await existingKeys(c, ons, "expense"))]);
    const { fresh, dupes } = dedupe(lines, (r) => [r.ref ? refKey("bank", r.ref) : "", r.inKobo ? saleKey(r.on, r.inKobo, r.narration) : expenseKey(r.on, r.outKobo, r.narration)], have);
    const dupe = new Set(dupes);
    plan.counts.fresh = fresh.length; plan.counts.dupes = dupes.length;
    plan.bank = lines.map((r) => ({ row: r.row, on: r.on, narration: r.narration, ref: r.ref, inKobo: r.inKobo, outKobo: r.outKobo, as: r.as, category: r.category, tick: r.tick && !dupe.has(r), why: r.why, dupe: dupe.has(r) }));
    plan.notes = readNotes;
    return { plan, work: { sheet, fresh } };
  }
  const parties = await customers(c.db, c.owner);
  const have = new Set(parties.filter((p) => p.kind === "customer").flatMap((p) => [p.phone ? customerKey(p.phone, "") : "", p.email ? customerKey("", "", p.email) : "", customerKey("", p.name)]).filter(Boolean));
  const { fresh, dupes } = dedupe(rows as ReturnType<typeof readRows<"customers">>["rows"], (r) => [r.phone ? customerKey(r.phone, "") : "", r.email ? customerKey("", "", r.email) : "", customerKey("", r.name)], have);
  plan.counts.fresh = fresh.length; plan.counts.dupes = dupes.length;
  plan.notes = [...readNotes, ...dupes.slice(0, 40).map((r) => ({ row: r.row, message: `${r.name} is already in your customers, so this row is skipped.` }))];
  return { plan, work: { sheet, fresh } };
}

const commitBatches = async (db: Firestore, writes: ((b: FirebaseFirestore.WriteBatch) => void)[]) => {
  for (let i = 0; i < writes.length; i += 400) { const b = db.batch(); writes.slice(i, i + 400).forEach((w) => w(b)); await b.commit(); }
};

// A bank import's choices: for each line the seller ticked, what it is (a sale for money in, an expense with its category for money out).
type BankChoice = { row: number; as: "sale" | "expense"; category?: string };
const bankChoices = (raw: unknown): Map<number, BankChoice> => {
  const out = new Map<number, BankChoice>();
  for (const x of Array.isArray(raw) ? raw.slice(0, 6000) : []) {
    const row = Number((x as BankChoice)?.row), as = (x as BankChoice)?.as;
    if (Number.isInteger(row) && (as === "sale" || as === "expense")) out.set(row, { row, as, category: typeof (x as BankChoice).category === "string" ? String((x as BankChoice).category).slice(0, 40) : undefined });
  }
  return out;
};

export async function applyImport(c: Ctx, raw: { kind?: unknown; csv?: unknown; mapping?: unknown; preset?: unknown; fileName?: unknown; choices?: unknown }) {
  const { db, owner } = c;
  const { plan, work } = await planImport(c, raw);
  if (plan.missing.length) throw new BooksError(400, `Match a column to: ${plan.missing.join(", ")}.`);
  if (plan.counts.problems) throw new BooksError(400, "Fix or remove the rows with problems first (or take them out of the file).");
  const kind = plan.kind, src = plan.source;
  const choices = kind === "bank" ? bankChoices(raw.choices) : new Map<number, BankChoice>();
  if (kind === "bank" && !(work.fresh as BankRow[]).some((r) => choices.has(r.row))) throw new BooksError(400, "Tick the lines to bring in first.");
  const importRef = db.collection("bookImports").doc();
  const at = iso(c.now);
  const writes: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  const undo: { items: StockChange[] } = { items: [] };
  const created = { entries: 0, items: 0, parties: 0, updates: 0 };
  // Saved for next time a file with the same headings comes from the same place.
  await db.doc(`bookSettings/${owner}`).set({ mappings: { [`${kind}:${plan.headers.join("|").toLowerCase()}`]: plan.mapping } }, { merge: true });
  // The import's record first (status running), so an import that stops halfway can still be undone.
  await importRef.set({ ownerUid: owner, kind, source: src, ...(presetOf(raw.preset) ? { preset: presetOf(raw.preset)!.id } : {}), fileName: cleanText(raw.fileName, 120) || `${kind}.csv`, rows: plan.rows, by: c.actor, at, undoUntil: new Date(c.now.getTime() + BOOKS_UNDO_HOURS * 3_600_000).toISOString(), status: "running", created });
  const base = { ownerUid: owner, source: "import" as const, by: c.actor, files: [], counts: false, importId: importRef.id };

  if (kind === "stock") {
    for (const ch of work.stock ?? []) {
      if (!ch.target) {
        const ref = db.collection("bookItems").doc();
        writes.push((b) => b.set(ref, { ownerUid: owner, ...ch.set, sku: cleanSku(ch.set.sku), importId: importRef.id, createdAt: at }));
        created.items++;
      } else if (ch.target.bookItemId) {
        const ref = db.doc(`bookItems/${ch.target.bookItemId}`);
        writes.push((b) => b.update(ref, ch.set));
        undo.items.push(ch); created.updates++;
      } else undo.items.push(ch);
    }
    await commitBatches(db, writes);
    // Store items: through Inventory (a count correction with this import's reference), and the private details.
    for (const ch of (work.stock ?? []).filter((x) => x.target?.itemId)) {
      const t = ch.target!;
      if (ch.set.stock !== undefined) await bookStockMove(db, { ownerUid: owner, itemId: t.itemId!, variant: t.variant, set: ch.set.stock as number, reason: "count", note: "Business books import", by: c.actor, bookRef: `import:${importRef.id}` });
      const det: Record<string, unknown> = {};
      for (const k of ["costKobo", "lowAt", "sku"] as const) if (ch.set[k] !== undefined) det[k] = ch.set[k];
      if (Object.keys(det).length) {
        const ref = db.doc(`inventory/${t.itemId}`);
        const cur = inventoryDocOf((await ref.get()).data(), owner);
        if (det.sku && t.variant) { cur.variantSku = { ...cur.variantSku, [t.variant]: String(det.sku) }; delete det.sku; }
        await ref.set({ ...cur, ...det, updatedAt: at });
      }
      created.updates++;
    }
  } else if (kind === "expenses") {
    for (const r of (work.fresh ?? []) as ReturnType<typeof readRows<"expenses">>["rows"]) {
      const ref = db.collection("bookEntries").doc();
      writes.push((b) => b.set(ref, { ...base, kind: "expense", on: r.on, at: `${r.on}T12:00:00.000Z`, lines: [], totalKobo: r.amountKobo, paidKobo: r.amountKobo, method: r.method, owesKobo: 0, settledKobo: 0, open: false, category: r.category, ...(r.description ? { note: r.description } : {}) } satisfies Omit<Entry, "id">));
      created.entries++;
    }
    await commitBatches(db, writes);
  } else if (kind === "bank") {
    // The lines the seller ticked: money in as a sale (paid by transfer), money out as an expense in the category they chose.
    const cats = new Set(categoriesOf(c).map((x) => x.id));
    for (const r of (work.fresh ?? []) as BankRow[]) {
      const ch = choices.get(r.row);
      if (!ch) continue;
      const ref = db.collection("bookEntries").doc();
      const ext = r.ref ? { extRef: extRefOf(refKey("bank", r.ref)) } : {};
      if (ch.as === "sale" && r.inKobo) {
        writes.push((b) => b.set(ref, { ...base, kind: "sale", on: r.on, at: r.at, lines: [{ title: r.narration, qty: 1, unitKobo: r.inKobo, costKobo: 0 }], totalKobo: r.inKobo, paidKobo: r.inKobo, method: "transfer", owesKobo: 0, settledKobo: 0, open: false, note: "From a bank statement", ...ext } satisfies Omit<Entry, "id">));
        created.entries++;
      } else if (ch.as === "expense" && r.outKobo) {
        const category = ch.category && cats.has(ch.category) ? ch.category : categoryFrom(ch.category ?? "");
        writes.push((b) => b.set(ref, { ...base, kind: "expense", on: r.on, at: r.at, lines: [], totalKobo: r.outKobo, paidKobo: r.outKobo, method: "transfer", owesKobo: 0, settledKobo: 0, open: false, category: cats.has(category) ? category : "other", note: r.narration, ...ext } satisfies Omit<Entry, "id">));
        created.entries++;
      }
    }
    await commitBatches(db, writes);
  } else {
    // Sales and customers: the customers first (matched by phone, email, then exact name), then the entries, then each customer's balance.
    const parties = await customers(c.db, owner);
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const find = (phone: string, name: string, email: string) => parties.find((p) => p.kind === "customer" && ((phone && p.phone === phone) || (email && p.email && same(p.email, email)) || same(p.name, name)));
    const owing = new Set(parties.filter((p) => p.kind === "customer" && p.balanceKobo > 0).map((p) => p.id));
    const add = new Map<string, number>();
    const partyFor = (name: string, phone: string, email = ""): Party => {
      const hit = find(phone, name, email);
      if (hit) return hit;
      const ref = db.collection("bookParties").doc();
      const p: Party = { id: ref.id, ownerUid: owner, kind: "customer", name, phone, balanceKobo: 0, statementCode: newCode(), createdAt: at, importId: importRef.id, ...(email ? { email } : {}) };
      parties.push(p);
      const { id: _id, ...doc } = p; void _id;
      writes.push((b) => b.set(ref, doc));
      created.parties++;
      return p;
    };
    const cat = kind === "sales" ? await catalog(c) : [];
    const byTitle = new Map(cat.map((x) => [x.title.trim().toLowerCase(), x]));
    const linesOf = (r: SaleRow): Line[] => {
      const lines: Line[] = (r.lines ?? [{ title: r.title, qty: r.qty, unitKobo: r.unitKobo }]).map((l) => {
        // Shops name an option's line "Title - Option" (Shopify, Woo); stock lists name the item "Title (Option)".
        const t = l.title.trim().toLowerCase();
        const it = byTitle.get(t) ?? byTitle.get(t.replace(/^(.+) - (.+)$/, "$1 ($2)"));
        return { ...(it?.itemId ? { itemId: it.itemId } : {}), ...(it?.variant ? { variant: it.variant } : {}), ...(it?.bookItemId ? { bookItemId: it.bookItemId } : {}), title: l.title, qty: l.qty, unitKobo: l.unitKobo, costKobo: it?.costKobo ?? 0 };
      });
      // Shipping, taxes and discounts: the difference between the lines and the total.
      const gap = r.totalKobo - linesTotal(lines);
      if (gap) lines.push({ title: gap < 0 ? "Discount" : "Other (delivery, tax)", qty: 1, unitKobo: gap, costKobo: 0 });
      return lines;
    };
    const refund = (r: SaleRow, party: Party | null) => {
      const ref = db.collection("bookEntries").doc();
      const full = r.refundKobo === r.totalKobo;
      const lines = full ? linesOf(r) : [{ title: `Refund: ${r.title}`.slice(0, 120), qty: 1, unitKobo: r.refundKobo!, costKobo: 0 }];
      writes.push((b) => b.set(ref, { ...base, kind: "refund", on: r.on, at: r.at, lines, totalKobo: r.refundKobo!, paidKobo: r.refundKobo!, method: r.method, owesKobo: 0, settledKobo: 0, open: false, ...(party ? { partyId: party.id, partyName: party.name } : {}), ...(r.ref ? { extRef: `${extRefOf(saleRef(src, r))}:refund` } : {}) } satisfies Omit<Entry, "id">));
      created.entries++;
    };
    const fees = new Map<string, { kobo: number; n: number }>();
    const rows = (work.fresh ?? []) as (SaleRow | ReturnType<typeof readRows<"customers">>["rows"][number])[];
    for (const r of rows) {
      const owes = "totalKobo" in r ? r.totalKobo - r.paidKobo : r.owesKobo;
      const name = "customer" in r ? r.customer : r.name;
      const party = name ? partyFor(name, r.phone, r.email ?? "") : null;
      if (owes > 0 && party && !owing.has(party.id)) {
        if (!canAddDebtor(c.access, c.caps, owing.size, false)) throw new BooksError(402, `Free Basic keeps up to ${c.caps.freeCustomers} customers owing at once, and this file would go over. Import fewer debtors, or move to Pro.`, "customers_cap");
        owing.add(party.id);
      }
      if (owes > 0 && party) add.set(party.id, (add.get(party.id) ?? 0) + owes);
      if ("totalKobo" in r) {
        const ref = db.collection("bookEntries").doc();
        const lines = linesOf(r);
        writes.push((b) => b.set(ref, { ...base, kind: "sale", on: r.on, at: r.at, lines, totalKobo: r.totalKobo, paidKobo: r.paidKobo, method: r.method, owesKobo: owes, settledKobo: 0, open: owes > 0, ...(party ? { partyId: party.id, partyName: party.name } : {}), ...(r.dueOn ? { dueOn: r.dueOn } : {}), ...(r.note ? { note: r.note } : {}), ...(r.ref ? { extRef: extRefOf(saleRef(src, r)) } : {}) } satisfies Omit<Entry, "id">));
        created.entries++;
        if (r.refundKobo) refund(r, party);
        if (r.feeKobo) { const f = fees.get(r.on) ?? { kobo: 0, n: 0 }; f.kobo += r.feeKobo; f.n++; fees.set(r.on, f); }
      } else if (owes > 0 && party) {
        const ref = db.collection("bookEntries").doc();
        writes.push((b) => b.set(ref, { ...base, kind: "opening", on: c.today, at, lines: [], totalKobo: owes, paidKobo: 0, method: "cash", owesKobo: owes, settledKobo: 0, open: true, partyId: party.id, partyName: party.name, ...(r.dueOn ? { dueOn: r.dueOn } : {}), note: r.note || "Opening balance" } satisfies Omit<Entry, "id">));
        created.entries++;
      }
    }
    // Orders already in the books that were refunded since.
    for (const r of work.refunds ?? []) { refund(r, r.customer ? partyFor(r.customer, r.phone, r.email ?? "") : null); created.updates++; created.entries--; }
    // The payment app's fees: one expense a day, under Bank and POS charges.
    const label = sourceOf(src)?.label ?? "Payment";
    for (const [on, f] of fees) {
      const ref = db.collection("bookEntries").doc();
      writes.push((b) => b.set(ref, { ...base, kind: "expense", on, at: `${on}T12:00:00.000Z`, lines: [], totalKobo: f.kobo, paidKobo: f.kobo, method: "transfer", owesKobo: 0, settledKobo: 0, open: false, category: "bank", note: `${label} fees · ${f.n} ${f.n === 1 ? "payment" : "payments"}` } satisfies Omit<Entry, "id">));
      created.entries++;
    }
    await commitBatches(db, writes.map((w) => (b: FirebaseFirestore.WriteBatch) => w(b)));
    // Balances: read now and add, outside the batches (one small transaction each).
    for (const [pid, k] of add) {
      const ref = db.doc(`bookParties/${pid}`);
      await db.runTransaction(async (t) => { const s = await t.get(ref); t.set(ref, { balanceKobo: (Number(s.data()?.balanceKobo) || 0) + k }, { merge: true }); });
    }
  }
  await importRef.update({ status: "done", created, undo: JSON.parse(JSON.stringify(undo.items.map((x) => ({ target: x.target, before: x.before })))) });
  return { importId: importRef.id, created, undoUntil: new Date(c.now.getTime() + BOOKS_UNDO_HOURS * 3_600_000).toISOString() };
}

export async function importsView(c: Ctx) {
  const s = await c.db.collection("bookImports").where("ownerUid", "==", c.owner).get();
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string }).map((x) => ({ id: x.id, kind: x.kind, source: x.source, fileName: x.fileName, rows: x.rows, at: x.at, undoUntil: x.undoUntil, status: x.status, created: x.created, canUndo: x.status !== "undone" && String(x.undoUntil) > iso(c.now) }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
}

// Undo, within 24 hours: the entries, Books-only items and customers it made are removed, stock and details it changed go back, and each
// customer's balance is worked out again from what's left.
export async function undoImport(c: Ctx, importId: string) {
  const { db, owner } = c;
  const ref = db.doc(`bookImports/${importId}`);
  const imp = (await ref.get()).data();
  if (!imp || imp.ownerUid !== owner) throw new BooksError(404, "Import not found.");
  if (imp.status === "undone") throw new BooksError(409, "That import was already undone.");
  if (String(imp.undoUntil) <= iso(c.now)) throw new BooksError(409, `An import can be undone for ${BOOKS_UNDO_HOURS} hours. Fix entries one at a time now.`);
  const q = (col: string): Query => db.collection(col).where("ownerUid", "==", owner).where("importId", "==", importId);
  const [entries, items, parties] = await Promise.all([q("bookEntries").get(), q("bookItems").get(), q("bookParties").get()]);
  if (entries.docs.some((d) => (Number(d.data().settledKobo) || 0) > 0)) throw new BooksError(409, "Some customers have paid back money from this import since. Void those payments first, or fix the entries one at a time.");
  const touched = new Set(entries.docs.map((d) => String(d.data().partyId ?? "")).filter(Boolean));
  const madeParties = new Set(parties.docs.map((d) => d.id));
  const writes: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  entries.docs.forEach((d) => writes.push((b) => b.delete(d.ref)));
  items.docs.forEach((d) => writes.push((b) => b.delete(d.ref)));
  await commitBatches(db, writes);
  // What it changed: Books-only items back to how they were; store items through Inventory.
  for (const u of (imp.undo ?? []) as { target: StockChange["target"]; before: Record<string, unknown> }[]) {
    if (!u.target) continue;
    if (u.target.bookItemId) { await db.doc(`bookItems/${u.target.bookItemId}`).update(u.before).catch(() => {}); continue; }
    if (u.before.stock !== undefined) await bookStockMove(db, { ownerUid: owner, itemId: u.target.itemId!, variant: u.target.variant, set: Number(u.before.stock), reason: "count", note: "Business books import undone", by: c.actor, bookRef: `import:${importId}` }).catch(() => {});
    const det: Record<string, unknown> = {};
    for (const k of ["costKobo", "lowAt"] as const) if (u.before[k] !== undefined) det[k] = u.before[k];
    if (u.before.sku !== undefined && !u.target.variant) det.sku = u.before.sku;
    if (Object.keys(det).length) await db.doc(`inventory/${u.target.itemId}`).set(det, { merge: true });
  }
  // Customers: those it made go (unless something else was recorded for them since); the rest get their balance worked out again.
  for (const pid of new Set([...touched, ...madeParties])) {
    const left = (await db.collection("bookEntries").where("ownerUid", "==", owner).where("partyId", "==", pid).get()).docs.map(entryOf);
    if (madeParties.has(pid) && !left.length) await db.doc(`bookParties/${pid}`).delete();
    else await db.doc(`bookParties/${pid}`).set({ balanceKobo: left.filter((e) => e.kind === "sale" || e.kind === "opening").reduce((n, e) => n + openKobo(e), 0) }, { merge: true });
  }
  await ref.update({ status: "undone", undoneAt: iso(c.now), undoneBy: c.actor });
  return { removed: entries.size + items.size, restored: (imp.undo ?? []).length };
}
