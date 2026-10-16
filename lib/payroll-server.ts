import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { FinanceError, naira } from "./finance";
import { createEntry, type Caller } from "./finance-server";
import { accountCryptoConfigured, decryptAccountNumber, encryptAccountNumber } from "./account-crypto";
import { adjustLine, buildLines, cleanStaff, runTotals, type PayLine, type PayRun, type PayStaff, type StaffInput } from "./payroll";
import { lagosDate } from "./team";
import { isMonth } from "./finance";

// Server side of Payroll. Collections (all server-only in firestore.rules): payrollStaff, payrollRuns (id = YYYY-MM), payrollSecrets (the
// encrypted full account numbers, one per person). Finance and super admins only.
const STAFF = "payrollStaff", RUNS = "payrollRuns", SECRETS = "payrollSecrets";
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new FinanceError(msg, status); };
const gate = (c: Caller) => need(c.finance, "Payroll is for the finance team.");

const toStaff = (id: string, d: FirebaseFirestore.DocumentData): PayStaff => ({
  id, name: d.name, role: d.role ?? "", uid: d.uid || undefined, monthlyKobo: d.monthlyKobo, payDay: d.payDay ?? 28, bankName: d.bankName ?? "", accountName: d.accountName ?? "",
  accountLast4: d.accountLast4 ?? "", hasAccount: !!d.hasAccount, startedOn: d.startedOn, active: d.active !== false, note: d.note ?? "", createdAt: d.createdAt ?? "",
});
const toRun = (id: string, d: FirebaseFirestore.DocumentData): PayRun => ({ id, period: id, lines: d.lines ?? [], createdAt: d.createdAt ?? "", createdByEmail: d.createdByEmail ?? "" });

async function log(db: Firestore, c: Caller, action: string, detail: string, now: Date) {
  await db.collection("financeLog").add({ at: now.toISOString(), byUid: c.uid, byEmail: c.email, action: `payroll:${action}`, entryId: "", detail: detail.slice(0, 400) });
}

export async function payrollView(db: Firestore, c: Caller): Promise<{ staff: PayStaff[]; runs: (PayRun & { totals: ReturnType<typeof runTotals> })[]; cryptoReady: boolean; monthlyTotalKobo: number }> {
  gate(c);
  const [s, r] = await Promise.all([db.collection(STAFF).get(), db.collection(RUNS).get()]);
  const staff = s.docs.map((d) => toStaff(d.id, d.data())).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const runs = r.docs.map((d) => toRun(d.id, d.data())).sort((a, b) => b.period.localeCompare(a.period)).slice(0, 12).map((x) => ({ ...x, totals: runTotals(x) }));
  return { staff, runs, cryptoReady: accountCryptoConfigured(), monthlyTotalKobo: staff.filter((p) => p.active).reduce((t, p) => t + p.monthlyKobo, 0) };
}

export async function addStaff(db: Firestore, c: Caller, input: StaffInput, now = new Date()): Promise<PayStaff> {
  gate(c);
  const clean = cleanStaff(input);
  const { accountNumber, ...rest } = clean;
  if (accountNumber) need(accountCryptoConfigured(), "Bank account numbers can't be stored until ACCOUNT_DATA_KEY is set (see docs/ENVIRONMENT.md).", 400);
  const ref = db.collection(STAFF).doc();
  const doc = { ...rest, active: true, hasAccount: !!accountNumber, accountLast4: accountNumber ? accountNumber.slice(-4) : "", createdAt: now.toISOString(), createdByEmail: c.email };
  await ref.set(doc);
  if (accountNumber) await db.collection(SECRETS).doc(ref.id).set({ enc: encryptAccountNumber(accountNumber), at: now.toISOString() });
  await log(db, c, "add", `${doc.name}`, now);
  return toStaff(ref.id, doc);
}

export async function updateStaff(db: Firestore, c: Caller, id: unknown, input: StaffInput & { active?: unknown }, now = new Date()): Promise<void> {
  gate(c);
  const ref = db.collection(STAFF).doc(String(id));
  const s = await ref.get();
  need(s.exists, "That person wasn't found.", 404);
  const { accountNumber, ...rest } = cleanStaff(input, true);
  const patch: Record<string, unknown> = { ...rest, updatedAt: now.toISOString() };
  if (input.active !== undefined) patch.active = input.active === true;
  if (accountNumber) {
    need(accountCryptoConfigured(), "Bank account numbers can't be stored until ACCOUNT_DATA_KEY is set (see docs/ENVIRONMENT.md).", 400);
    patch.hasAccount = true; patch.accountLast4 = accountNumber.slice(-4);
    await db.collection(SECRETS).doc(ref.id).set({ enc: encryptAccountNumber(accountNumber), at: now.toISOString() });
  }
  if (rest.uid === "") patch.uid = FieldValue.delete();
  await ref.update(patch);
  await log(db, c, "update", `${s.data()!.name}${patch.monthlyKobo ? ` pay ${naira(Number(patch.monthlyKobo))}` : ""}${input.active !== undefined ? (patch.active ? " reactivated" : " deactivated") : ""}`, now);
}

// The full account number, shown on request to finance and logged each time (the transfer is made by hand).
export async function revealAccount(db: Firestore, c: Caller, id: unknown, now = new Date()): Promise<{ accountNumber: string; bankName: string; accountName: string }> {
  gate(c);
  const s = await db.collection(STAFF).doc(String(id)).get();
  need(s.exists, "That person wasn't found.", 404);
  const sec = (await db.collection(SECRETS).doc(s.id).get()).data();
  need(!!sec?.enc, "No account number is saved for this person.", 404);
  await log(db, c, "reveal", s.data()!.name, now);
  return { accountNumber: decryptAccountNumber(sec!.enc), bankName: s.data()!.bankName ?? "", accountName: s.data()!.accountName ?? "" };
}

export async function startRun(db: Firestore, c: Caller, period: unknown, now = new Date()): Promise<PayRun> {
  gate(c);
  need(isMonth(period), "Enter the month as YYYY-MM.", 400);
  const p = String(period);
  need(p <= lagosDate(now).slice(0, 7), "You can't start a run for a month that hasn't begun.", 400);
  const ref = db.collection(RUNS).doc(p);
  const staff = (await db.collection(STAFF).get()).docs.map((d) => toStaff(d.id, d.data()));
  const lines = buildLines(staff, p);
  need(lines.length > 0, "No active staff are due pay in that month. Add people first.", 400);
  const doc = { lines, createdAt: now.toISOString(), createdByEmail: c.email };
  await db.runTransaction(async (t) => {
    need(!(await t.get(ref)).exists, `The ${p} run already exists.`, 409);
    t.set(ref, doc);
  });
  await log(db, c, "run", `${p}: ${lines.length} people, ${naira(lines.reduce((s, l) => s + l.amountKobo, 0))}`, now);
  return toRun(p, doc);
}

async function mutateLine(db: Firestore, period: string, staffId: string, fn: (l: PayLine) => Promise<Partial<PayLine>> | Partial<PayLine>) {
  const ref = db.collection(RUNS).doc(period);
  const s = await ref.get();
  need(s.exists, "That run wasn't found.", 404);
  const lines: PayLine[] = s.data()!.lines;
  const i = lines.findIndex((l) => l.staffId === staffId);
  need(i >= 0, "That person isn't in this run.", 404);
  const patch = await fn(lines[i]);
  const next = lines.map((l, n) => (n === i ? { ...l, ...patch } : l));
  await ref.update({ lines: next });
}

export async function adjustRunLine(db: Firestore, c: Caller, period: string, staffId: string, adjust: unknown, note: unknown, now = new Date()): Promise<void> {
  gate(c);
  await mutateLine(db, period, staffId, (l) => adjustLine(l, adjust, note));
  await log(db, c, "adjust", `${period} ${staffId}`, now);
}

export async function removeRunLine(db: Firestore, c: Caller, period: string, staffId: string, now = new Date()): Promise<void> {
  gate(c);
  const ref = db.collection(RUNS).doc(period);
  const s = await ref.get();
  need(s.exists, "That run wasn't found.", 404);
  const lines: PayLine[] = s.data()!.lines;
  const l = lines.find((x) => x.staffId === staffId);
  need(!!l, "That person isn't in this run.", 404);
  need(l!.status === "pending", "That line is already paid.", 409);
  await ref.update({ lines: lines.filter((x) => x.staffId !== staffId) });
  await log(db, c, "remove-line", `${period} ${l!.name}`, now);
}

// Paying: writes a Payroll entry (Salary) into the money ledger, dated today, then marks the line paid. The line is marked first inside a
// transaction so a double click can't record it twice; if the ledger write fails the mark is undone.
export async function markLinePaid(db: Firestore, c: Caller, period: string, staffId: string, now = new Date()): Promise<{ entryId: string }> {
  gate(c);
  const ref = db.collection(RUNS).doc(period);
  const line = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That run wasn't found.", 404);
    const lines: PayLine[] = s.data()!.lines;
    const l = lines.find((x) => x.staffId === staffId);
    need(!!l, "That person isn't in this run.", 404);
    need(l!.status === "pending", "That line is already paid.", 409);
    t.update(ref, { lines: lines.map((x) => (x.staffId === staffId ? { ...x, status: "paid", paidOn: lagosDate(now) } : x)) });
    return l!;
  });
  try {
    const e = await createEntry(db, c, { kind: "payroll", category: "salary", amountKobo: line.amountKobo, occurredOn: lagosDate(now), party: line.name, description: `Salary ${period}${line.adjustNote ? ` (${line.adjustNote})` : ""}`, period }, now);
    await mutateLine(db, period, staffId, () => ({ paidEntryId: e.id }));
    await log(db, c, "paid", `${period} ${line.name} ${naira(line.amountKobo)}`, now);
    return { entryId: e.id };
  } catch (err) {
    await mutateLine(db, period, staffId, () => ({ status: "pending" as const, paidOn: undefined })).catch(() => {});
    throw err;
  }
}
