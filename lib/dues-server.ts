import type { Firestore } from "firebase-admin/firestore";
import { FinanceError, naira } from "./finance";
import { createEntry, type Caller } from "./finance-server";
import { listGrants, defaultGrantDeps, type GrantDeps } from "./grants-server";
import { daysLeft } from "./grants";
import { cleanDue, dueFromGrants, dueReminders, dueText, type Due, type DueInput } from "./dues";
import { lagosDate } from "./team";

// Server side of Expenses due. Collection: financeDues (server-only in firestore.rules). Finance edits, product reads.
const COL = "financeDues";
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new FinanceError(msg, status); };
const toDue = (id: string, d: FirebaseFirestore.DocumentData): Due => ({ ...(d as Omit<Due, "id">), id, remindedDays: d.remindedDays ?? [], source: "manual" });

// Everything still to pay, soonest first: the manual items plus plans that will turn paid.
export async function listDues(db: Firestore, c: Caller, now = new Date()): Promise<Due[]> {
  need(c.finance || c.product, "Expenses due are for the finance and product teams.");
  const today = lagosDate(now);
  const [snap, grants] = await Promise.all([db.collection(COL).where("status", "==", "open").get(), listGrants(db, c)]);
  return [...snap.docs.map((d) => toDue(d.id, d.data())), ...dueFromGrants(grants, today)].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export async function addDue(db: Firestore, c: Caller, input: DueInput, now = new Date()): Promise<Due> {
  need(c.finance, "Only the finance team can add expenses due.");
  const clean = cleanDue(input, lagosDate(now));
  const ref = db.collection(COL).doc();
  const doc = { ...clean, status: "open", source: "manual", remindedDays: [], createdAt: now.toISOString(), createdByEmail: c.email };
  await ref.set(doc);
  return toDue(ref.id, doc);
}

export async function cancelDue(db: Firestore, c: Caller, id: unknown, now = new Date()): Promise<void> {
  need(c.finance, "Only the finance team can change expenses due.");
  const ref = db.collection(COL).doc(String(id));
  need((await ref.get()).exists, "That item wasn't found.", 404);
  await ref.update({ status: "cancelled", updatedAt: now.toISOString() });
}

// Paying it: records a real expense in the money ledger (dated today, so the usual ledger rules apply) and closes the item.
export async function markPaid(db: Firestore, c: Caller, id: unknown, amount: unknown, now = new Date()): Promise<{ entryId: string }> {
  need(c.finance, "Only the finance team can record payments.");
  const ref = db.collection(COL).doc(String(id));
  const s = await ref.get();
  need(s.exists && s.data()!.status === "open", "That item wasn't found, or is already closed.", 404);
  const d = toDue(s.id, s.data()!);
  const e = await createEntry(db, c, {
    kind: "expense", category: d.category, ...(amount !== undefined && String(amount).trim() ? { amount } : { amountKobo: d.amountKobo }),
    occurredOn: lagosDate(now), party: d.party || "—", description: d.title,
  }, now);
  await ref.update({ status: "paid", paidEntryId: e.id, updatedAt: now.toISOString() });
  return { entryId: e.id };
}

// Cron: for each open manual item, one message covering the thresholds reached (14, 7, 3, 1, 0 days before, then once when overdue).
// Plans turning paid are reminded by the grants job. Returns how many items triggered a message.
export async function sendDueReminders(db: Firestore, now = new Date(), deps: GrantDeps = defaultGrantDeps(db, "/admin/team/finance")): Promise<number> {
  const today = lagosDate(now);
  const snap = await db.collection(COL).where("status", "==", "open").get();
  let sent = 0;
  let people: { uid: string; email: string }[] | null = null;
  for (const doc of snap.docs) {
    const d = toDue(doc.id, doc.data());
    const due = dueReminders(d, today);
    if (!due.length) continue;
    const left = daysLeft(d.dueOn, today);
    const text = `Expense due: ${dueText(d, left, naira)}`;
    people ??= await deps.recipients();
    await doc.ref.update({ remindedDays: [...d.remindedDays, ...due] });
    for (const p of people) {
      await deps.bell(p.uid, text).catch(() => {});
      if (p.email) await deps.email(p.email, { subject: left < 0 ? `Overdue: ${d.title}` : left === 0 ? `Due today: ${d.title}` : `Due in ${left} day${left === 1 ? "" : "s"}: ${d.title}`, text }).catch(() => {});
    }
    sent++;
  }
  return sent;
}
