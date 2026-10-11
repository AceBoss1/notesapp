import { FinanceError, CATEGORIES, toKobo, MAX_AMOUNT_KOBO } from "./finance";
import { addDays, daysLeft, kobo, monthlyAfter, type Grant } from "./grants";

// Expenses due: money the company will have to pay on a known date (a bill, a renewal, a free plan turning paid). Manual ones are entered by
// finance and live in `financeDues`; plans that turn paid appear on their own from Grants & subscriptions. Reminders go out ahead of each date.
export type DueStatus = "open" | "paid" | "cancelled";
export type Due = {
  id: string;
  title: string;
  party: string;
  amountKobo: number; // 0 = amount not known yet
  dueOn: string; // YYYY-MM-DD
  category: string; // an expense category key, used when it is marked paid
  note: string;
  status: DueStatus;
  source: "manual" | "grant";
  grantId?: string;
  paidEntryId?: string;
  remindedDays: number[]; // thresholds already sent; -1 = the overdue notice
  createdAt: string;
  createdByEmail: string;
};
export const DUE_REMIND_DAYS = [14, 7, 3, 1, 0];
export type DueInput = { title?: unknown; party?: unknown; amount?: unknown; dueOn?: unknown; category?: unknown; note?: unknown };

export function cleanDue(input: DueInput, today: string): Pick<Due, "title" | "party" | "amountKobo" | "dueOn" | "category" | "note"> {
  const title = String(input.title ?? "").trim().slice(0, 120);
  if (!title) throw new FinanceError("Say what is due.");
  const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(String(input.dueOn ?? "")) && !Number.isNaN(Date.parse(`${input.dueOn}T12:00:00Z`)) ? String(input.dueOn) : "";
  if (!dueOn) throw new FinanceError("Pick the date it is due.");
  const raw = String(input.amount ?? "").trim();
  const amountKobo = raw ? toKobo(raw) ?? 0 : 0;
  if (raw && amountKobo <= 0) throw new FinanceError("Enter the amount in naira, for example 12500, or leave it empty if you don't know it yet.");
  if (amountKobo > MAX_AMOUNT_KOBO) throw new FinanceError("That amount looks too large. Check for an extra zero.");
  const category = CATEGORIES.expense.some((c) => c.key === input.category) ? String(input.category) : "other_expense";
  void today;
  return { title, party: String(input.party ?? "").trim().slice(0, 80), amountKobo, dueOn, category, note: String(input.note ?? "").trim().slice(0, 300) };
}

// Thresholds newly reached (or -1 once it is overdue) for an open item.
export function dueReminders(d: Pick<Due, "status" | "dueOn" | "remindedDays">, today: string): number[] {
  if (d.status !== "open") return [];
  const left = daysLeft(d.dueOn, today);
  if (left < 0) return d.remindedDays.includes(-1) ? [] : [-1];
  return DUE_REMIND_DAYS.filter((n) => left <= n && !d.remindedDays.includes(n));
}

export function dueText(d: Pick<Due, "title" | "party" | "dueOn" | "amountKobo">, left: number, money: (k: number) => string): string {
  const amt = d.amountKobo ? ` (${money(d.amountKobo)})` : "";
  const when = left < 0 ? `was due on ${d.dueOn}` : left === 0 ? "is due today" : left === 1 ? "is due tomorrow" : `is due in ${left} days (${d.dueOn})`;
  return `${d.title}${d.party ? ` to ${d.party}` : ""}${amt} ${when}.`;
}

// A free plan that turns paid is an expense due the day after its free period ends, at the monthly cost in naira (unknown without a rate).
export function dueFromGrants(grants: Grant[], today: string): Due[] {
  return grants
    .filter((g) => g.becomesPaid && g.status === "active" && g.endsOn >= today)
    .map((g) => ({
      id: `grant:${g.id}`, title: `${g.title} turns paid (first month)`, party: g.provider,
      amountKobo: g.fxNgn > 0 ? kobo(monthlyAfter(g), g.fxNgn) : 0, dueOn: addDays(g.endsOn, 1), category: "hosting",
      note: g.fxNgn > 0 ? "From Grants & subscriptions. Cancel it there to remove this." : "Add the naira rate to the grant to see the amount.",
      status: "open" as const, source: "grant" as const, grantId: g.id, remindedDays: [], createdAt: g.createdAt, createdByEmail: g.createdByEmail,
    }));
}
