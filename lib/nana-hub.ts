import type { Firestore } from "firebase-admin/firestore";
import { listTeam } from "./team-server";
import { HORIZON_LABEL, STATUS_LABEL, isOwner, lagosDate, ownersOf } from "./team";

// What the team hub knows about one staff member, as a few plain lines for Nana: their open work, what is overdue, blocked or waiting on a
// decision. Built on the server after the route has checked the caller is staff; it never leaves the server except inside Nana's replies
// to that same person.
export async function hubContextFor(db: Firestore, uid: string, name: string, now = new Date()): Promise<string> {
  const today = lagosDate(now);
  const { items } = await listTeam(db);
  const mine = items.filter((i) => isOwner(i, uid) && i.status !== "done");
  const unassigned = items.filter((i) => !ownersOf(i).length && i.status !== "done").length;
  const blockedAll = items.filter((i) => i.status === "blocked").length, decisionsAll = items.filter((i) => i.status === "decision").length;
  const order = (a: (typeof mine)[number], b: (typeof mine)[number]) => (a.due || "9999").localeCompare(b.due || "9999");
  const line = (i: (typeof mine)[number]) =>
    `- ${i.title} (${STATUS_LABEL[i.status]}, ${HORIZON_LABEL[i.horizon].toLowerCase()}${i.due ? `, due ${i.due}${i.due < today ? " — OVERDUE" : i.due === today ? " — due today" : ""}` : ""}${i.status === "blocked" && i.blockedReason ? `, blocked: ${i.blockedReason}` : ""}${i.status === "decision" && i.decisionQuestion ? `, to decide: ${i.decisionQuestion}` : ""}${ownersOf(i).length > 1 ? `, shared with ${ownersOf(i).length - 1} other${ownersOf(i).length === 2 ? "" : "s"}` : ""}${i.repeat === "monthly" ? ", repeats monthly" : ""})`;
  return [
    `TEAM HUB CONTEXT for ${name} (today is ${today}). Use it to help them plan their day when they ask; do not recite it unprompted.`,
    mine.length ? `Their open items (${mine.length}):\n${mine.sort(order).slice(0, 15).map(line).join("\n")}${mine.length > 15 ? `\n…and ${mine.length - 15} more` : ""}` : "They have no open items assigned to them.",
    `Across the team: ${blockedAll} blocked, ${decisionsAll} waiting on a decision, ${unassigned} open with no owner.`,
  ].join("\n");
}
