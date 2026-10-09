import type { Firestore } from "firebase-admin/firestore";
import { safeFileName } from "./private-files";
import { loadRevenue } from "./revenue-server";
import { lagosDate } from "./team";
import {
  FinanceError, MAX_IMPORT_ROWS, MAX_RECEIPTS, RECEIPT_EXTENSIONS, RECEIPT_MAX_BYTES, cleanEntry, isBackdated, naira, summarize, windowStart,
  type CleanInput, type FinanceEntry, type FinanceInput, type Receipt,
} from "./finance";

// Server side of the money ledger (see lib/finance.ts for the rules in plain words). Collections: financeEntries (one document per
// entry) and financeLog (who did what, never edited). Both are server-only in firestore.rules.
export type Caller = { uid: string; email: string; owner: boolean; finance: boolean; product: boolean };

const COL = "financeEntries";
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new FinanceError(msg, status); };
const OLD = (today: string) => `Entries dated before ${windowStart(today)} are history: only the owner can add, change or void them.`;

async function log(db: Firestore, c: Caller, action: string, entryId: string, detail: string, now: Date) {
  await db.collection("financeLog").add({ at: now.toISOString(), byUid: c.uid, byEmail: c.email, action, entryId, detail: detail.slice(0, 400) });
}
const brief = (e: Pick<CleanInput, "kind" | "category" | "amountKobo" | "occurredOn" | "party">) => `${e.kind}/${e.category} ${naira(e.amountKobo)} on ${e.occurredOn} (${e.party})`;

function toEntry(id: string, d: FirebaseFirestore.DocumentData): FinanceEntry {
  return { ...(d as Omit<FinanceEntry, "id" | "receipts">), id, receipts: (d.receipts as Receipt[] | undefined) ?? [] };
}

export async function createEntry(db: Firestore, c: Caller, input: FinanceInput, now = new Date()): Promise<FinanceEntry> {
  need(c.finance, "Only the finance team can record entries.");
  const today = lagosDate(now);
  const e = cleanEntry(input, today);
  const backdated = isBackdated(e.occurredOn, today);
  need(!backdated || c.owner, OLD(today));
  const ref = db.collection(COL).doc();
  const doc = { ...e, receipts: [], status: "active", backdated, seeded: false, createdAt: now.toISOString(), createdByUid: c.uid, createdByEmail: c.email };
  await ref.set(doc);
  await log(db, c, "create", ref.id, brief(e) + (backdated ? " [backdated]" : ""), now);
  return toEntry(ref.id, doc);
}

export async function voidEntry(db: Firestore, c: Caller, id: string, reason: unknown, now = new Date()): Promise<void> {
  need(c.finance, "Only the finance team can void entries.");
  const why = String(reason ?? "").trim().slice(0, 300);
  need(why.length >= 3, "Say why it is being voided.", 400);
  const today = lagosDate(now);
  const ref = db.collection(COL).doc(String(id));
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That entry wasn't found.", 404);
    const e = toEntry(s.id, s.data()!);
    need(e.status === "active", "That entry is already voided.", 400);
    need(!isBackdated(e.occurredOn, today) || c.owner, OLD(today));
    t.update(ref, { status: "voided", voidedAt: now.toISOString(), voidedByUid: c.uid, voidedByEmail: c.email, voidReason: why, updatedAt: now.toISOString() });
  });
  await log(db, c, "void", ref.id, why, now);
}

// Owner only: correct an entry (any date). Receipts stay as they are.
export async function editEntry(db: Firestore, c: Caller, id: string, input: FinanceInput, now = new Date()): Promise<void> {
  need(c.owner, "Only the owner can change an existing entry. Void it and add a new one.");
  const today = lagosDate(now);
  const e = cleanEntry(input, today);
  const ref = db.collection(COL).doc(String(id));
  let before = "";
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That entry wasn't found.", 404);
    const old = toEntry(s.id, s.data()!);
    need(old.status === "active", "A voided entry can't be changed.", 400);
    before = brief(old);
    t.update(ref, { ...e, ...(e.kind === "payroll" ? {} : { period: null }), backdated: isBackdated(e.occurredOn, today), updatedAt: now.toISOString() });
  });
  await log(db, c, "edit", ref.id, `${before} → ${brief(e)}`, now);
}

// Owner only: past records in bulk. Every row is checked first and nothing is saved if any row is wrong; rows that already exist
// (same kind, date, amount, party and description) are skipped, so importing the same file twice is harmless.
export type ImportResult = { added: number; skipped: number };
const sig = (e: Pick<CleanInput, "kind" | "occurredOn" | "amountKobo" | "party" | "description">) => [e.kind, e.occurredOn, e.amountKobo, e.party.toLowerCase(), e.description.toLowerCase()].join("|");
export async function importEntries(db: Firestore, c: Caller, rows: unknown, now = new Date()): Promise<ImportResult> {
  need(c.owner, "Only the owner can import past records.");
  need(Array.isArray(rows) && rows.length > 0, "There are no rows to import.", 400);
  const list = rows as FinanceInput[];
  need(list.length <= MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} rows at a time.`, 400);
  const today = lagosDate(now);
  const clean: CleanInput[] = [];
  const problems: string[] = [];
  list.forEach((r, i) => {
    try { clean.push(cleanEntry(r, today)); } catch (err) { problems.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "not valid"}`); }
  });
  if (problems.length) throw new FinanceError(`Nothing was imported.\n${problems.slice(0, 10).join("\n")}${problems.length > 10 ? `\n…and ${problems.length - 10} more.` : ""}`);
  const existing = new Set((await db.collection(COL).where("status", "==", "active").get()).docs.map((d) => sig(toEntry(d.id, d.data()))));
  const fresh = clean.filter((e) => !existing.has(sig(e)));
  const batch = db.batch();
  for (const e of fresh) {
    batch.set(db.collection(COL).doc(), { ...e, receipts: [], status: "active", backdated: isBackdated(e.occurredOn, today), seeded: true, createdAt: now.toISOString(), createdByUid: c.uid, createdByEmail: c.email });
  }
  if (fresh.length) await batch.commit();
  await log(db, c, "import", "-", `${fresh.length} added, ${clean.length - fresh.length} already there`, now);
  return { added: fresh.length, skipped: clean.length - fresh.length };
}

// ---- receipts (private bucket; links are short-lived and only for people who may see the entry)
const TYPES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", csv: "text/csv", txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const extOf = (n: string) => (n.split(".").pop() || "").toLowerCase();

async function entryOf(db: Firestore, id: string): Promise<FinanceEntry> {
  const s = await db.collection(COL).doc(String(id)).get();
  need(s.exists, "That entry wasn't found.", 404);
  return toEntry(s.id, s.data()!);
}

export async function startReceipt(db: Firestore, c: Caller, id: string, file: { name?: unknown; size?: unknown }, presign: (key: string, type: string, size: number) => Promise<string>, now = new Date()) {
  need(c.finance, "Only the finance team can add receipts.");
  const e = await entryOf(db, id);
  need(e.status === "active", "That entry is voided.", 400);
  need(e.receipts.length < MAX_RECEIPTS, `An entry can hold ${MAX_RECEIPTS} files.`, 400);
  const name = String(file.name ?? "");
  const size = Number(file.size);
  const type = TYPES[extOf(name)];
  need(!!type && RECEIPT_EXTENSIONS.includes(extOf(name)), `Files can be ${RECEIPT_EXTENSIONS.join(", ")}.`, 400);
  need(Number.isFinite(size) && size > 0 && size <= RECEIPT_MAX_BYTES, `Each file can be up to ${RECEIPT_MAX_BYTES / 1024 / 1024} MB.`, 400);
  const key = `finance/${e.id}/${now.getTime()}-${safeFileName(name)}`;
  return { key, contentType: type, uploadUrl: await presign(key, type, size) };
}

export async function attachReceipt(db: Firestore, c: Caller, id: string, file: { key?: unknown; name?: unknown }, head: (key: string) => Promise<{ size: number } | null>, now = new Date()): Promise<void> {
  need(c.finance, "Only the finance team can add receipts.");
  const key = String(file.key ?? "");
  need(key.startsWith(`finance/${id}/`) && !key.includes(".."), "That file doesn't belong to this entry.", 400);
  const name = String(file.name ?? "").slice(0, 120) || "receipt";
  const type = TYPES[extOf(key)];
  need(!!type, "That file type isn't allowed.", 400);
  const obj = await head(key);
  need(!!obj, "The upload didn't arrive. Try again.", 400);
  need(obj!.size <= RECEIPT_MAX_BYTES, "That file is too large.", 400);
  const ref = db.collection(COL).doc(String(id));
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That entry wasn't found.", 404);
    const e = toEntry(s.id, s.data()!);
    need(e.receipts.length < MAX_RECEIPTS, `An entry can hold ${MAX_RECEIPTS} files.`, 400);
    need(!e.receipts.some((r) => r.key === key), "Already attached.", 400);
    t.update(ref, { receipts: [...e.receipts, { key, name, type, size: obj!.size, at: now.toISOString(), byEmail: c.email }] });
  });
  await log(db, c, "receipt", String(id), name, now);
}

export async function receiptLink(db: Firestore, c: Caller, id: string, index: number, sign: (key: string, name: string, type: string) => Promise<string>) {
  need(c.finance || c.product, "You don't have access to the ledger.");
  const e = await entryOf(db, id);
  need(e.kind !== "payroll" || c.finance, "Payroll records are for the finance team.");
  const r = e.receipts[index];
  need(!!r, "That file wasn't found.", 404);
  return { url: await sign(r.key, r.name, r.type), name: r.name, type: r.type };
}

// ---- reading
export type LedgerView = {
  me: { owner: boolean; canWrite: boolean; seesPayroll: boolean };
  window: { start: string; today: string };
  entries: FinanceEntry[];
  months: ReturnType<typeof summarize>["months"];
  categories: ReturnType<typeof summarize>["categories"];
  asOf: string;
};

// For people who can't see payroll lines: all payroll categories collapse into a single "Payroll" total.
function onePayrollRow(rows: LedgerView["categories"]): LedgerView["categories"] {
  const out = rows.filter((r) => r.kind !== "payroll");
  const pay = rows.filter((r) => r.kind === "payroll");
  if (pay.length) out.push({ kind: "payroll", category: "payroll", label: "Payroll", kobo: pay.reduce((n, r) => n + r.kobo, 0), count: pay.reduce((n, r) => n + r.count, 0) });
  return out.sort((a, b) => b.kobo - a.kobo);
}

// Everything the ledger page shows. Totals include payroll for everyone who can open the ledger; the payroll lines themselves (who was
// paid, how much, which receipts) only go to finance and super admins.
export async function ledgerView(db: Firestore, c: Caller, now = new Date()): Promise<LedgerView> {
  need(c.finance || c.product, "You don't have access to the ledger.");
  const [snap, rev] = await Promise.all([db.collection(COL).orderBy("occurredOn", "desc").limit(5000).get(), loadRevenue(db, 0)]);
  const all = snap.docs.map((d) => toEntry(d.id, d.data()));
  const platform = Object.fromEntries(rev.report.series.map((s) => [s.key, s.revenueKobo]));
  const { months, categories } = summarize(all, platform);
  const today = lagosDate(now);
  return {
    me: { owner: c.owner, canWrite: c.finance, seesPayroll: c.finance },
    window: { start: windowStart(today), today },
    entries: c.finance ? all : all.filter((e) => e.kind !== "payroll"),
    months,
    categories: c.finance ? categories : onePayrollRow(categories),
    asOf: rev.asOf,
  };
}

export async function financeLog(db: Firestore, limit = 30) {
  const s = await db.collection("financeLog").orderBy("at", "desc").limit(limit).get();
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as { at: string; byEmail: string; action: string; detail: string; entryId: string }) }));
}
