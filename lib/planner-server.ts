import { createHmac, timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { isKidUid } from "./kids";
import { notifyBell } from "./email";
import { memberTier, type Meter } from "./nana-meter";
import { gemModel, realDeps, runAi, type NanaDeps } from "./nana-server";
import { addDays, isDay, lagosHour, lagosToday, type CalEntry } from "./my-calendar";
import {
  DEFAULT_PLANNER_PREFS, MOVES_BELL_TEXT, PLANNER_HREF, PlannerError, REVIEW_BELL_TEXT, SKIP_TEXT, cleanAnswer, cleanLength, cleanPlan,
  cleanPlannerPrefs, cleanReview, cleanTicks, dayView, fallbackNote, isMonth, lengthsFor, movesBellDue, mustSumUp, newInterview, parsePlanJson,
  parseReply, planEntries, planStart, progressPct, reviewBellDue, reviewOpen, reviewWeek, streak, targetFor, warnings, weekDays, withAnswer,
  withReply, withReviewNumbers, type Interview, type Plan, type PlannerPrefs, type Review,
} from "./planner";
import { PLAN_TASK, interviewMessages, interviewState, interviewSystem, planSystem, reviewContext, reviewSystem } from "./planner-nana";

// Notes Planner on the server (docs/NOTES_PLANNER.md; the rules are in lib/planner.ts). Every collection is server-only in
// firestore.rules and written only here. Her interview answers, plan, ticks and reviews are encrypted at rest with ACCOUNT_DATA_KEY
// (AES-256-GCM, as My Cycle's are). Nothing here is part of ads, analytics, other Nana features or Admin.
//
//   plannerPlans/{uid}          { uid, data (encrypted: the interview, the plan, the plan before it), has (a plan exists), movesBell,
//                                 reviewBell, lock (copies of her choices, for the bells job and the calendar), prefs, movesBellDay?,
//                                 reviewBellWeek?, updatedAt }
//   plannerDays/{uid}_{day}     { uid, day, data (encrypted: which moves she ticked) }
//   plannerReviews/{uid}_{week} { uid, week, data (encrypted: her Sunday review and Nana's note) }
//
// The lock is her choice (off by default). With it on, every route except the status needs a fresh passkey check, kept in an
// httpOnly cookie for /api/planner, and the plan stays out of My Calendar and the private feed.

const PLANS = "plannerPlans", DAYS = "plannerDays", REVIEWS = "plannerReviews";
export const UNLOCK_COOKIE = "nc_planner";
export const UNLOCK_IDLE_MS = 10 * 60_000;
export const UNLOCK_MAX_MS = 60 * 60_000;
const AI_PER_DAY = 90; // Planner questions to Nana's own AI per member per day (an interview is about 30)

export const plannerReady = () => accountCryptoConfigured();
const enc = (v: unknown) => encryptSecret(JSON.stringify(v));
function dec<T>(blob: unknown, fallback: T): T {
  if (typeof blob !== "string" || !blob) return fallback;
  try { return JSON.parse(decryptSecret(blob)) as T; } catch { return fallback; }
}
function needCrypto() {
  if (!plannerReady()) throw new PlannerError("Notes Planner isn't switched on yet. Please check back soon.", 503);
}

// Her own calendar day from the page, if it's within a day of ours; else today in Lagos.
export function pickToday(raw: unknown, now = new Date()): string {
  const ours = lagosToday(now);
  return isDay(raw) && (raw === ours || raw === addDays(ours, -1) || raw === addDays(ours, 1)) ? raw : ours;
}

// ── The optional lock ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function unlockKey(): Buffer {
  const raw = setting("ACCOUNT_DATA_KEY");
  if (!raw) throw new PlannerError("Notes Planner isn't switched on yet. Please check back soon.", 503);
  return createHmac("sha256", Buffer.from(raw, "base64")).update("notesapp-planner-unlock-v1").digest();
}
const sign = (body: string) => createHmac("sha256", unlockKey()).update(body).digest("base64url");
export function issueUnlock(uid: string, now = new Date(), since = now.getTime()): string {
  const exp = Math.min(now.getTime() + UNLOCK_IDLE_MS, since + UNLOCK_MAX_MS);
  const body = `${Buffer.from(uid).toString("base64url")}.${since}.${exp}`;
  return `${body}.${sign(body)}`;
}
// The token's start time, or a 423 ("locked") when it is missing, for someone else, changed or out of date.
export function checkUnlock(token: string | undefined | null, uid: string, now = new Date()): number {
  const locked = new PlannerError("Notes Planner is locked. Unlock it with your passkey.", 423);
  if (!token || token.length > 400) throw locked;
  const parts = token.split(".");
  if (parts.length !== 4) throw locked;
  const [u, since, exp, mac] = parts;
  const want = Buffer.from(sign(`${u}.${since}.${exp}`)), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw locked;
  if (Buffer.from(u, "base64url").toString() !== uid) throw locked;
  const s = Number(since), e = Number(exp);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < now.getTime() || now.getTime() - s > UNLOCK_MAX_MS) throw locked;
  return s;
}

// ── Who may use it ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Who = { teen: boolean };
export async function whoIs(db: Firestore, uid: string): Promise<Who> {
  if (isKidUid(uid)) throw new PlannerError("Notes Planner isn't part of a child profile.", 403);
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) throw new PlannerError("Finish setting up your profile first.", 403);
  if (u.kid === true) throw new PlannerError("Notes Planner isn't part of a child profile.", 403);
  return { teen: u.teen === true };
}

type PlanDoc = { data?: string; has?: boolean; prefs?: unknown; lock?: boolean; movesBell?: number; reviewBell?: number; movesBellDay?: string; reviewBellWeek?: string };
type Stored = { interview: Interview | null; plan: Plan | null; old: Plan | null };
const EMPTY: Stored = { interview: null, plan: null, old: null };
const planRef = (db: Firestore, uid: string) => db.collection(PLANS).doc(uid);
async function read(db: Firestore, uid: string): Promise<{ doc: PlanDoc | undefined; stored: Stored; prefs: PlannerPrefs }> {
  const doc = (await planRef(db, uid).get()).data() as PlanDoc | undefined;
  return { doc, stored: { ...EMPTY, ...dec<Partial<Stored>>(doc?.data, {}) }, prefs: cleanPlannerPrefs(doc?.prefs) };
}
async function write(db: Firestore, uid: string, s: Stored, now: Date, extra: Record<string, unknown> = {}) {
  await planRef(db, uid).set({ uid, data: enc(s), has: !!s.plan, updatedAt: now.toISOString(), ...extra }, { merge: true });
}

// Every request but the status starts here: she may use the Planner, and if she turned the lock on, the cookie is hers and fresh.
export async function enter(db: Firestore, uid: string, token: string | undefined | null, now = new Date()): Promise<Who & { since: number | null }> {
  needCrypto();
  const who = await whoIs(db, uid);
  const doc = (await planRef(db, uid).get()).data() as PlanDoc | undefined;
  return { ...who, since: doc?.lock === true ? checkUnlock(token, uid, now) : null };
}
export async function isLocked(db: Firestore, uid: string): Promise<boolean> {
  return ((await planRef(db, uid).get()).data() as PlanDoc | undefined)?.lock === true;
}

// ── Status (never locked): which screen to open ───────────────────────────────────────────────────────────────────────────
export type PlannerStatus = { eligible: boolean; reason?: string; teen: boolean; ready: boolean; has: boolean; lock: boolean };
export async function plannerStatus(db: Firestore, uid: string): Promise<PlannerStatus> {
  let who: Who;
  try { who = await whoIs(db, uid); } catch (e) {
    if (e instanceof PlannerError) return { eligible: false, reason: e.message, teen: false, ready: plannerReady(), has: false, lock: false };
    throw e;
  }
  const d = (await planRef(db, uid).get()).data() as PlanDoc | undefined;
  return { eligible: true, teen: who.teen, ready: plannerReady(), has: d?.has === true, lock: d?.lock === true };
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function readTicks(db: Firestore, uid: string): Promise<Map<string, boolean[]>> {
  const snap = await db.collection(DAYS).where("uid", "==", uid).get();
  return new Map(snap.docs.map((d) => [String(d.data().day), dec<boolean[]>(d.data().data, [])] as [string, boolean[]]));
}
async function readReviews(db: Firestore, uid: string): Promise<Review[]> {
  const snap = await db.collection(REVIEWS).where("uid", "==", uid).get();
  return snap.docs.map((d) => dec<Review | null>(d.data().data, null)).filter((r): r is Review => !!r && typeof r.week === "string").sort((a, b) => a.week.localeCompare(b.week));
}
const tickedDays = (ticks: Map<string, boolean[]>) => [...ticks].filter(([, t]) => t.some(Boolean)).map(([d]) => d);

const interviewView = (iv: Interview) => ({
  messages: iv.messages, part: iv.part, asked: iv.asked, target: targetFor(iv.teen), gentle: iv.gentle, summary: iv.summary, pct: progressPct(iv), start: iv.start, length: iv.length,
});

// Everything the Planner tab shows, worked out on the server.
export async function plannerView(db: Firestore, uid: string, who: Who, today: string) {
  const [{ stored, prefs }, ticks, reviews] = await Promise.all([read(db, uid), readTicks(db, uid), readReviews(db, uid)]);
  const plan = stored.plan;
  const week = reviewWeek(today);
  return {
    teen: who.teen, today, prefs,
    state: plan ? ("plan" as const) : stored.interview ? (stored.interview.summary ? ("summary" as const) : ("interview" as const)) : ("none" as const),
    starts: planStart(today), lengths: lengthsFor(who.teen),
    interview: stored.interview ? interviewView(stored.interview) : null,
    plan,
    day: plan ? dayView(plan, today, ticks.get(today)) : null,
    streak: streak(tickedDays(ticks), today),
    review: plan ? { week, open: reviewOpen(plan, today), done: reviews.find((r) => r.week === week) ?? null } : null,
    reviews: reviews.slice(-8).reverse(),
    old: stored.old,
  };
}
export type PlannerView = Awaited<ReturnType<typeof plannerView>>;

// One day, for the calendar: the month's project and the moves to tick.
export async function plannerDay(db: Firestore, uid: string, day: string, today: string) {
  const [{ stored }, snap] = await Promise.all([read(db, uid), db.collection(DAYS).doc(`${uid}_${day}`).get()]);
  if (!stored.plan) return { has: false as const };
  const ticks = dec<boolean[]>(snap.data()?.data, []);
  return { has: true as const, day, view: dayView(stored.plan, day, ticks), tasks: day === today ? stored.plan.tasks : [], canTick: day <= today };
}

// ── The interview ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function askNana(db: Firestore, uid: string, deps: NanaDeps, req: { system: string; state?: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number }): Promise<{ text: string; notice?: string } | { text: null; notice?: string }> {
  const meter: Meter = { uid, tier: await memberTier(db, uid), gem: "pearl", effort: "low" };
  const system = [{ type: "text" as const, text: req.system, cache_control: { type: "ephemeral" as const } }, ...(req.state ? [{ type: "text" as const, text: req.state }] : [])];
  const ran = await runAi(db, deps, deps.now(), uid, { system, messages: req.messages, maxTokens: req.maxTokens, model: gemModel("pearl"), effort: "low" }, AI_PER_DAY, meter);
  if (!ran.completion || ran.completion.refused || !ran.completion.text.trim()) return { text: null, ...(ran.notice ? { notice: ran.notice } : {}) };
  return { text: ran.completion.text, ...(ran.notice ? { notice: ran.notice } : {}) };
}
const nanaAway = (notice?: string) => new PlannerError(`${notice ?? "Nana can't carry on just now."} Your answers are saved: come back later, or write your plan yourself.`, 503);

// Start with Nana: the first question is ours, so it opens at once and costs nothing.
export async function startInterview(db: Firestore, uid: string, who: Who, b: Record<string, unknown>, today: string, now = new Date()) {
  const { stored } = await read(db, uid);
  if (stored.interview && b.restart !== true) return interviewView(stored.interview);
  const interview = newInterview({ teen: who.teen, length: cleanLength(b.length, who.teen), today, now });
  await write(db, uid, { ...stored, interview }, now);
  return interviewView(interview);
}

// Her answer (or a skip), then Nana's next question or her five-line summary.
export async function interviewTurn(db: Firestore, uid: string, who: Who, b: Record<string, unknown>, deps: NanaDeps = realDeps()) {
  const now = deps.now();
  const { stored } = await read(db, uid);
  if (!stored.interview) throw new PlannerError("Start the interview first.", 409);
  let iv: Interview = { ...stored.interview, teen: who.teen };
  if (typeof b.gentle === "boolean") iv = { ...iv, gentle: who.teen ? true : b.gentle };
  iv = withAnswer(iv, b.skip === true ? SKIP_TEXT : cleanAnswer(b.message), now);
  await write(db, uid, { ...stored, interview: iv }, now); // her answer is kept even if Nana can't reply
  const state = [interviewState(iv), b.sumUp === true || mustSumUp(iv) ? "They asked you to sum up now. Reply with [[SUMMARY]]." : ""].filter(Boolean).join("\n");
  const got = await askNana(db, uid, deps, { system: interviewSystem(iv), state, messages: interviewMessages(iv), maxTokens: 500 });
  if (!got.text) throw nanaAway(got.notice);
  iv = withReply(iv, parseReply(got.text), now);
  await write(db, uid, { ...stored, interview: iv }, now);
  return { ...interviewView(iv), ...(got.notice ? { notice: got.notice } : {}) };
}

export async function setGentle(db: Firestore, uid: string, who: Who, on: boolean, now = new Date()) {
  const { stored } = await read(db, uid);
  if (!stored.interview) throw new PlannerError("Start the interview first.", 409);
  const interview = { ...stored.interview, gentle: who.teen ? true : on };
  await write(db, uid, { ...stored, interview }, now);
  return interviewView(interview);
}

// "Yes, write my plan": Nana writes it from the interview. The interview is dropped once the plan is saved.
export async function writePlan(db: Firestore, uid: string, who: Who, deps: NanaDeps = realDeps()): Promise<{ plan: Plan; notice?: string }> {
  const now = deps.now();
  const { stored } = await read(db, uid);
  const iv = stored.interview;
  if (!iv?.summary) throw new PlannerError("Finish the interview first, so Nana can check she understood you.", 409);
  const got = await askNana(db, uid, deps, { system: planSystem({ ...iv, teen: who.teen }), messages: [...interviewMessages(iv), { role: "user", content: PLAN_TASK }], maxTokens: 3500 });
  if (!got.text) throw nanaAway(got.notice);
  const start = iv.start > lagosToday(now) ? iv.start : planStart(lagosToday(now)); // an interview finished weeks later still starts next month
  const plan = cleanPlan(parsePlanJson(got.text), { start, length: iv.length, teen: who.teen, by: "nana", now });
  await write(db, uid, { interview: null, plan, old: stored.plan ?? stored.old }, now);
  return { plan, ...(got.notice ? { notice: got.notice } : {}) };
}

// Write it myself, and every edit afterwards. An edit keeps the plan's dates, ticks of finished months and who wrote it.
export async function savePlan(db: Firestore, uid: string, who: Who, b: Record<string, unknown>, today: string, now = new Date()): Promise<Plan> {
  const { stored } = await read(db, uid);
  const prev = stored.plan;
  const fresh = !prev || b.fresh === true;
  const plan = cleanPlan(b.plan, {
    start: fresh ? planStart(today) : prev.start, length: fresh ? cleanLength(b.length, who.teen) : prev.months.length, teen: who.teen, by: fresh ? "me" : prev.by, now,
  });
  const kept = fresh ? plan : { ...plan, createdAt: prev.createdAt };
  await write(db, uid, { interview: fresh ? null : stored.interview, plan: kept, old: fresh ? prev ?? stored.old : stored.old }, now);
  return kept;
}

// ── Ticks ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function needPlan(db: Firestore, uid: string) {
  const r = await read(db, uid);
  if (!r.stored.plan) throw new PlannerError("Make your plan first.", 409);
  return { ...r, plan: r.stored.plan };
}

// A move ticked or unticked, today or on a day already gone (never ahead).
export async function tickMove(db: Firestore, uid: string, b: Record<string, unknown>, today: string, now = new Date()) {
  const { plan } = await needPlan(db, uid);
  const day = isDay(b.day) ? b.day : today, i = Number(b.i);
  if (day > today) throw new PlannerError("You can tick a move on the day, not before it.");
  if (!dayView(plan, day).inPlan) throw new PlannerError("That day isn't inside your plan.");
  if (!Number.isInteger(i) || i < 0 || i >= plan.moves.length) throw new PlannerError("Unknown move.");
  const ref = db.collection(DAYS).doc(`${uid}_${day}`);
  const ticks = cleanTicks(dec<boolean[]>((await ref.get()).data()?.data, []), plan);
  ticks[i] = b.on === true;
  await ref.set({ uid, day, data: enc(ticks), updatedAt: now.toISOString() });
  return { day, view: dayView(plan, day, ticks) };
}

export async function tickTask(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()): Promise<Plan> {
  const { stored, plan } = await needPlan(db, uid);
  const i = Number(b.i);
  if (!Number.isInteger(i) || i < 0 || i >= plan.tasks.length) throw new PlannerError("Unknown task.");
  const next = { ...plan, tasks: plan.tasks.map((t, j) => (j === i ? { ...t, done: b.on === true } : t)) };
  await write(db, uid, { ...stored, plan: next }, now);
  return next;
}

export async function finishMonth(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()): Promise<Plan> {
  const { stored, plan } = await needPlan(db, uid);
  if (!isMonth(b.month) || !plan.months.some((m) => m.month === b.month)) throw new PlannerError("That month isn't in your plan.");
  const next = { ...plan, months: plan.months.map((m) => (m.month === b.month ? { ...m, finished: b.on === true } : m)) };
  await write(db, uid, { ...stored, plan: next }, now);
  return next;
}

// ── The Sunday review ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function saveReview(db: Firestore, uid: string, who: Who, b: Record<string, unknown>, today: string, deps: NanaDeps = realDeps()) {
  const now = deps.now();
  const { stored, plan, prefs } = await needPlan(db, uid);
  if (!reviewOpen(plan, today)) throw new PlannerError("Your first review opens on the first Sunday of your plan.");
  const week = reviewWeek(today);
  const review = cleanReview(b, plan, week, now);
  const ticks = await readTicks(db, uid);
  const days = weekDays(week).filter((d) => ticks.get(d)?.some(Boolean)).length;
  let note = fallbackNote(plan, review, days), ai = false, notice: string | undefined;
  if (prefs.nanaNote) {
    const got = await askNana(db, uid, deps, { system: reviewSystem(who.teen), messages: [{ role: "user", content: reviewContext(plan, review, days) }], maxTokens: 300 });
    notice = got.notice;
    if (got.text) { note = got.text.replace(/\[\[[^\]]*\]\]/g, "").trim().slice(0, 1200); ai = true; }
  }
  const saved: Review = { ...review, note, ai };
  await db.collection(REVIEWS).doc(`${uid}_${week}`).set({ uid, week, data: enc(saved), updatedAt: now.toISOString() });
  const next = withReviewNumbers(plan, review);
  await write(db, uid, { ...stored, plan: next }, now);
  return { review: saved, plan: next, warnings: warnings(plan, review), ...(notice ? { notice } : {}) };
}

// ── Her choices ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The bell hours and the lock are copied beside the encrypted data, so the bells job and the calendar can read them without it.
export async function savePrefs(db: Firestore, uid: string, raw: unknown, now = new Date()): Promise<PlannerPrefs> {
  needCrypto();
  const { doc } = await read(db, uid);
  const prefs = cleanPlannerPrefs(raw, cleanPlannerPrefs(doc?.prefs));
  await planRef(db, uid).set({ uid, prefs, lock: prefs.lock, movesBell: prefs.movesBell, reviewBell: prefs.reviewBell, updatedAt: now.toISOString() }, { merge: true });
  return prefs;
}
export const defaultPrefs = () => ({ ...DEFAULT_PLANNER_PREFS });

// ── My Calendar and the private feed ─────────────────────────────────────────────────────────────────────────────────────────────
// Each month's project and the Sunday review, as calendar entries. Nothing when she has no plan, or when she turned the lock on.
export async function planCalendar(db: Firestore, uid: string, from: string, to: string): Promise<CalEntry[]> {
  if (!plannerReady()) return [];
  const { doc, stored, prefs } = await read(db, uid);
  if (!stored.plan || doc?.lock === true) return [];
  return planEntries(stored.plan, from, to, { titles: prefs.feedTitles, reviewHour: prefs.reviewBell || 17 });
}

// ── Download my plan, Delete everything ──────────────────────────────────────────────────────────────────────────────────────────
export async function exportPlanner(db: Firestore, uid: string, now = new Date()) {
  const [{ stored, prefs }, ticks, reviews] = await Promise.all([read(db, uid), readTicks(db, uid), readReviews(db, uid)]);
  return {
    about: "Your Notes Planner data from #NotesApp. Only you can see this.",
    exportedAt: now.toISOString(),
    plan: stored.plan, planBefore: stored.old, interview: stored.interview, settings: prefs,
    ticks: Object.fromEntries([...ticks].sort(([a], [b]) => a.localeCompare(b))),
    reviews,
  };
}

// Everything goes: the interview, the plan, ticks, reviews and her choices. Also run when the account is closed (lib/account-server.ts).
export async function erasePlanner(db: Firestore, uid: string): Promise<number> {
  const [days, reviews] = await Promise.all([db.collection(DAYS).where("uid", "==", uid).get(), db.collection(REVIEWS).where("uid", "==", uid).get()]);
  const refs = [...days.docs.map((d) => d.ref), ...reviews.docs.map((d) => d.ref), planRef(db, uid)];
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const r of refs.slice(i, i + 400)) batch.delete(r);
    await batch.commit();
  }
  return refs.length;
}

// ── Bells (the 15-minute reminders job) ──────────────────────────────────────────────────────────────────────────────────────────
// Today's moves each morning, and the Sunday review, from the hours she chose. Each says only that the Planner is ready. Never an email.
export async function plannerBells(db: Firestore, now = new Date(), notify = notifyBell): Promise<number> {
  if (!plannerReady()) return 0;
  const today = lagosToday(now), hour = lagosHour(now);
  const snap = await db.collection(PLANS).where("has", "==", true).get();
  let n = 0;
  for (const d of snap.docs) {
    const p = d.data() as PlanDoc;
    const plan = dec<Partial<Stored>>(p.data, {}).plan;
    if (!plan) continue;
    const prefs = cleanPlannerPrefs(p.prefs);
    if (movesBellDue(plan, prefs.movesBell, p.movesBellDay, today, hour)) {
      await d.ref.update({ movesBellDay: today });
      await notify({ uid: d.id, type: "reminder", linkHref: "/calendar", message: MOVES_BELL_TEXT }).catch(() => {});
      n++;
    }
    if (prefs.reviewBell > 0 && p.reviewBellWeek !== today) {
      const reviewed = (await db.collection(REVIEWS).doc(`${d.id}_${today}`).get()).exists;
      if (reviewBellDue(plan, prefs.reviewBell, p.reviewBellWeek, today, hour, reviewed)) {
        await d.ref.update({ reviewBellWeek: today });
        await notify({ uid: d.id, type: "reminder", linkHref: `${PLANNER_HREF}/review`, message: REVIEW_BELL_TEXT }).catch(() => {});
        n++;
      }
    }
  }
  return n;
}
