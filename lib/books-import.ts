// Business books imports (docs/BUSINESS-BOOKS.md section 3): one wizard for every kind. Pure: the column matching (guessed from the
// headings, or a preset such as Tralo's exports), reading each row into a clean record, the duplicate keys and the templates. The server
// (lib/books-server.ts) runs the dry run and the import, and keeps each import's id so it can be undone for 24 hours.
//
// CSV only (owner, 2 Nov 2026): no Excel library. Excel and Google Sheets save as CSV (the help article shows how).
import { parseCsv } from "./inventory";
import { BOOKS_IMPORT_MAX_BYTES, BOOKS_IMPORT_MAX_ROWS, DEFAULT_CATEGORIES, cleanText, isDay, toKobo, waPhone, type Method } from "./books";

export type ImportKind = "stock" | "sales" | "expenses" | "customers";
export const IMPORT_KINDS: { id: ImportKind; label: string; hint: string }[] = [
  { id: "stock", label: "Stock list", hint: "Items, prices, cost prices and how many you have" },
  { id: "sales", label: "Sales", hint: "Past sales, with credit sales becoming money owed" },
  { id: "expenses", label: "Expenses", hint: "What you spent, by category" },
  { id: "customers", label: "Customers and debtors", hint: "Names, phone numbers and what they owe you" },
];
export const isImportKind = (v: unknown): v is ImportKind => IMPORT_KINDS.some((k) => k.id === v);

// Each kind's fields, and the headings that usually mean them (lower case, with spaces and punctuation taken out when compared).
type Field = { id: string; label: string; required?: boolean; words: string[] };
export const FIELDS: Record<ImportKind, Field[]> = {
  stock: [
    { id: "name", label: "Item name", required: true, words: ["name", "item", "item name", "product", "product name", "title", "description"] },
    { id: "sku", label: "SKU (to match)", words: ["sku", "barcode", "code", "item code", "product code", "item_id"] },
    { id: "category", label: "Category", words: ["category", "group", "type"] },
    { id: "price", label: "Price (₦)", words: ["price", "selling price", "sale price", "unit price", "retail price", "price naira", "price_naira"] },
    { id: "cost", label: "Cost price (₦)", words: ["cost", "cost price", "buying price", "purchase price", "cost naira", "cost_naira", "unit cost"] },
    { id: "stock", label: "Stock", words: ["stock", "qty", "quantity", "stock quantity", "in stock", "quantity in stock", "count", "on hand"] },
    { id: "unit", label: "Unit", words: ["unit", "uom", "unit of measure"] },
    { id: "lowAt", label: "Low-stock level", words: ["low stock", "low stock at", "low_stock_at", "reorder level", "reorder point", "alert at", "minimum"] },
  ],
  sales: [
    { id: "date", label: "Date", required: true, words: ["date", "sale date", "day", "created", "created at", "sold on"] },
    { id: "time", label: "Time", words: ["time"] },
    { id: "item", label: "Item or description", required: true, words: ["item", "product", "product name", "product_name", "description", "details", "name", "title", "what"] },
    { id: "qty", label: "Quantity", words: ["qty", "quantity", "units", "count"] },
    { id: "unitPrice", label: "Price each (₦)", words: ["unit price", "unit_price", "price", "rate", "price each"] },
    { id: "total", label: "Total (₦)", words: ["total", "amount", "total amount", "sale amount", "value"] },
    { id: "paid", label: "Amount paid (₦)", words: ["paid", "amount paid", "amount_paid", "deposit", "paid now"] },
    { id: "method", label: "Paid how", words: ["payment method", "payment_method", "method", "paid by", "payment", "mode"] },
    { id: "customer", label: "Customer", words: ["customer", "customer name", "customer_name", "buyer", "client"] },
    { id: "phone", label: "Customer phone", words: ["phone", "customer phone", "customer_phone", "mobile", "phone number", "whatsapp"] },
    { id: "dueOn", label: "Due date", words: ["due", "due date", "due_date", "pay by"] },
    { id: "note", label: "Note", words: ["note", "notes", "remark", "remarks", "comment"] },
  ],
  expenses: [
    { id: "date", label: "Date", required: true, words: ["date", "day", "paid on", "expense date"] },
    { id: "amount", label: "Amount (₦)", required: true, words: ["amount", "total", "cost", "value", "spent"] },
    { id: "category", label: "Category", words: ["category", "type", "group", "account"] },
    { id: "description", label: "Description", words: ["description", "details", "item", "what", "note", "notes", "narration", "memo"] },
    { id: "method", label: "Paid how", words: ["payment method", "method", "paid by", "payment", "mode"] },
  ],
  customers: [
    { id: "name", label: "Name", required: true, words: ["name", "customer", "customer name", "full name", "client"] },
    { id: "phone", label: "Phone", words: ["phone", "mobile", "phone number", "whatsapp", "number"] },
    { id: "owes", label: "Owes you (₦)", words: ["owes", "balance", "amount owed", "debt", "outstanding", "owing"] },
    { id: "dueOn", label: "Due date", words: ["due", "due date", "pay by"] },
    { id: "note", label: "Note", words: ["note", "notes", "for", "what for", "description"] },
  ],
};
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const fieldLabel = (kind: ImportKind, id: string) => FIELDS[kind].find((f) => f.id === id)?.label ?? "Don't import";

// Presets: an app's own export, whose headings we know. Tralo's (tralo.app, read 1 Nov 2026): inventory "Product Name, Category, Cost
// Price, Selling Price, Stock Quantity, Unit"; sales "date, time, product_name, quantity, unit_price, customer_name, customer_phone,
// payment_method, amount_paid, apply_taxes, notes".
export type Preset = { id: string; label: string; kind: ImportKind; columns: Record<string, string> };
export const PRESETS: Preset[] = [
  { id: "tralo-stock", label: "Tralo inventory export", kind: "stock", columns: { "Product Name": "name", Category: "category", "Cost Price": "cost", "Selling Price": "price", "Stock Quantity": "stock", Unit: "unit" } },
  { id: "tralo-sales", label: "Tralo sales export", kind: "sales", columns: { date: "date", time: "time", product_name: "item", quantity: "qty", unit_price: "unitPrice", customer_name: "customer", customer_phone: "phone", payment_method: "method", amount_paid: "paid", apply_taxes: "", notes: "note" } },
];
export const presetOf = (id: unknown) => PRESETS.find((p) => p.id === id);

// The column each heading goes into ("" = don't import): the preset's, else the closest heading words, each field used once.
export type Mapping = string[];
export function guessMapping(headers: string[], kind: ImportKind, preset?: Preset): Mapping {
  const used = new Set<string>();
  const out = headers.map(() => "");
  if (preset && preset.kind === kind) {
    const byHead = new Map(Object.entries(preset.columns).map(([h, f]) => [squash(h), f]));
    headers.forEach((h, i) => { const f = byHead.get(squash(h)); if (f && !used.has(f)) { out[i] = f; used.add(f); } });
    if (used.size) return out;
  }
  // Exact heading words first, then a heading that contains a field's word (longest words first, so "cost price" beats "price").
  const words = FIELDS[kind].flatMap((f) => f.words.map((w) => ({ f: f.id, w: squash(w) }))).sort((a, b) => b.w.length - a.w.length);
  headers.forEach((h, i) => { const s = squash(h); const hit = words.find((x) => x.w === s && !used.has(x.f)); if (hit) { out[i] = hit.f; used.add(hit.f); } });
  headers.forEach((h, i) => { if (out[i]) return; const s = squash(h); const hit = words.find((x) => x.w.length >= 3 && s.includes(x.w) && !used.has(x.f)); if (hit) { out[i] = hit.f; used.add(hit.f); } });
  return out;
}
export function cleanMapping(raw: unknown, headers: string[], kind: ImportKind): Mapping {
  const ids = new Set(FIELDS[kind].map((f) => f.id));
  const arr = Array.isArray(raw) ? raw : [];
  const used = new Set<string>();
  return headers.map((_, i) => { const f = String(arr[i] ?? ""); if (!ids.has(f) || used.has(f)) return ""; used.add(f); return f; });
}
export const missingRequired = (m: Mapping, kind: ImportKind) => FIELDS[kind].filter((f) => f.required && !m.includes(f.id)).map((f) => f.label);

// ---- Reading the file ----
export type Sheet = { headers: string[]; rows: string[][] };
export function readSheet(text: string): Sheet | { error: string } {
  if (text.length > BOOKS_IMPORT_MAX_BYTES) return { error: `That file is too big: up to ${BOOKS_IMPORT_MAX_BYTES / 1024 / 1024} MB. Split it, a year at a time.` };
  const all = parseCsv(text.replace(/^﻿/, ""));
  if (!all.length) return { error: "The file is empty." };
  const headers = all[0].map((h) => h.trim());
  if (!headers.some(Boolean)) return { error: "The first row needs the column headings." };
  const rows = all.slice(1);
  if (rows.length > BOOKS_IMPORT_MAX_ROWS) return { error: `That file has ${rows.length.toLocaleString("en-NG")} rows: up to ${BOOKS_IMPORT_MAX_ROWS.toLocaleString("en-NG")} at a time. Split it, a year at a time.` };
  return { headers, rows };
}

// Dates as people write them: 2026-10-12, 12/10/2026 and 12/10/26 (day first, as in Nigeria and Ghana), 12-10-2026, 12 Oct 2026, Oct 12 2026.
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseDay(v: string): string | null {
  const s = v.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ok = (y: number, m: number, d: number) => { const day = `${y < 100 ? 2000 + y : y}-${pad(m)}-${pad(d)}`; return isDay(day) ? day : null; };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ t].*)?$/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?: .*)?$/);
  if (m) return ok(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[ -]([a-z]{3})[a-z]*[ -](\d{2}|\d{4})$/);
  if (m && MON.includes(m[2])) return ok(+m[3], MON.indexOf(m[2]) + 1, +m[1]);
  m = s.match(/^([a-z]{3})[a-z]* (\d{1,2}) (\d{4})$/);
  if (m && MON.includes(m[1])) return ok(+m[3], MON.indexOf(m[1]) + 1, +m[2]);
  return null;
}
// How it was paid, in the words apps and people use. Credit means on credit (owed).
export function parseMethod(v: string): Method | "credit" | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (/credit|owe|later|debt/.test(s)) return "credit";
  if (/cash/.test(s)) return "cash";
  if (/pos|card|terminal/.test(s)) return "pos";
  if (/transfer|bank|mobile ?money|momo|ussd|opay|palmpay|moniepoint|kuda/.test(s)) return "transfer";
  return null;
}
const CEDIS = /gh[₵¢]|ghs|cedi/i;
const num = (v: string) => { const s = v.trim().replace(/[,\s]/g, ""); if (!s) return undefined; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
export const categoryFrom = (v: string): string => {
  const s = v.trim().toLowerCase();
  if (!s) return "other";
  const hit = DEFAULT_CATEGORIES.find((c) => c.id === s || c.label.toLowerCase() === s || c.label.toLowerCase().startsWith(s) || s.includes(c.id));
  return hit ? hit.id : cleanText(s, 40).replace(/[^a-z0-9 _-]/g, "").trim() || "other";
};

export type StockRow = { row: number; name: string; sku: string; category: string; priceKobo?: number; costKobo?: number; stock?: number; unit: string; lowAt?: number };
export type SaleRow = { row: number; on: string; at: string; title: string; qty: number; unitKobo: number; totalKobo: number; paidKobo: number; method: Method; customer: string; phone: string; dueOn?: string; note: string };
export type ExpenseRow = { row: number; on: string; amountKobo: number; category: string; description: string; method: Method };
export type CustomerRow = { row: number; name: string; phone: string; owesKobo: number; dueOn?: string; note: string };
export type RowOf<K extends ImportKind> = K extends "stock" ? StockRow : K extends "sales" ? SaleRow : K extends "expenses" ? ExpenseRow : CustomerRow;
export type Problem = { row: number; message: string };

// Every row into a clean record, or a problem the seller sees in the preview (nothing is saved until they choose Import).
export function readRows<K extends ImportKind>(sheet: Sheet, mapping: Mapping, kind: K, today: string): { rows: RowOf<K>[]; problems: Problem[] } {
  const rows: RowOf<K>[] = [], problems: Problem[] = [];
  const at = (r: string[], f: string) => { const i = mapping.indexOf(f); return i >= 0 ? String(r[i] ?? "").trim() : ""; };
  sheet.rows.forEach((r, n) => {
    const row = n + 2; // the heading is row 1
    if (!r.some((x) => x.trim())) return;
    const bad = (message: string) => { problems.push({ row, message }); };
    if (r.some((x, i) => mapping[i] && CEDIS.test(x))) return bad("Prices in cedis wait for cedi support (the Ghana launch). Use naira for now.");
    const money = (f: string, label: string, needed = false): number | undefined | null => {
      const v = at(r, f);
      if (!v) { if (needed) { bad(`${label} is empty.`); return null; } return undefined; }
      const k = toKobo(v);
      if (k === null) { bad(`${label} “${v.slice(0, 30)}” isn't an amount in naira.`); return null; }
      return k;
    };
    if (kind === "stock") {
      const name = cleanText(at(r, "name"), 120);
      if (!name) return bad("The item has no name.");
      const price = money("price", "Price"), cost = money("cost", "Cost price");
      if (price === null || cost === null) return;
      const st = num(at(r, "stock")), low = num(at(r, "lowAt"));
      if (st !== undefined && (!Number.isInteger(st) || st < 0 || st > 1_000_000)) return bad(`Stock is ${at(r, "stock")}. Stock is a whole number, 0 or more.`);
      if (low !== undefined && (!Number.isInteger(low) || low < 0)) return bad("The low-stock level should be a whole number.");
      rows.push({ row, name, sku: at(r, "sku").toUpperCase().replace(/[^A-Z0-9._\-/]/g, "-").slice(0, 40), category: cleanText(at(r, "category"), 40), ...(price !== undefined ? { priceKobo: price } : {}), ...(cost !== undefined ? { costKobo: cost } : {}), ...(st !== undefined ? { stock: st } : {}), unit: cleanText(at(r, "unit"), 20), ...(low !== undefined ? { lowAt: low } : {}) } as RowOf<K>);
    } else if (kind === "sales") {
      const on = parseDay(at(r, "date"));
      if (!on) return bad(`The date “${at(r, "date").slice(0, 20)}” isn't one we can read (try 2026-10-12 or 12/10/2026).`);
      if (on > today) return bad("The date is in the future.");
      const title = cleanText(at(r, "item"), 120);
      if (!title) return bad("The row has no item or description.");
      const q = num(at(r, "qty"));
      const qty = q === undefined ? 1 : q;
      if (!Number.isInteger(qty) || qty < 1 || qty > 100_000) return bad("The quantity should be a whole number, 1 or more.");
      const unit = money("unitPrice", "Price each"), total = money("total", "Total");
      if (unit === null || total === null) return;
      const totalKobo = total ?? (unit !== undefined ? unit * qty : undefined);
      if (totalKobo === undefined) return bad("The row needs a total or a price each.");
      const paid = money("paid", "Amount paid");
      if (paid === null) return;
      const m = parseMethod(at(r, "method"));
      const paidKobo = paid !== undefined ? Math.min(paid, totalKobo) : m === "credit" ? 0 : totalKobo;
      const customer = cleanText(at(r, "customer"), 80);
      if (paidKobo < totalKobo && !customer) return bad("A sale on credit needs the customer's name.");
      const dueRaw = at(r, "dueOn"), dueOn = dueRaw ? parseDay(dueRaw) : undefined;
      if (dueRaw && !dueOn) return bad("The due date isn't one we can read.");
      const time = at(r, "time").match(/^(\d{1,2}):(\d{2})/);
      const iso = new Date(Date.parse(`${on}T${time ? `${time[1].padStart(2, "0")}:${time[2]}` : "12:00"}:00+01:00`)).toISOString();
      rows.push({ row, on, at: iso, title, qty, unitKobo: unit ?? Math.round(totalKobo / qty), totalKobo, paidKobo, method: m && m !== "credit" ? m : "cash", customer, phone: waPhone(at(r, "phone")) ?? "", ...(dueOn ? { dueOn } : {}), note: cleanText(at(r, "note"), 200) } as RowOf<K>);
    } else if (kind === "expenses") {
      const on = parseDay(at(r, "date"));
      if (!on) return bad(`The date “${at(r, "date").slice(0, 20)}” isn't one we can read (try 2026-10-12 or 12/10/2026).`);
      if (on > today) return bad("The date is in the future.");
      const amount = money("amount", "Amount", true);
      if (amount === null || amount === undefined) return;
      if (amount === 0) return bad("The amount is 0.");
      const m = parseMethod(at(r, "method"));
      rows.push({ row, on, amountKobo: amount, category: categoryFrom(at(r, "category")), description: cleanText(at(r, "description"), 200), method: m && m !== "credit" ? m : "cash" } as RowOf<K>);
    } else {
      const name = cleanText(at(r, "name"), 80);
      if (!name) return bad("The customer has no name.");
      const owes = money("owes", "Owes you");
      if (owes === null) return;
      const dueRaw = at(r, "dueOn"), dueOn = dueRaw ? parseDay(dueRaw) : undefined;
      if (dueRaw && !dueOn) return bad("The due date isn't one we can read.");
      const rawPhone = at(r, "phone");
      const phone = rawPhone ? waPhone(rawPhone) : "";
      if (rawPhone && !phone) return bad(`The phone number “${rawPhone.slice(0, 20)}” doesn't look right.`);
      rows.push({ row, name, phone: phone ?? "", owesKobo: owes ?? 0, ...(dueOn ? { dueOn } : {}), note: cleanText(at(r, "note"), 200) } as RowOf<K>);
    }
  });
  return { rows, problems };
}

// ---- Duplicates (docs/BUSINESS-BOOKS.md: items by SKU then exact name; sales and expenses by date + amount + item or description;
// customers by phone, then exact name). A row that matches what's already in the books, or an earlier row in the same file, is skipped.
const low = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const saleKey = (on: string, totalKobo: number, title: string) => `${on}|${totalKobo}|${low(title)}`;
export const expenseKey = (on: string, amountKobo: number, text: string) => `${on}|${amountKobo}|${low(text)}`;
export const itemKeys = (sku: string, name: string) => ({ sku: sku ? sku.toUpperCase() : "", name: low(name) });
export const customerKey = (phone: string, name: string) => (phone ? `p:${phone}` : `n:${low(name)}`);
// Splits rows into new ones and duplicates, given the keys already in the books.
export function dedupe<T>(rows: T[], keyOf: (r: T) => string | string[], existing: Set<string>): { fresh: T[]; dupes: T[] } {
  const seen = new Set(existing), fresh: T[] = [], dupes: T[] = [];
  for (const r of rows) {
    const keys = ([] as string[]).concat(keyOf(r)).filter(Boolean);
    if (keys.some((k) => seen.has(k))) dupes.push(r);
    else { fresh.push(r); keys.forEach((k) => seen.add(k)); }
  }
  return { fresh, dupes };
}

// ---- Templates to download ----
export const TEMPLATES: Record<ImportKind, string[][]> = {
  stock: [["name", "sku", "category", "price_naira", "cost_naira", "stock", "unit", "low_stock_at"], ["Rice 10kg (Mama Gold)", "RICE-MG-10", "Foodstuff", "15000", "12800", "18", "bag", "3"]],
  sales: [["date", "time", "item", "quantity", "unit_price", "total", "amount_paid", "payment_method", "customer_name", "customer_phone", "due_date", "notes"], ["2026-10-12", "14:05", "Rice 10kg (Mama Gold)", "3", "15000", "45000", "20000", "cash", "Bisi Adebayo", "08031234567", "2026-10-26", ""]],
  expenses: [["date", "amount", "category", "description", "payment_method"], ["2026-10-12", "18000", "Power (diesel and NEPA)", "Diesel for the generator", "cash"]],
  customers: [["name", "phone", "owes", "due_date", "note"], ["Chinedu Okafor", "08031234567", "38500", "2026-10-27", "Ankara and garri"]],
};
const cell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csvOf = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
export const templateCsv = (kind: ImportKind) => csvOf(TEMPLATES[kind]);
