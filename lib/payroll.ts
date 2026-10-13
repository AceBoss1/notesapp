import { FinanceError, MAX_AMOUNT_KOBO, isMonth, toKobo } from "./finance";

// Payroll under Accounts: who is paid, how much, on which day, and a monthly run that is marked paid one person at a time. Marking a line
// paid writes a Payroll entry into the money ledger. Only finance and super admins see any of it. Transfers stay manual for now.
export type PayStaff = {
  id: string;
  name: string;
  role: string;
  uid?: string; // their staff login, when they have one
  monthlyKobo: number;
  payDay: number; // 1 to 28, the day of the month they are paid
  bankName: string;
  accountName: string;
  accountLast4: string;
  hasAccount: boolean; // the full number is held encrypted, never sent to the page
  startedOn: string; // YYYY-MM-DD: the first month they are paid is the month this falls in
  active: boolean;
  note: string;
  createdAt: string;
};
export type PayLine = { staffId: string; name: string; role: string; baseKobo: number; adjustKobo: number; adjustNote: string; amountKobo: number; status: "pending" | "paid"; paidOn?: string; paidEntryId?: string };
export type PayRun = { id: string; period: string; lines: PayLine[]; createdAt: string; createdByEmail: string };

export type StaffInput = { name?: unknown; role?: unknown; uid?: unknown; monthly?: unknown; payDay?: unknown; bankName?: unknown; accountName?: unknown; accountNumber?: unknown; startedOn?: unknown; note?: unknown };

export function cleanStaff(input: StaffInput, partial = false): Partial<Omit<PayStaff, "id" | "hasAccount" | "active" | "createdAt" | "accountLast4">> & { accountNumber?: string } {
  const out: ReturnType<typeof cleanStaff> = {};
  const has = (k: keyof StaffInput) => input[k] !== undefined;
  if (!partial || has("name")) { out.name = String(input.name ?? "").trim().slice(0, 100); if (!out.name) throw new FinanceError("Enter the person's name."); }
  if (!partial || has("role")) out.role = String(input.role ?? "").trim().slice(0, 100);
  if (has("uid")) out.uid = String(input.uid ?? "").trim().slice(0, 128);
  if (!partial || has("monthly")) {
    const k = toKobo(input.monthly);
    if (!k) throw new FinanceError("Enter the monthly pay in naira, for example 50000.");
    if (k > MAX_AMOUNT_KOBO) throw new FinanceError("That amount looks too large. Check for an extra zero.");
    out.monthlyKobo = k;
  }
  if (!partial || has("payDay")) {
    const d = Number(input.payDay ?? 28);
    if (!Number.isInteger(d) || d < 1 || d > 28) throw new FinanceError("The pay day is a day of the month from 1 to 28.");
    out.payDay = d;
  }
  if (!partial || has("startedOn")) {
    const s = String(input.startedOn ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T12:00:00Z`))) throw new FinanceError("Enter the date they started, as a date.");
    out.startedOn = s;
  }
  if (has("bankName")) out.bankName = String(input.bankName ?? "").trim().slice(0, 80);
  if (has("accountName")) out.accountName = String(input.accountName ?? "").trim().slice(0, 100);
  if (has("accountNumber") && String(input.accountNumber).trim()) {
    const n = String(input.accountNumber).replace(/\s/g, "");
    if (!/^\d{10}$/.test(n)) throw new FinanceError("A Nigerian bank account number has 10 digits.");
    out.accountNumber = n;
  }
  if (has("note")) out.note = String(input.note ?? "").trim().slice(0, 300);
  return out;
}

// Staff in a run: active, and started on or before the last day of the month.
export const inRun = (s: Pick<PayStaff, "active" | "startedOn">, period: string) => s.active && s.startedOn.slice(0, 7) <= period;

export function buildLines(staff: PayStaff[], period: string): PayLine[] {
  if (!isMonth(period)) throw new FinanceError("Enter the month as YYYY-MM.");
  return staff.filter((s) => inRun(s, period)).sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({
    staffId: s.id, name: s.name, role: s.role, baseKobo: s.monthlyKobo, adjustKobo: 0, adjustNote: "", amountKobo: s.monthlyKobo, status: "pending" as const,
  }));
}

// An adjustment (a deduction or an extra) of up to ±the monthly pay; the line total can't go to zero or below.
export function adjustLine(l: PayLine, adjust: unknown, note: unknown): Pick<PayLine, "adjustKobo" | "adjustNote" | "amountKobo"> {
  if (l.status === "paid") throw new FinanceError("That line is already paid.", 409);
  const raw = String(adjust ?? "").trim().replace(/[₦,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new FinanceError("Enter the change in naira, for example -5000 or 10000.");
  const adjustKobo = Math.round(Number(raw) * 100);
  if (Math.abs(adjustKobo) > l.baseKobo) throw new FinanceError("An adjustment can't be larger than the monthly pay.");
  const amountKobo = l.baseKobo + adjustKobo;
  if (amountKobo <= 0) throw new FinanceError("The line total must stay above zero. Remove the person from the run instead.");
  const adjustNote = String(note ?? "").trim().slice(0, 120);
  if (adjustKobo !== 0 && !adjustNote) throw new FinanceError("Say why the pay is different this month.");
  return { adjustKobo, adjustNote, amountKobo };
}

export const runTotals = (r: PayRun) => ({
  total: r.lines.reduce((s, l) => s + l.amountKobo, 0),
  paid: r.lines.filter((l) => l.status === "paid").reduce((s, l) => s + l.amountKobo, 0),
  people: r.lines.length,
  open: r.lines.filter((l) => l.status === "pending").length,
});
