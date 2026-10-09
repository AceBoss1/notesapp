// The money ledger in the team hub: what the company spends (expenses and payroll) and what comes in that isn't already counted
// as platform revenue (grants, sponsorships, direct transfers). Pure and client-safe; the server side is lib/finance-server.ts.
//
// Who may do what:
//   - Finance (and super admins) record entries dated today or up to BACKDATE_DAYS (3) ago, attach receipts to any entry, and void
//     a recent entry with a reason.
//   - Product (and finance) read everything except payroll, which only finance and super admins see.
//   - The owner alone enters older (backdated) entries, edits or voids history, and imports past records in bulk.
//   - Nothing is ever deleted: a voided entry stays in the list with who voided it and why.
import { addDays } from "./team";

export type EntryKind = "income" | "expense" | "payroll";
export const KIND_LABEL: Record<EntryKind, string> = { income: "Money in", expense: "Expense", payroll: "Payroll" };

export const CATEGORIES: Record<EntryKind, { key: string; label: string }[]> = {
  income: [
    { key: "grant", label: "Grant or funding" },
    { key: "sponsorship", label: "Sponsorship or partnership" },
    { key: "direct", label: "Direct sale or bank transfer" },
    { key: "refund", label: "Refund received" },
    { key: "other_income", label: "Other income" },
  ],
  expense: [
    { key: "hosting", label: "Hosting and software" },
    { key: "fees", label: "Payment and bank fees" },
    { key: "marketing", label: "Marketing and advertising" },
    { key: "contractors", label: "Contractors and freelancers" },
    { key: "legal", label: "Legal, tax and compliance" },
    { key: "domains", label: "Domains and registrar credit" },
    { key: "equipment", label: "Equipment" },
    { key: "office", label: "Office, travel and meals" },
    { key: "other_expense", label: "Other expense" },
  ],
  payroll: [
    { key: "salary", label: "Salary" },
    { key: "bonus", label: "Bonus" },
    { key: "pension_tax", label: "Pension and tax remittance" },
    { key: "benefits", label: "Benefits and allowances" },
  ],
};
export const categoryLabel = (kind: EntryKind, key: string) => CATEGORIES[kind].find((c) => c.key === key)?.label ?? key;

// Entries dated within this many days of today are ordinary; older ones are backdated and need the owner.
export const BACKDATE_DAYS = 3;
export const MAX_AMOUNT_KOBO = 100_000_000_00; // ₦100 million per entry: a typo guard, not a business limit
export const MAX_RECEIPTS = 5;
export const MAX_IMPORT_ROWS = 500;
export const RECEIPT_MAX_BYTES = 15 * 1024 * 1024;
export const RECEIPT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "xlsx", "csv", "docx", "txt"];

export type Receipt = { key: string; name: string; type: string; size: number; at: string; byEmail: string };
export type FinanceEntry = {
  id: string;
  kind: EntryKind;
  category: string;
  amountKobo: number; // always positive; the kind says which way the money went
  occurredOn: string; // YYYY-MM-DD, Lagos
  party: string; // the vendor, the person paid, or where the money came from
  description: string;
  period?: string; // payroll only: the month it pays for, YYYY-MM
  receipts: Receipt[];
  status: "active" | "voided";
  backdated: boolean; // entered by the owner for a date outside the normal window
  seeded: boolean; // came in through a bulk import
  createdAt: string;
  createdByEmail: string;
  updatedAt?: string;
  voidedAt?: string;
  voidedByEmail?: string;
  voidReason?: string;
};

export type FinanceInput = { kind?: unknown; category?: unknown; amount?: unknown; amountKobo?: unknown; occurredOn?: unknown; party?: unknown; description?: unknown; period?: unknown };
export type CleanInput = { kind: EntryKind; category: string; amountKobo: number; occurredOn: string; party: string; description: string; period?: string };

export class FinanceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const isKind = (k: unknown): k is EntryKind => k === "income" || k === "expense" || k === "payroll";
export const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
export const isMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

// ₦12,500.50 (two decimals only when there are kobo).
export const naira = (kobo: number) => `${kobo < 0 ? "−" : ""}₦${(Math.abs(kobo) / 100).toLocaleString("en-NG", { minimumFractionDigits: kobo % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// "₦12,500.50", "12500.5" and 12500.5 all become 1250050 kobo. Anything that isn't a clear positive amount is refused.
export function toKobo(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[₦,\s]|NGN/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const k = Math.round(Number(s) * 100);
  return k > 0 ? k : null;
}

// The oldest date an ordinary (non-owner) entry may carry today.
export const windowStart = (today: string) => addDays(today, -BACKDATE_DAYS);
export const isBackdated = (occurredOn: string, today: string) => occurredOn < windowStart(today);

// Validates and tidies one entry. `today` is the Lagos date. Dates in the future are refused for everyone.
export function cleanEntry(input: FinanceInput, today: string): CleanInput {
  if (!isKind(input.kind)) throw new FinanceError("Choose money in, expense or payroll.");
  const kind = input.kind;
  const category = String(input.category ?? "");
  if (!CATEGORIES[kind].some((c) => c.key === category)) throw new FinanceError("Choose a category from the list.");
  const amountKobo = input.amountKobo !== undefined ? Number(input.amountKobo) : toKobo(input.amount);
  if (!amountKobo || !Number.isInteger(amountKobo) || amountKobo <= 0) throw new FinanceError("Enter the amount in naira, for example 12500 or 12,500.50.");
  if (amountKobo > MAX_AMOUNT_KOBO) throw new FinanceError("That amount looks too large. Check for an extra zero.");
  if (!isDate(input.occurredOn)) throw new FinanceError("Enter the date the money moved.");
  if (input.occurredOn > today) throw new FinanceError("The date can't be in the future.");
  const party = String(input.party ?? "").trim().slice(0, 120);
  if (!party) throw new FinanceError(kind === "income" ? "Say where the money came from." : kind === "payroll" ? "Say who was paid." : "Say who was paid (the vendor).");
  const description = String(input.description ?? "").trim().slice(0, 500);
  let period: string | undefined;
  if (kind === "payroll") {
    period = String(input.period || input.occurredOn.slice(0, 7));
    if (!isMonth(period)) throw new FinanceError("Enter the payroll month as YYYY-MM.");
  }
  return { kind, category, amountKobo, occurredOn: input.occurredOn, party, description, ...(period ? { period } : {}) };
}

export type Viewer = { owner: boolean; finance: boolean };
// Payroll lines are for finance and super admins only; Product sees only the total.
export const seesPayroll = (v: Pick<Viewer, "finance">) => v.finance;

export type Month = { month: string; platformKobo: number; otherIncomeKobo: number; expenseKobo: number; payrollKobo: number; netKobo: number };
export type CategoryRow = { kind: EntryKind; category: string; label: string; kobo: number; count: number };

// Sums active entries per month (and per category). Platform revenue comes from lib/revenue.ts and is added to the money-in side.
export function summarize(entries: FinanceEntry[], platformByMonth: Record<string, number> = {}): { months: Month[]; categories: CategoryRow[] } {
  const by = new Map<string, Month>();
  const month = (m: string) => {
    let r = by.get(m);
    if (!r) by.set(m, (r = { month: m, platformKobo: platformByMonth[m] ?? 0, otherIncomeKobo: 0, expenseKobo: 0, payrollKobo: 0, netKobo: 0 }));
    return r;
  };
  for (const m of Object.keys(platformByMonth)) month(m);
  const cats = new Map<string, CategoryRow>();
  for (const e of entries) {
    if (e.status !== "active") continue;
    const r = month(e.occurredOn.slice(0, 7));
    if (e.kind === "income") r.otherIncomeKobo += e.amountKobo;
    else if (e.kind === "expense") r.expenseKobo += e.amountKobo;
    else r.payrollKobo += e.amountKobo;
    const ck = `${e.kind}:${e.category}`;
    const c = cats.get(ck) ?? { kind: e.kind, category: e.category, label: categoryLabel(e.kind, e.category), kobo: 0, count: 0 };
    c.kobo += e.amountKobo;
    c.count += 1;
    cats.set(ck, c);
  }
  const months = [...by.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  for (const r of months) r.netKobo = r.platformKobo + r.otherIncomeKobo - r.expenseKobo - r.payrollKobo;
  return { months, categories: [...cats.values()].sort((a, b) => b.kobo - a.kobo) };
}

// ---- CSV (the owner's bulk import)
export const CSV_HEADER = "kind,date,amount,category,party,description,period";
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}
// Category cells may use the key or the label ("Hosting and software" or "hosting").
export function csvToInputs(text: string): FinanceInput[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const body = /^kind$/.test(head[0]) ? rows.slice(1) : rows;
  const idx = (n: string, fallback: number) => (head.includes(n) ? head.indexOf(n) : fallback);
  const [ik, id, ia, ic, ip, ides, iper] = [idx("kind", 0), idx("date", 1), idx("amount", 2), idx("category", 3), idx("party", 4), idx("description", 5), idx("period", 6)];
  return body.map((r) => {
    const kind = String(r[ik] ?? "").trim().toLowerCase().replace(/^money in$/, "income");
    const cat = String(r[ic] ?? "").trim();
    const list = isKind(kind) ? CATEGORIES[kind] : [];
    const found = list.find((c) => c.key === cat.toLowerCase() || c.label.toLowerCase() === cat.toLowerCase());
    return { kind, category: found?.key ?? cat, amount: String(r[ia] ?? "").trim(), occurredOn: String(r[id] ?? "").trim(), party: r[ip] ?? "", description: r[ides] ?? "", period: String(r[iper] ?? "").trim() || undefined };
  });
}
export const csvCell = (v: string | number) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
