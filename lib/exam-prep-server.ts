import { createHash, createPrivateKey, createPublicKey, randomBytes, sign as edSign } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import {
  EXAMS, PAYLINK_DAYS, MOCK_GRACE_SECONDS, BOARD_DAILY_CAP, applySource, accessState, checkQuestion, checkNickname, defaultPack, emptyProgress,
  isExamId, mark, mergeProgress, passExpiry, passPayload, recomputeExpiry, refundable, subjectKey, toMock, toStudent, weekId,
  type AccessDoc, type ExamId, type Pack, type Progress, type Question, type QuestionInput, type StudentQuestion, type Subject, type OfflinePass,
} from "./exam-prep";
import { DEFAULT_SUBJECTS } from "./exam-prep-catalog";
import { YoungError, teenBirth } from "./young";

// Server-only. Naija Exam Prep (lib/exam-prep.ts has the rules and the shape of everything). Every function takes the database so
// the emulator tests run them as they are.
export class PrepError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const iso = (d = new Date()) => d.toISOString();
const today = (d = new Date()) => d.toISOString().slice(0, 10);
const token = (bytes = 18) => randomBytes(bytes).toString("base64url");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

// Daily counts for Admin → Naija Exam Prep (no student is identified in them).
export const bump = (db: Firestore, field: "answers" | "mocks" | "packsSold" | "packsSaved" | "payLinks" | "reports", by = 1, now = new Date()) =>
  db.doc(`prepStats/${today(now)}`).set({ [field]: FieldValue.increment(by), day: today(now) }, { merge: true }).catch(() => {});

// ---------------------------------------------------------------- catalogue
export async function ensureCatalog(db: Firestore): Promise<void> {
  const s = await db.collection("prepSubjects").limit(1).get();
  if (s.empty) {
    const b = db.batch();
    for (const sub of DEFAULT_SUBJECTS) b.set(db.doc(`prepSubjects/${subjectKey(sub.exam, sub.id)}`), sub);
    await b.commit();
  }
  const p = await db.collection("prepPacks").limit(1).get();
  if (p.empty) {
    const b = db.batch();
    for (const exam of Object.keys(EXAMS) as ExamId[]) b.set(db.doc(`prepPacks/${exam}`), defaultPack(exam));
    await b.commit();
  }
}
export async function allSubjects(db: Firestore): Promise<Subject[]> {
  await ensureCatalog(db);
  return (await db.collection("prepSubjects").get()).docs.map((d) => d.data() as Subject).sort((a, b) => a.exam.localeCompare(b.exam) || a.order - b.order);
}
export async function allPacks(db: Firestore): Promise<Record<ExamId, Pack>> {
  await ensureCatalog(db);
  const out = Object.fromEntries((Object.keys(EXAMS) as ExamId[]).map((e) => [e, defaultPack(e)])) as Record<ExamId, Pack>;
  for (const d of (await db.collection("prepPacks").get()).docs) { const p = d.data() as Pack; if (isExamId(p.id)) out[p.id] = p; }
  return out;
}
async function published(db: Firestore, exam: ExamId): Promise<Question[]> {
  // One field in the query (status), the rest filtered here: no composite index, and the catalogue is small.
  const snap = await db.collection("prepQuestions").where("status", "==", "published").where("exam", "==", exam).get();
  return snap.docs.map((d) => ({ ...(d.data() as Question), id: d.id }));
}
export type CatalogueSubject = Omit<Subject, "topics"> & { free: number; pack: number; topics: (Subject["topics"][number] & { free: number; pack: number })[] };
export type Catalogue = { exams: typeof EXAMS; subjects: CatalogueSubject[]; packs: Record<ExamId, Pack>; access: Partial<Record<ExamId, { active: boolean; expiresAt: string | null; daysLeft: number }>> };
// What students see: only live subjects with at least one published question, and counts of what is actually published.
export async function catalogue(db: Firestore, uid: string | null, now = new Date()): Promise<Catalogue> {
  const [subjects, packs] = await Promise.all([allSubjects(db), allPacks(db)]);
  const out: CatalogueSubject[] = [];
  for (const exam of Object.keys(EXAMS) as ExamId[]) {
    const qs = await published(db, exam);
    for (const s of subjects.filter((x) => x.exam === exam && x.live)) {
      const mine = qs.filter((q) => q.subject === s.id);
      if (!mine.length) continue;
      out.push({ ...s, free: mine.filter((q) => q.access === "free").length, pack: mine.filter((q) => q.access === "pack").length,
        topics: s.topics.map((t) => ({ ...t, free: mine.filter((q) => q.topic === t.id && q.access === "free").length, pack: mine.filter((q) => q.topic === t.id && q.access === "pack").length })).filter((t) => t.free + t.pack > 0) });
    }
  }
  const access: Catalogue["access"] = {};
  if (uid) for (const exam of Object.keys(EXAMS) as ExamId[]) { const a = await accessDoc(db, uid, exam); if (a) access[exam] = accessState(a, iso(now)); }
  return { exams: EXAMS, subjects: out, packs, access };
}

// ---------------------------------------------------------------- access
export const accessRef = (db: Firestore, uid: string, exam: ExamId) => db.doc(`prepAccess/${uid}_${exam}`);
export async function accessDoc(db: Firestore, uid: string, exam: ExamId): Promise<AccessDoc | null> {
  return ((await accessRef(db, uid, exam).get()).data() as AccessDoc | undefined) ?? null;
}
export async function hasAccess(db: Firestore, uid: string | null, exam: ExamId, now = new Date()): Promise<boolean> {
  return !!uid && accessState(await accessDoc(db, uid, exam), iso(now)).active;
}

// Questions for practice: everyone gets the free ones; an account with the pack also gets the pack's. Opening paid questions is
// noted once (it ends the 7-day full refund).
export async function practiceSet(db: Firestore, uid: string | null, q: { exam: unknown; subject?: unknown; topic?: unknown }, now = new Date()): Promise<{ questions: StudentQuestion[]; hasPack: boolean; lockedCount: number }> {
  if (!isExamId(q.exam)) throw new PrepError("Choose JAMB, WAEC or NECO.");
  const exam = q.exam;
  const all = (await published(db, exam)).filter((x) => (!q.subject || x.subject === q.subject) && (!q.topic || x.topic === q.topic));
  const hasPack = await hasAccess(db, uid, exam, now);
  const open = all.filter((x) => x.access === "free" || hasPack);
  if (hasPack && uid && open.some((x) => x.access === "pack")) {
    const ref = accessRef(db, uid, exam);
    await db.runTransaction(async (t) => { const a = (await t.get(ref)).data() as AccessDoc | undefined; if (a && !a.firstPaidQuestionAt) t.update(ref, { firstPaidQuestionAt: iso(now) }); });
  }
  const order = (x: Question) => `${x.subject}|${x.topic}|${x.access === "free" ? 0 : 1}|${x.difficulty}|${x.id}`;
  return { questions: open.sort((a, b) => order(a).localeCompare(order(b))).map(toStudent), hasPack, lockedCount: all.length - open.length };
}

// Inside fulfillPayment's transaction (lib/payments.ts), when Paystack has confirmed an exam_pack payment: the pack's months are added
// to the account it was bought for. The same reference never adds twice (applySource), so a repeated webhook changes nothing.
export async function grantPackInTransaction(t: Transaction, db: Firestore, p: { reference: string; examPack?: { pack: ExamId; forUid: string; months: number } }, nowIso: string) {
  if (!p.examPack) return;
  const { pack, forUid, months } = p.examPack;
  const ref = accessRef(db, forUid, pack);
  const cur = ((await t.get(ref)).data() as AccessDoc | undefined) ?? null;
  const r = applySource(cur, forUid, pack, { kind: "payment", ref: p.reference, months, at: nowIso }, nowIso);
  if (!r.changed) return;
  t.set(ref, r.doc);
  t.set(db.doc(`prepStats/${nowIso.slice(0, 10)}`), { packsSold: FieldValue.increment(1), day: nowIso.slice(0, 10) }, { merge: true });
}

// ---------------------------------------------------------------- buying
export type Checkout = (a: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, unknown> }) => Promise<{ authorization_url: string }>;
export type PackPaymentRecord = {
  reference: string; kind: "exam_pack"; uid: string; email: string; amountKobo: number; status: "pending"; publisherUid: string; publisherUsername: string;
  commissionRate: 0; examPack: { pack: ExamId; forUid: string; months: number; via: "self" | "paylink"; payLink?: string }; createdAt: string;
};
async function packFor(db: Firestore, exam: unknown): Promise<Pack> {
  if (!isExamId(exam)) throw new PrepError("Choose JAMB, WAEC or NECO.");
  const p = (await allPacks(db))[exam];
  if (!p.available) throw new PrepError("This pack isn't on sale right now.", 409);
  if (!Number.isInteger(p.priceKobo) || p.priceKobo < 10_000 || !Number.isInteger(p.months) || p.months < 1) throw new PrepError("This pack isn't set up properly yet.", 503);
  return p;
}
// A signed-in student buys a pack for their own account. The price and months come from the pack here, never from the browser.
export async function startPackCheckout(db: Firestore, me: { uid: string; email: string }, exam: unknown, origin: string, checkout: Checkout, newRef: () => string, now = new Date()) {
  const p = await packFor(db, exam);
  const reference = newRef();
  const record: PackPaymentRecord = { reference, kind: "exam_pack", uid: me.uid, email: me.email, amountKobo: p.priceKobo, status: "pending", publisherUid: me.uid, publisherUsername: "", commissionRate: 0, examPack: { pack: p.id, forUid: me.uid, months: p.months, via: "self" }, createdAt: iso(now) };
  const tx = await checkout({ email: me.email, amountKobo: p.priceKobo, reference, callbackUrl: `${origin}/exam-prep/paid`, metadata: { kind: "exam_pack", pack: p.id, uid: me.uid } });
  await db.doc(`payments/${reference}`).set(record);
  return { authorizationUrl: tx.authorization_url, reference };
}

// "Ask someone to pay": a link for one pack and one account, good for 14 days; the payer needs no account.
export async function createPayLink(db: Firestore, uid: string, exam: unknown, nickname: unknown, now = new Date()) {
  const p = await packFor(db, exam);
  const nick = checkNickname(nickname);
  const code = token(9).replace(/[-_]/g, "").slice(0, 10).toUpperCase();
  const link = { code, uid, pack: p.id, nickname: nick ?? "A student", createdAt: iso(now), expiresAt: new Date(now.getTime() + PAYLINK_DAYS * 86_400_000).toISOString() };
  await db.doc(`prepPayLinks/${code}`).set(link);
  await bump(db, "payLinks", 1, now);
  return link;
}
export async function payLinkInfo(db: Firestore, code: unknown, now = new Date()) {
  const c = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const l = (await db.doc(`prepPayLinks/${c}`).get()).data();
  if (!c || !l) throw new PrepError("That pay link wasn't found.", 404);
  const p = (await allPacks(db))[l.pack as ExamId];
  return { code: c, pack: p.id, packName: p.name, priceKobo: p.priceKobo, months: p.months, nickname: String(l.nickname), expired: String(l.expiresAt) <= iso(now), paid: !!l.paidRef, uid: String(l.uid) };
}
export async function startPayLinkCheckout(db: Firestore, code: unknown, payerEmail: unknown, origin: string, checkout: Checkout, newRef: () => string, now = new Date()) {
  const info = await payLinkInfo(db, code, now);
  if (info.expired) throw new PrepError("This pay link has expired. Ask for a new one.", 410);
  if (info.paid) throw new PrepError("This pack has been paid for already. Thank you!", 409);
  const email = String(payerEmail ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) throw new PrepError("Enter an email address for the receipt.");
  const p = await packFor(db, info.pack);
  const reference = newRef();
  const record: PackPaymentRecord = { reference, kind: "exam_pack", uid: info.uid, email, amountKobo: p.priceKobo, status: "pending", publisherUid: info.uid, publisherUsername: "", commissionRate: 0, examPack: { pack: p.id, forUid: info.uid, months: p.months, via: "paylink", payLink: info.code }, createdAt: iso(now) };
  const tx = await checkout({ email, amountKobo: p.priceKobo, reference, callbackUrl: `${origin}/exam-prep/paid?code=${info.code}`, metadata: { kind: "exam_pack", pack: p.id, uid: info.uid, payLink: info.code } });
  await db.doc(`payments/${reference}`).set(record);
  return { authorizationUrl: tx.authorization_url, reference };
}
// After Paystack sends the payer back: confirm with Paystack (fulfillPayment) and say what happened. The buyer must own the payment,
// or, for a pay link, the code must match it (that's all the payer has).
export async function confirmPackPayment(db: Firestore, reference: unknown, who: { uid?: string; code?: string }, fulfil: (ref: string) => Promise<{ status: string }>, now = new Date()) {
  const ref = String(reference ?? "").slice(0, 120);
  const p = (await db.doc(`payments/${ref}`).get()).data() as PackPaymentRecord | undefined;
  if (!ref || !p || p.kind !== "exam_pack") throw new PrepError("That payment wasn't found.", 404);
  const okWho = (who.uid && p.examPack.forUid === who.uid) || (who.code && p.examPack.payLink === String(who.code).toUpperCase());
  if (!okWho) throw new PrepError("That payment wasn't found.", 404);
  let status = p.status as string;
  try { status = (await fulfil(ref)).status; } catch { status = "pending"; }
  const paid = status === "paid";
  if (paid && p.examPack.payLink) await db.doc(`prepPayLinks/${p.examPack.payLink}`).set({ paidRef: ref, paidAt: iso(now) }, { merge: true });
  const a = await accessDoc(db, p.examPack.forUid, p.examPack.pack);
  return { paid, status, pack: p.examPack.pack, packName: EXAMS[p.examPack.pack].name, ...(who.uid ? { access: accessState(a, iso(now)) } : {}) };
}
// "Restore my pack": any of this account's pack payments still pending (the confirmation was missed) is checked with Paystack again.
// Nothing is charged; a payment that went through opens the pack, one that didn't stays as it is.
export async function restorePurchases(db: Firestore, uid: string, fulfil: (ref: string) => Promise<{ status: string }>, now = new Date()) {
  const snap = await db.collection("payments").where("examPack.forUid", "==", uid).get();
  let restored = 0, checked = 0;
  for (const d of snap.docs) {
    const p = d.data() as PackPaymentRecord;
    if (p.status !== "pending" || now.getTime() - new Date(p.createdAt).getTime() > 90 * 86_400_000) continue;
    checked++;
    try { if ((await fulfil(d.id)).status === "paid") restored++; } catch { /* not paid: stays pending */ }
  }
  const access = Object.fromEntries(await Promise.all((Object.keys(EXAMS) as ExamId[]).map(async (e) => [e, accessState(await accessDoc(db, uid, e), iso(now))])));
  return { checked, restored, access };
}

// ---------------------------------------------------------------- offline pass
// EXAM_PREP_PASS_KEY: a P-256 private key (PKCS#8 PEM, or its base64). Without it, packs with paid questions can't be saved offline
// (free questions still can).
function passKey() {
  const raw = (setting("EXAM_PREP_PASS_KEY") || "").trim();
  if (!raw) return null;
  try { return createPrivateKey(raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : Buffer.from(raw, "base64").toString("utf8")); } catch { return null; }
}
export const offlinePassReady = () => !!passKey();
export function passPublicKey(): string | null {
  const k = passKey();
  return k ? createPublicKey(k).export({ type: "spki", format: "der" }).toString("base64") : null;
}
export function signPass(p: OfflinePass): string {
  const k = passKey();
  if (!k) throw new PrepError("Saving paid questions for offline use isn't switched on yet.", 503);
  return edSign("sha256", Buffer.from(passPayload(p)), { key: k, dsaEncoding: "ieee-p1363" }).toString("base64");
}
// A pack to keep on the phone: the questions this account may use (free, plus the pack's with access) and, for paid ones, a signed pass.
export async function packForSaving(db: Firestore, uid: string | null, exam: unknown, now = new Date()) {
  const set = await practiceSet(db, uid, { exam }, now);
  const out: { exam: ExamId; questions: StudentQuestion[]; savedAt: string; hasPack: boolean; pass?: OfflinePass & { sig: string }; publicKey?: string } = { exam: exam as ExamId, questions: set.questions, savedAt: iso(now), hasPack: set.hasPack };
  if (set.hasPack && uid) {
    const a = await accessDoc(db, uid, exam as ExamId);
    const pass: OfflinePass = { uid, pack: exam as ExamId, exp: passExpiry(a!.expiresAt, iso(now)), iat: iso(now) };
    out.pass = { ...pass, sig: signPass(pass) };
    out.publicKey = passPublicKey()!;
  }
  await bump(db, "packsSaved", 1, now);
  return out;
}

// ---------------------------------------------------------------- mocks
type MockDoc = { owner: string; exam: ExamId; subject: string; questionIds: string[]; startedAt: string; deadline: string; durationSec: number; answers: Record<string, string>; submittedAt?: string; result?: ReturnType<typeof mark> };
const ownerOf = (who: { uid?: string | null; token?: string | null }) => (who.uid ? `u:${who.uid}` : who.token ? `t:${hash(who.token)}` : "");
// A timed mock. The server keeps the start and the deadline, so refreshing or changing the phone's clock changes nothing. Signed-out
// students get a token (kept in the browser) that stands for them on this one mock.
export async function startMock(db: Firestore, who: { uid: string | null }, input: { exam: unknown; subject?: unknown; size: unknown; minutes?: unknown }, now = new Date(), rnd = Math.random) {
  if (!isExamId(input.exam)) throw new PrepError("Choose JAMB, WAEC or NECO.");
  const exam = input.exam;
  const size = Number(input.size);
  if (![10, 20, 40].includes(size)) throw new PrepError("Choose 10, 20 or 40 questions.");
  const set = await practiceSet(db, who.uid, { exam, subject: input.subject }, now);
  if (!set.questions.length) throw new PrepError("There are no questions to use for this mock yet.", 404);
  const pool = [...set.questions];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picked = pool.slice(0, Math.min(size, pool.length));
  const minutes = input.minutes === undefined ? Math.max(5, Math.round(picked.length * EXAMS[exam].mockMinutesPerQuestion)) : Number(input.minutes);
  if (!Number.isInteger(minutes) || minutes < 2 || minutes > 180) throw new PrepError("Choose between 2 and 180 minutes.");
  const tok = who.uid ? null : token(24);
  const doc: MockDoc = { owner: ownerOf({ uid: who.uid, token: tok }), exam, subject: String(input.subject ?? ""), questionIds: picked.map((q) => q.id), startedAt: iso(now), deadline: new Date(now.getTime() + minutes * 60_000).toISOString(), durationSec: minutes * 60, answers: {} };
  const ref = db.collection("prepMocks").doc();
  await ref.set(doc);
  await bump(db, "mocks", 1, now);
  return { id: ref.id, token: tok, questions: picked.map(toMock), startedAt: doc.startedAt, deadline: doc.deadline, serverNow: iso(now), total: picked.length, fewer: picked.length < size };
}
async function mockFor(db: Firestore, id: unknown, who: { uid?: string | null; token?: string | null }) {
  const ref = db.doc(`prepMocks/${String(id ?? "x").replace(/\//g, "")}`);
  const m = (await ref.get()).data() as MockDoc | undefined;
  if (!m || !ownerOf(who) || m.owner !== ownerOf(who)) throw new PrepError("That mock wasn't found.", 404);
  return { ref, m };
}
const cleanAnswers = (a: unknown, ids: string[]) => Object.fromEntries(Object.entries((a && typeof a === "object" ? a : {}) as Record<string, unknown>).filter(([k, v]) => ids.includes(k) && typeof v === "string" && /^[A-E]$/.test(v)).map(([k, v]) => [k, v as string]));
// Answers as the student goes (so a lost connection or a refresh loses nothing). After the deadline (and a short grace) nothing changes.
export async function saveMockAnswers(db: Firestore, id: unknown, who: { uid?: string | null; token?: string | null }, answers: unknown, now = new Date()) {
  const { ref, m } = await mockFor(db, id, who);
  if (m.submittedAt) throw new PrepError("This mock has been submitted.", 409);
  if (now.getTime() > new Date(m.deadline).getTime() + MOCK_GRACE_SECONDS * 1000) throw new PrepError("Time is up for this mock.", 409);
  const clean = cleanAnswers(answers, m.questionIds);
  await ref.update({ answers: clean });
  return { saved: Object.keys(clean).length, deadline: m.deadline, serverNow: iso(now) };
}
async function questionsById(db: Firestore, ids: string[]): Promise<Question[]> {
  const refs = ids.map((id) => db.doc(`prepQuestions/${id}`));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  return snaps.filter((s) => s.exists).map((s) => ({ ...(s.data() as Question), id: s.id }));
}
// Submitting (or the time running out): marked here, from the answers the server has, against the questions as published.
export async function submitMock(db: Firestore, id: unknown, who: { uid?: string | null; token?: string | null }, answers: unknown, now = new Date()) {
  const { ref, m } = await mockFor(db, id, who);
  const qs = await questionsById(db, m.questionIds);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ordered = m.questionIds.map((qid) => byId.get(qid)).filter((q): q is Question => !!q);
  if (!m.submittedAt) {
    const inTime = now.getTime() <= new Date(m.deadline).getTime() + MOCK_GRACE_SECONDS * 1000;
    const final = inTime && answers !== undefined ? cleanAnswers(answers, m.questionIds) : m.answers;
    const result = mark(ordered, final);
    await ref.update({ answers: final, submittedAt: iso(now), result, late: !inTime });
    m.answers = final; m.result = result; m.submittedAt = iso(now);
  }
  return { id: ref.id, exam: m.exam, subject: m.subject, startedAt: m.startedAt, submittedAt: m.submittedAt, result: m.result!, answers: m.answers, questions: ordered.map(toStudent) };
}
export async function mockStatus(db: Firestore, id: unknown, who: { uid?: string | null; token?: string | null }, now = new Date()) {
  const { m } = await mockFor(db, id, who);
  if (m.submittedAt) return { submitted: true as const, ...(await submitMock(db, id, who, undefined, now)) };
  const qs = await questionsById(db, m.questionIds);
  const byId = new Map(qs.map((q) => [q.id, q]));
  return { submitted: false as const, exam: m.exam, subject: m.subject, questions: m.questionIds.map((qid) => byId.get(qid)).filter((q): q is Question => !!q).map(toMock), answers: m.answers, startedAt: m.startedAt, deadline: m.deadline, serverNow: iso(now) };
}

// ---------------------------------------------------------------- progress and the effort board
export async function getProgress(db: Firestore, uid: string): Promise<Progress> {
  return ((await db.doc(`prepProgress/${uid}`).get()).data() as Progress | undefined) ?? emptyProgress();
}
// A signed-in student's phone sends its progress; the account keeps the two merged and sends the merge back.
export async function syncProgress(db: Firestore, uid: string, incoming: unknown): Promise<Progress> {
  const p = incoming as Progress;
  if (!p || p.v !== 1 || typeof p.byQuestion !== "object" || !Array.isArray(p.mocks) || !Array.isArray(p.days)) throw new PrepError("That progress couldn't be read.");
  if (Object.keys(p.byQuestion).length > 20_000) throw new PrepError("Too much progress to save at once.", 413);
  const ref = db.doc(`prepProgress/${uid}`);
  return db.runTransaction(async (t) => {
    const cur = ((await t.get(ref)).data() as Progress | undefined) ?? emptyProgress();
    const merged = mergeProgress(cur, p);
    t.set(ref, merged);
    return merged;
  });
}
// One answer, counted for the board (if the student joined it) and the daily totals: each question once a day, up to a daily cap.
export async function recordAttempt(db: Firestore, uid: string | null, questionId: unknown, now = new Date()) {
  const qid = String(questionId ?? "").replace(/\//g, "");
  if (!qid) throw new PrepError("Which question?");
  await bump(db, "answers", 1, now);
  if (!uid) return { counted: false };
  const dayRef = db.doc(`prepAttempts/${uid}_${today(now)}`);
  const member = (await db.doc(`prepBoard/${uid}`).get()).data();
  return db.runTransaction(async (t) => {
    const d = (await t.get(dayRef)).data() as { ids?: string[] } | undefined;
    const ids = d?.ids ?? [];
    if (ids.includes(qid) || ids.length >= BOARD_DAILY_CAP) return { counted: false };
    t.set(dayRef, { ids: [...ids, qid], day: today(now) });
    if (member?.joined) t.set(db.doc(`prepBoardWeeks/${weekId(iso(now))}/entries/${uid}`), { nickname: member.nickname, count: FieldValue.increment(1) }, { merge: true });
    return { counted: !!member?.joined };
  });
}
export async function joinBoard(db: Firestore, uid: string, nickname: unknown, join: boolean) {
  if (!join) { await db.doc(`prepBoard/${uid}`).set({ joined: false }, { merge: true }); return { joined: false }; }
  const nick = checkNickname(nickname);
  if (!nick) throw new PrepError("Pick a nickname: 3 to 20 letters and numbers, starting with a letter. Not your real name.");
  const taken = await db.collection("prepBoard").where("nicknameLower", "==", nick.toLowerCase()).limit(2).get();
  if (taken.docs.some((d) => d.id !== uid)) throw new PrepError("That nickname is taken. Try another.", 409);
  await db.doc(`prepBoard/${uid}`).set({ joined: true, nickname: nick, nicknameLower: nick.toLowerCase(), at: iso() }, { merge: true });
  return { joined: true, nickname: nick };
}
export async function board(db: Firestore, uid: string | null, now = new Date()) {
  const week = weekId(iso(now));
  const top = await db.collection(`prepBoardWeeks/${week}/entries`).orderBy("count", "desc").limit(20).get();
  const me = uid ? (await db.doc(`prepBoard/${uid}`).get()).data() : undefined;
  const mine = uid && me?.joined ? (await db.doc(`prepBoardWeeks/${week}/entries/${uid}`).get()).data() : undefined;
  return { week, top: top.docs.map((d, i) => ({ rank: i + 1, nickname: String(d.data().nickname), count: Number(d.data().count), me: d.id === uid })), me: me?.joined ? { nickname: String(me.nickname), count: Number(mine?.count ?? 0) } : null };
}

// ---------------------------------------------------------------- reports
export async function reportQuestion(db: Firestore, uid: string | null, input: { questionId: unknown; reason: unknown; note?: unknown }, now = new Date()) {
  const qid = String(input.questionId ?? "").replace(/\//g, "");
  const reason = ["wrong-answer", "unclear", "typo", "other"].includes(String(input.reason)) ? String(input.reason) : null;
  if (!qid || !reason) throw new PrepError("Say what's wrong with the question.");
  if (!(await db.doc(`prepQuestions/${qid}`).get()).exists) throw new PrepError("That question wasn't found.", 404);
  await db.collection("prepReports").add({ questionId: qid, reason, note: String(input.note ?? "").trim().slice(0, 1_000), ...(uid ? { uid } : {}), status: "open", at: iso(now) });
  await bump(db, "reports", 1, now);
  return { ok: true };
}

// ---------------------------------------------------------------- editorial: editors, reviewers, publishing
export type Editor = { uid: string; name: string };
// A reviewer reviews only the subjects their invite named (keys "exam_subject", e.g. "jamb_mathematics"). Each review is counted
// on their record (reviews, reviewsByMonth), ready for paying reviewers into their NotesApp wallet later.
export type Reviewer = { uid: string; name: string; active: boolean; subjects: string[]; reviews?: number; reviewsByMonth?: Record<string, number>; at: string };
export async function reviewerOf(db: Firestore, uid: string): Promise<Reviewer | null> {
  const r = (await db.doc(`prepReviewers/${uid}`).get()).data() as Reviewer | undefined;
  return r && r.active !== false ? { ...r, subjects: Array.isArray(r.subjects) ? r.subjects : [] } : null;
}
export const isReviewer = async (db: Firestore, uid: string) => !!(await reviewerOf(db, uid));

// Invites. Choose the subjects first. "single": one person, 14 days. "open": a link to share with volunteers (a WhatsApp group,
// a staff room), good until its date and up to its number of reviewers, and closable at any time.
export type InviteInput = { subjects: unknown; kind?: unknown; days?: unknown; maxUses?: unknown; note?: unknown };
export async function createInvite(db: Firestore, admin: Editor, input: InviteInput, now = new Date()) {
  const known = new Set((await allSubjects(db)).map((x) => subjectKey(x.exam, x.id)));
  const subjects = Array.from(new Set((Array.isArray(input.subjects) ? input.subjects : []).map(String))).filter((k) => known.has(k));
  if (!subjects.length) throw new PrepError("Choose at least one subject to review.");
  const kind = input.kind === "open" ? "open" : "single";
  const days = kind === "open" ? Number(input.days ?? 30) : 14;
  if (![7, 14, 30, 90].includes(days)) throw new PrepError("Choose 7, 14, 30 or 90 days.");
  const maxUses = kind === "open" ? Number(input.maxUses ?? 50) : 1;
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500) throw new PrepError("Up to 500 reviewers per link.");
  const t = token(18);
  await db.doc(`prepInvites/${hash(t)}`).set({ kind, subjects, maxUses, uses: 0, acceptedBy: [], active: true, createdBy: admin.uid, createdByName: admin.name, note: String(input.note ?? "").slice(0, 200), createdAt: iso(now), expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString() });
  return { token: t, kind, subjects, maxUses, expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString() };
}
async function inviteDoc(db: Firestore, tok: unknown) {
  const ref = db.doc(`prepInvites/${hash(String(tok ?? ""))}`);
  return { ref, inv: (await ref.get()).data() };
}
const inviteProblem = (inv: Record<string, unknown> | undefined, uid: string | null, nowIso: string) => {
  if (!inv) return { status: 404, why: "That invite link isn't valid." };
  if (inv.active === false) return { status: 410, why: "This invite link has been closed." };
  if (String(inv.expiresAt) <= nowIso) return { status: 410, why: "That invite link has expired. Ask for a new one." };
  const accepted = (inv.acceptedBy as string[] | undefined) ?? (inv.usedBy ? [String(inv.usedBy)] : []);
  if (uid && accepted.includes(uid)) return null;
  if (accepted.length >= Number(inv.maxUses ?? 1)) return { status: 410, why: inv.kind === "open" ? "This link has all the reviewers it needs. Thank you!" : "That invite link has been used." };
  return null;
};
// What the invite page shows before accepting: the subjects, and whether the link still works.
export async function inviteInfo(db: Firestore, tok: unknown, now = new Date()) {
  const { inv } = await inviteDoc(db, tok);
  const p = inviteProblem(inv, null, iso(now));
  if (!inv) throw new PrepError(p!.why, p!.status);
  const subs = await allSubjects(db);
  return { kind: String(inv.kind ?? "single"), subjects: (inv.subjects as string[] ?? []).map((k) => { const x = subs.find((y) => subjectKey(y.exam, y.id) === k); return x ? `${EXAMS[x.exam].short} ${x.name}` : k; }), ok: !p, why: p?.why ?? null };
}
export async function acceptInvite(db: Firestore, me: Editor, tok: unknown, now = new Date()) {
  const ref = db.doc(`prepInvites/${hash(String(tok ?? ""))}`);
  return db.runTransaction(async (t) => {
    const inv = (await t.get(ref)).data();
    const p = inviteProblem(inv, me.uid, iso(now));
    if (p) throw new PrepError(p.why, p.status);
    const accepted: string[] = (inv!.acceptedBy as string[] | undefined) ?? [];
    const revRef = db.doc(`prepReviewers/${me.uid}`);
    const cur = (await t.get(revRef)).data() as Reviewer | undefined;
    const subjects = Array.from(new Set([...(cur?.subjects ?? []), ...((inv!.subjects as string[]) ?? [])]));
    if (!accepted.includes(me.uid)) t.update(ref, { acceptedBy: [...accepted, me.uid], uses: accepted.length + 1, ...(inv!.kind === "open" ? {} : { usedBy: me.uid, usedAt: iso(now) }) });
    t.set(revRef, { uid: me.uid, name: me.name, active: true, subjects, invitedBy: inv!.createdBy, at: cur?.at ?? iso(now) }, { merge: true });
    return { reviewer: true, subjects };
  });
}
export async function closeInvite(db: Firestore, id: unknown) {
  await db.doc(`prepInvites/${String(id ?? "x").replace(/[^a-f0-9]/g, "")}`).update({ active: false });
  return { closed: true };
}
async function subjectOf(db: Firestore, exam: ExamId, subject: string): Promise<Subject | null> {
  return ((await db.doc(`prepSubjects/${subjectKey(exam, subject)}`).get()).data() as Subject | undefined) ?? null;
}
// An editor writes or changes a question. It goes for review (or stays a draft); changing one that was approved or published sends it
// back for review and takes it out of practice until it's approved again.
export async function saveQuestion(db: Firestore, editor: Editor, input: QuestionInput & { draft?: boolean }, id?: string, now = new Date()) {
  const checked = checkQuestion(input, await allSubjects(db));
  if (!checked.ok) throw new PrepError(checked.errors.join(" "));
  const ref = id ? db.doc(`prepQuestions/${id.replace(/\//g, "")}`) : db.collection("prepQuestions").doc();
  const cur = (await ref.get()).data() as Question | undefined;
  if (id && !cur) throw new PrepError("That question wasn't found.", 404);
  const status = input.draft ? "draft" : "in_review";
  const doc: Omit<Question, "id"> = {
    ...checked.value, status, reviews: cur?.reviews ?? [], approvals: 0,
    provenance: cur?.provenance ?? { kind: "original", by: "editor", authorUid: editor.uid, authorName: editor.name },
    createdAt: cur?.createdAt ?? iso(now), updatedAt: iso(now), version: (cur?.version ?? 0) + 1,
  };
  await ref.set(doc);
  return { id: ref.id, status };
}
// Many questions at once (a spreadsheet, or the starter set). With ids, importing twice changes nothing already there.
export async function importQuestions(db: Firestore, editor: Editor, rows: { input: QuestionInput & { id?: string }; line: number }[], by: "ai-draft" | "editor", now = new Date()) {
  const subjects = await allSubjects(db);
  const errors: { line: number; errors: string[] }[] = [];
  let added = 0, skipped = 0;
  for (const r of rows) {
    const checked = checkQuestion(r.input, subjects);
    if (!checked.ok) { errors.push({ line: r.line, errors: checked.errors }); continue; }
    const ref = r.input.id ? db.doc(`prepQuestions/${String(r.input.id).replace(/[^\w-]/g, "")}`) : db.collection("prepQuestions").doc();
    if (r.input.id && (await ref.get()).exists) { skipped++; continue; }
    await ref.set({ ...checked.value, status: "in_review", reviews: [], approvals: 0, provenance: { kind: "original", by, ...(by === "editor" ? { authorUid: editor.uid, authorName: editor.name } : {}) }, createdAt: iso(now), updatedAt: iso(now), version: 1 } satisfies Omit<Question, "id">);
    added++;
  }
  return { added, skipped, errors };
}
// A reviewer approves or asks for changes. Nobody reviews a question they wrote. Enough approvals (the subject's number) make it
// approved; publishing is a separate step.
export async function reviewQuestion(db: Firestore, reviewer: Editor & { subjects?: string[] | null }, id: unknown, decision: unknown, note: unknown, now = new Date()) {
  if (decision !== "approve" && decision !== "changes") throw new PrepError("Approve it or ask for changes.");
  const text = String(note ?? "").trim().slice(0, 1_000);
  if (decision === "changes" && text.length < 3) throw new PrepError("Say what needs changing.");
  const ref = db.doc(`prepQuestions/${String(id ?? "x").replace(/\//g, "")}`);
  return db.runTransaction(async (t) => {
    const q = (await t.get(ref)).data() as Question | undefined;
    if (!q) throw new PrepError("That question wasn't found.", 404);
    if (q.status !== "in_review") throw new PrepError("That question isn't waiting for review.", 409);
    if (q.provenance.authorUid === reviewer.uid) throw new PrepError("You wrote this question, so someone else reviews it.", 403);
    if (reviewer.subjects && !reviewer.subjects.includes(subjectKey(q.exam, q.subject))) throw new PrepError("That question isn't in a subject you review.", 403);
    if (q.reviews.some((r) => r.uid === reviewer.uid && r.decision === "approve" && r.at >= q.updatedAt)) throw new PrepError("You've approved this version already.", 409);
    const sub = await subjectOf(db, q.exam, q.subject);
    const reviews = [...q.reviews, { uid: reviewer.uid, name: reviewer.name, decision, note: text, at: iso(now) }];
    if (reviewer.subjects) t.set(db.doc(`prepReviewers/${reviewer.uid}`), { reviews: FieldValue.increment(1), reviewsByMonth: { [iso(now).slice(0, 7)]: FieldValue.increment(1) }, lastReviewAt: iso(now) }, { merge: true });
    if (decision === "changes") { t.update(ref, { reviews, status: "changes", approvals: 0 }); return { status: "changes" as const }; }
    const approvals = q.approvals + 1;
    const done = approvals >= Math.max(1, sub?.approvalsNeeded ?? 1);
    t.update(ref, { reviews, approvals, ...(done ? { status: "approved", reviewedBy: reviewer.name } : {}) });
    return { status: done ? ("approved" as const) : ("in_review" as const), approvals };
  });
}
// Publishing: only an approved question that has everything a student needs (a checked answer and an explanation).
export async function publishQuestion(db: Firestore, id: unknown, publish: boolean, now = new Date()) {
  const ref = db.doc(`prepQuestions/${String(id ?? "x").replace(/\//g, "")}`);
  const q = (await ref.get()).data() as Question | undefined;
  if (!q) throw new PrepError("That question wasn't found.", 404);
  if (!publish) { await ref.update({ status: "retired", updatedAt: iso(now) }); return { status: "retired" }; }
  if (q.status !== "approved") throw new PrepError("Only an approved question can be published.", 409);
  const checked = checkQuestion(q, await allSubjects(db), true);
  if (!checked.ok) throw new PrepError(checked.errors.join(" "));
  await ref.update({ status: "published", publishedAt: iso(now) });
  return { status: "published" };
}
export async function reviewQueue(db: Firestore, filter: { status?: unknown; exam?: unknown; subjects?: string[] | null }) {
  const status = ["draft", "in_review", "changes", "approved", "published", "retired"].includes(String(filter.status)) ? String(filter.status) : "in_review";
  const snap = await db.collection("prepQuestions").where("status", "==", status).limit(500).get();
  return snap.docs.map((d) => ({ ...(d.data() as Question), id: d.id })).filter((q) => (!isExamId(filter.exam) || q.exam === filter.exam) && (!filter.subjects || filter.subjects.includes(subjectKey(q.exam, q.subject)))).sort((a, b) => `${a.exam}${a.subject}${a.topic}${a.id}`.localeCompare(`${b.exam}${b.subject}${b.topic}${b.id}`));
}

// ---------------------------------------------------------------- admin: access, grants, refunds
export async function lookupAccess(db: Firestore, uid: string, now = new Date()) {
  const [docs, pays] = await Promise.all([
    Promise.all((Object.keys(EXAMS) as ExamId[]).map(async (e) => [e, await accessDoc(db, uid, e)] as const)),
    db.collection("payments").where("examPack.forUid", "==", uid).get(),
  ]);
  return {
    access: docs.map(([exam, d]) => ({ exam, doc: d, state: accessState(d, iso(now)), refundable: d ? d.sources.filter((s) => s.kind === "payment").map((s) => ({ ref: s.ref, ...refundable(d, s.ref, iso(now)) })) : [] })),
    payments: pays.docs.map((d) => { const p = d.data(); return { reference: d.id, status: String(p.status), pack: p.examPack?.pack, via: p.examPack?.via, amountKobo: Number(p.amountKobo), createdAt: String(p.createdAt), paidAt: p.paidAt ? String(p.paidAt) : null }; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
export async function adminGrant(db: Firestore, admin: Editor, uid: string, exam: unknown, months: unknown, note: unknown, now = new Date()) {
  if (!isExamId(exam)) throw new PrepError("Choose JAMB, WAEC or NECO.");
  const m = Number(months);
  if (!Number.isInteger(m) || m < 1 || m > 24) throw new PrepError("Grant 1 to 24 months.");
  const why = String(note ?? "").trim();
  if (why.length < 3) throw new PrepError("Say why (it's kept with the grant).");
  const ref = accessRef(db, uid, exam);
  return db.runTransaction(async (t) => {
    const cur = ((await t.get(ref)).data() as AccessDoc | undefined) ?? null;
    const r = applySource(cur, uid, exam, { kind: "admin", ref: `admin:${iso(now)}`, months: m, at: iso(now), by: `${admin.name} (${admin.uid}): ${why.slice(0, 200)}` }, iso(now));
    t.set(ref, r.doc);
    return accessState(r.doc, iso(now));
  });
}
// The 7-day refund: only within the rule (lib/exam-prep.ts refundable), then the money goes back through the shared refund path and the
// months that payment added come off.
export async function adminRefund(db: Firestore, reference: unknown, refund: (ref: string) => Promise<void>, now = new Date()) {
  const ref = String(reference ?? "");
  const p = (await db.doc(`payments/${ref}`).get()).data() as (Omit<PackPaymentRecord, "status"> & { status: string }) | undefined;
  if (!p || p.kind !== "exam_pack") throw new PrepError("That pack payment wasn't found.", 404);
  if (p.status !== "paid") throw new PrepError("Only a paid payment can be refunded.", 409);
  const aRef = accessRef(db, p.examPack.forUid, p.examPack.pack);
  const a = ((await aRef.get()).data() as AccessDoc | undefined) ?? null;
  const ok = refundable(a, ref, iso(now));
  if (!ok.ok) throw new PrepError(`This payment can't be refunded: ${ok.why}`, 409);
  await refund(ref);
  const sources = a!.sources.map((s) => (s.ref === ref ? { ...s, refundedAt: iso(now) } : s));
  const next = { ...a!, sources };
  await aRef.set({ ...next, expiresAt: recomputeExpiry(next) });
  await db.doc(`payments/${ref}`).update({ status: "refunded", refundedAt: iso(now) });
  return { refunded: true };
}

// ---------------------------------------------------------------- teen mode
// Under 18: hidden from people search and the directory, messages only from people they follow, a nickname on the board. A parent
// or guardian is asked to confirm by email; the address is kept here, never on the public profile.
// The birth month and year (lib/young.ts) is kept here too, never on the profile: it's how we know when they turn 18.
const birthOf = (month: unknown, year: unknown, now: Date) => {
  try { return teenBirth(month, year, iso(now).slice(0, 10)); } catch (e) { throw e instanceof YoungError ? new PrepError(e.message) : e; }
};
export async function setTeen(db: Firestore, uid: string, parentEmail: unknown, send: (to: string, link: string) => Promise<boolean>, origin: string, now = new Date(), birth?: { month: unknown; year: unknown }) {
  const email = String(parentEmail ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) throw new PrepError("Enter your parent's or guardian's email address.");
  // Resending to a new address keeps the month and year given before.
  const had = (await db.doc(`prepTeens/${uid}`).get()).data()?.birth;
  const born = !birth?.month && !birth?.year && had ? String(had) : birthOf(birth?.month, birth?.year, now);
  const t = token(18);
  await db.doc(`users/${uid}`).set({ teen: true }, { merge: true });
  await db.doc(`prepTeens/${uid}`).set({ uid, parentEmail: email, birth: born, tokenHash: hash(t), askedAt: iso(now), confirmedAt: null }, { merge: true });
  const sent = await send(email, `${origin}/exam-prep/confirm?t=${encodeURIComponent(t)}&u=${encodeURIComponent(uid)}`).catch(() => false);
  await db.doc(`prepTeens/${uid}`).update({ emailSent: sent });
  return { teen: true, emailSent: sent };
}
export async function confirmTeen(db: Firestore, uid: unknown, tok: unknown, now = new Date()) {
  const ref = db.doc(`prepTeens/${String(uid ?? "x").replace(/\//g, "")}`);
  const d = (await ref.get()).data();
  if (!d || d.tokenHash !== hash(String(tok ?? ""))) throw new PrepError("That confirmation link isn't valid.", 404);
  if (!d.confirmedAt) await ref.update({ confirmedAt: iso(now) });
  return { confirmed: true };
}
export async function teenStatus(db: Firestore, uid: string) {
  const [u, t] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`prepTeens/${uid}`).get()]);
  return { teen: u.data()?.teen === true, kid: u.data()?.kid === true, confirmed: !!t.data()?.confirmedAt, emailSent: t.data()?.emailSent ?? null, hasBirth: !!t.data()?.birth };
}
// Teen mode turned on before we asked: the month and year, once.
export async function setTeenBirth(db: Firestore, uid: string, month: unknown, year: unknown, now = new Date()) {
  const ref = db.doc(`prepTeens/${uid}`);
  if (!(await ref.get()).exists) throw new PrepError("Teen mode isn't on for this account.", 409);
  await ref.update({ birth: birthOf(month, year, now) });
  return { hasBirth: true };
}

// ---------------------------------------------------------------- admin metrics
export async function prepMetrics(db: Firestore, days = 30) {
  const snap = await db.collection("prepStats").orderBy("day", "desc").limit(days).get();
  const [inReview, publishedCount, open] = await Promise.all([
    db.collection("prepQuestions").where("status", "==", "in_review").count().get(),
    db.collection("prepQuestions").where("status", "==", "published").count().get(),
    db.collection("prepReports").where("status", "==", "open").count().get(),
  ]);
  return { days: snap.docs.map((d) => d.data()), inReview: inReview.data().count, published: publishedCount.data().count, openReports: open.data().count, passKey: offlinePassReady() };
}
