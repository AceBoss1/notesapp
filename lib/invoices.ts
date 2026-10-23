import { addDays, weekStart } from "./team";

// Client invoices from billable hours (Team hub → Time → Invoices). The owner's rules (23 Oct 2026):
//   - One invoice per billable project and month, from APPROVED billable hours × the project's hourly rate, a line per week.
//   - Payment is due 14 days after it's sent. Paid with Paylony first (a one-time account to transfer to, or CardTap), then
//     Paystack (card), then a plain bank transfer that finance marks paid. Paid → money in on the money ledger.
//   - VAT (7.5%) only when it's switched on in Setup: off until NotesApp Technologies is confirmed VAT-registered.
//   - A sent invoice locks its hours: a week it bills can't be returned or reopened unless the invoice is voided first.
//   - One reminder to the client 3 days after the due date.
// Pure, shared by the page and the server (lib/invoices-server.ts).

export const PAY_DAYS = 14;
export const REMIND_AFTER_DAYS = 3;
export const VAT_RATE = 7.5;
export const VAT_BASIS = 1000; // VAT is in tenths of a percent, so 7.5% is 75

export class InvoiceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type PayMethod = "paylony" | "cardtap" | "paystack" | "bank";
export const PAY_LABEL: Record<PayMethod, string> = { paylony: "Paylony bank transfer", cardtap: "Paylony CardTap", paystack: "Card (Paystack)", bank: "Bank transfer" };
export type InvoiceLine = { week: string; minutes: number; amountKobo: number };
export type Invoice = {
  id: string; number: string; projectId: string; project: string; client: string; clientEmail: string; month: string;
  rateKobo: number; lines: InvoiceLine[]; minutes: number; subtotalKobo: number; vatTenths: number; vatKobo: number; totalKobo: number;
  status: InvoiceStatus; issuedOn: string; dueOn: string; sentAt?: string; paidAt?: string; paidVia?: PayMethod; payRef?: string; ledgerEntryId?: string;
  remindedAt?: string; voidReason?: string; createdAt: string; createdBy: string;
};

export const isMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });

// The Mondays of weeks that have a day in the month.
export function monthWeeks(month: string): string[] {
  const out: string[] = [];
  for (let w = weekStart(`${month}-01`); w.slice(0, 7) <= month; w = addDays(w, 7)) out.push(w);
  return out;
}

// A line per week from billable minutes by day (only days in the month count; weeks crossing months split by day).
export function linesFrom(minutesByDay: Record<string, number>, month: string, rateKobo: number): InvoiceLine[] {
  const byWeek = new Map<string, number>();
  for (const [day, m] of Object.entries(minutesByDay)) if (day.slice(0, 7) === month && m) byWeek.set(weekStart(day), (byWeek.get(weekStart(day)) ?? 0) + m);
  return Array.from(byWeek.entries()).filter(([, m]) => m > 0).sort(([a], [b]) => a.localeCompare(b)).map(([week, minutes]) => ({ week, minutes, amountKobo: Math.round((minutes * rateKobo) / 60) }));
}

export function totals(lines: InvoiceLine[], vatTenths: number) {
  const minutes = lines.reduce((s, l) => s + l.minutes, 0);
  const subtotalKobo = lines.reduce((s, l) => s + l.amountKobo, 0);
  const vatKobo = Math.round((subtotalKobo * vatTenths) / VAT_BASIS);
  return { minutes, subtotalKobo, vatKobo, totalKobo: subtotalKobo + vatKobo };
}

export const invoiceNumber = (year: number, seq: number) => `NA-INV-${year}-${String(seq).padStart(3, "0")}`;
export const dueFrom = (issuedOn: string) => addDays(issuedOn, PAY_DAYS);
export const overdue = (i: Pick<Invoice, "status" | "dueOn">, today: string) => i.status === "sent" && !!i.dueOn && i.dueOn < today;
export const reminderDue = (i: Pick<Invoice, "status" | "dueOn" | "remindedAt">, today: string) => i.status === "sent" && !i.remindedAt && !!i.dueOn && addDays(i.dueOn, REMIND_AFTER_DAYS) <= today;

// The month an invoice is first drafted for has to be over (or at least be the current one, for a mid-month invoice).
export function canDraftFor(month: string, today: string): boolean {
  return isMonth(month) && month <= today.slice(0, 7);
}

// What a client sees: nothing internal (who made it, the ledger, the payment references).
export function publicView(i: Invoice) {
  const { number, project, client, month, rateKobo, lines, minutes, subtotalKobo, vatTenths, vatKobo, totalKobo, status, issuedOn, dueOn, paidAt, paidVia } = i;
  return { number, project, client, month, rateKobo, lines, minutes, subtotalKobo, vatTenths, vatKobo, totalKobo, status, issuedOn, dueOn, paidAt, paidVia };
}
