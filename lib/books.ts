// Business books (docs/BUSINESS-BOOKS.md): a seller's walk-in sales, expenses, money owed and profit, next to the online store. Pure: the
// rules, the money maths, the periods and the WhatsApp messages. The server side is lib/books-server.ts, imports are lib/books-import.ts,
// the page is /profile/books and the API /api/books.
//
// - Money is whole kobo everywhere (integers, never floats); dates are Lagos business days (YYYY-MM-DD) plus an ISO time.
// - Who has it: Free Basic, Pro, Business and Enterprise (members who can sell). Free Basic has caps (lib/pricing.ts books): walk-in sales
//   and expenses a month, customers owing at once, rows per import, and the P&L for a day or a week. Pro and above: no caps, and the month.
// - Honest numbers: sales recorded, expenses recorded and stock value are always separate numbers. Stock value is never added to sales,
//   profit or any headline.
import type { AccountTier } from "./users";

export const BOOKS_IMPORT_MAX_ROWS = 5_000;
export const BOOKS_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const BOOKS_IMPORTS_PER_DAY = 10;
export const BOOKS_UNDO_HOURS = 24;
export const MAX_RECEIPT_PHOTOS = 3;
export const RECEIPT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_PHOTO_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", pdf: "application/pdf" };
export const MAX_LINES = 50;
export const MAX_KOBO = 1_000_000_000 * 100; // ₦1 billion: a typo guard on any one amount
export const MAX_QTY = 100_000;

// ---- Kinds, methods, categories ----
// sale (walk-in, online or imported), refund (an online order refunded), expense, payment (a customer paying what they owe) and opening
// (an opening balance a customer already owed, from an import or typed in). Only sale, refund and expense are in the P&L.
export type EntryKind = "sale" | "refund" | "expense" | "payment" | "opening";
export type EntrySource = "walkin" | "online" | "import";
export type Method = "cash" | "transfer" | "pos" | "card" | "wallet";
export const SALE_METHODS: { id: Method; label: string }[] = [{ id: "cash", label: "Cash" }, { id: "transfer", label: "Transfer" }, { id: "pos", label: "POS" }];
export const EXPENSE_METHODS: { id: Method; label: string }[] = [...SALE_METHODS, { id: "card", label: "Card" }];
export const methodLabel = (m?: string) => ({ cash: "Cash", transfer: "Transfer", pos: "POS", card: "Card", wallet: "Wallet" } as Record<string, string>)[m ?? ""] ?? "—";
export const isMethod = (v: unknown, list = EXPENSE_METHODS): v is Method => list.some((m) => m.id === v);

export const DEFAULT_CATEGORIES: { id: string; label: string }[] = [
  { id: "stock", label: "Stock purchases" },
  { id: "rent", label: "Rent" },
  { id: "staff", label: "Staff pay" },
  { id: "power", label: "Power (diesel and NEPA)" },
  { id: "transport", label: "Transport and loading" },
  { id: "levies", label: "Market and LG levies" },
  { id: "data", label: "Data and airtime" },
  { id: "repairs", label: "Repairs" },
  { id: "supplies", label: "Salon or workshop supplies" },
  { id: "bank", label: "Bank and POS charges" },
  { id: "other", label: "Other" },
];
export const COMMISSION_LABEL = "#NotesApp commission (online orders)";
export const categoryLabel = (id: string | undefined, extra: { id: string; label: string }[] = []) =>
  [...DEFAULT_CATEGORIES, ...extra].find((c) => c.id === id)?.label ?? (id ? id : "Other");

// ---- Entries ----
// A line of a sale: an item from the store (itemId, and variant for an option), a Books-only item (bookItemId), or typed in. costKobo is
// the cost of ONE at the time of the sale; noCost marks a stocked item that has no cost price yet (so profit may be a little high).
export type Line = { itemId?: string; variant?: string; bookItemId?: string; title: string; qty: number; unitKobo: number; costKobo: number; noCost?: boolean };
export type Entry = {
  id: string; ownerUid: string; kind: EntryKind; source: EntrySource;
  on: string; at: string; by: string;
  lines: Line[]; totalKobo: number;
  paidKobo: number; method: Method; // what was paid now, and how
  owesKobo: number; settledKobo: number; open: boolean; // the part on credit, how much of it is paid back since, and whether any is left
  partyId?: string; partyName?: string; dueOn?: string;
  category?: string; note?: string; files?: { key: string; name: string; type: string; size: number }[];
  feeKobo?: number; // online orders: our commission on it (an expense line in the P&L)
  orderRef?: string; importId?: string; clientId?: string; receiptCode?: string;
  counts?: boolean; // counts toward Free Basic's monthly cap (walk-in sales and expenses)
  voidedAt?: string; voidedBy?: string; voidReason?: string;
};
export const openKobo = (e: Pick<Entry, "owesKobo" | "settledKobo" | "voidedAt">) => (e.voidedAt ? 0 : Math.max(0, (e.owesKobo || 0) - (e.settledKobo || 0)));
export const lineTotal = (l: Pick<Line, "qty" | "unitKobo">) => l.qty * l.unitKobo;
export const linesTotal = (lines: Pick<Line, "qty" | "unitKobo">[]) => lines.reduce((n, l) => n + lineTotal(l), 0);
export const linesCost = (lines: Pick<Line, "qty" | "costKobo">[]) => lines.reduce((n, l) => n + l.qty * (l.costKobo || 0), 0);

// ---- Naira and kobo ----
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// ₦45,000 / ₦45,000.50 / −₦18,000. Integers only in, so no float drift.
export function naira(kobo: number): string {
  const k = Math.round(kobo), neg = k < 0, a = Math.abs(k);
  const whole = Math.floor(a / 100), part = a % 100;
  return `${neg ? "−" : ""}₦${group(whole)}${part ? `.${String(part).padStart(2, "0")}` : ""}`;
}
// "₦1,500", "1500.5", "1,500" → kobo; anything else (words, two dots, negative) → null.
export function toKobo(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  const s = String(v ?? "").replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return Number(w) * 100 + Number((f + "00").slice(0, 2));
}

// ---- Lagos days and periods ----
// Lagos is UTC+1 all year (no daylight saving).
export const lagosDay = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10);
export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const shortDate = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
export const longDate = (day: string) => `${DAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]} ${Number(day.slice(8, 10))} ${MONTHS_LONG[Number(day.slice(5, 7)) - 1]}`;
export const weekdayOf = (day: string) => DAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type PeriodKind = "day" | "week" | "month";
export type Period = { kind: PeriodKind; start: string; end: string; label: string };
// The day, the week (Monday to Sunday) or the month holding `today`, moved back `back` periods.
export function periodOf(kind: PeriodKind, today: string, back = 0): Period {
  if (kind === "day") { const d = addDays(today, -back); return { kind, start: d, end: d, label: longDate(d) }; }
  if (kind === "week") {
    const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const start = addDays(today, -dow - 7 * back), end = addDays(start, 6);
    return { kind, start, end, label: `${shortDate(start)} – ${shortDate(end)}` };
  }
  let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - back;
  while (m < 1) { m += 12; y--; }
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1);
  return { kind, start, end, label: `${MONTHS_LONG[m - 1]} ${y}` };
}
export const inPeriod = (on: string, p: Pick<Period, "start" | "end">) => on >= p.start && on <= p.end;

// ---- Who has it, and the Free Basic caps ----
export type Caps = { freeEntries: number; freeCustomers: number; freeImportRows: number };
export type BooksAccess = { ok: true; unlimited: boolean; monthPnl: boolean; importRows: number } | { ok: false; reason: string };
export function booksAccess(tier: AccountTier | string, caps: Caps, suspended = false): BooksAccess {
  if (suspended) return { ok: false, reason: "This account is suspended." };
  if (tier === "pro" || tier === "business" || tier === "enterprise") return { ok: true, unlimited: true, monthPnl: true, importRows: BOOKS_IMPORT_MAX_ROWS };
  if (tier === "basic") return { ok: true, unlimited: false, monthPnl: false, importRows: Math.min(caps.freeImportRows, BOOKS_IMPORT_MAX_ROWS) };
  return { ok: false, reason: "Business books is for accounts that sell. Switching to Free Basic is free (Account → Plan)." };
}
// The month's count of walk-in sales and expenses (online orders, imports and customers paying back never count).
export type Usage = { month: string; entries: number };
export const usageFor = (u: Usage | undefined, month: string): number => (u && u.month === month ? u.entries : 0);
export type CapState = { unlimited: boolean; used: number; limit: number | null; left: number | null; full: boolean };
export function capState(access: BooksAccess, caps: Caps, used: number): CapState {
  if (!access.ok || access.unlimited) return { unlimited: true, used, limit: null, left: null, full: false };
  const left = Math.max(0, caps.freeEntries - used);
  return { unlimited: false, used, limit: caps.freeEntries, left, full: left === 0 };
}
export const countsTowardCap = (e: Pick<Entry, "kind" | "source">) => e.source === "walkin" && (e.kind === "sale" || e.kind === "expense");
// A new customer owing (one with nothing owed now) on Free Basic, when the cap is reached, is refused; existing ones can owe more.
export const canAddDebtor = (access: BooksAccess, caps: Caps, openCustomers: number, alreadyOwing: boolean) => !access.ok ? false : access.unlimited || alreadyOwing || openCustomers < caps.freeCustomers;

// ---- Paying back: first in, first out ----
// A payment of `amount` against a customer's open sales, oldest first. Returns how much goes to each, and anything paid over (credit).
export function settleFifo(open: { id: string; at: string; openKobo: number }[], amount: number): { applied: { id: string; kobo: number }[]; overKobo: number } {
  let left = amount;
  const applied: { id: string; kobo: number }[] = [];
  for (const e of [...open].sort((a, b) => a.at.localeCompare(b.at))) {
    if (left <= 0) break;
    const k = Math.min(left, e.openKobo);
    if (k > 0) { applied.push({ id: e.id, kobo: k }); left -= k; }
  }
  return { applied, overKobo: left };
}

// ---- Profit and loss ----
export type Pnl = {
  salesKobo: number; walkinKobo: number; onlineKobo: number; importedKobo: number; refundsKobo: number; costKobo: number;
  grossKobo: number; marginPct: number | null; expensesKobo: number; commissionKobo: number; netKobo: number;
  sales: number; expenses: number; onlineSales: number;
  byCategory: { id: string; label: string; kobo: number }[];
  noCostItems: number; // stocked items sold with no cost price yet
  best: { key: string; title: string; units: number; salesKobo: number; profitKobo: number }[];
};
export function pnl(entries: Entry[], extra: { id: string; label: string }[] = []): Pnl {
  const p: Pnl = { salesKobo: 0, walkinKobo: 0, onlineKobo: 0, importedKobo: 0, refundsKobo: 0, costKobo: 0, grossKobo: 0, marginPct: null, expensesKobo: 0, commissionKobo: 0, netKobo: 0, sales: 0, expenses: 0, onlineSales: 0, byCategory: [], noCostItems: 0, best: [] };
  const cats = new Map<string, number>();
  const best = new Map<string, Pnl["best"][number]>();
  const noCost = new Set<string>();
  for (const e of entries) {
    if (e.voidedAt) continue;
    if (e.kind === "sale") {
      p.salesKobo += e.totalKobo; p.sales++;
      if (e.source === "online") { p.onlineKobo += e.totalKobo; p.onlineSales++; } else if (e.source === "import") p.importedKobo += e.totalKobo; else p.walkinKobo += e.totalKobo;
      p.costKobo += linesCost(e.lines);
      p.commissionKobo += e.feeKobo ?? 0;
      for (const l of e.lines) {
        const key = l.itemId ? `i:${l.itemId}:${l.variant ?? ""}` : l.bookItemId ? `b:${l.bookItemId}` : `t:${l.title.trim().toLowerCase()}`;
        const b = best.get(key) ?? { key, title: l.title, units: 0, salesKobo: 0, profitKobo: 0 };
        b.units += l.qty; b.salesKobo += lineTotal(l); b.profitKobo += lineTotal(l) - l.qty * (l.costKobo || 0);
        best.set(key, b);
        if (l.noCost && (l.itemId || l.bookItemId)) noCost.add(key);
      }
    } else if (e.kind === "refund") {
      p.refundsKobo += e.totalKobo;
      p.costKobo -= linesCost(e.lines); // the goods came back
      p.commissionKobo -= e.feeKobo ?? 0; // our commission is refunded with it
    } else if (e.kind === "expense") {
      p.expensesKobo += e.totalKobo; p.expenses++;
      const c = e.category || "other";
      cats.set(c, (cats.get(c) ?? 0) + e.totalKobo);
    }
  }
  p.grossKobo = p.salesKobo - p.refundsKobo - p.costKobo;
  const net = p.salesKobo - p.refundsKobo;
  p.marginPct = net > 0 ? Math.round((p.grossKobo / net) * 1000) / 10 : null;
  p.byCategory = [...cats.entries()].map(([id, kobo]) => ({ id, label: categoryLabel(id, extra), kobo }));
  if (p.commissionKobo) p.byCategory.push({ id: "commission", label: COMMISSION_LABEL, kobo: p.commissionKobo });
  p.byCategory.sort((a, b) => b.kobo - a.kobo);
  p.netKobo = p.grossKobo - p.expensesKobo - p.commissionKobo;
  p.noCostItems = noCost.size;
  p.best = [...best.values()].sort((a, b) => b.units - a.units || b.salesKobo - a.salesKobo).slice(0, 10);
  return p;
}
// The change on the period before, as a whole percent (null when there's nothing to compare with).
export const changePct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

// ---- Cash in hand ----
// The drawer: the opening float, plus cash taken (walk-in sales and customers paying back), minus cash paid out (expenses). Transfer, POS
// and card money go to the bank, and online orders are paid out by #NotesApp, so none of that is in the drawer.
export type Cash = { floatKobo: number; inKobo: number; outKobo: number; drawerKobo: number; transferKobo: number; posKobo: number; onlineKobo: number };
export function cashInHand(entries: Entry[], floatKobo = 0): Cash {
  const c: Cash = { floatKobo, inKobo: 0, outKobo: 0, drawerKobo: 0, transferKobo: 0, posKobo: 0, onlineKobo: 0 };
  for (const e of entries) {
    if (e.voidedAt) continue;
    const received = e.kind === "sale" || e.kind === "payment" ? e.paidKobo : 0;
    if (e.kind === "sale" && e.source === "online") { c.onlineKobo += e.totalKobo; continue; }
    if (e.kind === "payment" && e.source === "online") { c.onlineKobo += e.totalKobo; continue; } // a debt paid online: held by #NotesApp, then paid out
    if (e.source === "import") continue; // the past isn't in today's drawer
    if (received) {
      if (e.method === "cash") c.inKobo += received;
      else if (e.method === "transfer") c.transferKobo += received;
      else if (e.method === "pos" || e.method === "card") c.posKobo += received;
    }
    if (e.kind === "expense" && e.method === "cash") c.outKobo += e.totalKobo;
  }
  c.drawerKobo = c.floatKobo + c.inKobo - c.outKobo;
  return c;
}

// ---- Money owed ----
export type Party = {
  id: string; ownerUid: string; kind: "customer" | "supplier"; name: string; phone?: string; memberUid?: string; memberUsername?: string;
  balanceKobo: number; dueOn?: string; note?: string; statementCode?: string; remindersOff?: boolean; lastRemindedAt?: string; lastRemindedOn?: string; lastRemindedBy?: string;
  createdAt: string; importId?: string;
};
export type Debtor = { party: Party; openKobo: number; overdueKobo: number; since: string; dueOn?: string; daysLate: number; what: string; entries: { id: string; on: string; openKobo: number; dueOn?: string; title: string }[] };
// One row per customer who owes, latest-due first among the late ones: late (longest first), then due soonest.
export function debtors(parties: Party[], open: Entry[], today: string): Debtor[] {
  const by = new Map<string, Entry[]>();
  for (const e of open) if (e.partyId && openKobo(e) > 0) by.set(e.partyId, [...(by.get(e.partyId) ?? []), e]);
  const rows: Debtor[] = [];
  for (const party of parties) {
    if (party.kind !== "customer") continue;
    const es = (by.get(party.id) ?? []).sort((a, b) => a.on.localeCompare(b.on));
    if (!es.length) continue;
    const owed = es.reduce((n, e) => n + openKobo(e), 0);
    const late = es.filter((e) => e.dueOn && e.dueOn < today);
    const due = es.map((e) => e.dueOn).filter((d): d is string => !!d).sort();
    const titles = [...new Set(es.flatMap((e) => (e.lines.length ? e.lines.map((l) => l.title) : [e.note || "Opening balance"])))];
    rows.push({
      party, openKobo: owed, overdueKobo: late.reduce((n, e) => n + openKobo(e), 0), since: es[0].on,
      dueOn: due[0], daysLate: late.length ? daysBetween(late.map((e) => e.dueOn!).sort()[0], today) : 0,
      what: titles.slice(0, 3).join(", ") + (titles.length > 3 ? "…" : ""),
      entries: es.map((e) => ({ id: e.id, on: e.on, openKobo: openKobo(e), dueOn: e.dueOn, title: e.lines.map((l) => (l.qty > 1 ? `${l.title} × ${l.qty}` : l.title)).join(", ") || e.note || "Opening balance" })),
    });
  }
  return rows.sort((a, b) => b.daysLate - a.daysLate || (a.dueOn ?? "9").localeCompare(b.dueOn ?? "9") || b.openKobo - a.openKobo);
}

// ---- WhatsApp (click to send) for customers who aren't on #NotesApp ----
// Owner's decision, 1 Nov 2026: receipts and reminders to non-members go by WhatsApp, opened on the seller's own phone with the message
// written, and every message ends with this line. `domain` is the primary domain (lib/host.ts ROOT_DOMAIN), never typed in here.
export const footnote = (domain: string) => `Sent with #NotesApp Business books. Keep your own books free: ${domain}/books`;
// A phone number for wa.me: digits only, with the country code. Nigerian numbers typed the local way (0803…) get 234.
export function waPhone(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const plus = s.startsWith("+") || s.startsWith("00");
  let d = s.replace(/\D/g, "");
  if (s.startsWith("00")) d = d.slice(2);
  if (!plus && /^0[789][01]\d{8}$/.test(d)) d = `234${d.slice(1)}`;
  else if (!plus && /^[789][01]\d{8}$/.test(d)) d = `234${d}`;
  if (d.startsWith("2340")) d = `234${d.slice(4)}`;
  return /^\d{8,15}$/.test(d) && (plus || d.startsWith("234")) ? d : null;
}
// 0803 ··· 4417: how a number is shown to the seller (never to anyone else).
export const maskPhone = (p?: string) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length >= 8 ? `${d.startsWith("234") ? `0${d.slice(3, 6)}` : d.slice(0, 4)} ··· ${d.slice(-4)}` : ""; };
export const firstName = (name: string) => name.trim().replace(/^(mama|papa|baba|aunty|auntie|uncle|alhaji|alhaja|chief|pastor|dr\.?|mr\.?|mrs\.?|miss|ms\.?|madam|iya|oga)\s+/i, "").split(/\s+/)[0] || name.trim();
export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

export function reminderText(m: { customer: string; shop: string; amountKobo: number; what: string; since: string; dueOn?: string; today: string; link: string; domain: string }): string {
  const due = m.dueOn ? (m.dueOn < m.today ? `, was due on ${shortDate(m.dueOn)}` : `, is due on ${shortDate(m.dueOn)}`) : "";
  return `Hello ${firstName(m.customer)}, a friendly reminder from ${m.shop}: ${naira(m.amountKobo)} for ${m.what}, since ${shortDate(m.since)}${due}. See the details: ${m.link}\n\n${footnote(m.domain)}`;
}
export function receiptText(m: { customer?: string; shop: string; totalKobo: number; what: string; paidKobo: number; method: Method; owesKobo: number; dueOn?: string; link: string; domain: string }): string {
  const hello = m.customer ? `Hello ${firstName(m.customer)}, thank you` : "Thank you";
  const paid = m.owesKobo > 0 ? `${m.paidKobo ? `${naira(m.paidKobo)} paid, ` : ""}${naira(m.owesKobo)} still to pay${m.dueOn ? ` by ${shortDate(m.dueOn)}` : ""}` : `paid by ${methodLabel(m.method).toLowerCase()}`;
  return `${hello} for buying from ${m.shop}. Your receipt: ${naira(m.totalKobo)} for ${m.what}, ${paid}. ${m.link}\n\n${footnote(m.domain)}`;
}
// What a sale was for, in a few words: "Rice 10kg × 3 and garri".
export function whatOf(lines: Pick<Line, "title" | "qty">[]): string {
  const t = lines.map((l) => (l.qty > 1 ? `${l.title} × ${l.qty}` : l.title));
  return t.length <= 2 ? t.join(" and ") : `${t.slice(0, 2).join(", ")} and ${t.length - 2} more`;
}

// ---- Cleaning what a seller sends ----
export const cleanText = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const cleanName = (v: unknown) => cleanText(v, 80);
// A whole number of units, 1 to 100,000.
export const cleanQty = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= MAX_QTY ? n : null; };
export const cleanKobo = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= MAX_KOBO ? n : null; };
export const cleanCategory = (v: unknown) => cleanText(v, 40).toLowerCase().replace(/[^a-z0-9 _-]/g, "").trim() || "other";

// ---- Staff and roles (docs/BUSINESS-BOOKS.md, step 10) ----
// The seller ("owner") and an organisation's admins ("admin") keep the books. A seller on a team plan can invite staff to their books
// (bookStaff/{owner}_{uid}): a Cashier records sales and payments received, sees the sales they recorded today, and prints or shares
// receipts; no profit, expenses, costs, exports or settings. A Manager does everything except settings and staff.
export type BooksRole = "owner" | "admin" | "manager" | "cashier";
export type StaffRole = "cashier" | "manager";
export const isStaffRole = (v: unknown): v is StaffRole => v === "cashier" || v === "manager";
export const ROLE_LABEL: Record<BooksRole, string> = { owner: "Owner", admin: "Admin", manager: "Manager", cashier: "Cashier" };
// Every action in /api/books, by what it touches.
export type BooksAct =
  | "home" | "pnl" | "sales" | "expenses" | "owed" | "customers" | "catalog" | "costs" | "imports" | "export" | "staffView"
  | "sale" | "payment" | "expense" | "purchase" | "void" | "party" | "supplier" | "remind" | "receipt" | "photo" | "import" | "nana" | "sync"
  | "settings" | "staff";
const CASHIER: BooksAct[] = ["home", "sales", "customers", "catalog", "sale", "payment", "party", "receipt", "void", "nana", "sync"];
export function can(role: BooksRole, act: BooksAct): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "manager") return act !== "settings" && act !== "staff";
  return CASHIER.includes(act);
}
export const roleRefusal = (role: BooksRole) =>
  role === "cashier" ? "Cashiers record sales and payments received. Ask the owner for anything else." : "Only the owner changes settings and staff.";
// Staff seats on the books by the OWNER's plan (lib/pricing.ts books.staffSeatsPro and staffSeatsBusiness): Business and Enterprise; Pro only when the admin
// sets seats for it (open question 4, unanswered: 0 by default); Free Basic never. null means no fixed limit.
export function staffSeats(tier: string, seats: { staffSeatsPro: number; staffSeatsBusiness: number }): number | null {
  if (tier === "enterprise") return null;
  if (tier === "business") return seats.staffSeatsBusiness;
  if (tier === "pro") return seats.staffSeatsPro;
  return 0;
}

// ---- Paying a debt online (payment kind "debt", docs/BUSINESS-BOOKS.md open question 5) ----
// The customer pays all or part of what they owe from their statement link, by card or transfer through Paystack. At least ₦100, and
// never more than they owe. Our commission follows lib/pricing.ts books.debtCommission: "store" (the seller's physical-goods rate,
// the same as a store sale, the default) or "none".
export const DEBT_MIN_KOBO = 100 * 100;
export function debtAmount(raw: unknown, owesKobo: number): { ok: true; kobo: number } | { ok: false; error: string } {
  const k = toKobo(raw);
  if (k === null || k <= 0) return { ok: false, error: "Enter how much you'd like to pay." };
  if (owesKobo <= 0) return { ok: false, error: "There's nothing to pay." };
  if (k > owesKobo) return { ok: false, error: `You owe ${naira(owesKobo)}. Enter that or less.` };
  if (k < Math.min(DEBT_MIN_KOBO, owesKobo)) return { ok: false, error: `The least you can pay online is ${naira(Math.min(DEBT_MIN_KOBO, owesKobo))}.` };
  return { ok: true, kobo: k };
}
export const debtCommissionKobo = (amountKobo: number, rate: number, rule: "store" | "none") => (rule === "none" ? 0 : Math.round(amountKobo * rate));
