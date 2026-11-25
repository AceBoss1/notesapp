// Notes Tasks on the server (rules: lib/tasks.ts). Server only; every collection here is closed to browsers (firestore.rules).
//   tasks/{id}                       the task (lib/tasks.ts Task)
//   tasks/{id}/private/brief         the private brief and files, for the poster and accepted workers only
//   taskApplications/{taskId}_{uid}  an application and, once accepted, the worker's submission and both ratings
//   taskUploads/{id}                 a file being uploaded to the private bucket, until a brief or a submission claims it
//   walletHolds/task_{id}            the escrow: the rewards held from the poster's NotesApp Credit (lib/wallet-server.ts)
//   payments/task_{id}_{uid}, ledger/task_{id}_{uid}   one approved reward; paid to the worker PAYOUT_HOLD_HOURS later (lib/payouts.ts)
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { hasVerifiedBadge, type UserProfile } from "./users";
import { orgVerified } from "./org";
import { notifyBell } from "./email";
import { formatNaira } from "./booking-time";
import { attachmentTypeOf } from "./messages-rules";
import { safeFileName } from "./private-files";
import { WalletError, chargeFromHold, holdDoc, placeHold, settleHold, walletDoc } from "./wallet-server";
import type { WalletHold } from "./wallet";
import type { LedgerEntry, PaymentRecord } from "./payments";
import {
  ACTIVE, CHANGES_MAX, FILES_MAX, FILE_MAX_BYTES, REVIEW_DAYS, TASK_COMMISSION, TaskError, anonFeeFor, anonLabel, budgetKobo, canPost,
  cleanComment, cleanFeedback, cleanNote, cleanPitch, cleanStars, cleanTask, isActive, isOpenFor, publicTask, slotsLeft, workerNetKobo,
  type AppStatus, type Task, type TaskApplication, type TaskFile, type TaskInput, type TaskPrivate,
} from "./tasks";

export type Me = { uid: string; emailVerified: boolean };
export type Notify = (n: { uid: string; message: string; linkHref: string }) => Promise<void>;
export type FileDeps = { presignPut: (key: string, type: string, size: number) => Promise<string>; presignGet: (key: string, name: string, type: string) => Promise<string> };
const bell: Notify = (n) => notifyBell({ uid: n.uid, type: "job", linkHref: n.linkHref, message: n.message });

const DAY = 86_400_000;
const taskRef = (db: Firestore, id: string) => db.doc(`tasks/${id}`);
const privRef = (db: Firestore, id: string) => db.doc(`tasks/${id}/private/brief`);
const appRef = (db: Firestore, id: string, uid: string) => db.doc(`taskApplications/${id}_${uid}`);
const holdId = (id: string) => `task_${id}`;
const link = (id: string) => `/tasks/${id}`;
const idOk = (v: unknown): v is string => typeof v === "string" && /^[\w-]{1,64}$/.test(v);
const must = (v: unknown, what = "task") => { if (!idOk(v)) throw new TaskError(400, `Which ${what}?`); return v; };
const nameOf = (u: FirebaseFirestore.DocumentData | undefined) => String(u?.displayName || u?.username || "");

async function member(db: Firestore, uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!u || !u.username) throw new TaskError(400, "Finish setting up your profile first.");
  if (u.suspended === true) throw new TaskError(403, "Your account can't do that right now.");
  return u;
}
async function loadTask(db: Firestore, id: string): Promise<Task> {
  const t = (await taskRef(db, id).get()).data() as Task | undefined;
  if (!t || t.status === "removed") throw new TaskError(404, "That task isn't here any more.");
  return t;
}

// ── Posting ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function posterCheck(u: UserProfile | undefined, emailVerified: boolean) {
  return canPost(u ?? null, !!u && hasVerifiedBadge(u), !!u && orgVerified(u), emailVerified);
}

// Saves a draft (new when id is empty). Only drafts can be edited; the brief's files are uploaded first (startUpload, purpose "brief").
export async function saveTask(db: Firestore, me: Me, id: unknown, input: TaskInput & { fileIds?: unknown }, now = new Date()): Promise<{ id: string }> {
  const u = await member(db, me.uid);
  const ok = posterCheck(u, me.emailVerified);
  if (!ok.ok) throw new TaskError(403, ok.reason);
  const c = cleanTask(input);
  const tid = id ? must(id) : randomBytes(6).toString("hex");
  const ref = taskRef(db, tid);
  const fileIds = Array.isArray(input.fileIds) ? input.fileIds.filter(idOk).slice(0, FILES_MAX + 1) : [];
  if (fileIds.length > FILES_MAX) throw new TaskError(400, `Up to ${FILES_MAX} files.`);
  await db.runTransaction(async (t) => {
    const [cur, priv, ...ups] = await Promise.all([t.get(ref), t.get(privRef(db, tid)), ...fileIds.map((f) => t.get(db.doc(`taskUploads/${f}`)))]);
    const was = cur.data() as Task | undefined;
    if (id && !was) throw new TaskError(404, "That draft isn't here any more.");
    if (was && (was.posterUid !== me.uid || was.status !== "draft")) throw new TaskError(409, "Only your own drafts can be edited. A published task can be closed.");
    const kept = ((priv.data() as TaskPrivate | undefined)?.files ?? []);
    const files: TaskPrivate["files"] = fileIds.map((f, i) => {
      const old = kept.find((k) => k.id === f);
      if (old) return old;
      const up = ups[i].data();
      if (!up || up.uid !== me.uid || up.purpose !== "brief" || up.used) throw new TaskError(400, "One of the files didn't finish uploading. Add it again.");
      t.update(ups[i].ref, { used: true, taskId: tid });
      return { id: f, key: String(up.key), name: String(up.name), size: Number(up.size), type: String(up.type) };
    });
    const task: Task = {
      id: tid, posterUid: me.uid, posterUsername: String(u.username), posterName: nameOf(u), posterAvatar: String(u.avatar ?? ""), posterOrg: u.accountKind === "organisation",
      anonymous: c.anonymous, anonLabel: anonLabel(u), title: c.title, summary: c.summary, details: c.details, category: c.category, terms: c.terms,
      rewardKobo: c.rewardKobo, slots: c.slots, days: c.days, openDays: c.openDays, closesAt: "", status: "draft", funded: false, heldKobo: 0, paidKobo: 0,
      accepted: 0, approved: 0, applicants: 0, ratingSum: 0, ratingCount: 0, createdAt: was?.createdAt ?? now.toISOString(),
    };
    t.set(ref, task);
    t.set(privRef(db, tid), { brief: c.brief, files } satisfies TaskPrivate);
  });
  return { id: tid };
}

export async function deleteDraft(db: Firestore, me: Me, id: unknown) {
  const tid = must(id);
  const t = await loadTask(db, tid);
  if (t.posterUid !== me.uid || t.status !== "draft") throw new TaskError(409, "Only your own drafts can be deleted.");
  await Promise.all([taskRef(db, tid).delete(), privRef(db, tid).delete()]);
  return { deleted: true };
}

// Publishing: holds the rewards from the poster's NotesApp Credit and takes the anonymous-posting fee, if any, in the same step.
export async function publishTask(db: Firestore, me: Me, id: unknown, now = new Date()) {
  const tid = must(id);
  const u = await member(db, me.uid);
  const ok = posterCheck(u, me.emailVerified);
  if (!ok.ok) throw new TaskError(403, ok.reason);
  const ref = taskRef(db, tid), hRef = holdDoc(db, holdId(tid)), wRef = walletDoc(db, me.uid);
  const res = await db.runTransaction(async (t) => {
    const [cur, w, h] = await Promise.all([t.get(ref), t.get(wRef), t.get(hRef)]);
    const task = cur.data() as Task | undefined;
    if (!task || task.posterUid !== me.uid) throw new TaskError(404, "That task isn't here any more.");
    if (task.status !== "draft") throw new TaskError(409, "It's already published.");
    const budget = budgetKobo(task), fee = anonFeeFor(task.anonymous, u.accountTier);
    let hold: WalletHold;
    try {
      hold = placeHold(t, db, { uid: me.uid, wallet: w.data(), holdId: holdId(tid), hold: h.data() as WalletHold | undefined, kobo: budget + fee, kind: "task", label: `Notes Tasks: ${task.title}`, reference: holdId(tid), now });
    } catch (e) {
      if (e instanceof WalletError && e.status === 402) throw new TaskError(402, `Publishing holds ${formatNaira(budget)} for the rewards${fee ? ` and takes ${formatNaira(fee)} for posting anonymously` : ""}. ${e.message}`);
      throw e;
    }
    if (fee) {
      chargeFromHold(t, db, { holdId: holdId(tid), hold, chargeKobo: fee });
      const reference = `task_anon_${tid}`;
      t.set(db.doc(`payments/${reference}`), {
        reference, kind: "task_anon", uid: me.uid, email: "", amountKobo: fee, status: "paid", publisherUid: "", publisherUsername: "", commissionRate: 1,
        payWith: "wallet", walletDebit: { creditKobo: fee, bonusKobo: 0 }, createdAt: now.toISOString(), paidAt: now.toISOString(),
      } as PaymentRecord & { paidAt: string });
    }
    t.update(ref, {
      status: "open", funded: true, heldKobo: budget, publishedAt: now.toISOString(), closesAt: new Date(now.getTime() + task.openDays * DAY).toISOString(),
      anonLabel: anonLabel(u), posterName: nameOf(u), posterAvatar: String(u.avatar ?? ""), posterUsername: String(u.username),
    });
    return { budget, fee };
  });
  return { published: true, link: link(tid), ...res };
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function listOpen(db: Firestore, opts: { category?: unknown } = {}, now = new Date()) {
  const snap = await db.collection("tasks").where("status", "==", "open").limit(300).get();
  return snap.docs.map((d) => d.data() as Task)
    .filter((t) => isOpenFor(t, now) && slotsLeft(t) > 0 && (!opts.category || t.category === opts.category))
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .map(publicTask);
}

type Stats = { rating: number | null; count: number; done: number };
const statsOf = (u: FirebaseFirestore.DocumentData | undefined, as: "worker" | "poster"): Stats => {
  const sum = Number(u?.[as === "worker" ? "taskWorkerRatingSum" : "taskPosterRatingSum"] ?? 0), count = Number(u?.[as === "worker" ? "taskWorkerRatingCount" : "taskPosterRatingCount"] ?? 0);
  return { rating: count ? Math.round((sum / count) * 10) / 10 : null, count, done: Number(u?.tasksDone ?? 0) };
};

// One task as the viewer may see it: everyone sees the public task; an applicant sees their application; accepted workers also see
// the private brief; the poster sees everything, with every application and each worker's rating from other tasks.
export async function viewTask(db: Firestore, uid: string | null, id: unknown) {
  const tid = must(id);
  const t = await loadTask(db, tid);
  const poster = uid === t.posterUid;
  if (t.status === "draft" && !poster) throw new TaskError(404, "That task isn't here any more.");
  const mine = uid && !poster ? ((await appRef(db, tid, uid).get()).data() as TaskApplication | undefined) ?? null : null;
  const seesBrief = poster || (!!mine && (isActive(mine.status) || mine.status === "approved" || mine.status === "rejected"));
  const priv = seesBrief ? ((await privRef(db, tid).get()).data() as TaskPrivate | undefined) : undefined;
  const brief = priv ? { brief: priv.brief, files: priv.files.map(({ key: _k, ...f }) => f) } : null;
  const posterStats = t.anonymous ? null : statsOf((await db.doc(`users/${t.posterUid}`).get()).data(), "poster");
  if (!poster) return { role: mine ? "worker" : "visitor", task: publicTask(t), me: mine, brief, posterStats };
  const apps = (await db.collection("taskApplications").where("taskId", "==", tid).limit(500).get()).docs.map((d) => d.data() as TaskApplication);
  const users = apps.length ? await db.getAll(...apps.map((a) => db.doc(`users/${a.uid}`))) : [];
  const applications = apps.map((a, i) => ({ ...a, stats: statsOf(users[i].data(), "worker") })).sort((a, b) => a.appliedAt.localeCompare(b.appliedAt));
  return { role: "poster", task: { ...t }, me: null, brief, posterStats, applications };
}

// Your tasks: the ones you posted, and the ones you applied to.
export async function myTasks(db: Firestore, uid: string) {
  const [posted, apps] = await Promise.all([
    db.collection("tasks").where("posterUid", "==", uid).limit(200).get(),
    db.collection("taskApplications").where("uid", "==", uid).limit(200).get(),
  ]);
  const applied = apps.docs.map((d) => d.data() as TaskApplication);
  const tasks = applied.length ? await db.getAll(...applied.map((a) => taskRef(db, a.taskId))) : [];
  return {
    posted: posted.docs.map((d) => d.data() as Task).filter((t) => t.status !== "removed").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    working: applied.map((a, i) => ({ app: a, task: tasks[i].exists ? publicTask(tasks[i].data() as Task) : null })).filter((r) => r.task).sort((a, b) => b.app.appliedAt.localeCompare(a.app.appliedAt)),
  };
}

// ── Applying and choosing ───────────────────────────────────────────────────────────────────────────────────────────────────────
export async function applyTo(db: Firestore, me: Me, id: unknown, input: { pitch?: unknown; agree?: unknown }, notify: Notify = bell, now = new Date()) {
  const tid = must(id);
  if (!me.emailVerified) throw new TaskError(403, "Confirm your email first.");
  const u = await member(db, me.uid);
  const pitch = cleanPitch(input.pitch);
  if (pitch.length < 20) throw new TaskError(400, "Say in a few lines (20 characters or more) why you're right for this task.");
  const t = await db.runTransaction(async (tx) => {
    const [cur, a] = await Promise.all([tx.get(taskRef(db, tid)), tx.get(appRef(db, tid, me.uid))]);
    const task = cur.data() as Task | undefined;
    if (!task || !isOpenFor(task, now)) throw new TaskError(409, "This task isn't taking applications.");
    if (task.posterUid === me.uid) throw new TaskError(409, "You can't apply to your own task.");
    if (slotsLeft(task) <= 0) throw new TaskError(409, "Every place on this task is taken.");
    if (a.exists) throw new TaskError(409, "You've already applied.");
    if (task.terms && input.agree !== true) throw new TaskError(400, "Agree to the task's terms to apply.");
    tx.set(appRef(db, tid, me.uid), {
      taskId: tid, uid: me.uid, username: String(u.username), name: nameOf(u), avatar: String(u.avatar ?? ""), pitch, status: "applied", appliedAt: now.toISOString(),
      ...(task.terms ? { termsAcceptedAt: now.toISOString() } : {}),
    } satisfies TaskApplication);
    tx.update(taskRef(db, tid), { applicants: FieldValue.increment(1) });
    return task;
  });
  await notify({ uid: t.posterUid, linkHref: link(tid), message: `${nameOf(u)} applied to your task "${t.title}".` }).catch(() => {});
  return { applied: true };
}

export async function withdraw(db: Firestore, me: Me, id: unknown) {
  const tid = must(id);
  await db.runTransaction(async (tx) => {
    const a = (await tx.get(appRef(db, tid, me.uid))).data() as TaskApplication | undefined;
    if (!a || (a.status !== "applied" && a.status !== "accepted" && a.status !== "changes")) throw new TaskError(409, "There's nothing to withdraw.");
    tx.update(appRef(db, tid, me.uid), { status: "withdrawn", decidedAt: new Date().toISOString() });
    if (a.status !== "applied") tx.update(taskRef(db, tid), { accepted: FieldValue.increment(-1) });
  });
  return { withdrawn: true };
}

async function posterTx<T>(db: Firestore, me: Me, tid: string, workerUid: string, run: (tx: Transaction, task: Task, app: TaskApplication) => T | Promise<T>): Promise<{ task: Task; app: TaskApplication; out: T }> {
  return db.runTransaction(async (tx) => {
    const [cur, a] = await Promise.all([tx.get(taskRef(db, tid)), tx.get(appRef(db, tid, workerUid))]);
    const task = cur.data() as Task | undefined, app = a.data() as TaskApplication | undefined;
    if (!task || task.posterUid !== me.uid) throw new TaskError(404, "That task isn't here any more.");
    if (!app) throw new TaskError(404, "That application isn't here any more.");
    return { task, app, out: await run(tx, task, app) };
  });
}

export async function decide(db: Firestore, me: Me, id: unknown, workerUid: unknown, accept: boolean, notify: Notify = bell, now = new Date()) {
  const tid = must(id), w = must(workerUid, "member");
  const { task } = await posterTx(db, me, tid, w, (tx, task, app) => {
    if (app.status !== "applied") throw new TaskError(409, "You've already answered this application.");
    if (accept) {
      if (task.status !== "open") throw new TaskError(409, "This task is closed.");
      if (slotsLeft(task) <= 0) throw new TaskError(409, `All ${task.slots} place${task.slots === 1 ? " is" : "s are"} taken. Close a place (reject or wait for work) first.`);
      tx.update(appRef(db, tid, w), { status: "accepted", acceptedAt: now.toISOString(), dueAt: new Date(now.getTime() + task.days * DAY).toISOString(), decidedAt: now.toISOString() });
      tx.update(taskRef(db, tid), { accepted: FieldValue.increment(1) });
    } else tx.update(appRef(db, tid, w), { status: "declined", decidedAt: now.toISOString() });
  });
  await notify({ uid: w, linkHref: link(tid), message: accept ? `You're on the task "${task.title}". Open it for the brief; you have ${task.days} day${task.days === 1 ? "" : "s"} to submit.` : `Your application for "${task.title}" wasn't selected this time.` }).catch(() => {});
  return { ok: true };
}

// ── Files ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// purpose "brief": a file for a draft's private brief (the poster); "work": a file for a submission (an accepted worker).
export async function startUpload(db: Firestore, me: Me, input: { name?: unknown; size?: unknown; purpose?: unknown; taskId?: unknown }, files: FileDeps, now = new Date()) {
  const name = String(input.name ?? "").trim().slice(0, 200), size = Number(input.size);
  const what = attachmentTypeOf(name);
  if (!what) throw new TaskError(400, "That kind of file can't be added. Documents (PDF, Word, Excel, text, CSV, zip), pictures, audio and video can.");
  if (!Number.isInteger(size) || size <= 0) throw new TaskError(400, "That file looks empty.");
  if (size > FILE_MAX_BYTES) throw new TaskError(413, `Files can be up to ${FILE_MAX_BYTES / 1048576} MB.`);
  const purpose = input.purpose === "work" ? "work" : "brief";
  let taskId = "";
  if (purpose === "work") {
    taskId = must(input.taskId);
    const a = (await appRef(db, taskId, me.uid).get()).data() as TaskApplication | undefined;
    if (!a || (a.status !== "accepted" && a.status !== "changes")) throw new TaskError(403, "Only a worker on this task can add work to it.");
  } else {
    const u = await member(db, me.uid);
    const ok = posterCheck(u, me.emailVerified);
    if (!ok.ok) throw new TaskError(403, ok.reason);
  }
  const id = randomBytes(8).toString("hex");
  const key = `tasks/${me.uid}/${id}-${safeFileName(name)}`;
  await db.doc(`taskUploads/${id}`).set({ uid: me.uid, key, name, size, type: what.type, purpose, ...(taskId ? { taskId } : {}), used: false, createdAt: now.toISOString() });
  return { id, uploadUrl: await files.presignPut(key, what.type, size), contentType: what.type };
}

// A short-lived link to one file: a brief's (poster and workers on the task) or a submission's (the poster and that worker).
export async function fileLink(db: Firestore, uid: string, id: unknown, fileId: unknown, worker: unknown, files: FileDeps) {
  const tid = must(id), fid = must(fileId, "file");
  const t = await loadTask(db, tid);
  const poster = t.posterUid === uid;
  if (worker) {
    const w = must(worker, "member");
    if (!poster && w !== uid) throw new TaskError(403, "That file isn't yours to open.");
    const a = (await appRef(db, tid, w).get()).data() as TaskApplication | undefined;
    const f = (a?.files ?? []).find((x) => x.id === fid) as (TaskFile & { key?: string }) | undefined;
    if (!f) throw new TaskError(404, "That file isn't here any more.");
    const up = (await db.doc(`taskUploads/${fid}`).get()).data();
    if (!up) throw new TaskError(404, "That file isn't here any more.");
    return { url: await files.presignGet(String(up.key), f.name, f.type) };
  }
  if (!poster) {
    const a = (await appRef(db, tid, uid).get()).data() as TaskApplication | undefined;
    if (!a || !(isActive(a.status) || a.status === "approved" || a.status === "rejected")) throw new TaskError(403, "The brief's files are for workers on this task.");
  }
  const priv = (await privRef(db, tid).get()).data() as TaskPrivate | undefined;
  const f = priv?.files.find((x) => x.id === fid);
  if (!f) throw new TaskError(404, "That file isn't here any more.");
  return { url: await files.presignGet(f.key, f.name, f.type) };
}

// ── Working and reviewing ───────────────────────────────────────────────────────────────────────────────────────────────────────
export async function submitWork(db: Firestore, me: Me, id: unknown, input: { note?: unknown; fileIds?: unknown }, notify: Notify = bell, now = new Date()) {
  const tid = must(id);
  const note = cleanNote(input.note);
  const fileIds = Array.isArray(input.fileIds) ? input.fileIds.filter(idOk) : [];
  if (fileIds.length > FILES_MAX) throw new TaskError(400, `Up to ${FILES_MAX} files.`);
  if (!note && !fileIds.length) throw new TaskError(400, "Add your work: a note, files, or both.");
  const task = await db.runTransaction(async (tx) => {
    const [cur, a, ...ups] = await Promise.all([tx.get(taskRef(db, tid)), tx.get(appRef(db, tid, me.uid)), ...fileIds.map((f) => tx.get(db.doc(`taskUploads/${f}`)))]);
    const t = cur.data() as Task | undefined, app = a.data() as TaskApplication | undefined;
    if (!t || !app || (app.status !== "accepted" && app.status !== "changes")) throw new TaskError(409, "There's nothing to submit on this task right now.");
    const prev = app.files ?? [];
    const files: TaskFile[] = fileIds.map((f, i) => {
      const old = prev.find((p) => p.id === f);
      if (old) return old;
      const up = ups[i].data();
      if (!up || up.uid !== me.uid || up.purpose !== "work" || up.taskId !== tid || up.used) throw new TaskError(400, "One of the files didn't finish uploading. Add it again.");
      tx.update(ups[i].ref, { used: true });
      return { id: f, name: String(up.name), size: Number(up.size), type: String(up.type) };
    });
    tx.update(appRef(db, tid, me.uid), { status: "submitted", note, files, submittedAt: now.toISOString() });
    return t;
  });
  await notify({ uid: task.posterUid, linkHref: link(tid), message: `New work on "${task.title}" to review. If you don't review it in ${REVIEW_DAYS} days, it's approved and paid.` }).catch(() => {});
  return { submitted: true };
}

// Pays one worker inside a transaction: one reward out of the hold into the ledger, less TASK_COMMISSION.
function payWorker(tx: Transaction, db: Firestore, task: Task, app: TaskApplication, hold: WalletHold | undefined, now: Date, auto: boolean) {
  chargeFromHold(tx, db, { holdId: holdId(task.id), hold, chargeKobo: task.rewardKobo });
  const reference = `task_${task.id}_${app.uid}`;
  const commissionKobo = task.rewardKobo - workerNetKobo(task.rewardKobo);
  tx.set(db.doc(`payments/${reference}`), {
    reference, kind: "task", uid: task.posterUid, email: "", amountKobo: task.rewardKobo, status: "paid", publisherUid: app.uid, publisherUsername: app.username,
    commissionRate: TASK_COMMISSION, payWith: "wallet", walletDebit: { creditKobo: task.rewardKobo, bonusKobo: 0 }, createdAt: now.toISOString(), paidAt: now.toISOString(),
  } as PaymentRecord & { paidAt: string });
  tx.set(db.doc(`ledger/${reference}`), {
    reference, kind: "task", publisherUid: app.uid, publisherUsername: app.username, payerUid: task.posterUid,
    grossKobo: task.rewardKobo, commissionKobo, netKobo: task.rewardKobo - commissionKobo, status: "held", releaseAfter: now.toISOString(), createdAt: now.toISOString(),
  } as LedgerEntry);
  tx.update(appRef(db, task.id, app.uid), { status: "approved", decidedAt: now.toISOString(), reference, ...(auto ? { autoApproved: true } : {}) });
  tx.update(taskRef(db, task.id), { approved: FieldValue.increment(1), accepted: FieldValue.increment(-1), paidKobo: FieldValue.increment(task.rewardKobo), heldKobo: FieldValue.increment(-task.rewardKobo) });
  tx.set(db.doc(`users/${app.uid}`), { tasksDone: FieldValue.increment(1) }, { merge: true });
}

export async function review(db: Firestore, me: Me, id: unknown, workerUid: unknown, decision: unknown, feedback: unknown, notify: Notify = bell, now = new Date()) {
  const tid = must(id), w = must(workerUid, "member");
  const fb = cleanFeedback(feedback);
  if (decision !== "approve" && decision !== "changes" && decision !== "reject") throw new TaskError(400, "Approve, ask for changes, or reject.");
  if (decision !== "approve" && fb.length < 10) throw new TaskError(400, "Say what needs to change, or why it isn't approved (10 characters or more).");
  const hRef = holdDoc(db, holdId(tid));
  const { task } = await db.runTransaction(async (tx) => {
    const [cur, a, h] = await Promise.all([tx.get(taskRef(db, tid)), tx.get(appRef(db, tid, w)), tx.get(hRef)]);
    const task = cur.data() as Task | undefined, app = a.data() as TaskApplication | undefined;
    if (!task || task.posterUid !== me.uid) throw new TaskError(404, "That task isn't here any more.");
    if (!app || app.status !== "submitted") throw new TaskError(409, "There's no submitted work to review from them.");
    if (decision === "approve") payWorker(tx, db, task, app, h.data() as WalletHold | undefined, now, false);
    else if (decision === "changes") {
      if ((app.changesAsked ?? 0) >= CHANGES_MAX) throw new TaskError(409, `You've asked for changes ${CHANGES_MAX} times. Approve or reject it now.`);
      const due = Math.max(Date.parse(app.dueAt ?? "") || 0, now.getTime() + 2 * DAY);
      tx.update(appRef(db, tid, w), { status: "changes", feedback: fb, changesAsked: FieldValue.increment(1), dueAt: new Date(due).toISOString() });
    } else {
      tx.update(appRef(db, tid, w), { status: "rejected", feedback: fb, decidedAt: now.toISOString() });
      tx.update(taskRef(db, tid), { accepted: FieldValue.increment(-1) });
    }
    return { task };
  });
  const net = formatNaira(workerNetKobo(task.rewardKobo));
  const msg = decision === "approve" ? `Your work on "${task.title}" is approved. ${net} is on its way to your bank account (after a 24-hour check).`
    : decision === "changes" ? `Changes asked on "${task.title}": ${fb.slice(0, 120)}` : `Your work on "${task.title}" wasn't approved: ${fb.slice(0, 120)}`;
  await notify({ uid: w, linkHref: link(tid), message: msg }).catch(() => {});
  return { ok: true };
}

// Ratings, once the work is decided: the poster rates the worker, the worker rates the poster. Once each.
export async function rate(db: Firestore, me: Me, id: unknown, workerUid: unknown, stars: unknown, comment: unknown) {
  const tid = must(id);
  const n = cleanStars(stars), c = cleanComment(comment);
  await db.runTransaction(async (tx) => {
    const task = (await tx.get(taskRef(db, tid))).data() as Task | undefined;
    if (!task) throw new TaskError(404, "That task isn't here any more.");
    const poster = task.posterUid === me.uid;
    const w = poster ? must(workerUid, "member") : me.uid;
    const app = (await tx.get(appRef(db, tid, w))).data() as TaskApplication | undefined;
    if (!app || (app.status !== "approved" && app.status !== "rejected")) throw new TaskError(409, "Ratings open once the work is approved or rejected.");
    if (poster) {
      if (app.workerRating) throw new TaskError(409, "You've already rated them.");
      tx.update(appRef(db, tid, w), { workerRating: n, workerComment: c });
      tx.set(db.doc(`users/${w}`), { taskWorkerRatingSum: FieldValue.increment(n), taskWorkerRatingCount: FieldValue.increment(1) }, { merge: true });
    } else {
      if (app.posterRating) throw new TaskError(409, "You've already rated this task.");
      tx.update(appRef(db, tid, w), { posterRating: n, posterComment: c });
      tx.update(taskRef(db, tid), { ratingSum: FieldValue.increment(n), ratingCount: FieldValue.increment(1) });
      tx.set(db.doc(`users/${task.posterUid}`), { taskPosterRatingSum: FieldValue.increment(n), taskPosterRatingCount: FieldValue.increment(1) }, { merge: true });
    }
  });
  return { rated: true };
}

// ── Closing ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Closes a task and gives back what's still held. Not while someone is working on it (review or wait for them first), unless forced
// (an admin removing it, or the sweep): then their places end as "expired".
async function closeIt(db: Firestore, tid: string, how: { by?: string; force?: boolean; remove?: string }, now: Date) {
  const apps = (await db.collection("taskApplications").where("taskId", "==", tid).limit(500).get()).docs.map((d) => d.data() as TaskApplication);
  const working = apps.filter((a) => isActive(a.status));
  if (working.length && !how.force) throw new TaskError(409, `${working.length} ${working.length === 1 ? "person is" : "people are"} still working on it. Review their work (or wait for their time to run out) first.`);
  const hRef = holdDoc(db, holdId(tid));
  return db.runTransaction(async (tx) => {
    const [cur, h] = await Promise.all([tx.get(taskRef(db, tid)), tx.get(hRef)]);
    const task = cur.data() as Task | undefined;
    if (!task || (how.by && task.posterUid !== how.by)) throw new TaskError(404, "That task isn't here any more.");
    if (task.status !== "open") throw new TaskError(409, "It isn't open.");
    const hold = h.data() as WalletHold | undefined;
    const w = hold ? await tx.get(walletDoc(db, hold.uid)) : null;
    const split = hold ? settleHold(tx, db, { wallet: w?.data(), holdId: holdId(tid), hold, chargeKobo: 0, label: `Notes Tasks, back: ${task.title}`, reference: holdId(tid), now }) : null;
    for (const a of apps) {
      if (a.status === "applied") tx.update(appRef(db, tid, a.uid), { status: "declined", decidedAt: now.toISOString() });
      else if (isActive(a.status)) tx.update(appRef(db, tid, a.uid), { status: "expired", decidedAt: now.toISOString() });
    }
    tx.update(taskRef(db, tid), { status: how.remove ? "removed" : "closed", closedAt: now.toISOString(), heldKobo: 0, accepted: 0, ...(how.remove ? { removedReason: how.remove } : {}) });
    return { returnedKobo: split?.releasedKobo ?? 0, task };
  });
}

export async function closeTask(db: Firestore, me: Me, id: unknown, notify: Notify = bell, now = new Date()) {
  const r = await closeIt(db, must(id), { by: me.uid }, now);
  if (r.returnedKobo) await notify({ uid: me.uid, linkHref: link(r.task.id), message: `"${r.task.title}" is closed. ${formatNaira(r.returnedKobo)} is back in your NotesApp Credit.` }).catch(() => {});
  return { closed: true, returnedKobo: r.returnedKobo };
}

// Admins (Trust & safety) take a task down: what's held goes back to the poster; anyone working on it is told.
export async function removeTask(db: Firestore, id: unknown, reason: unknown, by: { uid: string; email: string } | null = null, notify: Notify = bell, now = new Date()) {
  const why = cleanFeedback(reason);
  if (why.length < 5) throw new TaskError(400, "Say why it's removed.");
  const tid = must(id);
  const cur = await loadTask(db, tid);
  if (cur.status !== "open") {
    // A draft or a closed task holds nothing: it just comes down.
    await taskRef(db, tid).update({ status: "removed", removedReason: why, closedAt: cur.closedAt ?? now.toISOString(), ...(by ? { removedBy: by.uid, removedByEmail: by.email } : {}) });
    await notify({ uid: cur.posterUid, linkHref: "/tasks", message: `Your task "${cur.title}" was removed by #NotesApp: ${why}` }).catch(() => {});
    return { removed: true };
  }
  const before = (await db.collection("taskApplications").where("taskId", "==", tid).limit(500).get()).docs.map((d) => d.data() as TaskApplication).filter((a) => isActive(a.status));
  const r = await closeIt(db, tid, { force: true, remove: why }, now);
  if (by) await taskRef(db, tid).update({ removedBy: by.uid, removedByEmail: by.email });
  await notify({ uid: r.task.posterUid, linkHref: "/tasks", message: `Your task "${r.task.title}" was removed by #NotesApp: ${why}${r.returnedKobo ? ` ${formatNaira(r.returnedKobo)} is back in your NotesApp Credit.` : ""}` }).catch(() => {});
  for (const a of before) await notify({ uid: a.uid, linkHref: "/tasks", message: `The task "${r.task.title}" was removed by #NotesApp, so your place on it has ended.` }).catch(() => {});
  return { removed: true };
}

// Admin → Tasks (Trust & safety): every task, newest first, with who really posted it (anonymous ones too), and on request one task's
// applications, for disputes. ?status= narrows it; ?q= matches the title or the poster's username.
export async function adminTasks(db: Firestore, opts: { status?: unknown; q?: unknown } = {}) {
  const status = ["draft", "open", "closed", "removed"].includes(String(opts.status)) ? String(opts.status) : "";
  const base = db.collection("tasks");
  const snap = await (status ? base.where("status", "==", status) : base).limit(500).get();
  const q = String(opts.q ?? "").trim().toLowerCase().replace(/^@/, "");
  const tasks = snap.docs.map((d) => d.data() as Task & { removedBy?: string; removedByEmail?: string })
    .filter((t) => !q || t.title.toLowerCase().includes(q) || t.posterUsername.toLowerCase().includes(q) || t.id === q)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = { draft: 0, open: 0, closed: 0, removed: 0 } as Record<string, number>;
  for (const t of snap.docs) counts[String(t.data().status)] = (counts[String(t.data().status)] ?? 0) + 1;
  return { tasks, counts: status ? null : counts };
}
export async function adminTaskApplications(db: Firestore, id: unknown) {
  const tid = must(id);
  const apps = (await db.collection("taskApplications").where("taskId", "==", tid).limit(500).get()).docs.map((d) => d.data() as TaskApplication);
  return { applications: apps.sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)).map(({ note: _n, ...a }) => ({ ...a, hasNote: !!_n })) };
}

// The scheduled sweep (app/api/cron/reminders): submissions not reviewed in REVIEW_DAYS are approved and paid; workers past their time
// lose their place; tasks past their closing date with nobody working, or with every place approved, close and give back what's left.
export async function sweepTasks(db: Firestore, notify: Notify = bell, now = new Date()): Promise<number> {
  let done = 0;
  const [subs, working] = await Promise.all([
    db.collection("taskApplications").where("status", "==", "submitted").limit(200).get(),
    db.collection("taskApplications").where("status", "in", ["accepted", "changes"]).limit(300).get(),
  ]);
  for (const d of subs.docs) {
    const a = d.data() as TaskApplication;
    if (!a.submittedAt || Date.parse(a.submittedAt) > now.getTime() - REVIEW_DAYS * DAY) continue;
    try {
      const task = await db.runTransaction(async (tx) => {
        const [cur, fresh, h] = await Promise.all([tx.get(taskRef(db, a.taskId)), tx.get(d.ref), tx.get(holdDoc(db, holdId(a.taskId)))]);
        const t = cur.data() as Task | undefined, app = fresh.data() as TaskApplication | undefined;
        if (!t || !app || app.status !== "submitted") return null;
        payWorker(tx, db, t, app, h.data() as WalletHold | undefined, now, true);
        return t;
      });
      if (task) {
        done++;
        await notify({ uid: a.uid, linkHref: link(a.taskId), message: `Your work on "${task.title}" was approved (not reviewed in ${REVIEW_DAYS} days). ${formatNaira(workerNetKobo(task.rewardKobo))} is on its way to you.` }).catch(() => {});
        await notify({ uid: task.posterUid, linkHref: link(a.taskId), message: `${a.name}'s work on "${task.title}" was approved and paid, as it wasn't reviewed in ${REVIEW_DAYS} days.` }).catch(() => {});
      }
    } catch (e) { console.error("tasks auto-approve", d.id, e); }
  }
  for (const d of working.docs) {
    const a = d.data() as TaskApplication;
    if (!a.dueAt || Date.parse(a.dueAt) > now.getTime()) continue;
    const ok = await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(d.ref)).data() as TaskApplication | undefined;
      if (!fresh || (fresh.status !== "accepted" && fresh.status !== "changes")) return false;
      tx.update(d.ref, { status: "expired" satisfies AppStatus, decidedAt: now.toISOString() });
      tx.update(taskRef(db, a.taskId), { accepted: FieldValue.increment(-1) });
      return true;
    }).catch(() => false);
    if (ok) { done++; await notify({ uid: a.uid, linkHref: link(a.taskId), message: "Your time on a task ran out before you submitted, so your place has ended." }).catch(() => {}); }
  }
  const open = await db.collection("tasks").where("status", "==", "open").limit(300).get();
  for (const d of open.docs) {
    const t = d.data() as Task;
    const full = t.approved >= t.slots;
    if (!full && Date.parse(t.closesAt) > now.getTime()) continue;
    try {
      const r = await closeIt(db, t.id, {}, now);
      done++;
      await notify({ uid: t.posterUid, linkHref: link(t.id), message: `"${t.title}" has closed${full ? ": every place is done" : ""}.${r.returnedKobo ? ` ${formatNaira(r.returnedKobo)} is back in your NotesApp Credit.` : ""}` }).catch(() => {});
    } catch { /* someone is still working: it closes once they're done */ }
  }
  return done;
}

export { ACTIVE };
