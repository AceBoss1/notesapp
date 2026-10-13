import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { notifyBell } from "./email";
import { FinanceError, naira } from "./finance";
import { createEntry, type Caller } from "./finance-server";
import { listGrants, defaultGrantDeps, type GrantDeps } from "./grants-server";
import { daysLeft } from "./grants";
import { deadlineOf, cleanDue, dueFromGrants, dueReminders, dueText, type Due, type DueInput } from "./dues";
import { lagosDate } from "./team";
import { listTeamPeople } from "./team-server";

// Server side of Expenses due. Collection: financeDues (server-only in firestore.rules). Finance edits, product reads.
const COL = "financeDues";
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new FinanceError(msg, status); };
const toDue = (id: string, d: FirebaseFirestore.DocumentData): Due => ({ ...(d as Omit<Due, "id">), id, remindedDays: d.remindedDays ?? [], source: "manual" });

// Everything still to pay, soonest first: the manual items plus plans that will turn paid.
// Finance and product see everything; any other staff member sees only the payments assigned to them.
export async function listDues(db: Firestore, c: Caller, now = new Date()): Promise<Due[]> {
  const today = lagosDate(now);
  const snap = await db.collection(COL).where("status", "==", "open").get();
  const manual = snap.docs.map((d) => toDue(d.id, d.data()));
  if (!(c.finance || c.product)) return manual.filter((d) => d.assigneeUid === c.uid).sort((a, b) => deadlineOf(a).localeCompare(deadlineOf(b)));
  const grants = await listGrants(db, c);
  return [...manual, ...dueFromGrants(grants, today)].sort((a, b) => deadlineOf(a).localeCompare(deadlineOf(b)));
}

async function assigneeOf(db: Firestore, uid: unknown): Promise<Pick<Due, "assigneeUid" | "assigneeName" | "assigneeEmail">> {
  if (uid === undefined || uid === null || uid === "") return {};
  const p = (await listTeamPeople(db)).find((x) => x.uid === uid);
  need(!!p, "Choose someone from the team.", 400);
  return { assigneeUid: p!.uid, assigneeName: p!.name, assigneeEmail: p!.email };
}

// Changes who must pay and by when (finance only). Clears the reminders already sent so the new date counts down afresh.
export async function assignDue(db: Firestore, c: Caller, id: unknown, input: { assigneeUid?: unknown; payBy?: unknown }, now = new Date()): Promise<void> {
  need(c.finance, "Only the finance team can assign payments.");
  const ref = db.collection(COL).doc(String(id));
  const s = await ref.get();
  need(s.exists && s.data()!.status === "open", "That item wasn't found, or is already closed.", 404);
  const today = lagosDate(now);
  const clean = cleanDue({ title: "x", dueOn: s.data()!.dueOn, payBy: input.payBy }, today);
  const who = await assigneeOf(db, input.assigneeUid);
  await ref.update({
    assigneeUid: who.assigneeUid ?? FieldValue.delete(), assigneeName: who.assigneeName ?? FieldValue.delete(), assigneeEmail: who.assigneeEmail ?? FieldValue.delete(),
    payBy: clean.payBy ?? FieldValue.delete(), remindedDays: [], updatedAt: now.toISOString(),
  });
  if (who.assigneeUid && who.assigneeUid !== s.data()!.assigneeUid) {
    const d = toDue(s.id, { ...s.data()!, ...who, ...(clean.payBy ? { payBy: clean.payBy } : {}) });
    await notifyBell({ uid: who.assigneeUid, type: "team", linkHref: "/admin/team/finance", message: `A payment is assigned to you: ${dueText(d, daysLeft(deadlineOf(d), today), naira)}` }).catch(() => {});
  }
}

export async function addDue(db: Firestore, c: Caller, input: DueInput, now = new Date()): Promise<Due> {
  need(c.finance, "Only the finance team can add expenses due.");
  const clean = cleanDue(input, lagosDate(now));
  const who = await assigneeOf(db, input.assigneeUid);
  const ref = db.collection(COL).doc();
  const doc = { ...clean, ...who, status: "open", source: "manual", remindedDays: [], createdAt: now.toISOString(), createdByEmail: c.email };
  await ref.set(doc);
  if (who.assigneeUid) {
    const d = toDue(ref.id, doc);
    await notifyBell({ uid: who.assigneeUid, type: "team", linkHref: "/admin/team/finance", message: `A payment is assigned to you: ${dueText(d, daysLeft(deadlineOf(d), lagosDate(now)), naira)}` }).catch(() => {});
  }
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
    const left = daysLeft(deadlineOf(d), today);
    const text = `Expense due: ${dueText(d, left, naira)}`;
    people ??= await deps.recipients();
    await doc.ref.update({ remindedDays: [...d.remindedDays, ...due] });
    // Finance, plus the person who has to make the payment.
    const to = d.assigneeUid && !people.some((p) => p.uid === d.assigneeUid) ? [...people, { uid: d.assigneeUid, email: d.assigneeEmail ?? "" }] : people;
    for (const p of to) {
      await deps.bell(p.uid, text).catch(() => {});
      if (p.email) await deps.email(p.email, { subject: left < 0 ? `Overdue: ${d.title}` : left === 0 ? `Due today: ${d.title}` : `Due in ${left} day${left === 1 ? "" : "s"}: ${d.title}`, text }).catch(() => {});
    }
    sent++;
  }
  return sent;
}
