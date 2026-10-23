import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { notifyBell } from "./email";
import { addDays, canSeeMeeting, isOwner, lagosDate, weekStart, type TeamItem } from "./team";
import { listTeamPeople, type Person } from "./team-server";
import { weekInvoiced } from "./invoices-server";
import {
  EVERYONE, TimeError, approvedMinutesInMonth, asking, answerBy, canApprove, canSee, cleanLeads, cleanLeave, cleanManual, cleanNote, cleanProject,
  cleanTargetInput, confirmTimer, parseDuration, entryFromTimer, isApprover, isDay, isWeek, lagosClock, leaveDays, locked, payFor, rowKey, settle, startTimer,
  weekRows, weekSummary, fridayNudgeDue,
  type Leave, type Project, type SheetStatus, type Target, type TimeEntry, type Timer, type Timesheet, type Viewer,
} from "./time";

// Server side of Time (lib/time.ts has the rules). Collections, all server-only in firestore.rules:
//   timeTimers/{uid}            the running timer, one per person
//   timeEntries/{id}            tracked time; `uidWeek` (uid_YYYY-MM-DD of the Monday) and `week` keep every read to one equality
//   timeSheets/{uid_week}       the week's status: draft, submitted, approved
//   timeLeave/{id}              leave requests (uid "*" is a public holiday for everyone)
//   timeProjects/{id}           projects, with running totals of minutes (and billable minutes) logged against them
//   timeLeads/{uid}             the departments a person leads (set by super admins)
//   timeNudges/{week}           the Friday reminders already sent
const TIMERS = "timeTimers", ENTRIES = "timeEntries", SHEETS = "timeSheets", LEAVE = "timeLeave", PROJECTS = "timeProjects", LEADS = "timeLeads", NUDGES = "timeNudges";
const PAGE = "/admin/team/time";
type Notify = typeof notifyBell;
const quiet = (p: Promise<unknown>) => p.catch(() => {});
const sheetId = (uid: string, week: string) => `${uid}_${week}`;

export type Me = { uid: string; superAdmin: boolean; owner: boolean; finance: boolean };

export async function viewerOf(db: Firestore, me: Me): Promise<Viewer & { finance: boolean }> {
  const d = (await db.doc(`${LEADS}/${me.uid}`).get()).data();
  return { uid: me.uid, superAdmin: me.superAdmin, owner: me.owner, leads: cleanLeads(d?.depts), finance: me.finance };
}

// ── What time can be for ─────────────────────────────────────────────────────────────────────────────────────────────────────────

async function resolveTarget(db: Firestore, uid: string, b: Record<string, unknown>, people?: Person[]): Promise<Target> {
  const t = cleanTargetInput(b);
  const myDept = async () => ((people ?? (await listTeamPeople(db))).find((p) => p.uid === uid)?.depts ?? [])[0] ?? "";
  if (t.kind === "item") {
    const s = await db.doc(`teamItems/${t.refId}`).get();
    if (!s.exists) throw new TimeError("That work item wasn't found.", 404);
    const i = s.data() as TeamItem;
    return { kind: "item", refId: s.id, label: i.title, dept: i.depts?.[0] ?? (await myDept()), billable: t.billable };
  }
  if (t.kind === "project") {
    const s = await db.doc(`${PROJECTS}/${t.refId}`).get();
    if (!s.exists || s.data()!.active === false) throw new TimeError("That project wasn't found or is closed.", 404);
    const p = s.data() as Project;
    return { kind: "project", refId: s.id, label: p.name, dept: p.dept || (await myDept()), billable: p.billable };
  }
  if (t.kind === "meeting") {
    const s = await db.doc(`teamMeetings/${t.refId}`).get();
    if (!s.exists || !canSeeMeeting(s.data() as { memberUids?: string[] }, uid)) throw new TimeError("That meeting wasn't found.", 404);
    const team = String(s.data()!.team ?? "");
    return { kind: "meeting", refId: s.id, label: String(s.data()!.title), dept: team && team !== "all" && team !== "custom" ? team : await myDept(), billable: t.billable };
  }
  return { kind: "other", refId: "", label: t.label, dept: await myDept(), billable: t.billable };
}

// The choices for the timer: my open work items (assigned ones first), active projects, and meetings from yesterday to the week ahead.
export async function choices(db: Firestore, uid: string, now = new Date()) {
  const today = lagosDate(now);
  const [items, projects, meetings] = await Promise.all([
    db.collection("teamItems").orderBy("createdAt", "desc").limit(500).get(),
    db.collection(PROJECTS).get(),
    db.collection("teamMeetings").where("startsAt", ">=", `${addDays(today, -1)}T00:00:00`).limit(100).get(),
  ]);
  const open = items.docs.map((d) => ({ ...(d.data() as TeamItem), id: d.id })).filter((i) => i.status !== "done");
  return {
    items: [...open.filter((i) => isOwner(i, uid)), ...open.filter((i) => !isOwner(i, uid))].slice(0, 200).map((i) => ({ id: i.id, title: i.title, mine: isOwner(i, uid), dept: i.depts?.[0] ?? "" })),
    projects: projects.docs.map((d) => toProject(d.id, d.data())).filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)),
    meetings: meetings.docs.map((d) => ({ id: d.id, ...(d.data() as { title: string; startsAt: string; memberUids?: string[]; status?: string }) }))
      .filter((m) => canSeeMeeting(m, uid) && m.startsAt.slice(0, 10) <= addDays(today, 7)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((m) => ({ id: m.id, title: m.title, startsAt: m.startsAt })),
  };
}

const toProject = (id: string, d: FirebaseFirestore.DocumentData): Project & { minutes: number; billableMinutes: number } => ({
  id, name: d.name, client: d.client ?? "", clientEmail: d.clientEmail ?? "", dept: d.dept ?? "", billable: !!d.billable, rateKobo: d.rateKobo ?? 0, budgetHours: d.budgetHours ?? 0, active: d.active !== false, createdAt: d.createdAt ?? "",
  minutes: d.minutes ?? 0, billableMinutes: d.billableMinutes ?? 0,
});

// ── Writing time ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function sheetStatus(db: Firestore, uid: string, week: string): Promise<SheetStatus> {
  return ((await db.doc(`${SHEETS}/${sheetId(uid, week)}`).get()).data()?.status as SheetStatus) ?? "draft";
}
async function needOpen(db: Firestore, uid: string, day: string) {
  if (locked(await sheetStatus(db, uid, weekStart(day)))) throw new TimeError(`The week of ${weekStart(day)} is submitted. Ask your team lead to return it before you change it.`, 409);
}

// Every write of time goes through here, so project totals stay right.
async function writeEntry(db: Firestore, e: Omit<TimeEntry, "id">): Promise<TimeEntry> {
  const ref = db.collection(ENTRIES).doc();
  const week = weekStart(e.day);
  const batch = db.batch();
  batch.set(ref, { ...e, week, uidWeek: sheetId(e.uid, week) });
  if (e.kind === "project" && e.refId) batch.set(db.doc(`${PROJECTS}/${e.refId}`), { minutes: FieldValue.increment(e.minutes), ...(e.billable ? { billableMinutes: FieldValue.increment(e.minutes) } : {}) }, { merge: true });
  await batch.commit();
  return { ...e, id: ref.id };
}

export async function deleteEntry(db: Firestore, uid: string, id: unknown) {
  const ref = db.doc(`${ENTRIES}/${String(id)}`);
  const s = await ref.get();
  if (!s.exists || s.data()!.uid !== uid) throw new TimeError("That time wasn't found.", 404);
  const e = s.data() as TimeEntry;
  await needOpen(db, uid, e.day);
  const batch = db.batch();
  batch.delete(ref);
  if (e.kind === "project" && e.refId) batch.set(db.doc(`${PROJECTS}/${e.refId}`), { minutes: FieldValue.increment(-e.minutes), ...(e.billable ? { billableMinutes: FieldValue.increment(-e.minutes) } : {}) }, { merge: true });
  await batch.commit();
}

// Stops a timer that has stopped by itself (no answer, or midnight) and records its time. Returns what it recorded.
async function settleOne(db: Firestore, t: Timer, now: Date, notify: Notify): Promise<{ entry: TimeEntry | null; flag?: string } | null> {
  const s = settle(t, now.toISOString());
  if (!s) return null;
  const ref = db.doc(`${TIMERS}/${t.uid}`);
  // Only one caller records it: the page and the scheduled sweep can arrive together.
  const won = await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists || cur.data()!.startedAt !== t.startedAt) return false;
    tx.delete(ref);
    return true;
  });
  if (!won) return { entry: null };
  const e = entryFromTimer(t, s.endedAt, s.flag, now.toISOString());
  const entry = e && !locked(await sheetStatus(db, t.uid, weekStart(e.day))) ? await writeEntry(db, e) : null;
  const msg = s.flag === "midnight"
    ? `Your timer for “${t.label}” was still running at midnight, so it stopped then. Check the time on your timesheet.`
    : `Your timer for “${t.label}” stopped at ${lagosClock(s.endedAt)} because the time check wasn't answered. The unanswered half hour isn't counted.`;
  await quiet(notify({ uid: t.uid, type: "team", linkHref: PAGE, message: msg }));
  return { entry, flag: s.flag };
}

export async function getTimer(db: Firestore, uid: string, now = new Date(), notify: Notify = notifyBell): Promise<{ timer: Timer | null; stopped: { entry: TimeEntry | null; flag?: string } | null }> {
  const s = await db.doc(`${TIMERS}/${uid}`).get();
  if (!s.exists) return { timer: null, stopped: null };
  const t = s.data() as Timer;
  const stopped = await settleOne(db, t, now, notify);
  return stopped ? { timer: null, stopped } : { timer: t, stopped: null };
}

async function stopAt(db: Firestore, t: Timer, endIso: string, now: Date): Promise<TimeEntry | null> {
  await db.doc(`${TIMERS}/${t.uid}`).delete();
  const e = entryFromTimer(t, endIso, undefined, now.toISOString());
  return e ? writeEntry(db, e) : null;
}

export async function start(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date(), notify: Notify = notifyBell) {
  await needOpen(db, uid, lagosDate(now));
  const target = await resolveTarget(db, uid, b);
  const { timer: running } = await getTimer(db, uid, now, notify);
  if (running) await stopAt(db, running, now.toISOString(), now); // one timer at a time: starting another stops the first
  const t = startTimer(uid, target, cleanNote(b.note), now.toISOString(), target.kind === "meeting" ? Number(b.plannedMinutes) : undefined);
  await db.doc(`${TIMERS}/${uid}`).set(JSON.parse(JSON.stringify(t)));
  return { timer: t };
}

export async function stop(db: Firestore, uid: string, now = new Date(), notify: Notify = notifyBell) {
  const { timer, stopped } = await getTimer(db, uid, now, notify);
  if (stopped) return { entry: stopped.entry, flag: stopped.flag };
  if (!timer) throw new TimeError("No timer is running.", 409);
  return { entry: await stopAt(db, timer, now.toISOString(), now) };
}

export async function confirm(db: Firestore, uid: string, now = new Date(), notify: Notify = notifyBell) {
  const { timer, stopped } = await getTimer(db, uid, now, notify);
  if (stopped) return { timer: null, stopped };
  if (!timer) throw new TimeError("No timer is running.", 409);
  const next = confirmTimer(timer, now.toISOString());
  await db.doc(`${TIMERS}/${uid}`).set(JSON.parse(JSON.stringify(next)));
  return { timer: next, stopped: null };
}

async function dayTotal(db: Firestore, uid: string, day: string) {
  const s = await db.collection(ENTRIES).where("uidWeek", "==", sheetId(uid, weekStart(day))).get();
  return s.docs.filter((d) => d.data().day === day).reduce((n, d) => n + (d.data().minutes ?? 0), 0);
}

export async function addManual(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()) {
  const { day, minutes } = cleanManual(b, lagosDate(now));
  await needOpen(db, uid, day);
  const target = await resolveTarget(db, uid, b);
  if ((await dayTotal(db, uid, day)) + minutes > 24 * 60) throw new TimeError("That would make the day longer than 24 hours.");
  return { entry: await writeEntry(db, { ...target, uid, day, minutes, startedAt: "", endedAt: "", note: cleanNote(b.note), source: "manual", createdAt: now.toISOString() }) };
}

// A timesheet cell set to a new total: the difference is recorded as a correction, so what was tracked stays visible.
export async function setCell(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()) {
  if (!isDay(b.day)) throw new TimeError("Choose the day.");
  const day = String(b.day);
  if (day > lagosDate(now)) throw new TimeError("You can't add time for a day that hasn't come yet.");
  const want = parseDuration(b.duration);
  if (want === null || want < 0 || want > 24 * 60) throw new TimeError("Enter the time as 1:30, 1h30 or 90m (0 clears it).");
  await needOpen(db, uid, day);
  const target = await resolveTarget(db, uid, b);
  const key = rowKey(target);
  const s = await db.collection(ENTRIES).where("uidWeek", "==", sheetId(uid, weekStart(day))).get();
  const sameDay = s.docs.map((d) => d.data() as TimeEntry).filter((e) => e.day === day);
  const have = sameDay.filter((e) => rowKey(e) === key).reduce((n, e) => n + e.minutes, 0);
  const delta = want - have;
  if (delta === 0) return { entry: null };
  if (sameDay.reduce((n, e) => n + e.minutes, 0) + delta > 24 * 60) throw new TimeError("That would make the day longer than 24 hours.");
  return { entry: await writeEntry(db, { ...target, uid, day, minutes: delta, startedAt: "", endedAt: "", note: "Timesheet correction", source: "adjust", createdAt: now.toISOString() }) };
}

// ── Reading a week ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function leaveFor(db: Firestore, uids: string[], from: string, to: string): Promise<Leave[]> {
  const s = await db.collection(LEAVE).where("to", ">=", from).get();
  return s.docs.map((d) => ({ ...(d.data() as Omit<Leave, "id">), id: d.id })).filter((l) => l.from <= to && (l.uid === EVERYONE || uids.includes(l.uid)));
}

async function hourlyRates(db: Firestore): Promise<Map<string, number>> {
  const s = await db.collection("payrollStaff").get();
  const m = new Map<string, number>();
  s.docs.forEach((d) => { const x = d.data(); if (x.uid && x.active !== false && x.basis !== "monthly" && x.hourlyKobo) m.set(x.uid, x.hourlyKobo); });
  return m;
}

export async function myWeek(db: Firestore, uid: string, week: string, now = new Date()) {
  if (!isWeek(week)) throw new TimeError("Choose a week (its Monday).");
  const [entries, sheet, leave, rates] = await Promise.all([
    db.collection(ENTRIES).where("uidWeek", "==", sheetId(uid, week)).get().then((s) => s.docs.map((d) => ({ ...(d.data() as TimeEntry), id: d.id }))),
    db.doc(`${SHEETS}/${sheetId(uid, week)}`).get().then((s) => (s.data() as Timesheet | undefined) ?? { uid, week, status: "draft" as const }),
    leaveFor(db, [uid], week, addDays(week, 6)),
    hourlyRates(db),
  ]);
  const mine = leave.filter((l) => l.uid === uid || l.uid === EVERYONE);
  const summary = weekSummary(week, entries, mine, lagosDate(now));
  const rate = rates.get(uid) ?? 0;
  return { week, entries: entries.sort((a, b) => (a.day + a.startedAt).localeCompare(b.day + b.startedAt)), rows: weekRows(entries), sheet, summary, leave: mine, hourlyKobo: rate, payKobo: sheet.status === "approved" ? payFor(summary.tracked, rate) : 0 };
}

export async function myLeave(db: Firestore, uid: string) {
  const s = await db.collection(LEAVE).where("uid", "in", [uid, EVERYONE]).get();
  return s.docs.map((d) => ({ ...(d.data() as Omit<Leave, "id">), id: d.id })).sort((a, b) => b.from.localeCompare(a.from)).slice(0, 30);
}

// The team report for a week: the people the viewer may see, their numbers and timesheets, leave to decide, and projects.
export async function teamWeek(db: Firestore, v: Viewer & { finance: boolean }, week: string, now = new Date()) {
  if (!isApprover(v)) throw new TimeError("The team report is for team leads and super admins.", 403);
  if (!isWeek(week)) throw new TimeError("Choose a week (its Monday).");
  const people = (await listTeamPeople(db)).filter((p) => canSee(v, p));
  const uids = people.map((p) => p.uid);
  const [entriesSnap, sheetsSnap, leave, projects, rates, leads, pending] = await Promise.all([
    db.collection(ENTRIES).where("week", "==", week).get(),
    db.collection(SHEETS).where("week", "==", week).get(),
    leaveFor(db, uids, week, addDays(week, 6)),
    db.collection(PROJECTS).get(),
    hourlyRates(db),
    db.collection(LEADS).get(),
    db.collection(LEAVE).where("status", "==", "pending").get(),
  ]);
  const entries = entriesSnap.docs.map((d) => d.data() as TimeEntry);
  const sheets = new Map(sheetsSnap.docs.map((d) => [d.data().uid as string, d.data() as Timesheet]));
  const today = lagosDate(now);
  const rows = people.map((p) => {
    const mine = entries.filter((e) => e.uid === p.uid);
    const s = weekSummary(week, mine, leave.filter((l) => l.uid === p.uid || l.uid === EVERYONE), today);
    const status = sheets.get(p.uid)?.status ?? "draft";
    const rate = rates.get(p.uid) ?? 0;
    return { uid: p.uid, name: p.name, depts: p.depts ?? [], summary: s, status, canApprove: canApprove(v, p), ...(v.finance ? { hourlyKobo: rate, payKobo: status === "approved" ? payFor(s.tracked, rate) : 0 } : {}) };
  });
  const byUid = new Map(people.map((p) => [p.uid, p]));
  const leaveToDecide = pending.docs.map((d) => ({ ...(d.data() as Omit<Leave, "id">), id: d.id }))
    .filter((l) => { const p = byUid.get(l.uid); return !!p && canApprove(v, p); })
    .map((l) => ({ ...l, name: byUid.get(l.uid)!.name, days: leaveDays(l).length }));
  return {
    week, rows, leaveToDecide,
    projects: projects.docs.map((d) => toProject(d.id, d.data())).filter((p) => v.superAdmin || !p.dept || v.leads.includes(p.dept)).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    leads: v.superAdmin ? leads.docs.map((d) => ({ uid: d.id, depts: cleanLeads(d.data().depts) })).filter((l) => l.depts.length) : [],
    people: v.superAdmin ? (await listTeamPeople(db)).map((p) => ({ uid: p.uid, name: p.name, depts: p.depts ?? [] })) : [],
    holidays: (await db.collection(LEAVE).where("uid", "==", EVERYONE).get()).docs.map((d) => ({ ...(d.data() as Omit<Leave, "id">), id: d.id })).filter((l) => l.to >= addDays(lagosDate(now), -30)).sort((a, b) => a.from.localeCompare(b.from)),
  };
}

// ── Timesheets ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Who to tell about a submitted week or a leave request: the leads of the person's departments, else the super admins.
async function approversFor(db: Firestore, person: Person): Promise<string[]> {
  const leads = (await db.collection(LEADS).get()).docs.filter((d) => d.id !== person.uid && cleanLeads(d.data().depts).some((x) => (person.depts ?? []).includes(x))).map((d) => d.id);
  if (leads.length) return leads;
  const { listStaff } = await import("./admin-access-server");
  return (await listStaff(db)).filter((p) => p.role === "super" && p.uid !== person.uid).map((p) => p.uid);
}

export async function submit(db: Firestore, uid: string, week: unknown, now = new Date(), notify: Notify = notifyBell) {
  if (!isWeek(week)) throw new TimeError("Choose a week (its Monday).");
  const w = String(week);
  if (w > weekStart(lagosDate(now))) throw new TimeError("That week hasn't started yet.");
  const ref = db.doc(`${SHEETS}/${sheetId(uid, w)}`);
  const cur = ((await ref.get()).data()?.status as SheetStatus) ?? "draft";
  if (locked(cur)) throw new TimeError(cur === "approved" ? "That week is already approved." : "That week is already submitted.", 409);
  if ((await db.doc(`${TIMERS}/${uid}`).get()).exists && weekStart(lagosDate(now)) === w) throw new TimeError("Stop your timer before you submit the week.", 409);
  await ref.set({ uid, week: w, status: "submitted", submittedAt: now.toISOString(), returnNote: FieldValue.delete() }, { merge: true });
  const people = await listTeamPeople(db);
  const me = people.find((p) => p.uid === uid) ?? { uid, name: "Someone", email: "", depts: [] };
  const to = await approversFor(db, me);
  await Promise.all(to.map((u) => quiet(notify({ uid: u, type: "team", linkHref: `${PAGE}?tab=team&week=${w}`, message: `${me.name} submitted their timesheet for the week of ${w}.` }))));
  return { status: "submitted" as const };
}

export async function decideSheet(db: Firestore, v: Viewer, b: Record<string, unknown>, now = new Date(), notify: Notify = notifyBell) {
  if (!isWeek(b.week)) throw new TimeError("Choose a week (its Monday).");
  const week = String(b.week), uid = String(b.uid ?? "");
  const person = (await listTeamPeople(db)).find((p) => p.uid === uid);
  if (!person) throw new TimeError("That person wasn't found.", 404);
  if (!canApprove(v, person)) throw new TimeError(v.uid === uid ? "Someone else approves your own timesheet." : "Only their team lead or a super admin can do that.", 403);
  const ref = db.doc(`${SHEETS}/${sheetId(uid, week)}`);
  const cur = ((await ref.get()).data()?.status as SheetStatus) ?? "draft";
  if (b.decision === "approve") {
    if (cur === "approved") throw new TimeError("That week is already approved.", 409);
    await ref.set({ uid, week, status: "approved", decidedBy: v.uid, decidedAt: now.toISOString() }, { merge: true });
    await quiet(notify({ uid, type: "team", linkHref: `${PAGE}?tab=sheet&week=${week}`, message: `Your timesheet for the week of ${week} was approved.` }));
    return { status: "approved" as const };
  }
  if (b.decision === "return") {
    if (cur === "draft") throw new TimeError("That week is still a draft.", 409);
    const billed = await weekInvoiced(db, uid, week);
    if (billed) throw new TimeError(`This week's billable hours are on invoice ${billed}. Void the invoice first (Time → Invoices), then return the week.`, 409);
    const note = cleanNote(b.note);
    await ref.set({ uid, week, status: "draft", decidedBy: v.uid, decidedAt: now.toISOString(), returnNote: note }, { merge: true });
    await quiet(notify({ uid, type: "team", linkHref: `${PAGE}?tab=sheet&week=${week}`, message: `Your timesheet for the week of ${week} was returned to you${note ? `: ${note}` : ""}. Change it and submit it again.` }));
    return { status: "draft" as const };
  }
  throw new TimeError("Approve or return it.");
}

// ── Leave ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function requestLeave(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date(), notify: Notify = notifyBell) {
  const l = cleanLeave(b);
  const ref = await db.collection(LEAVE).add({ ...l, uid, status: "pending", createdAt: now.toISOString() });
  const people = await listTeamPeople(db);
  const me = people.find((p) => p.uid === uid) ?? { uid, name: "Someone", email: "", depts: [] };
  const to = await approversFor(db, me);
  await Promise.all(to.map((u) => quiet(notify({ uid: u, type: "team", linkHref: `${PAGE}?tab=team`, message: `${me.name} asked for ${leaveDays(l).length} day${leaveDays(l).length === 1 ? "" : "s"} of leave from ${l.from}.` }))));
  return { id: ref.id };
}

export async function cancelLeave(db: Firestore, uid: string, id: unknown) {
  const ref = db.doc(`${LEAVE}/${String(id)}`);
  const s = await ref.get();
  if (!s.exists || s.data()!.uid !== uid) throw new TimeError("That leave wasn't found.", 404);
  if (s.data()!.status !== "pending") throw new TimeError("It's already been decided. Ask your team lead to change it.", 409);
  await ref.delete();
}

export async function decideLeave(db: Firestore, v: Viewer, b: Record<string, unknown>, now = new Date(), notify: Notify = notifyBell) {
  const ref = db.doc(`${LEAVE}/${String(b.id ?? "")}`);
  const s = await ref.get();
  if (!s.exists) throw new TimeError("That leave wasn't found.", 404);
  const l = s.data() as Leave;
  const person = (await listTeamPeople(db)).find((p) => p.uid === l.uid);
  if (!person || !canApprove(v, person)) throw new TimeError("Only their team lead or a super admin can decide it.", 403);
  if (b.decision !== "approve" && b.decision !== "decline") throw new TimeError("Approve or decline it.");
  const status = b.decision === "approve" ? "approved" : "declined";
  await ref.update({ status, decidedBy: v.uid, decidedAt: now.toISOString(), ...(typeof b.counts === "boolean" ? { counts: b.counts } : {}) });
  await quiet(notify({ uid: l.uid, type: "team", linkHref: `${PAGE}?tab=leave`, message: `Your leave from ${l.from} to ${l.to} was ${status}.` }));
  return { status };
}

// A public holiday for everyone (super admins).
export async function addHoliday(db: Firestore, v: Viewer, b: Record<string, unknown>, now = new Date()) {
  if (!v.superAdmin) throw new TimeError("Only a super admin can add a public holiday.", 403);
  const l = cleanLeave({ ...b, kind: "holiday" });
  if (!l.note) throw new TimeError("Name the holiday, for example Independence Day.");
  const ref = await db.collection(LEAVE).add({ ...l, uid: EVERYONE, status: "approved", decidedBy: v.uid, createdAt: now.toISOString() });
  return { id: ref.id };
}
export async function removeHoliday(db: Firestore, v: Viewer, id: unknown) {
  if (!v.superAdmin) throw new TimeError("Only a super admin can remove a public holiday.", 403);
  const ref = db.doc(`${LEAVE}/${String(id)}`);
  const s = await ref.get();
  if (!s.exists || s.data()!.uid !== EVERYONE) throw new TimeError("That holiday wasn't found.", 404);
  await ref.delete();
}

// ── Projects and leads ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function saveProject(db: Firestore, v: Viewer, b: Record<string, unknown>, now = new Date()) {
  const p = cleanProject(b);
  const mayRun = (dept: string) => v.superAdmin || (!!dept && v.leads.includes(dept));
  if (!mayRun(p.dept)) throw new TimeError(v.leads.length ? "Choose one of the departments you lead." : "Projects are set up by team leads and super admins.", 403);
  if (b.id) {
    const ref = db.doc(`${PROJECTS}/${String(b.id)}`);
    const s = await ref.get();
    if (!s.exists) throw new TimeError("That project wasn't found.", 404);
    if (!mayRun(String(s.data()!.dept ?? ""))) throw new TimeError("That project belongs to another department.", 403);
    await ref.update({ ...p, ...(typeof b.active === "boolean" ? { active: b.active } : {}), updatedAt: now.toISOString() });
    return { id: ref.id };
  }
  const ref = await db.collection(PROJECTS).add({ ...p, active: true, minutes: 0, billableMinutes: 0, createdAt: now.toISOString(), createdBy: v.uid });
  return { id: ref.id };
}

export async function setLead(db: Firestore, v: Viewer, b: Record<string, unknown>, now = new Date(), notify: Notify = notifyBell) {
  if (!v.superAdmin) throw new TimeError("Only a super admin chooses team leads.", 403);
  const uid = String(b.uid ?? "");
  const person = (await listTeamPeople(db)).find((p) => p.uid === uid);
  if (!person) throw new TimeError("That person isn't on the team.", 404);
  const depts = cleanLeads(b.depts);
  await db.doc(`${LEADS}/${uid}`).set({ depts, updatedAt: now.toISOString(), by: v.uid });
  if (depts.length) await quiet(notify({ uid, type: "team", linkHref: `${PAGE}?tab=team`, message: `You're now a team lead (${depts.join(", ")}): you approve timesheets and leave for your departments.` }));
  return { depts };
}

// ── Payroll ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Approved minutes in a month for each staff login, for the payroll run (lib/payroll-server.ts).
export async function approvedMinutesByUid(db: Firestore, uids: string[], month: string): Promise<Map<string, number>> {
  const first = `${month}-01`, weeks: string[] = [];
  for (let w = weekStart(first); w.slice(0, 7) <= month; w = addDays(w, 7)) weeks.push(w);
  const out = new Map<string, number>();
  for (const uid of uids) {
    const sheets = await db.getAll(...weeks.map((w) => db.doc(`${SHEETS}/${sheetId(uid, w)}`)));
    const approved = new Set(sheets.filter((s) => s.data()?.status === "approved").map((s) => s.data()!.week as string));
    if (!approved.size) { out.set(uid, 0); continue; }
    const entries = await db.collection(ENTRIES).where("uidWeek", "in", Array.from(approved).map((w) => sheetId(uid, w))).get();
    out.set(uid, approvedMinutesInMonth(entries.docs.map((d) => d.data() as TimeEntry), approved, month));
  }
  return out;
}

// ── Scheduled (app/api/cron/reminders, every ~15 minutes) ───────────────────────────────────────────────────────────────────────

// Stops timers that stopped themselves, and sends the "still working?" bell once per check.
export async function sweepTimers(db: Firestore, now = new Date(), notify: Notify = notifyBell): Promise<{ stopped: number; asked: number }> {
  const s = await db.collection(TIMERS).get();
  let stopped = 0, asked = 0;
  for (const d of s.docs) {
    const t = d.data() as Timer;
    if (await settleOne(db, t, now, notify)) { stopped++; continue; }
    if (asking(t, now.toISOString()) && t.promptedFor !== t.checkAt) {
      await d.ref.update({ promptedFor: t.checkAt });
      await quiet(notify({ uid: t.uid, type: "team", linkHref: PAGE, message: `Still working on “${t.label}”? Answer by ${lagosClock(answerBy(t))}, or the timer stops and the last half hour isn't counted.` }));
      asked++;
    }
  }
  return { stopped, asked };
}

// Friday 4 pm: everyone on the team whose week isn't submitted yet, once a week.
export async function fridayNudges(db: Firestore, now = new Date(), notify: Notify = notifyBell): Promise<number> {
  if (!fridayNudgeDue(now)) return 0;
  const week = weekStart(lagosDate(now));
  const ref = db.doc(`${NUDGES}/${week}`);
  const claimed = await db.runTransaction(async (tx) => { if ((await tx.get(ref)).exists) return false; tx.set(ref, { at: now.toISOString() }); return true; });
  if (!claimed) return 0;
  const people = await listTeamPeople(db);
  const sheets = await db.getAll(...(people.length ? people.map((p) => db.doc(`${SHEETS}/${sheetId(p.uid, week)}`)) : [db.doc(`${SHEETS}/none`)]));
  const due = people.filter((p, i) => !locked(sheets[i]?.data()?.status as SheetStatus | undefined));
  await Promise.all(due.map((p) => quiet(notify({ uid: p.uid, type: "team", linkHref: `${PAGE}?tab=sheet&week=${week}`, message: `It's Friday: check this week's hours and submit your timesheet for approval.` }))));
  await ref.update({ sent: due.length });
  return due.length;
}

