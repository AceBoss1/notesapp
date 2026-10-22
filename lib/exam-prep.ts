// Naija Exam Prep (pure: shared by the server, the pages and the tests). "Built for your next breakthrough."
//
// A Nigerian exam-practice product inside Notes Academy, at prep.<domain> (middleware.ts) and /exam-prep. Its own catalogue,
// packs, access and rules, on NotesApp's shared sign-in, payments and storage. The server side is lib/exam-prep-server.ts;
// the browser's saved packs and local progress are lib/exam-prep-local.ts.
//
// Firestore (all server-only: firestore.rules lets no browser read or write them; everything goes through /api/exam-prep):
//   prepSubjects/{exam}_{subject}   a subject of an exam, its topics, and how many approvals a question needs
//   prepQuestions/{id}              a question and its review trail; only `published` ones ever reach students
//   prepPacks/{exam}                what a pack costs and for how long (₦1,000 for 12 months, set in Admin)
//   prepAccess/{uid}_{pack}         an account's access to a pack: its expiry and every payment or grant that made it
//   prepPayLinks/{code}             "Ask someone to pay": one pack, one account, 14 days
//   prepMocks/{id}                  a timed mock: its questions, start and deadline kept by the server, answers, result
//   prepProgress/{uid}              a signed-in student's progress (the same shape as the browser's)
//   prepBoard/{uid}, prepBoardWeeks/{week}/entries/{uid}   the opt-in weekly effort board (nicknames)
//   prepReviewers/{uid}, prepInvites/{token}               reviewers, who come by invite link
//   prepReports/{id}                a student's "Report a problem" on a question
//   prepTeens/{uid}                 teen mode: the parent's or guardian's email and confirmation (never on the public profile)
//   prepStats/{yyyy-mm-dd}          daily counts only (answers, mocks, packs sold, packs saved): no per-student tracking
export const PREP_NAME = "Naija Exam Prep";
export const PREP_TAGLINE = "Built for your next breakthrough.";

export type ExamId = "jamb" | "waec" | "neco";
export const EXAM_IDS: ExamId[] = ["jamb", "waec", "neco"];
export type Exam = { id: ExamId; short: string; name: string; full: string; about: string; mockMinutesPerQuestion: number };
// The three exams. Facts here are general; students are pointed to each board's own site for dates and rules.
export const EXAMS: Record<ExamId, Exam> = {
  jamb: { id: "jamb", short: "JAMB", name: "JAMB UTME", full: "Unified Tertiary Matriculation Examination", about: "The computer-based entrance exam for Nigerian universities, polytechnics and colleges of education. Use of English is compulsory, with three other subjects for your course.", mockMinutesPerQuestion: 0.75 },
  waec: { id: "waec", short: "WAEC", name: "WAEC WASSCE", full: "West African Senior School Certificate Examination", about: "The senior school certificate exam taken at the end of SS3, with objective and written papers in each subject.", mockMinutesPerQuestion: 1 },
  neco: { id: "neco", short: "NECO", name: "NECO SSCE", full: "Senior School Certificate Examination (NECO)", about: "Nigeria's own senior school certificate exam at the end of SS3, with objective and written papers in each subject.", mockMinutesPerQuestion: 1 },
};
export const isExamId = (v: unknown): v is ExamId => typeof v === "string" && (EXAM_IDS as string[]).includes(v);
export const AFFILIATION = "Not affiliated with JAMB, WAEC or NECO. All questions are original practice questions written for Naija Exam Prep.";

export type Topic = { id: string; name: string };
export type Subject = { exam: ExamId; id: string; name: string; topics: Topic[]; order: number; live: boolean; approvalsNeeded: number };
export const subjectKey = (exam: ExamId, subject: string) => `${exam}_${subject}`;
export const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

export type OptionKey = "A" | "B" | "C" | "D" | "E";
export const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];
export type Status = "draft" | "in_review" | "changes" | "approved" | "published" | "retired";
export type Access = "free" | "pack";
export type Review = { uid: string; name: string; decision: "approve" | "changes"; note: string; at: string };
export type Question = {
  id: string; exam: ExamId; subject: string; topic: string;
  context?: string; // a short passage or diagram description the question refers to
  stem: string; options: { key: OptionKey; text: string }[]; answer: OptionKey;
  explanation: string; whyNot?: Partial<Record<OptionKey, string>>;
  difficulty: 1 | 2 | 3; access: Access; status: Status;
  provenance: { kind: "original"; by: "ai-draft" | "editor"; authorUid?: string; authorName?: string };
  reviews: Review[]; approvals: number; reviewedBy?: string;
  createdAt: string; updatedAt: string; publishedAt?: string; version: number;
};
// What a student sees in practice (answers included: practice marks itself, and it works offline). Mocks leave them out until submitted.
export type StudentQuestion = Pick<Question, "id" | "exam" | "subject" | "topic" | "context" | "stem" | "options" | "answer" | "explanation" | "whyNot" | "difficulty" | "access"> & { reviewedBy?: string };
export type MockQuestion = Omit<StudentQuestion, "answer" | "explanation" | "whyNot">;
export const toStudent = (q: Question): StudentQuestion => ({ id: q.id, exam: q.exam, subject: q.subject, topic: q.topic, ...(q.context ? { context: q.context } : {}), stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, ...(q.whyNot && Object.keys(q.whyNot).length ? { whyNot: q.whyNot } : {}), difficulty: q.difficulty, access: q.access, ...(q.reviewedBy ? { reviewedBy: q.reviewedBy } : {}) });
export const toMock = (q: StudentQuestion | Question): MockQuestion => ({ id: q.id, exam: q.exam, subject: q.subject, topic: q.topic, ...(q.context ? { context: q.context } : {}), stem: q.stem, options: q.options, difficulty: q.difficulty, access: q.access });

// An editor's question, checked. `forPublish` also asks for what a published question must have (a checked answer and an explanation).
export type QuestionInput = Partial<Omit<Question, "options" | "difficulty">> & { options?: { key?: string; text?: string }[] | string[]; difficulty?: number | string };
export function checkQuestion(input: QuestionInput, subjects: Subject[], forPublish = false): { ok: true; value: Omit<Question, "id" | "status" | "provenance" | "reviews" | "approvals" | "createdAt" | "updatedAt" | "version"> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const exam = input.exam;
  if (!isExamId(exam)) errors.push("Choose JAMB, WAEC or NECO.");
  const sub = subjects.find((s) => s.exam === exam && s.id === input.subject);
  if (!sub) errors.push("Choose a subject of that exam.");
  else if (!sub.topics.some((t) => t.id === input.topic)) errors.push("Choose a topic of that subject.");
  const stem = String(input.stem ?? "").trim();
  if (stem.length < 5 || stem.length > 1_500) errors.push("Write the question (5 to 1,500 characters).");
  const context = String(input.context ?? "").trim();
  if (context.length > 3_000) errors.push("The passage can be up to 3,000 characters.");
  const raw = (input.options ?? []) as ({ key?: string; text?: string } | string)[];
  const options = raw.map((o, i) => ({ key: OPTION_KEYS[i], text: String(typeof o === "string" ? o : o?.text ?? "").trim() })).filter((o) => o.text);
  if (options.length < 2 || options.length > 5) errors.push("Give 2 to 5 options.");
  if (options.some((o) => o.text.length > 500)) errors.push("Each option can be up to 500 characters.");
  if (new Set(options.map((o) => o.text.toLowerCase())).size !== options.length) errors.push("Two options are the same.");
  const answer = String(input.answer ?? "").toUpperCase() as OptionKey;
  if (!options.some((o) => o.key === answer)) errors.push("Choose which option is correct.");
  const explanation = String(input.explanation ?? "").trim();
  if (explanation.length > 3_000) errors.push("The explanation can be up to 3,000 characters.");
  if (forPublish && explanation.length < 10) errors.push("Explain the answer before it's published.");
  const whyNot: Partial<Record<OptionKey, string>> = {};
  for (const [k, v] of Object.entries(input.whyNot ?? {})) {
    const key = k.toUpperCase() as OptionKey;
    const text = String(v ?? "").trim();
    if (text && options.some((o) => o.key === key) && key !== answer) whyNot[key] = text.slice(0, 1_000);
  }
  const d = Number(input.difficulty ?? 2);
  if (![1, 2, 3].includes(d)) errors.push("Difficulty is 1 (easy), 2 or 3 (hard).");
  const access = input.access === "free" ? "free" : input.access === "pack" ? "pack" : null;
  if (!access) errors.push("Say whether it's free or in the pack.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { exam: exam as ExamId, subject: String(input.subject), topic: String(input.topic), ...(context ? { context } : {}), stem, options, answer, explanation, ...(Object.keys(whyNot).length ? { whyNot } : {}), difficulty: d as 1 | 2 | 3, access: access! } };
}

// ---- packs and access ----
export type Pack = { id: ExamId; exam: ExamId; name: string; priceKobo: number; months: number; available: boolean };
export const DEFAULT_PACK_KOBO = 100_000; // ₦1,000
export const DEFAULT_PACK_MONTHS = 12;
export const defaultPack = (exam: ExamId): Pack => ({ id: exam, exam, name: `${EXAMS[exam].name} pack`, priceKobo: DEFAULT_PACK_KOBO, months: DEFAULT_PACK_MONTHS, available: true });
export const REFUND_DAYS = 7; // full refund within 7 days if no paid question was opened
export const PAYLINK_DAYS = 14;

export type AccessSource = { kind: "payment" | "admin"; ref: string; months: number; at: string; by?: string; refundedAt?: string };
export type AccessDoc = { uid: string; pack: ExamId; expiresAt: string; startedAt: string; sources: AccessSource[]; firstPaidQuestionAt?: string };

// Months added the way people count them: 21 Oct + 12 months = 21 Oct next year (the last day of a shorter month when needed).
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString();
}
// A confirmed payment (or an admin's grant) adds its months: from now if access had ended, otherwise from when it ends.
// Applying the same reference twice changes nothing.
export function applySource(cur: AccessDoc | null, uid: string, pack: ExamId, src: AccessSource, nowIso: string): { doc: AccessDoc; changed: boolean } {
  if (cur?.sources.some((s) => s.ref === src.ref)) return { doc: cur, changed: false };
  const base = cur && cur.expiresAt > nowIso ? cur.expiresAt : nowIso;
  return {
    doc: { uid, pack, startedAt: cur?.startedAt ?? nowIso, expiresAt: addMonths(base, src.months), sources: [...(cur?.sources ?? []), src], ...(cur?.firstPaidQuestionAt ? { firstPaidQuestionAt: cur.firstPaidQuestionAt } : {}) },
    changed: true,
  };
}
// The expiry again from the sources that still count (after a refund), in the order they were added.
export function recomputeExpiry(doc: AccessDoc): string {
  let exp = "";
  for (const s of doc.sources) {
    if (s.refundedAt) continue;
    const base = exp && exp > s.at ? exp : s.at;
    exp = addMonths(base, s.months);
  }
  return exp || doc.startedAt;
}
export function accessState(doc: AccessDoc | null, nowIso: string): { active: boolean; expiresAt: string | null; daysLeft: number } {
  if (!doc) return { active: false, expiresAt: null, daysLeft: 0 };
  const active = doc.expiresAt > nowIso;
  return { active, expiresAt: doc.expiresAt, daysLeft: active ? Math.ceil((new Date(doc.expiresAt).getTime() - new Date(nowIso).getTime()) / 86_400_000) : 0 };
}
// May this payment still be refunded in full? Within REFUND_DAYS, and only if no paid question was opened since it.
export function refundable(doc: AccessDoc | null, ref: string, nowIso: string): { ok: boolean; why: string } {
  const s = doc?.sources.find((x) => x.ref === ref);
  if (!doc || !s) return { ok: false, why: "That payment didn't open this pack." };
  if (s.refundedAt) return { ok: false, why: "It was refunded already." };
  if (new Date(nowIso).getTime() - new Date(s.at).getTime() > REFUND_DAYS * 86_400_000) return { ok: false, why: `It's more than ${REFUND_DAYS} days since the payment.` };
  if (doc.firstPaidQuestionAt && doc.firstPaidQuestionAt >= s.at) return { ok: false, why: "A paid question was opened after this payment." };
  return { ok: true, why: "" };
}

// ---- marking ----
export type Marked = { score: number; total: number; answered: number; perTopic: Record<string, { right: number; total: number }>; items: { id: string; chosen: OptionKey | null; answer: OptionKey; right: boolean }[] };
export function mark(questions: { id: string; topic: string; answer: OptionKey }[], answers: Record<string, string | null | undefined>): Marked {
  const out: Marked = { score: 0, total: questions.length, answered: 0, perTopic: {}, items: [] };
  for (const q of questions) {
    const a = answers[q.id];
    const chosen = typeof a === "string" && (OPTION_KEYS as string[]).includes(a) ? (a as OptionKey) : null;
    const right = chosen === q.answer;
    if (chosen) out.answered++;
    if (right) out.score++;
    const t = (out.perTopic[q.topic] ||= { right: 0, total: 0 });
    t.total++; if (right) t.right++;
    out.items.push({ id: q.id, chosen, answer: q.answer, right });
  }
  return out;
}
export const MOCK_GRACE_SECONDS = 30; // answers sent this long after the deadline still count (a slow connection)
export const MOCK_SIZES = [10, 20, 40] as const;

// ---- progress (the same shape on the phone and on the server) ----
export type Attempt = { c: OptionKey; ok: boolean; at: string; n: number }; // latest choice, right or not, when, how many tries
export type Progress = { v: 1; byQuestion: Record<string, Attempt & { t: string }>; mocks: { id: string; exam: ExamId; subject: string; score: number; total: number; at: string; offline: boolean }[]; days: string[]; updatedAt: string };
export const emptyProgress = (): Progress => ({ v: 1, byQuestion: {}, mocks: [], days: [], updatedAt: "" });
// Two copies of progress into one (this phone and the account): the later answer for each question, every mock once, every day once.
export function mergeProgress(a: Progress, b: Progress): Progress {
  const byQuestion = { ...a.byQuestion };
  for (const [id, x] of Object.entries(b.byQuestion)) if (!byQuestion[id] || x.at > byQuestion[id].at) byQuestion[id] = { ...x, n: Math.max(x.n, byQuestion[id]?.n ?? 0) };
  const mocks = [...a.mocks, ...b.mocks.filter((m) => !a.mocks.some((x) => x.id === m.id))].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 100);
  const days = Array.from(new Set([...a.days, ...b.days])).sort().slice(-400);
  return { v: 1, byQuestion, mocks, days, updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt };
}
// A topic's key in progress: exam/subject/topic, as the same topic name appears in several exams (JAMB and WAEC geometry).
export const topicKey = (q: { exam?: string; subject?: string; topic: string }) => (q.exam && q.subject ? `${q.exam}/${q.subject}/${q.topic}` : q.topic);
export function recordAnswer(p: Progress, q: { id: string; exam?: string; subject?: string; topic: string; answer: OptionKey }, chosen: OptionKey, nowIso: string): Progress {
  const prev = p.byQuestion[q.id];
  const day = nowIso.slice(0, 10);
  return { ...p, byQuestion: { ...p.byQuestion, [q.id]: { c: chosen, ok: chosen === q.answer, at: nowIso, n: (prev?.n ?? 0) + 1, t: topicKey(q) } }, days: p.days.includes(day) ? p.days : [...p.days, day].slice(-400), updatedAt: nowIso };
}
// The dashboard: only what the student actually did. "Right first time" counts a question once, by its first answer.
export function summarise(p: Progress, todayIso: string) {
  const all = Object.values(p.byQuestion);
  const right = all.filter((x) => x.ok).length;
  const firstTime = all.filter((x) => x.ok && x.n === 1).length;
  const byTopic: Record<string, { right: number; total: number }> = {};
  for (const x of all) { const t = (byTopic[x.t] ||= { right: 0, total: 0 }); t.total++; if (x.ok) t.right++; }
  // Days practised in a row, ending today or yesterday.
  let streak = 0;
  const day = new Date(`${todayIso.slice(0, 10)}T00:00:00Z`);
  if (!p.days.includes(todayIso.slice(0, 10))) day.setUTCDate(day.getUTCDate() - 1);
  while (p.days.includes(day.toISOString().slice(0, 10))) { streak++; day.setUTCDate(day.getUTCDate() - 1); }
  return { answered: all.length, right, firstTime, firstTimePct: all.length ? Math.round((firstTime / all.length) * 100) : 0, byTopic, mocks: p.mocks.length, streak };
}
// Strong or needs practice, only once there's enough to say (5 answers in a topic): never a prediction of an exam score.
export const topicVerdict = (t: { right: number; total: number }) => (t.total < 5 ? "too few answers yet" : t.right / t.total >= 0.7 ? "strong" : t.right / t.total < 0.5 ? "practise more" : "getting there");

// ---- the weekly effort board ----
// ISO week, "2026-W43": the board starts again every Monday (Lagos is UTC+1; a few hours either side of midnight don't matter here).
export function weekId(iso: string): string {
  const d = new Date(iso);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}
export const BOARD_DAILY_CAP = 300; // answers a day that count towards the board, so it rewards steady practice
const ADJ = ["Bright", "Sharp", "Calm", "Brave", "Steady", "Swift", "Clever", "Bold", "Kind", "Keen", "Quiet", "Golden"];
const NOUN = ["Owl", "Lion", "Eagle", "Falcon", "Baobab", "River", "Star", "Leopard", "Heron", "Comet", "Pearl", "Tiger"];
export const suggestNickname = (seed: number) => `${ADJ[Math.abs(seed) % ADJ.length]}${NOUN[Math.abs(Math.floor(seed / ADJ.length)) % NOUN.length]}${Math.abs(seed) % 90 + 10}`;
// Nicknames: letters and numbers, 3 to 20, no spaces, nothing that looks like a name, a phone number or an address.
export function checkNickname(s: unknown): string | null {
  const n = String(s ?? "").trim();
  if (!/^[A-Za-z][A-Za-z0-9]{2,19}$/.test(n)) return null;
  if (/\d{5,}/.test(n)) return null;
  return n;
}

// ---- spreadsheet import (CSV, the export of any spreadsheet) ----
// One question a row. Columns: exam, subject, topic, passage, question, A, B, C, D, E, answer, explanation, why_A … why_E,
// difficulty, access. Header names are matched loosely ("Option A", "correct answer" work too).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell) quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const HEAD: Record<string, string> = { exam: "exam", subject: "subject", topic: "topic", passage: "context", context: "context", question: "stem", stem: "stem", a: "A", b: "B", c: "C", d: "D", e: "E", optiona: "A", optionb: "B", optionc: "C", optiond: "D", optione: "E", answer: "answer", correctanswer: "answer", correct: "answer", explanation: "explanation", whya: "why_A", whyb: "why_B", whyc: "why_C", whyd: "why_D", whye: "why_E", difficulty: "difficulty", access: "access" };
export function rowsToInputs(rows: string[][], subjects: Subject[]): { input: QuestionInput; line: number }[] {
  if (!rows.length) return [];
  const head = rows[0].map((h) => HEAD[h.toLowerCase().replace(/[^a-z]/g, "")] ?? "");
  return rows.slice(1).map((r, k) => {
    const v: Record<string, string> = {};
    head.forEach((h, i) => { if (h) v[h] = (r[i] ?? "").trim(); });
    const exam = v.exam?.toLowerCase().replace(/[^a-z]/g, "").replace(/^jambutme$/, "jamb").replace(/^waecwassce$/, "waec").replace(/^necossce$/, "neco");
    const subj = subjects.find((s) => s.exam === exam && (s.id === slug(v.subject ?? "") || s.name.toLowerCase() === (v.subject ?? "").toLowerCase()));
    const topic = subj?.topics.find((t) => t.id === slug(v.topic ?? "") || t.name.toLowerCase() === (v.topic ?? "").toLowerCase());
    return {
      line: k + 2,
      input: {
        exam: exam as ExamId, subject: subj?.id ?? slug(v.subject ?? ""), topic: topic?.id ?? slug(v.topic ?? ""), context: v.context, stem: v.stem,
        options: OPTION_KEYS.map((key) => ({ key, text: v[key] ?? "" })).filter((o) => o.text), answer: (v.answer ?? "").toUpperCase() as OptionKey,
        explanation: v.explanation, whyNot: Object.fromEntries(OPTION_KEYS.map((key) => [key, v[`why_${key}`] ?? ""]).filter(([, t]) => t)),
        difficulty: v.difficulty ? Number(v.difficulty) : 2, access: (v.access || "pack").toLowerCase() === "free" ? "free" : "pack",
      },
    };
  });
}

// ---- offline pass for a saved pack ----
// When a pack with paid questions is saved on a phone, the server signs a pass: whose it is, which pack, until when (30 days,
// or the end of access if sooner). The phone checks the signature with our public key before opening the pack offline, so
// editing the stored date doesn't work; going online renews it. (Someone determined can still copy questions they paid for
// off their own phone: no web app can stop that.)
export const OFFLINE_PASS_DAYS = 30;
export type OfflinePass = { uid: string; pack: ExamId; exp: string; iat: string };
export const passPayload = (p: OfflinePass) => `nep1|${p.uid}|${p.pack}|${p.exp}|${p.iat}`;
export const passExpiry = (accessExpiry: string, nowIso: string) => { const cap = new Date(new Date(nowIso).getTime() + OFFLINE_PASS_DAYS * 86_400_000).toISOString(); return accessExpiry < cap ? accessExpiry : cap; };
