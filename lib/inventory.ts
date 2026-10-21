// Inventory (owner, 21 Oct 2026): a seller's stock in one place. Pure: the rules, the numbers and the spreadsheet format; the server side is
// lib/inventory-server.ts and the page /profile/inventory.
//
// - Who has it: included on Business and Enterprise; Free Basic and Pro add it (lib/pricing.ts inventory: ₦1,500 a month) after a one-time
//   free trial of up to 15 days (lib/trials.ts).
// - What it adds to the store's stock (storeItems.stock and variantStock, which orders already reserve and release): a SKU per item and per
//   option, a cost price, a low-stock level with an alert, a history of every change (sales, refunds, restocks, corrections) and
//   spreadsheet export and import.
// - Stored server-only, because store items are public: inventory/{itemId} { ownerUid, sku, variantSku, costKobo, lowAt } and
//   inventoryMoves/{id} { ownerUid, itemId, variant?, delta, after, reason, note?, by, at, orderRef? }.
import { addonTrialDays } from "./trials";

export const DEFAULT_LOW_AT = 3;
export const MOVE_REASONS = [
  { id: "restock", label: "Restocked" },
  { id: "sale", label: "Sold" },
  { id: "return", label: "Returned or refunded" },
  { id: "count", label: "Stock count correction" },
  { id: "damaged", label: "Damaged or lost" },
  { id: "other", label: "Other" },
] as const;
export type MoveReason = (typeof MOVE_REASONS)[number]["id"];
// What a seller can record by hand (sales and refunds are recorded by orders).
export const MANUAL_REASONS: MoveReason[] = ["restock", "count", "damaged", "return", "other"];
export const isManualReason = (v: unknown): v is MoveReason => MANUAL_REASONS.includes(v as MoveReason);
export const reasonLabel = (r: string) => MOVE_REASONS.find((x) => x.id === r)?.label ?? r;

export type InventoryDoc = { ownerUid: string; sku: string; variantSku: Record<string, string>; costKobo: number; lowAt: number };
export type Move = { id?: string; ownerUid: string; itemId: string; variant?: string; delta: number; after: number; reason: MoveReason; note?: string; by: string; at: string; orderRef?: string };

// ---- Who has it ----
export type InventoryAccount = { trialStartedAt?: string; addonUntil?: string };
export type InventoryAccess = { ok: true; via: "plan" | "addon" | "trial"; until?: string } | { ok: false; canTrial: boolean };
export function inventoryAccess(tier: string, acc: InventoryAccount | undefined, now: Date, trialDays: number): InventoryAccess {
  if (tier === "business" || tier === "enterprise") return { ok: true, via: "plan" };
  if (tier !== "basic" && tier !== "pro") return { ok: false, canTrial: false };
  if (acc?.addonUntil && new Date(acc.addonUntil) > now) return { ok: true, via: "addon", until: acc.addonUntil };
  if (acc?.trialStartedAt) {
    const until = new Date(new Date(acc.trialStartedAt).getTime() + addonTrialDays(trialDays) * 86_400_000);
    if (until > now) return { ok: true, via: "trial", until: until.toISOString() };
  }
  return { ok: false, canTrial: !acc?.trialStartedAt };
}
// A paid month runs on from what's left of the trial or the month already paid, so paying early loses nothing.
export function addonExtendedUntil(acc: InventoryAccount | undefined, now: Date, trialDays: number): string {
  const trialEnd = acc?.trialStartedAt ? new Date(acc.trialStartedAt).getTime() + addonTrialDays(trialDays) * 86_400_000 : 0;
  const from = Math.max(now.getTime(), acc?.addonUntil ? new Date(acc.addonUntil).getTime() : 0, trialEnd);
  return new Date(from + 31 * 86_400_000).toISOString();
}

// ---- Cleaning what a seller sends ----
export const cleanSku = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9._\-/]/g, "-").replace(/-{2,}/g, "-").slice(0, 40);
export const cleanLowAt = (v: unknown) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, 100_000) : DEFAULT_LOW_AT; };
export const cleanCostKobo = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, 1_000_000_000) : 0; };
export function inventoryDocOf(raw: unknown, ownerUid: string): InventoryDoc {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const vs = (o.variantSku && typeof o.variantSku === "object" ? o.variantSku : {}) as Record<string, unknown>;
  const variantSku: Record<string, string> = {};
  for (const [k, v] of Object.entries(vs).slice(0, 400)) { const s = cleanSku(v); if (s) variantSku[k.slice(0, 80)] = s; }
  return { ownerUid, sku: cleanSku(o.sku), variantSku, costKobo: cleanCostKobo(o.costKobo), lowAt: o.lowAt === undefined ? DEFAULT_LOW_AT : cleanLowAt(o.lowAt) };
}

// ---- The numbers ----
export type StockLine = { itemId: string; title: string; variant?: string; sku: string; stock: number; lowAt: number; costKobo: number; priceKobo: number };
export type StockState = "out" | "low" | "ok";
export const stockState = (stock: number, lowAt: number): StockState => (stock <= 0 ? "out" : stock <= lowAt ? "low" : "ok");
// One line per item, or per option of an item with options.
export function stockLines(items: { id: string; title: string; stock?: number; variantStock?: Record<string, number>; priceKobo?: number }[], inv: Record<string, InventoryDoc | undefined>): StockLine[] {
  const out: StockLine[] = [];
  for (const it of items) {
    const d = inv[it.id];
    const base = { itemId: it.id, title: it.title, lowAt: d?.lowAt ?? DEFAULT_LOW_AT, costKobo: d?.costKobo ?? 0, priceKobo: it.priceKobo ?? 0 };
    const vs = it.variantStock && Object.keys(it.variantStock).length ? it.variantStock : null;
    if (vs) for (const [v, n] of Object.entries(vs)) out.push({ ...base, variant: v, sku: d?.variantSku[v] || (d?.sku ? cleanSku(`${d.sku}-${v.replace(/\|/g, "-")}`) : ""), stock: Math.max(0, Number(n) || 0) });
    else out.push({ ...base, sku: d?.sku ?? "", stock: Math.max(0, Number(it.stock) || 0) });
  }
  return out;
}
export function summary(lines: StockLine[]) {
  return {
    lines: lines.length,
    units: lines.reduce((n, l) => n + l.stock, 0),
    costKobo: lines.reduce((n, l) => n + l.stock * l.costKobo, 0),
    retailKobo: lines.reduce((n, l) => n + l.stock * l.priceKobo, 0),
    low: lines.filter((l) => stockState(l.stock, l.lowAt) === "low").length,
    out: lines.filter((l) => l.stock <= 0).length,
  };
}
// A sale that takes the stock to the low-stock level or below (from above it) is worth an alert; out of stock always is.
export const crossedLow = (before: number, after: number, lowAt: number) => after < before && ((before > lowAt && after <= lowAt) || (before > 0 && after <= 0));

// ---- Spreadsheet (CSV) ----
export const CSV_HEADER = ["item_id", "title", "option", "sku", "stock", "low_stock_at", "cost_naira", "price_naira"];
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // a spreadsheet must not run it as a formula
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(lines: StockLine[]): string {
  const rows = lines.map((l) => [l.itemId, l.title, l.variant ?? "", l.sku, l.stock, l.lowAt, (l.costKobo / 100).toFixed(2), (l.priceKobo / 100).toFixed(2)]);
  return [CSV_HEADER, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
// An import: each row names an item (by item_id, or by SKU) and option, and sets any of stock, SKU, low-stock level and cost (the
// low-stock level and cost belong to the item, so on an item with options the last row for it wins). Rows that
// can't be matched or make no change come back as problems, so the seller sees them before anything is saved.
export type ImportChange = { itemId: string; variant?: string; stock?: number; sku?: string; lowAt?: number; costKobo?: number };
export function planImport(text: string, lines: StockLine[]): { changes: ImportChange[]; problems: string[] } {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const problems: string[] = [], changes: ImportChange[] = [];
  if (!rows.length) return { changes, problems: ["The file is empty."] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  if (col("item_id") < 0 && col("sku") < 0) return { changes, problems: ["The first row needs the column names, with item_id or sku (download the spreadsheet to see them)."] };
  const num = (s: string | undefined) => (s === undefined || s.trim() === "" ? undefined : Number(s.replace(/[₦,\s]/g, "")));
  rows.slice(1, 2001).forEach((r, n) => {
    const at = `Row ${n + 2}`;
    const get = (k: string) => (col(k) >= 0 ? (r[col(k)] ?? "").trim() : undefined);
    const id = get("item_id"), sku = get("sku") ? cleanSku(get("sku")) : "", option = get("option") ?? "";
    const line = lines.find((l) => (id ? l.itemId === id && (l.variant ?? "") === option : !!sku && l.sku === sku));
    if (!line) return problems.push(`${at}: no item ${id ? `with id ${id}${option ? ` and option ${option}` : ""}` : `with SKU ${sku}`}.`);
    const c: ImportChange = { itemId: line.itemId, ...(line.variant ? { variant: line.variant } : {}) };
    const stock = num(get("stock"));
    if (stock !== undefined) { if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return problems.push(`${at}: stock should be a whole number, 0 or more.`); if (stock !== line.stock) c.stock = stock; }
    if (id && sku && sku !== line.sku) c.sku = sku;
    const low = num(get("low_stock_at"));
    if (low !== undefined) { if (!Number.isInteger(low) || low < 0) return problems.push(`${at}: low_stock_at should be a whole number.`); if (low !== line.lowAt) c.lowAt = low; }
    const cost = num(get("cost_naira"));
    if (cost !== undefined) { if (!Number.isFinite(cost) || cost < 0) return problems.push(`${at}: cost_naira should be an amount in naira.`); const k = Math.round(cost * 100); if (k !== line.costKobo) c.costKobo = k; }
    if (Object.keys(c).length > (line.variant ? 2 : 1)) changes.push(c);
  });
  return { changes, problems };
}
