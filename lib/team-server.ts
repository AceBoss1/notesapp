import { getAuth } from "firebase-admin/auth";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminApp } from "./firebase-admin";
import { ADMIN_PROFILES } from "./admin";
import { reportCounts } from "./reports-server";
import { gatherTraction } from "./traction-server";
import type { Traction } from "./traction";
import { createGroup, sendGroupMessage, syncMembers, syncTeamRoom, type GroupDeps } from "./groups-server";
import {
  TeamError, cleanItem, cleanMeeting, MEETING_STATUSES, type Meeting, type MeetingStatus, cleanMilestone, metricValue, statusEffects, lagosDate, addDays,
  type Milestone, type TeamItem, type Status,
} from "./team";

// Server side of the team hub. Everything lives in two server-only collections (teamItems, teamMilestones); only signed-in admins reach
// them, through /api/admin/team.
const ITEMS = "teamItems", MILESTONES = "teamMilestones", MEETINGS = "teamMeetings";

export type Person = { uid: string; name: string; email: string };
export type Signal = { id: string; label: string; count: number; href: string; urgent?: boolean };

// Every account with the admin claim, with a readable name.
export async function listTeamPeople(db: Firestore): Promise<Person[]> {
  const auth = getAuth(getAdminApp());
  const admins: { uid: string; email: string }[] = [];
  let token: string | undefined;
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) if (u.customClaims?.admin === true) admins.push({ uid: u.uid, email: u.email || "" });
    token = page.pageToken;
  } while (token);
  const docs = admins.length ? await db.getAll(...admins.map((a) => db.doc(`users/${a.uid}`))) : [];
  return admins.map((a, i) => {
    const d = docs[i].data();
    const name = d?.displayName || ADMIN_PROFILES[a.email]?.displayName || d?.username || a.email.split("@")[0] || a.uid;
    return { uid: a.uid, name: String(name), email: a.email };
  });
}

// Short-lived copy of the platform numbers: the page and every edit ask for them, and counting is heavy.
let tractionCache: { at: number; t: Traction } | null = null;
export async function cachedTraction(db: Firestore): Promise<Traction> {
  if (!tractionCache || Date.now() - tractionCache.at > 60_000) tractionCache = { at: Date.now(), t: await gatherTraction(db) };
  return tractionCache.t;
}

// What is waiting for the team in the queues that already exist. Each count is read on its own, so one failing never hides the rest.
export async function teamSignals(db: Firestore): Promise<Signal[]> {
  const count = async (q: { count(): { get(): Promise<{ data(): { count: number } }> } }) => (await q.count().get()).data().count;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const jobs: Promise<Signal | null>[] = [
    reportCounts(db).then((c) => (c.open > 0 ? { id: "reports", label: c.overdue > 0 ? `Reports (${c.overdue} overdue, ${c.urgent} urgent)` : c.urgent > 0 ? `Reports (${c.urgent} urgent)` : "Reports to review", count: c.open, href: "/admin/reports", urgent: c.urgent > 0 } : null)),
    count(db.collection("badgeRequests").where("status", "==", "pending")).then((n) => (n > 0 ? { id: "badges", label: "Gold badge applications", count: n, href: "/admin/users" } : null)),
    count(db.collection("users").where("org.rcStatus", "==", "unverified")).then((n) => (n > 0 ? { id: "orgs", label: "Organisations to verify", count: n, href: "/admin/organisations" } : null)),
    count(db.collection("leads").where("status", "==", "new")).then((n) => (n > 0 ? { id: "leads", label: "New contact messages and leads", count: n, href: "/admin/leads" } : null)),
    count(db.collection("ledger").where("status", "==", "disputed")).then((n) => (n > 0 ? { id: "disputes", label: "Disputed payouts", count: n, href: "/admin/payments", urgent: true } : null)),
    count(db.collection("errorLogs").where("lastSeenAt", ">=", since)).then((n) => (n > 0 ? { id: "errors", label: "Errors in the last 24 hours", count: n, href: "/admin/errors" } : null)),
  ];
  const settled = await Promise.allSettled(jobs);
  return settled.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}

export async function listTeam(db: Firestore) {
  const [itemsSnap, msSnap] = await Promise.all([
    db.collection(ITEMS).orderBy("createdAt", "desc").limit(500).get(),
    db.collection(MILESTONES).orderBy("endsOn", "desc").limit(100).get(),
  ]);
  const cutoff = addDays(lagosDate(), -30);
  const items = itemsSnap.docs.map((d) => ({ ...(d.data() as Omit<TeamItem, "id">), id: d.id })).filter((i) => i.status !== "done" || (i.doneAt || "").slice(0, 10) >= cutoff);
  const milestones = msSnap.docs.map((d) => ({ ...(d.data() as Omit<Milestone, "id">), id: d.id }));
  return { items, milestones };
}

const DEFAULTS = { detail: "", ownerUid: "", status: "todo", horizon: "week", due: "", blockedReason: "", decisionQuestion: "", decidedNote: "" } as const;

export async function createItem(db: Firestore, adminUid: string, body: Record<string, unknown>) {
  const now = new Date().toISOString();
  const c = cleanItem(body, false);
  const status = (c.status ?? "todo") as Status;
  if (status === "blocked" && !c.blockedReason) throw new TeamError("Say what it is blocked on.");
  const item = { ...DEFAULTS, ...c, status, createdByUid: adminUid, createdAt: now, updatedAt: now, doneAt: status === "done" ? now : "" };
  if (status === "decision" && !item.decisionQuestion) item.decisionQuestion = item.title ?? "";
  const ref = await db.collection(ITEMS).add(item);
  return { id: ref.id };
}

export async function updateItem(db: Firestore, id: string, body: Record<string, unknown>) {
  const ref = db.doc(`${ITEMS}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new TeamError("That item no longer exists.", 404);
  const prev = snap.data() as TeamItem;
  const now = new Date().toISOString();
  const c = cleanItem(body, true);
  const next = { ...prev, ...c } as TeamItem;
  if (next.status === "blocked" && !next.blockedReason) throw new TeamError("Say what it is blocked on.");
  if (next.status === "decision" && !next.decisionQuestion) next.decisionQuestion = next.title;
  if (c.status && c.status !== "blocked" && !("blockedReason" in body)) next.blockedReason = c.status === "done" ? next.blockedReason : "";
  const patch = { ...c, ...(next.decisionQuestion !== prev.decisionQuestion ? { decisionQuestion: next.decisionQuestion } : {}), blockedReason: next.blockedReason, ...statusEffects(next.status, prev.status, now), updatedAt: now };
  await ref.update(patch);
}

export async function deleteItem(db: Firestore, id: string) {
  await db.doc(`${ITEMS}/${id}`).delete();
}

export async function createMilestone(db: Firestore, adminUid: string, body: Record<string, unknown>) {
  const c = cleanMilestone(body);
  const baseline = c.mode === "gain" ? metricValue(await cachedTraction(db), c.metric) : 0;
  const ref = await db.collection(MILESTONES).add({ ...c, baseline, createdByUid: adminUid, createdAt: new Date().toISOString() });
  return { id: ref.id };
}

export async function deleteMilestone(db: Firestore, id: string) {
  await db.doc(`${MILESTONES}/${id}`).delete();
}

// ---- Meetings ----------------------------------------------------------------------------------------------------------------------
export async function listMeetings(db: Firestore): Promise<Meeting[]> {
  const snap = await db.collection(MEETINGS).orderBy("startsAt", "desc").limit(40).get();
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Meeting, "id">), id: d.id }));
}

export async function getMeeting(db: Firestore, id: string): Promise<Meeting> {
  const d = await db.doc(`${MEETINGS}/${id}`).get();
  if (!d.exists) throw new TeamError("That meeting wasn't found.", 404);
  return { ...(d.data() as Omit<Meeting, "id">), id: d.id };
}

export async function meetingActions(db: Firestore, meetingId: string): Promise<TeamItem[]> {
  const snap = await db.collection(ITEMS).where("meetingId", "==", meetingId).limit(100).get();
  return snap.docs.map((d) => ({ ...(d.data() as Omit<TeamItem, "id">), id: d.id })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Schedules a meeting: its own room in the group chat (every team member in it, the agenda as the first message, which also rings their bell).
export async function createMeeting(db: Firestore, adminUid: string, body: Record<string, unknown>, teamUids: string[], now = new Date(), deps?: GroupDeps) {
  const c = cleanMeeting(body);
  const ref = db.collection(MEETINGS).doc();
  const room = await createGroup(db, adminUid, { title: c.title, memberUids: teamUids.filter((u) => u !== adminUid), scope: "team", id: `meeting_${ref.id}`, meetingId: ref.id }, now, deps);
  const meeting: Omit<Meeting, "id"> = { ...c, conversationId: room.id, status: "scheduled", notes: "", decisions: [], createdByUid: adminUid, createdAt: now.toISOString(), endedAt: "" };
  await ref.set(meeting);
  const when = new Date(c.startsAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  await sendGroupMessage(db, adminUid, room.id, { text: `Meeting: ${c.title}\n${when} (Lagos time)${c.agenda ? `\n\nAgenda:\n${c.agenda}` : ""}` }, now, undefined, deps).catch(() => {});
  return { id: ref.id, conversationId: room.id };
}

export async function updateMeeting(db: Firestore, id: string, body: Record<string, unknown>, now = new Date()) {
  const m = await getMeeting(db, id);
  const patch: Record<string, unknown> = {};
  if ("agenda" in body) patch.agenda = String(body.agenda ?? "").trim().slice(0, 2000);
  if ("notes" in body) patch.notes = String(body.notes ?? "").trim().slice(0, 2000);
  if (typeof body.status === "string") {
    if (!MEETING_STATUSES.includes(body.status as MeetingStatus)) throw new TeamError("Unknown meeting status.");
    patch.status = body.status;
    patch.endedAt = body.status === "done" ? now.toISOString() : "";
  }
  if (Object.keys(patch).length) await db.doc(`${MEETINGS}/${m.id}`).update(patch);
}

export async function addDecision(db: Firestore, id: string, adminUid: string, text: unknown, now = new Date()) {
  const t = String(text ?? "").trim().slice(0, 500);
  if (!t) throw new TeamError("Write down what was decided.");
  const m = await getMeeting(db, id);
  await db.doc(`${MEETINGS}/${m.id}`).update({ decisions: FieldValue.arrayUnion({ text: t, at: now.toISOString(), byUid: adminUid }) });
}

export async function removeDecision(db: Firestore, id: string, at: unknown) {
  const m = await getMeeting(db, id);
  await db.doc(`${MEETINGS}/${m.id}`).update({ decisions: m.decisions.filter((d) => d.at !== at) });
}

// An action agreed in a meeting becomes a work item with the meeting's id on it (due date and owner as given).
export async function addMeetingAction(db: Firestore, adminUid: string, meetingId: string, body: Record<string, unknown>) {
  const m = await getMeeting(db, meetingId);
  return createItem(db, adminUid, { title: body.title, ownerUid: body.ownerUid, due: body.due, horizon: "week", status: "todo", detail: `From the meeting "${m.title}".`, meetingId: m.id });
}

// Keeps the standing Team room and the room of each upcoming meeting in step with who is on the team now.
export async function syncTeamRooms(db: Firestore, me: string, teamUids: string[], deps?: GroupDeps) {
  await syncTeamRoom(db, me, teamUids, new Date(), deps);
  const open = (await listMeetings(db)).filter((m) => m.status !== "done");
  await Promise.all(open.map((m) => syncMembers(db, m.conversationId, teamUids)));
}
