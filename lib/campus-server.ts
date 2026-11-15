// The campus programme on the server (lib/campus.ts has the rules and who's who). Collections, server-only (firestore.rules lets no one
// in directly):
//   campusTeam/{uid}   a coordinator or ambassador (CampusMember)
//   campusTasks/{id}   a task a coordinator gave some or all of her ambassadors, with each one's progress (CampusTask)
// Sign-ups are the ones the referral programme already records (referrals/{newMember}.referredBy = the ambassador).
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { canManageTeam, hasDept, type Access } from "./admin-access";
import {
  CAMPUS_COUNTRIES, CampusError, LEVELS, LIMITS, MEDALS, POINTS, approvedTally, campusDay, cleanTask, cleanUrl, isCampusCountry, levelFor,
  pointsOf, shortName, taskCounts, type CampusCountry, type CampusMember, type CampusTask, type Progress, type ProgressStatus,
} from "./campus";

export { CampusError };

export type Viewer = { uid: string; lead: boolean; member: CampusMember | null };
export type Notify = (n: { uid: string; message: string; linkHref: string }) => Promise<void>;

// Super admins, the Chief of Staff and Marketing lead the programme.
export const isLead = (access: Access | null | undefined) => !!access && (canManageTeam(access) || hasDept(access, "marketing"));

export async function viewerOf(db: Firestore, uid: string, access: Access | null): Promise<Viewer> {
  const d = (await db.doc(`campusTeam/${uid}`).get()).data() as CampusMember | undefined;
  return { uid, lead: isLead(access), member: d ?? null };
}

const coordinatorOf = (v: Viewer) => (v.member?.role === "coordinator" ? v.member : null);
function mustCoordinate(v: Viewer): CampusMember {
  const c = coordinatorOf(v);
  if (!c) throw new CampusError("Only a campus coordinator can do that.", 403);
  return c;
}

// What the Campus pages show this person. Opening Campus counts as checking in (at most once an hour).
export async function me(db: Firestore, v: Viewer, now = new Date()) {
  if (!v.lead && !v.member) throw new CampusError("Campus is for coordinators and ambassadors.", 403);
  if (v.member && (!v.member.lastCheckIn || now.getTime() - Date.parse(v.member.lastCheckIn) > 3_600_000)) {
    await db.doc(`campusTeam/${v.uid}`).update({ lastCheckIn: now.toISOString() }).catch(() => {});
  }
  let coordinator: { name: string; username: string } | null = null;
  if (v.member?.coordinatorUid) {
    const c = (await db.doc(`campusTeam/${v.member.coordinatorUid}`).get()).data() as CampusMember | undefined;
    if (c) coordinator = { name: c.name, username: c.username };
  }
  return { lead: v.lead, member: v.member, coordinator, countries: CAMPUS_COUNTRIES };
}

// A #NotesApp account by email or @username.
async function findAccount(db: Firestore, auth: Pick<Auth, "getUserByEmail">, who: unknown) {
  const idf = String(who ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!idf) throw new CampusError("Enter their @username or email address.");
  let uid: string | null = null;
  if (idf.includes("@")) uid = await auth.getUserByEmail(idf).then((u) => u.uid).catch(() => null);
  else uid = ((await db.doc(`usernames/${idf}`).get()).data()?.uid as string) || (await db.collection("users").where("username", "==", idf).limit(1).get()).docs[0]?.id || null;
  if (!uid) throw new CampusError("We couldn't find a #NotesApp account for that. They need to sign up first (it's free).", 404);
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || !u.username) throw new CampusError("That account hasn't finished signing up (no @username yet).", 404);
  if (u.suspended === true) throw new CampusError("That account is suspended.", 409);
  if (u.kid === true || u.teen === true) throw new CampusError("Campus team members must be adults.", 400);
  if (u.accountKind === "organisation") throw new CampusError("Add the person's own account, not an organisation.");
  return { uid, username: String(u.username), name: String(u.displayName || u.username) };
}

function placeOf(input: Record<string, unknown>) {
  const campus = String(input.campus ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.campus);
  if (campus.length < 3) throw new CampusError("Enter their campus (the university or college).");
  const state = String(input.state ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.state);
  return { campus, ...(state ? { state } : {}) };
}

// Leads appoint a country's coordinators.
export async function appointCoordinator(db: Firestore, auth: Pick<Auth, "getUserByEmail">, v: Viewer, input: Record<string, unknown>, notify: Notify, now = new Date()) {
  if (!v.lead) throw new CampusError("Only super admins, the Chief of Staff and Marketing appoint coordinators.", 403);
  if (!isCampusCountry(input.country)) throw new CampusError("Choose the country.");
  const who = await findAccount(db, auth, input.who);
  const existing = (await db.doc(`campusTeam/${who.uid}`).get()).data() as CampusMember | undefined;
  if (existing?.role === "coordinator") throw new CampusError(`${who.name} is already a coordinator.`, 409);
  if (existing?.role === "ambassador") throw new CampusError(`${who.name} is an ambassador on ${existing.coordinatorUid === v.uid ? "your" : "a"} team. Remove them from it first.`, 409);
  const m: CampusMember = { uid: who.uid, role: "coordinator", country: input.country, ...placeOf({ campus: input.campus || "Country team", state: input.state }), username: who.username, name: who.name, addedBy: v.uid, addedAt: now.toISOString() };
  await db.doc(`campusTeam/${who.uid}`).set(m);
  await notify({ uid: who.uid, linkHref: "/admin/campus", message: `You're now a #NotesApp campus coordinator for ${CAMPUS_COUNTRIES.find((c) => c.code === m.country)!.name}. Open Campus to add your ambassadors.` });
  return m;
}

// A coordinator adds her ambassadors (a lead may add one to a named coordinator's team).
export async function addAmbassador(db: Firestore, auth: Pick<Auth, "getUserByEmail">, v: Viewer, input: Record<string, unknown>, notify: Notify, now = new Date()) {
  let coord = coordinatorOf(v);
  if (!coord && v.lead && typeof input.coordinatorUid === "string") {
    const c = (await db.doc(`campusTeam/${input.coordinatorUid}`).get()).data() as CampusMember | undefined;
    if (c?.role === "coordinator") coord = c;
  }
  if (!coord) throw new CampusError("Only a campus coordinator can add ambassadors.", 403);
  const who = await findAccount(db, auth, input.who);
  if (who.uid === coord.uid) throw new CampusError("That's the coordinator.");
  const existing = (await db.doc(`campusTeam/${who.uid}`).get()).data() as CampusMember | undefined;
  if (existing) throw new CampusError(existing.coordinatorUid === coord.uid ? `${who.name} is already on this team.` : `${who.name} is already on a campus team.`, 409);
  const size = (await db.collection("campusTeam").where("coordinatorUid", "==", coord.uid).count().get()).data().count;
  if (size >= LIMITS.team) throw new CampusError(`A team can have ${LIMITS.team} ambassadors.`, 409);
  const m: CampusMember = { uid: who.uid, role: "ambassador", country: coord.country, ...placeOf(input), coordinatorUid: coord.uid, username: who.username, name: who.name, addedBy: v.uid, addedAt: now.toISOString() };
  await db.doc(`campusTeam/${who.uid}`).set(m);
  await notify({ uid: who.uid, linkHref: "/admin/campus", message: `${coord.name} added you to the #NotesApp campus team (${m.campus}). Open Campus to see your tasks and your link.` });
  return m;
}

// A coordinator removes her own ambassadors; a lead removes anyone (a coordinator only once her team has moved or gone).
export async function removeMember(db: Firestore, v: Viewer, uid: unknown, notify: Notify) {
  const target = (await db.doc(`campusTeam/${String(uid)}`).get()).data() as CampusMember | undefined;
  if (!target) throw new CampusError("They're not on a campus team.", 404);
  const mine = target.role === "ambassador" && target.coordinatorUid === v.uid;
  if (!mine && !v.lead) throw new CampusError("You can only remove ambassadors on your own team.", 403);
  if (target.role === "coordinator") {
    const left = (await db.collection("campusTeam").where("coordinatorUid", "==", target.uid).count().get()).data().count;
    if (left) throw new CampusError(`${target.name} still has ${left} ambassador${left === 1 ? "" : "s"}. Move them to another coordinator first.`, 409);
  }
  await db.doc(`campusTeam/${target.uid}`).delete();
  await notify({ uid: target.uid, linkHref: "/", message: "You're no longer on the #NotesApp campus team. Thank you for everything you did." });
  return { removed: target.uid };
}

// A lead moves a coordinator's ambassadors to another coordinator in the same country (their tasks stay with the old coordinator).
export async function moveTeam(db: Firestore, v: Viewer, fromUid: unknown, toUid: unknown, notify: Notify) {
  if (!v.lead) throw new CampusError("Only super admins, the Chief of Staff and Marketing move teams.", 403);
  const [from, to] = await Promise.all([db.doc(`campusTeam/${String(fromUid)}`).get(), db.doc(`campusTeam/${String(toUid)}`).get()]).then((d) => d.map((x) => x.data() as CampusMember | undefined));
  if (from?.role !== "coordinator" || to?.role !== "coordinator") throw new CampusError("Choose two coordinators.");
  if (from.uid === to.uid) throw new CampusError("Choose a different coordinator.");
  if (from.country !== to.country) throw new CampusError("Teams move within a country.");
  const team = await db.collection("campusTeam").where("coordinatorUid", "==", from.uid).get();
  const batch = db.batch();
  team.docs.forEach((d) => batch.update(d.ref, { coordinatorUid: to.uid }));
  await batch.commit();
  for (const d of team.docs) await notify({ uid: d.id, linkHref: "/admin/campus", message: `Your campus coordinator is now ${to.name}.` });
  return { moved: team.size };
}

// The people in view: a coordinator's own ambassadors; for a lead, everyone in a country (or one coordinator's team).
export async function team(db: Firestore, v: Viewer, opts: { country?: unknown; coordinatorUid?: unknown } = {}): Promise<CampusMember[]> {
  const coord = coordinatorOf(v);
  let q;
  if (v.lead && typeof opts.coordinatorUid === "string" && opts.coordinatorUid) q = db.collection("campusTeam").where("coordinatorUid", "==", opts.coordinatorUid);
  else if (v.lead) q = db.collection("campusTeam").where("country", "==", isCampusCountry(opts.country) ? opts.country : coord?.country ?? "NG");
  else if (coord) q = db.collection("campusTeam").where("coordinatorUid", "==", coord.uid);
  else throw new CampusError("Only coordinators see the team.", 403);
  return (await q.get()).docs.map((d) => d.data() as CampusMember).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "coordinator" ? -1 : 1));
}

// ---- tasks ----

export async function createTask(db: Firestore, v: Viewer, input: Record<string, unknown>, notify: Notify, now = new Date()): Promise<CampusTask> {
  const coord = mustCoordinate(v);
  const fields = cleanTask(input, campusDay(coord.country, now));
  const mine = (await db.collection("campusTeam").where("coordinatorUid", "==", coord.uid).get()).docs.map((d) => d.id);
  const assignees = input.assignees === "all" ? mine : Array.isArray(input.assignees) ? Array.from(new Set(input.assignees.map(String))) : [];
  if (!assignees.length) throw new CampusError(mine.length ? "Choose who the task is for." : "Add your ambassadors first, then give them tasks.");
  if (assignees.some((u) => !mine.includes(u))) throw new CampusError("Tasks can only go to ambassadors on your team.", 403);
  if (assignees.length > LIMITS.assignees) throw new CampusError(`A task can go to ${LIMITS.assignees} ambassadors at most.`);
  const ref = db.collection("campusTasks").doc();
  const at = now.toISOString();
  const task: CampusTask = { id: ref.id, country: coord.country, coordinatorUid: coord.uid, ...fields, assignees, progress: Object.fromEntries(assignees.map((u) => [u, { status: "todo" as const }])), createdBy: v.uid, createdAt: at, updatedAt: at };
  await ref.set(task);
  for (const uid of assignees) await notify({ uid, linkHref: "/admin/campus/tasks", message: `New campus task from ${coord.name}: ${task.title} (due ${task.due}).` });
  return task;
}

async function ownTask(db: Firestore, v: Viewer, id: unknown) {
  const coord = mustCoordinate(v);
  const ref = db.doc(`campusTasks/${String(id)}`);
  const t = (await ref.get()).data() as CampusTask | undefined;
  if (!t || t.coordinatorUid !== coord.uid) throw new CampusError("That task wasn't found.", 404);
  return { ref, t, coord };
}

// Edit the task, and add (never silently drop) ambassadors: someone taken off keeps what they reported, the task just leaves their list.
export async function updateTask(db: Firestore, v: Viewer, id: unknown, input: Record<string, unknown>, notify: Notify, now = new Date()) {
  const { ref, t, coord } = await ownTask(db, v, id);
  const fields = cleanTask({ ...t, ...input }, input.due && input.due !== t.due ? campusDay(t.country, now) : "0000-00-00");
  let assignees = t.assignees;
  if (input.assignees !== undefined) {
    const mine = (await db.collection("campusTeam").where("coordinatorUid", "==", coord.uid).get()).docs.map((d) => d.id);
    assignees = input.assignees === "all" ? mine : Array.isArray(input.assignees) ? Array.from(new Set(input.assignees.map(String))) : t.assignees;
    if (!assignees.length) throw new CampusError("A task needs at least one ambassador.");
    if (assignees.some((u) => !mine.includes(u) && !t.assignees.includes(u))) throw new CampusError("Tasks can only go to ambassadors on your team.", 403);
  }
  const added = assignees.filter((u) => !t.assignees.includes(u));
  const progress = { ...t.progress };
  for (const u of added) progress[u] = progress[u] ?? { status: "todo" };
  await ref.update({ ...fields, ...(fields.target ? {} : { target: FieldValue.delete() }), assignees, progress, updatedAt: now.toISOString() });
  for (const uid of added) await notify({ uid, linkHref: "/admin/campus/tasks", message: `New campus task from ${coord.name}: ${fields.title} (due ${fields.due}).` });
  return { ...t, ...fields, assignees, progress };
}

export async function deleteTask(db: Firestore, v: Viewer, id: unknown) {
  const { ref } = await ownTask(db, v, id);
  await ref.delete();
  return { deleted: ref.id };
}

// What someone sees: an ambassador her own tasks with only her own progress; a coordinator her tasks; a lead a country's.
export async function tasks(db: Firestore, v: Viewer, opts: { country?: unknown; coordinatorUid?: unknown } = {}): Promise<CampusTask[]> {
  let list: CampusTask[];
  if (v.member?.role === "ambassador" && !v.lead) {
    list = (await db.collection("campusTasks").where("assignees", "array-contains", v.uid).get()).docs.map((d) => d.data() as CampusTask)
      .map((t) => ({ ...t, assignees: [v.uid], progress: { [v.uid]: t.progress[v.uid] ?? { status: "todo" } } }));
  } else if (v.member?.role === "coordinator" && !(v.lead && opts.coordinatorUid && opts.coordinatorUid !== v.uid) && !(v.lead && opts.country && opts.country !== v.member.country)) {
    list = (await db.collection("campusTasks").where("coordinatorUid", "==", v.uid).get()).docs.map((d) => d.data() as CampusTask);
  } else if (v.lead) {
    const q = typeof opts.coordinatorUid === "string" && opts.coordinatorUid
      ? db.collection("campusTasks").where("coordinatorUid", "==", opts.coordinatorUid)
      : db.collection("campusTasks").where("country", "==", isCampusCountry(opts.country) ? opts.country : "NG");
    list = (await q.get()).docs.map((d) => d.data() as CampusTask);
  } else throw new CampusError("Campus is for coordinators and ambassadors.", 403);
  return list.sort((a, b) => a.due.localeCompare(b.due) || b.createdAt.localeCompare(a.createdAt));
}

// An ambassador reports on her task: to do, in progress or done, with a note and a link as proof. Reporting again after "redo" clears it.
export async function report(db: Firestore, v: Viewer, id: unknown, input: Record<string, unknown>, notify: Notify, now = new Date()) {
  if (v.member?.role !== "ambassador") throw new CampusError("Only ambassadors report on tasks.", 403);
  const status = input.status;
  if (status !== "todo" && status !== "doing" && status !== "done") throw new CampusError("Choose To do, In progress or Done.");
  const note = String(input.note ?? "").trim().slice(0, LIMITS.note);
  const proofUrl = cleanUrl(input.proofUrl);
  const ref = db.doc(`campusTasks/${String(id)}`);
  const at = now.toISOString();
  const t = await db.runTransaction(async (tx) => {
    const t = (await tx.get(ref)).data() as CampusTask | undefined;
    if (!t || !t.assignees.includes(v.uid)) throw new CampusError("That task wasn't found.", 404);
    const p: Progress = { status: status as ProgressStatus, ...(note ? { note } : {}), ...(proofUrl ? { proofUrl } : {}), updatedAt: at };
    tx.update(ref, { [`progress.${v.uid}`]: p, updatedAt: at });
    return t;
  });
  await db.doc(`campusTeam/${v.uid}`).update({ lastCheckIn: at }).catch(() => {});
  if (status === "done") await notify({ uid: t.coordinatorUid, linkHref: "/admin/campus/tasks", message: `${v.member.name} finished "${t.title}". Review it in Campus.` });
  return { ok: true };
}

// The coordinator approves what was handed in, or asks for it again with a note.
export async function review(db: Firestore, v: Viewer, id: unknown, uid: unknown, verdict: unknown, note: unknown, notify: Notify, now = new Date()) {
  const { ref, t } = await ownTask(db, v, id);
  const who = String(uid);
  const p = t.progress[who];
  if (!t.assignees.includes(who) || !p) throw new CampusError("They're not on this task.", 404);
  if (p.status !== "done") throw new CampusError("You can review it once they mark it done.", 409);
  if (verdict !== "approved" && verdict !== "redo") throw new CampusError("Approve it or ask for it again.");
  const reviewNote = String(note ?? "").trim().slice(0, LIMITS.note);
  if (verdict === "redo" && !reviewNote) throw new CampusError("Say what needs doing again.");
  const next: Progress = { ...p, review: verdict, ...(reviewNote ? { reviewNote } : {}), reviewedAt: now.toISOString(), ...(verdict === "redo" ? { status: "doing" as const } : {}) };
  await ref.update({ [`progress.${who}`]: next, updatedAt: now.toISOString() });
  await notify({ uid: who, linkHref: "/admin/campus/tasks", message: verdict === "approved" ? `"${t.title}" was approved. Well done!` : `"${t.title}" needs another go: ${reviewNote}` });
  return next;
}

// ---- how everyone is doing ----

// Sign-ups through one ambassador's link or code: this month (by the country's own day) and in all. Kept five minutes, as the leaderboard
// asks for a whole country at once.
const signupCache = new Map<string, { at: number; month: number; all: number }>();
export const clearSignupCache = () => signupCache.clear();
async function signupsOf(db: Firestore, uid: string, country: string, monthStart: string, now: Date) {
  const key = `${uid}|${country}|${monthStart}`;
  const hit = signupCache.get(key);
  if (hit && now.getTime() - hit.at < 300_000 && now.getTime() >= hit.at) return hit;
  const refs = (await db.collection("referrals").where("referredBy", "==", uid).limit(5000).get()).docs.map((d) => String(d.data().referredAt ?? ""));
  const row = { at: now.getTime(), month: refs.filter((at) => at && campusDay(country, new Date(at)) >= monthStart).length, all: refs.length };
  signupCache.set(key, row);
  if (signupCache.size > 5000) signupCache.delete(signupCache.keys().next().value as string);
  return row;
}

// The country a view is about: an ambassador's or coordinator's own, or the one a lead chose.
function scopeCountry(v: Viewer, opts: { country?: unknown }): CampusCountry {
  if (v.member && !v.lead) return v.member.country;
  return isCampusCountry(opts.country) ? opts.country : v.member?.country ?? "NG";
}

export type AmbassadorStats = {
  uid: string; name: string; username: string; campus: string; state?: string; coordinatorUid?: string; lastCheckIn?: string;
  signupsMonth: number; signupsAll: number; done: number; open: number; overdue: number; redo: number;
  pointsMonth: number; pointsAll: number; level: { name: string; emoji: string };
};

// Sign-ups through each ambassador's link or code (this month in the country's own days, and all time), her tasks and her points.
export async function overview(db: Firestore, v: Viewer, opts: { country?: unknown; coordinatorUid?: unknown } = {}, now = new Date()) {
  const country = scopeCountry(v, opts);
  const today = campusDay(country, now), monthStart = `${today.slice(0, 7)}-01`;
  const people = v.member?.role === "ambassador" && !v.lead ? [v.member] : (await team(db, v, opts)).filter((m) => m.role === "ambassador");
  const list = v.member?.role === "ambassador" && !v.lead ? await tasks(db, v) : await tasks(db, v, opts);
  const stats: AmbassadorStats[] = [];
  for (const m of people) {
    const s = await signupsOf(db, m.uid, m.country, monthStart, now);
    const ap = approvedTally(list, m.uid, monthStart, m.country);
    const pointsAll = pointsOf({ signups: s.all, ...ap.all });
    const { level } = levelFor(pointsAll);
    stats.push({ uid: m.uid, name: m.name, username: m.username, campus: m.campus, state: m.state, coordinatorUid: m.coordinatorUid, lastCheckIn: m.lastCheckIn,
      signupsMonth: s.month, signupsAll: s.all, ...taskCounts(list, m.uid, today),
      pointsMonth: pointsOf({ signups: s.month, ...ap.month }), pointsAll, level: { name: level.name, emoji: level.emoji } });
  }
  stats.sort((a, b) => b.signupsMonth - a.signupsMonth || b.signupsAll - a.signupsAll || b.done - a.done || a.name.localeCompare(b.name));
  const sum = (k: "signupsMonth" | "signupsAll" | "done" | "open" | "overdue") => stats.reduce((t, x) => t + x[k], 0);
  return {
    country, month: monthStart.slice(0, 7), today,
    totals: { ambassadors: stats.length, signupsMonth: sum("signupsMonth"), signupsAll: sum("signupsAll"), done: sum("done"), open: sum("open"), overdue: sum("overdue"), tasks: list.length },
    ambassadors: stats,
  };
}

// ---- the leaderboard: every ambassador in the programme can see it ----

export type BoardRow = { rank: number; medal?: string; uid?: string; name: string; campus: string; points: number; signups: number; approved: number; level: { name: string; emoji: string }; me: boolean };
export const BOARD_SHOWN = 50;

// Ambassadors ranked by points, for "my team" (one coordinator's ambassadors) or the whole country, this month or in all. Names are
// shortened ("Chioma E.") and only the people running the programme get the uids. Ties share a rank.
export async function leaderboard(db: Firestore, v: Viewer, opts: { scope?: unknown; period?: unknown; country?: unknown; coordinatorUid?: unknown } = {}, now = new Date()) {
  if (!v.lead && !v.member) throw new CampusError("Campus is for coordinators and ambassadors.", 403);
  const scope = opts.scope === "country" ? "country" : "team";
  const period = opts.period === "all" ? "all" : "month";
  const country = scopeCountry(v, opts);
  // Whose team: an ambassador's coordinator, a coordinator's own, or the one a lead chose (no team: the whole country).
  const teamOf = v.member?.role === "ambassador" ? v.member.coordinatorUid : v.member?.role === "coordinator" && !(v.lead && opts.coordinatorUid) ? v.member.uid : typeof opts.coordinatorUid === "string" && opts.coordinatorUid ? opts.coordinatorUid : undefined;
  const byTeam = scope === "team" && !!teamOf;
  const q = byTeam ? db.collection("campusTeam").where("coordinatorUid", "==", teamOf) : db.collection("campusTeam").where("country", "==", country);
  const people = (await q.get()).docs.map((d) => d.data() as CampusMember).filter((m) => m.role === "ambassador" && m.country === country);
  const today = campusDay(country, now), monthStart = `${today.slice(0, 7)}-01`;
  const allTasks = (await db.collection("campusTasks").where("country", "==", country).get()).docs.map((d) => d.data() as CampusTask);
  const scored = [];
  for (const m of people) {
    const s = await signupsOf(db, m.uid, country, monthStart, now);
    const ap = approvedTally(allTasks, m.uid, monthStart, country);
    const all = { signups: s.all, ...ap.all }, month = { signups: s.month, ...ap.month };
    const t = period === "all" ? all : month;
    const { level } = levelFor(pointsOf(all));
    scored.push({ m, points: pointsOf(t), signups: t.signups, approved: t.approved, level: { name: level.name, emoji: level.emoji } });
  }
  scored.sort((a, b) => b.points - a.points || b.signups - a.signups || a.m.name.localeCompare(b.m.name));
  const staff = v.lead || v.member?.role === "coordinator";
  let rank = 0, last = -1;
  const rows: BoardRow[] = scored.map((x, i) => {
    if (x.points !== last) { rank = i + 1; last = x.points; }
    return {
      rank, ...(rank <= 3 && x.points > 0 ? { medal: MEDALS[rank - 1] } : {}), ...(staff ? { uid: x.m.uid } : {}),
      name: staff ? x.m.name : shortName(x.m.name), campus: x.m.campus, points: x.points, signups: x.signups, approved: x.approved, level: x.level, me: x.m.uid === v.uid,
    };
  });
  const mine = rows.find((r) => r.me) ?? null;
  const shown = rows.slice(0, BOARD_SHOWN);
  // My own standing: where I am, my level from all-time points, and how far to the next.
  let standing = null;
  if (v.member?.role === "ambassador") {
    const meScore = scored.find((x) => x.m.uid === v.uid);
    const s = await signupsOf(db, v.uid, country, monthStart, now);
    const ap = approvedTally(allTasks, v.uid, monthStart, country);
    const allPts = pointsOf({ signups: s.all, ...ap.all });
    const lv = levelFor(allPts);
    standing = { rank: mine?.rank ?? null, of: rows.length, points: meScore?.points ?? 0, pointsAll: allPts, level: lv.level, next: lv.next, toNext: lv.toNext };
  }
  return {
    scope: byTeam ? "team" : "country", period, country, month: monthStart.slice(0, 7), rules: { points: POINTS, levels: LEVELS },
    rows: mine && !shown.includes(mine) ? [...shown, mine] : shown, total: rows.length, standing,
  };
}

export const countryOf = (c: unknown): CampusCountry => (isCampusCountry(c) ? c : "NG");
