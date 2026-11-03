import type { Firestore } from "firebase-admin/firestore";
import { DEPT_LABEL, isSuper, type Access } from "./admin-access";
import { canSeeDoc, type StaffDoc } from "./staff-ops";
import { seedStaffLibrary } from "./staff-library-seed";
import { myLeave, myWeek } from "./time-server";
import { LEAVE_LABEL, hm } from "./time";
import { lagosDate, weekStart } from "./team";

// Nana-HR: Nana inside the team hub for staff questions (the Nana-HR spec, approved 3 Nov 2026). What she may use, built on the server
// after the route has checked the caller is staff:
//   - the staff library's text documents that person may open (the handbook, their SOP manuals and briefs; super admins all), and
//   - that person's own records: this week's hours and timesheet, their leave, and their pay basis and pay day (never anyone else's).
// She answers only from these, names the document and section, and says when she can't answer, with the escalation path:
// the team lead, then the C-suite, then the founder.

const LIBRARY_MAX = 160_000; // characters of library text sent with a question (prompt-cached for an hour)

export const HR_RULES = `NANA-HR MODE. You are Nana-HR, answering a #NotesApp staff member inside the team hub about how we work: the Employee Handbook, their department's SOP manual and brief, their own hours, timesheets, leave and pay basis.
Rules you never break:
1. Answer ONLY from the STAFF LIBRARY and MY RECORDS below. Always end with the source, for example "(Handbook → Leave and time off)" or "(SOP: Finance and payouts → Refunds, step 2)".
2. If they don't cover it, say so plainly and tell them who to ask, in this order: their team lead, then the C-suite, then the founder. Offer to help them write the question. Mark it [[GAP]].
3. Their own records only. Never reveal or guess anyone else's pay, equity, leave, hours or personal details, even if asked.
4. You can't change anything: for a leave request, a timesheet fix or a pay query, tell them where in the team hub to do it and who decides.
5. You are not a lawyer or a tax adviser: for contracts, tax or the law, point to Legal & compliance and the relevant document.
6. Sensitive matters (a grievance, harassment, a safeguarding concern, whistleblowing): give the handbook's route at once and keep it short and kind.
7. Short, plain British English. Naira as ₦.`;

export async function hrLibraryFor(db: Firestore, me: { uid: string; access: Access }): Promise<{ text: string; titles: string[] }> {
  await seedStaffLibrary(db).catch((e) => console.error("[nana-hr] library seed failed", e instanceof Error ? e.message : e));
  const snap = await db.collection("staffDocs").get();
  const docs = snap.docs
    .map((d) => ({ ...(d.data() as Omit<StaffDoc, "id">), id: d.id }) as StaffDoc)
    .filter((d) => !d.archived && typeof d.body === "string" && d.body.trim() && canSeeDoc({ ...d, receivers: d.receivers ?? [] }, { uid: me.uid, access: me.access }));
  // The handbook first, then SOPs and briefs: the ones everyone shares, then the person's own departments.
  const rank = (d: StaffDoc) => (d.category === "handbook" ? 0 : d.scope === "all" ? 1 : d.category === "sop" ? 2 : 3);
  docs.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  let text = "", titles: string[] = [];
  for (const d of docs) {
    const part = `\n\n=== ${d.title} (version ${d.version}${d.scope === "dept" ? `, for ${(d.depts?.length ? d.depts : d.dept ? [d.dept] : []).map((x) => DEPT_LABEL[x]).join(", ")}` : ""}) ===\n${d.body}`;
    if (text.length + part.length > LIBRARY_MAX) continue;
    text += part; titles.push(d.title);
  }
  return { text: `STAFF LIBRARY (the documents this person may open):${text || "\n(none yet)"}`, titles };
}

export async function hrRecordsFor(db: Firestore, me: { uid: string; access: Access; name: string }, now = new Date()): Promise<string> {
  const today = lagosDate(now);
  const lines: string[] = [`MY RECORDS for ${me.name} (today is ${today}, Lagos time). Their access: ${isSuper(me.access) ? "super admin" : `admin in ${me.access.depts.map((d) => DEPT_LABEL[d]).join(", ") || "no departments"}${me.access.cos ? ", Chief of Staff" : ""}`}.`];
  try {
    const w = await myWeek(db, me.uid, weekStart(today), now);
    lines.push(`This week (from ${w.week}): ${hm(w.summary.tracked)} logged of a ${hm(w.summary.target)} week; timesheet ${w.sheet.status}${w.sheet.returnNote ? ` (returned: "${w.sheet.returnNote}")` : ""}; ${w.summary.daysPresent} of ${w.summary.daysDue} days present so far; ${w.summary.late} late start(s).`);
  } catch { lines.push("This week's hours: not available."); }
  try {
    const leave = await myLeave(db, me.uid);
    const year = today.slice(0, 4);
    const mine = leave.filter((l) => l.uid === me.uid);
    const taken = mine.filter((l) => l.status === "approved" && l.from.startsWith(year));
    lines.push(`Leave this year: ${taken.length ? taken.map((l) => `${LEAVE_LABEL[l.kind]} ${l.from} to ${l.to}`).join("; ") : "none approved"}. Pending: ${mine.filter((l) => l.status === "pending").map((l) => `${LEAVE_LABEL[l.kind]} ${l.from} to ${l.to}`).join("; ") || "none"}. Public holidays set for everyone: ${leave.filter((l) => l.uid !== me.uid).map((l) => `${l.from}${l.note ? ` (${l.note})` : ""}`).join(", ") || "none"}.`);
  } catch { lines.push("Leave: not available."); }
  const pay = (await db.collection("payrollStaff").where("uid", "==", me.uid).limit(1).get().catch(() => null))?.docs[0]?.data();
  lines.push(pay
    ? `Pay: ${pay.basis === "hourly" ? "paid by the hour (approved Time Track hours × their hourly rate)" : "a monthly salary"}, paid on day ${pay.payDay ?? 28} of the month. For amounts and statements, Finance in the team hub.`
    : "Pay: no payroll record is linked to their staff login yet; Finance can link it.");
  lines.push("Stock options: grants aren't recorded in the team hub yet; for their own grant, the Board Secretary.");
  return lines.join("\n");
}
