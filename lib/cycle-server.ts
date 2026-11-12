import { createHmac, timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { isKidUid } from "./kids";
import { lagosDate } from "./team";
import { notifyBell } from "./email";
import { memberTier, type Meter } from "./nana-meter";
import { gemModel, realDeps, runAi, type NanaDeps } from "./nana-server";
import {
  CHAT_KEEP, CHAT_MAX, CycleError, MAX_LENGTH, MIN_LENGTH, REMINDER_TEXT, addDays, addPeriod, calendar, cleanLength, cleanLog,
  daysBetween, endPeriod, fallbackNote, forTeen, insights, isDay, isLateForBell, nanaSummary, redFlags, removePeriod, sortPeriods,
  teenCalendar, tipsFor, todayView, type Log, type Period, type Settings,
} from "./cycle";
import { cycleSystem, CYCLE_TASK, type CycleTask } from "./cycle-nana";

// My Cycle on the server (docs/MY_CYCLE.md; the rules are in lib/cycle.ts). Every collection is server-only in firestore.rules and
// written only here. Her logs, settings, notes and chat are encrypted at rest with ACCOUNT_DATA_KEY (AES-256-GCM, as lib/ai-connect.ts
// keeps an AI key). Nothing here is part of the account export, ads, analytics, other Nana features or Admin.
//
//   cycleProfiles/{uid}       { uid, answer: "female" | "no", answeredAt, consentAt?, data (encrypted: periods, cycleLength, pill,
//                               pillStart), remindCheckIn, remindLate, lateToldFor?, checkInBellDay?, updatedAt }
//   cycleLogs/{uid}_{day}     { uid, day, data (encrypted check-in), advice? (encrypted), updatedAt }
//   cycleNotes/{uid}          { uid, data (encrypted: today's note from Nana, this month's report) }
//   cycleChats/{uid}          { uid, data (encrypted: her private chat with Nana, the last 40 messages), updatedAt }
//
// The answer to "I'm female / Not for me" lives only in cycleProfiles, never on users/{uid}.
//
// The lock: every route except the status and the first-open answer needs a fresh passkey check (lib/passkeys-server.ts
// verifyUser, user verification required). Success sets an httpOnly cookie, signed with a key made from ACCOUNT_DATA_KEY, that names
// her uid and lasts 2 minutes, renewed by each request, and never more than 30 minutes from the check. The page blanks and locks
// itself when she switches apps or tabs.

const PROFILES = "cycleProfiles", LOGS = "cycleLogs", NOTES = "cycleNotes", CHATS = "cycleChats";
export const UNLOCK_COOKIE = "nc_cycle";
export const UNLOCK_IDLE_MS = 2 * 60_000;
export const UNLOCK_MAX_MS = 30 * 60_000;
const AI_PER_DAY = 30; // My Cycle questions to Nana's own AI per member per day (her own AI account isn't counted)

export const cycleReady = () => accountCryptoConfigured();
const enc = (v: unknown) => encryptSecret(JSON.stringify(v));
function dec<T>(blob: unknown, fallback: T): T {
  if (typeof blob !== "string" || !blob) return fallback;
  try { return JSON.parse(decryptSecret(blob)) as T; } catch { return fallback; }
}
function needCrypto() {
  if (!cycleReady()) throw new CycleError("My Cycle isn't switched on yet. Please check back soon.", 503);
}

// ── The day ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Her own calendar day from the page, if it's within a day of ours; else today in Lagos.
export function pickToday(raw: unknown, now = new Date()): string {
  const utc = now.toISOString().slice(0, 10);
  return isDay(raw) && Math.abs(daysBetween(utc, raw)) <= 1 ? raw : lagosDate(now);
}

// ── The unlock token ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function unlockKey(): Buffer {
  const raw = setting("ACCOUNT_DATA_KEY");
  if (!raw) throw new CycleError("My Cycle isn't switched on yet. Please check back soon.", 503);
  return createHmac("sha256", Buffer.from(raw, "base64")).update("notesapp-my-cycle-unlock-v1").digest();
}
const sign = (body: string) => createHmac("sha256", unlockKey()).update(body).digest("base64url");

// `since` is when she last passed the passkey check; it carries over when the token is renewed.
export function issueUnlock(uid: string, now = new Date(), since = now.getTime()): string {
  const exp = Math.min(now.getTime() + UNLOCK_IDLE_MS, since + UNLOCK_MAX_MS);
  const body = `${Buffer.from(uid).toString("base64url")}.${since}.${exp}`;
  return `${body}.${sign(body)}`;
}

// The token's start time, or a 423 ("locked") when it is missing, for someone else, changed or out of date.
export function checkUnlock(token: string | undefined | null, uid: string, now = new Date()): number {
  const locked = new CycleError("My Cycle is locked. Unlock it with your passkey.", 423);
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
  if (isKidUid(uid)) throw new CycleError("My Cycle isn't part of a child profile.", 403);
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) throw new CycleError("Finish setting up your profile first.", 403);
  if (u.kid === true) throw new CycleError("My Cycle isn't part of a child profile.", 403);
  if (u.accountKind === "organisation") throw new CycleError("My Cycle is for personal accounts, not organisations.", 403);
  return { teen: u.teen === true };
}

type ProfileDoc = { answer?: "female" | "no"; data?: string; remindCheckIn?: boolean; remindLate?: boolean; lateToldFor?: string; checkInBellDay?: string; consentAt?: string };
type Stored = { periods: Period[]; cycleLength: number | null; pill: boolean; pillStart: string | null };
const EMPTY: Stored = { periods: [], cycleLength: null, pill: false, pillStart: null };
const profileRef = (db: Firestore, uid: string) => db.collection(PROFILES).doc(uid);
async function readProfile(db: Firestore, uid: string): Promise<{ doc: ProfileDoc | undefined; stored: Stored }> {
  const doc = (await profileRef(db, uid).get()).data() as ProfileDoc | undefined;
  const s = dec<Stored>(doc?.data, EMPTY);
  return { doc, stored: { ...EMPTY, ...s, periods: sortPeriods(Array.isArray(s.periods) ? s.periods : []) } };
}
const settingsOf = (s: Stored, teen: boolean): Settings => ({ cycleLength: s.cycleLength, pill: teen ? false : s.pill, pillStart: teen ? null : s.pillStart });

// ── Status (no unlock needed): whether to show the menu item, and which screen to open ─────────────────────────────────────────
export type CycleStatus = { eligible: boolean; reason?: string; teen: boolean; answer: "female" | "no" | null; ready: boolean; menu: boolean };
export async function cycleStatus(db: Firestore, uid: string): Promise<CycleStatus> {
  let who: Who;
  try { who = await whoIs(db, uid); } catch (e) {
    if (e instanceof CycleError) return { eligible: false, reason: e.message, teen: false, answer: null, ready: cycleReady(), menu: false };
    throw e;
  }
  const d = (await profileRef(db, uid).get()).data() as ProfileDoc | undefined;
  const answer = d?.answer === "female" || d?.answer === "no" ? d.answer : null;
  return { eligible: true, teen: who.teen, answer, ready: cycleReady(), menu: answer !== "no" };
}

// ── First open: "I'm female" (with the consent line, her last period and her usual length) or "Not for me" ───────────────────
export async function answer(db: Firestore, uid: string, b: Record<string, unknown>, today: string, now = new Date()): Promise<CycleStatus> {
  await whoIs(db, uid);
  const ref = profileRef(db, uid);
  const prev = (await ref.get()).data() as ProfileDoc | undefined;
  if (b.answer === "no") {
    if (prev?.answer === "female") throw new CycleError("My Cycle is set up. To remove it, use Delete everything in My Cycle settings.", 409);
    await ref.set({ uid, answer: "no", answeredAt: now.toISOString(), updatedAt: now.toISOString() });
    return cycleStatus(db, uid);
  }
  if (b.answer === "undo") { // Settings → Privacy: show My Cycle again
    if (prev?.answer === "no") await ref.delete();
    return cycleStatus(db, uid);
  }
  if (b.answer !== "female") throw new CycleError("Choose \"I'm female\" or \"Not for me\".");
  needCrypto();
  if (prev?.answer === "female") throw new CycleError("My Cycle is already set up. Unlock it to make changes.", 409);
  if (b.consent !== true) throw new CycleError("Tick the consent line to start.");
  const cycleLength = cleanLength(b.cycleLength);
  let periods: Period[] = [];
  if (b.lastPeriod !== undefined && b.lastPeriod !== null && b.lastPeriod !== "") periods = addPeriod([], String(b.lastPeriod), today);
  await ref.set({
    uid, answer: "female", answeredAt: now.toISOString(), consentAt: now.toISOString(),
    data: enc({ ...EMPTY, periods, cycleLength } satisfies Stored), remindCheckIn: false, remindLate: false, updatedAt: now.toISOString(),
  });
  return cycleStatus(db, uid);
}

// Every unlocked request starts here: she may use My Cycle, has set it up, and the cookie is hers.
export async function unlocked(db: Firestore, uid: string, token: string | undefined | null, now = new Date()): Promise<Who & { since: number }> {
  const since = checkUnlock(token, uid, now);
  needCrypto();
  const who = await whoIs(db, uid);
  const d = (await profileRef(db, uid).get()).data() as ProfileDoc | undefined;
  if (d?.answer !== "female") throw new CycleError("Set up My Cycle first.", 409);
  return { ...who, since };
}

// May she unlock? (Set up, and allowed.) Checked before the passkey ceremony starts.
export async function mayUnlock(db: Firestore, uid: string): Promise<void> {
  needCrypto();
  await whoIs(db, uid);
  const d = (await profileRef(db, uid).get()).data() as ProfileDoc | undefined;
  if (d?.answer !== "female") throw new CycleError("Set up My Cycle first.", 409);
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type LogDoc = { uid: string; day: string; data?: string; advice?: string };
async function readLogs(db: Firestore, uid: string): Promise<{ log: Log; advice: string | null }[]> {
  const snap = await db.collection(LOGS).where("uid", "==", uid).get();
  return snap.docs
    .map((d) => d.data() as LogDoc)
    .map((d) => ({ log: { ...dec<Log>(d.data, null as unknown as Log), day: d.day }, advice: dec<string | null>(d.advice, null) }))
    .filter((x) => x.log && Array.isArray(x.log.moods))
    .sort((a, b) => a.log.day.localeCompare(b.log.day));
}
type Notes = { daily?: { day: string; text: string; ai: boolean }; report?: { month: string; text: string; ai: boolean } };
const readNotes = async (db: Firestore, uid: string) => dec<Notes>((await db.collection(NOTES).doc(uid).get()).data()?.data, {});
type ChatMsg = { role: "user" | "assistant"; text: string; at: string };
const readChat = async (db: Firestore, uid: string) => dec<ChatMsg[]>((await db.collection(CHATS).doc(uid).get()).data()?.data, []);

// Everything the page shows, worked out on the server. A teen's view never carries ovulation, the fertile window or pill mode.
export async function cycleView(db: Firestore, uid: string, who: Who, today: string) {
  const [{ doc, stored }, logs, notes, chat] = await Promise.all([readProfile(db, uid), readLogs(db, uid), readNotes(db, uid), readChat(db, uid)]);
  const settings = settingsOf(stored, who.teen);
  const t = todayView(stored.periods, settings, today, who.teen);
  const from = addDays(today.slice(0, 8) + "01", -95), to = addDays(today, 130);
  const cal = calendar(stored.periods, settings, today, from, to, who.teen);
  const plain = logs.map((l) => l.log);
  const recent = logs.filter((l) => daysBetween(l.log.day, today) <= 100);
  const flags = redFlags(stored.periods, plain, today);
  return {
    teen: who.teen,
    today: who.teen ? forTeen(t) : t,
    calendar: who.teen ? teenCalendar(cal) : cal,
    periods: stored.periods.slice(-24),
    settings: { cycleLength: stored.cycleLength, pill: settings.pill, pillStart: settings.pillStart, remindCheckIn: doc?.remindCheckIn === true, remindLate: doc?.remindLate === true, min: MIN_LENGTH, max: MAX_LENGTH },
    logs: recent.map((l) => ({ ...l.log, advice: l.advice })),
    insights: insights(stored.periods, plain),
    tips: tipsFor(t.phase),
    flags,
    note: notes.daily?.day === today ? notes.daily : null,
    report: notes.report?.month === today.slice(0, 7) ? notes.report : null,
    chat,
  };
}

// ── Writing ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function writeStored(db: Firestore, uid: string, s: Stored, now: Date, extra: Record<string, unknown> = {}) {
  await profileRef(db, uid).set({ data: enc(s), updatedAt: now.toISOString(), ...extra }, { merge: true });
}

export async function saveSettings(db: Firestore, uid: string, who: Who, b: Record<string, unknown>, now = new Date()): Promise<void> {
  const { stored } = await readProfile(db, uid);
  const next: Stored = { ...stored };
  if ("cycleLength" in b) next.cycleLength = cleanLength(b.cycleLength);
  if ("pill" in b) {
    if (who.teen && b.pill === true) throw new CycleError("Pill mode isn't part of the teen version.", 403);
    next.pill = b.pill === true;
  }
  if ("pillStart" in b) {
    if (who.teen) throw new CycleError("Pill mode isn't part of the teen version.", 403);
    next.pillStart = b.pillStart === null || b.pillStart === "" ? null : isDay(b.pillStart) ? b.pillStart : (() => { throw new CycleError("Choose the day you started this pack."); })();
  }
  const extra: Record<string, unknown> = {};
  if ("remindCheckIn" in b) extra.remindCheckIn = b.remindCheckIn === true;
  if ("remindLate" in b) extra.remindLate = b.remindLate === true;
  await writeStored(db, uid, next, now, extra);
}

// The calendar: a period started on a day, a period's last day, or a period taken out.
export async function changePeriod(db: Firestore, uid: string, b: Record<string, unknown>, today: string, now = new Date()): Promise<void> {
  const { stored } = await readProfile(db, uid);
  let periods = stored.periods;
  if (b.op === "start") periods = addPeriod(periods, String(b.day ?? ""), today);
  else if (b.op === "end") periods = endPeriod(periods, String(b.start ?? ""), String(b.day ?? ""));
  else if (b.op === "remove") periods = removePeriod(periods, String(b.day ?? ""));
  else throw new CycleError("Unknown change.");
  await writeStored(db, uid, { ...stored, periods }, now, { lateToldFor: null });
}

// ── Nana ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// One call to Nana with only her phase and a short summary of her logs. Her own AI account first, else Nana's allowance (the same
// metering as every Nana feature). null when no AI is available, so the caller falls back to our own phase tips.
async function askNana(db: Firestore, uid: string, teen: boolean, task: CycleTask, summary: string, deps: NanaDeps, history: ChatMsg[] = []): Promise<{ text: string; notice?: string } | null> {
  const now = deps.now();
  const meter: Meter = { uid, tier: await memberTier(db, uid), gem: "pearl", effort: "low" };
  const messages = task === "chat"
    ? history.slice(-10).map((m) => ({ role: m.role, content: m.role === "user" ? `${m.text}` : m.text }))
    : [{ role: "user" as const, content: CYCLE_TASK[task] }];
  // Her summary goes in the system prompt, so each chat turn sees today's picture.
  const system = [{ type: "text" as const, text: cycleSystem(teen), cache_control: { type: "ephemeral" as const } }, { type: "text" as const, text: `WHAT SHE HAS LOGGED (her own data, nothing else is known about her):\n${summary}` }];
  const ran = await runAi(db, deps, now, uid, { system, messages, maxTokens: task === "report" ? 900 : 600, model: gemModel("pearl"), effort: "low" }, AI_PER_DAY, meter);
  if (!ran.completion || ran.completion.refused || !ran.completion.text.trim()) return null;
  const text = ran.completion.text.replace(/\[\[(GAP|HANDOFF)\]\]/g, "").trim().slice(0, 3000);
  return { text, ...(ran.notice ? { notice: ran.notice } : {}) };
}

async function context(db: Firestore, uid: string, who: Who, today: string) {
  const [{ stored }, logs] = await Promise.all([readProfile(db, uid), readLogs(db, uid)]);
  const plain = logs.map((l) => l.log);
  const t = todayView(stored.periods, settingsOf(stored, who.teen), today, who.teen);
  const flags = redFlags(stored.periods, plain, today);
  return { stored, plain, t, flags, summary: nanaSummary(t, plain, flags, who.teen) };
}

export type Advice = { text: string; ai: boolean; notice?: string };

export async function saveLog(db: Firestore, uid: string, who: Who, b: Record<string, unknown>, today: string, deps: NanaDeps = realDeps()): Promise<{ log: Log; advice: Advice | null }> {
  const now = deps.now();
  const log = cleanLog(b, today);
  const ref = db.collection(LOGS).doc(`${uid}_${log.day}`);
  await ref.set({ uid, day: log.day, data: enc(log), updatedAt: now.toISOString() }, { merge: true });
  // A heavy, medium or light flow on a day with no period logged nearby starts one (spotting doesn't).
  if (log.flow && log.flow !== "spotting") {
    const { stored } = await readProfile(db, uid);
    const near = stored.periods.some((p) => { const n = daysBetween(p.start, log.day); return n >= 0 && n < 10; });
    if (!near) await writeStored(db, uid, { ...stored, periods: addPeriod(stored.periods, log.day, today) }, now, { lateToldFor: null });
  }
  if (b.ask !== true) return { log, advice: null };
  const c = await context(db, uid, who, today);
  const got = await askNana(db, uid, who.teen, "checkin", c.summary, deps);
  const advice: Advice = got ? { text: got.text, ai: true, ...(got.notice ? { notice: got.notice } : {}) } : { text: fallbackNote(c.t, c.flags, who.teen), ai: false };
  await ref.set({ advice: enc(advice.text) }, { merge: true });
  return { log, advice };
}

// Nana's note for today, made once a day and kept.
export async function dailyNote(db: Firestore, uid: string, who: Who, today: string, deps: NanaDeps = realDeps()): Promise<Advice> {
  const notes = await readNotes(db, uid);
  if (notes.daily?.day === today) return { text: notes.daily.text, ai: notes.daily.ai };
  const c = await context(db, uid, who, today);
  const got = c.t.setUp ? await askNana(db, uid, who.teen, "daily", c.summary, deps) : null;
  const note: Advice = got ? { text: got.text, ai: true, ...(got.notice ? { notice: got.notice } : {}) } : { text: fallbackNote(c.t, c.flags, who.teen), ai: false };
  // Our own tips aren't kept, so Nana is asked again later in the day if she becomes available.
  if (note.ai) await db.collection(NOTES).doc(uid).set({ uid, data: enc({ ...notes, daily: { day: today, text: note.text, ai: true } }) });
  return note;
}

// Nana's monthly report, made once a month (she can ask again after logging more).
export async function monthlyReport(db: Firestore, uid: string, who: Who, today: string, fresh: boolean, deps: NanaDeps = realDeps()): Promise<Advice> {
  const notes = await readNotes(db, uid);
  const month = today.slice(0, 7);
  if (!fresh && notes.report?.month === month) return { text: notes.report.text, ai: notes.report.ai };
  const c = await context(db, uid, who, today);
  const ins = insights(c.stored.periods, c.plain.filter((l) => daysBetween(l.day, today) <= 31));
  const extra = [
    `This month: ${ins.checkIns} check-ins.`,
    ins.topSymptoms.length ? `Top symptoms: ${ins.topSymptoms.map((s) => `${s.name.toLowerCase()} (${s.count})`).join(", ")}.` : "",
    ins.average ? `Average cycle: ${ins.average} days${ins.spread !== null ? `, spread ${ins.spread} days` : ""}.` : "",
    ins.beforePeriod.length ? `Moods most logged in the 5 days before a period: ${ins.beforePeriod.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
  const got = await askNana(db, uid, who.teen, "report", `${c.summary}\n${extra}`, deps);
  const report: Advice = got
    ? { text: got.text, ai: true, ...(got.notice ? { notice: got.notice } : {}) }
    : { text: `This month you checked in ${ins.checkIns} time${ins.checkIns === 1 ? "" : "s"}.${ins.topSymptoms[0] ? ` You logged ${ins.topSymptoms[0].name.toLowerCase()} most.` : ""}${ins.average ? ` Your cycles average ${ins.average} days.` : ""} ${fallbackNote(c.t, c.flags, who.teen)}`, ai: false };
  if (report.ai) await db.collection(NOTES).doc(uid).set({ uid, data: enc({ ...notes, report: { month, text: report.text, ai: true } }) });
  return report;
}

// Her private chat with Nana: kept apart from other Nana chats (nanaChats), encrypted, never seen by staff.
export async function chatTurn(db: Firestore, uid: string, who: Who, b: Record<string, unknown>, today: string, deps: NanaDeps = realDeps()): Promise<{ chat: ChatMsg[]; ai: boolean; notice?: string }> {
  const now = deps.now();
  const q = String(b.message ?? "").replace(/\u0000/g, "").trim();
  if (!q) throw new CycleError("Ask Nana something.");
  if (q.length > CHAT_MAX) throw new CycleError(`Keep your question under ${CHAT_MAX} characters.`);
  const chat = await readChat(db, uid);
  const withQ: ChatMsg[] = [...chat, { role: "user", text: q, at: now.toISOString() }];
  const c = await context(db, uid, who, today);
  const got = await askNana(db, uid, who.teen, "chat", c.summary, deps, withQ);
  const reply = got?.text ?? `I can't answer properly just now, but here's what usually helps at this point in your cycle. ${fallbackNote(c.t, c.flags, who.teen)} If something worries you, a pharmacist, doctor or clinic can help${who.teen ? ", and so can a trusted adult" : ""}.`;
  const next = [...withQ, { role: "assistant" as const, text: reply, at: now.toISOString() }].slice(-CHAT_KEEP);
  await db.collection(CHATS).doc(uid).set({ uid, data: enc(next), updatedAt: now.toISOString() });
  return { chat: next, ai: !!got, ...(got?.notice ? { notice: got.notice } : {}) };
}

export async function clearChat(db: Firestore, uid: string): Promise<void> {
  await db.collection(CHATS).doc(uid).delete();
}

// ── Download my data, Delete everything ──────────────────────────────────────────────────────────────────────────────────────────
export async function exportCycle(db: Firestore, uid: string, who: Who, today: string, now = new Date()) {
  const [{ doc, stored }, logs, notes, chat] = await Promise.all([readProfile(db, uid), readLogs(db, uid), readNotes(db, uid), readChat(db, uid)]);
  return {
    about: "Your My Cycle data from #NotesApp. Only you can see this.",
    exportedAt: now.toISOString(),
    answeredAt: doc ? (doc as Record<string, unknown>).answeredAt ?? null : null,
    consentAt: doc?.consentAt ?? null,
    settings: { cycleLength: stored.cycleLength, ...(who.teen ? {} : { pill: stored.pill, pillStart: stored.pillStart }), remindCheckIn: doc?.remindCheckIn === true, remindLate: doc?.remindLate === true },
    periods: stored.periods,
    checkIns: logs.map((l) => ({ ...l.log, ...(l.advice ? { nana: l.advice } : {}) })),
    nanaNotes: notes,
    nanaChat: chat,
    today: who.teen ? forTeen(todayView(stored.periods, settingsOf(stored, true), today, true)) : todayView(stored.periods, settingsOf(stored, false), today, false),
  };
}

// Everything goes: the answer too, so the next open starts at the first screen. Also run when the account is closed.
export async function eraseCycle(db: Firestore, uid: string): Promise<number> {
  const logs = await db.collection(LOGS).where("uid", "==", uid).get();
  const refs = [...logs.docs.map((d) => d.ref), profileRef(db, uid), db.collection(NOTES).doc(uid), db.collection(CHATS).doc(uid)];
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const r of refs.slice(i, i + 400)) batch.delete(r);
    await batch.commit();
  }
  return logs.size;
}

// ── Bells (the cron job) ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The daily check-in reminder from 7 PM Lagos, once a day, when she hasn't checked in; and the "may be late" note, once for each
// expected period, 5 days after it. Both say only "A reminder from My Cycle". Never an email.
export async function cycleBells(db: Firestore, now = new Date(), notify = notifyBell): Promise<number> {
  if (!cycleReady()) return 0;
  const today = lagosDate(now);
  const hourLagos = (now.getUTCHours() + 1) % 24;
  let n = 0;
  if (hourLagos >= 19) {
    const snap = await db.collection(PROFILES).where("remindCheckIn", "==", true).get();
    for (const d of snap.docs) {
      const p = d.data() as ProfileDoc;
      if (p.answer !== "female" || p.checkInBellDay === today) continue;
      if ((await db.collection(LOGS).doc(`${d.id}_${today}`).get()).exists) continue;
      await d.ref.update({ checkInBellDay: today });
      await notify({ uid: d.id, type: "reminder", linkHref: "/cycle", message: REMINDER_TEXT }).catch(() => {});
      n++;
    }
  }
  const late = await db.collection(PROFILES).where("remindLate", "==", true).get();
  for (const d of late.docs) {
    const p = d.data() as ProfileDoc;
    if (p.answer !== "female") continue;
    const u = (await db.doc(`users/${d.id}`).get()).data();
    const teen = u?.teen === true;
    const s = dec<Stored>(p.data, EMPTY);
    const t = todayView(sortPeriods(s.periods ?? []), settingsOf({ ...EMPTY, ...s }, teen), today, teen);
    if (!isLateForBell(t)) continue;
    const last = sortPeriods(s.periods ?? []).slice(-1)[0]?.start ?? "";
    if (!last || p.lateToldFor === last) continue;
    await d.ref.update({ lateToldFor: last });
    await notify({ uid: d.id, type: "reminder", linkHref: "/cycle", message: REMINDER_TEXT }).catch(() => {});
    n++;
  }
  return n;
}
