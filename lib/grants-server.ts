import type { Firestore } from "firebase-admin/firestore";
import { listStaff } from "./admin-access-server";
import { notifyBell, sendEmail } from "./email";
import { FinanceError } from "./finance";
import { createEntry, type Caller } from "./finance-server";
import { MAX_USAGE, cleanGrant, cleanUsage, dueReminders, daysLeft, kobo, reminderText, usd, type Grant, type GrantInput } from "./grants";
import { lagosDate } from "./team";

// Server side of the grants and subscriptions tracker. Collection: grants (server-only in firestore.rules). Finance edits, product reads.
const COL = "grants";
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new FinanceError(msg, status); };
const toGrant = (id: string, d: FirebaseFirestore.DocumentData): Grant => ({ ...(d as Omit<Grant, "id">), id, usage: d.usage ?? [], remindedDays: d.remindedDays ?? [] });

export async function listGrants(db: Firestore, c: Caller): Promise<Grant[]> {
  need(c.finance || c.product, "Grants are for the finance and product teams.");
  const snap = await db.collection(COL).get();
  return snap.docs.map((d) => toGrant(d.id, d.data())).sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}

// Create (no id) or change (id) a grant. A grant whose end date passed is closed by the reminders job; changing the dates re-arms reminders.
export async function saveGrant(db: Firestore, c: Caller, id: unknown, input: GrantInput, now = new Date()): Promise<Grant> {
  need(c.finance, "Only the finance team can change grants.");
  const clean = cleanGrant(input, lagosDate(now));
  const at = now.toISOString();
  if (!id) {
    const ref = db.collection(COL).doc();
    const doc = { ...clean, status: "active", usage: [], remindedDays: [], createdAt: at, createdByEmail: c.email };
    await ref.set(doc);
    return toGrant(ref.id, doc);
  }
  const ref = db.collection(COL).doc(String(id));
  return db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That grant wasn't found.", 404);
    const old = toGrant(s.id, s.data()!);
    const datesMoved = old.endsOn !== clean.endsOn;
    const next = { ...old, ...clean, updatedAt: at, ...(datesMoved ? { remindedDays: [] } : {}) };
    const { id: _id, ...doc } = next;
    void _id;
    t.set(ref, doc);
    return next;
  });
}

export async function addUsage(db: Firestore, c: Caller, id: unknown, input: { on?: unknown; cents?: unknown; note?: unknown }, now = new Date()): Promise<void> {
  need(c.finance, "Only the finance team can record usage.");
  const u = cleanUsage(input, lagosDate(now));
  const ref = db.collection(COL).doc(String(id));
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That grant wasn't found.", 404);
    const g = toGrant(s.id, s.data()!);
    need(g.kind === "credit", "Usage is tracked on credit grants; for a plan, set seats in use.", 400);
    need(g.usage.length < MAX_USAGE, "Too many usage lines; edit the grant instead.", 400);
    t.update(ref, { usage: [...g.usage, u], updatedAt: now.toISOString() });
  });
}

export async function setStatus(db: Firestore, c: Caller, id: unknown, status: unknown, now = new Date()): Promise<void> {
  need(c.finance, "Only the finance team can change grants.");
  need(status === "active" || status === "ended" || status === "cancelled", "Unknown status.", 400);
  const ref = db.collection(COL).doc(String(id));
  need((await ref.get()).exists, "That grant wasn't found.", 404);
  await ref.update({ status, updatedAt: now.toISOString() });
}

// Puts the grant's worth on the grant side of the money ledger as an in-kind entry (not cash). Needs the exchange rate; once only.
export async function recordInLedger(db: Firestore, c: Caller, id: unknown, now = new Date()): Promise<{ entryId: string }> {
  need(c.finance, "Only the finance team can record entries.");
  const ref = db.collection(COL).doc(String(id));
  const s = await ref.get();
  need(s.exists, "That grant wasn't found.", 404);
  const g = toGrant(s.id, s.data()!);
  need(!g.ledgerEntryId, "This grant is already in the ledger.", 400);
  need(g.fxNgn > 0, "Add the naira per US dollar rate to this grant first.", 400);
  const e = await createEntry(db, c, {
    kind: "income", category: "grant", inKind: true, amountKobo: kobo(g.valueCents, g.fxNgn), occurredOn: g.startsOn, party: g.provider,
    description: `${g.title}: ${usd(g.valueCents)} in-kind at ₦${g.fxNgn}/$ (free credit or plan, not cash)`,
  }, now);
  await ref.update({ ledgerEntryId: e.id, updatedAt: now.toISOString() });
  return { entryId: e.id };
}

export type GrantDeps = {
  email: (to: string, mail: { subject: string; text: string }) => Promise<void>;
  bell: (uid: string, message: string) => Promise<void>;
  recipients: () => Promise<{ uid: string; email: string }[]>;
};
const defaultDeps = (db: Firestore): GrantDeps => ({
  email: async (to, m) => { await sendEmail({ to, subject: m.subject, text: m.text, action: { label: "Open grants", url: "https://www.notesapp.name.ng/admin/team/grants" } }); },
  bell: async (uid, message) => notifyBell({ uid, type: "team", linkHref: "/admin/team/grants", message }),
  // The owner, super admins and the finance team.
  recipients: async () => (await listStaff(db)).filter((p) => p.owner || p.role === "super" || p.depts.includes("finance")).map((p) => ({ uid: p.uid, email: p.email })),
});

// Cron: for each running grant, one message covering every threshold (30, 14, 7, 3, 1, 0 days) reached since the last one, then marks them so
// nothing repeats. A grant past its end date is closed. Returns how many grants triggered a message.
export async function sendGrantReminders(db: Firestore, now = new Date(), deps: GrantDeps = defaultDeps(db)): Promise<number> {
  const today = lagosDate(now);
  const snap = await db.collection(COL).where("status", "==", "active").get();
  let sent = 0;
  let people: { uid: string; email: string }[] | null = null;
  for (const d of snap.docs) {
    const g = toGrant(d.id, d.data());
    const due = dueReminders(g, today);
    if (!due.length) {
      if (daysLeft(g.endsOn, today) < 0) await d.ref.update({ status: "ended", updatedAt: now.toISOString() });
      continue;
    }
    const left = daysLeft(g.endsOn, today);
    const text = reminderText(g, left);
    people ??= await deps.recipients();
    // Marked first so a failure to send can't turn into a message every run.
    await d.ref.update({ remindedDays: [...g.remindedDays, ...due] });
    for (const p of people) {
      await deps.bell(p.uid, text).catch(() => {});
      if (p.email) await deps.email(p.email, { subject: `Grant ${left <= 0 ? "ends today" : `ends in ${left} day${left === 1 ? "" : "s"}`}: ${g.title}`, text }).catch(() => {});
    }
    sent++;
  }
  return sent;
}
