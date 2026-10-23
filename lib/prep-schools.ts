import { isExamId, type ExamId } from "./exam-prep";

// Schools on Naija Exam Prep (owner, 23 Oct 2026): a school joins by a key staff member (principal, proprietor or another senior
// role) applying and, once we've approved it, signing the onboarding data agreement. Then it gets classes with access codes, and
// its teachers see their classes' practice. Free during the pilot; a price per student per year comes later.
// The agreement's text is Legal's, kept in Firestore (prepConfig/schoolAgreement: version and text, set in Admin → Naija Exam Prep →
// Schools), never in the code; a school can sign only once a version is set. Pure, shared by the pages and lib/prep-schools-server.ts.

export const SCHOOL_ROLES = ["Principal", "Proprietor", "Vice principal", "Head of exams", "Head of ICT", "School administrator"] as const;
export const PILOT_NOTE = "Free during the pilot. After it, a price per student per year, agreed with each school before anything is charged.";
// What the agreement covers, in plain words, for the page (the binding text is Legal's).
export const AGREEMENT_POINTS = [
  "We keep only what students do on Naija Exam Prep: their practice, scores and mock results.",
  "Their teachers see their own classes, by first name and initial. Nobody else at the school sees them.",
  "Nothing about students is sold, shared for marketing or used for ads.",
  "A parent or the student can ask us to delete their data, and we do.",
  "Under-18s use teen mode, with a parent or guardian asked to confirm.",
];

export class SchoolError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type SchoolStatus = "pending" | "approved" | "declined";
export type Signature = { version: string; name: string; role: string; uid: string; at: string };
export type School = {
  id: string; name: string; state: string; address: string; phone: string; students: number; leadUid: string; leadName: string; leadRole: string;
  staff: Record<string, "lead" | "teacher">; staffUids: string[]; status: SchoolStatus; signature?: Signature; createdAt: string;
};
export type SchoolClass = { id: string; schoolId: string; name: string; exam: ExamId; subjects: string[]; teacherUid: string; teacherName: string; code: string; seats: number; members?: number; createdAt: string };

// The school pack: a class code opens that exam's full pack for a year, free during the pilot, for as many students as the class
// has places (the size the school gives). Leaving the class, or being removed by the teacher, frees the place and ends it; a pack the
// student paid for themselves is kept.
export const SCHOOL_PACK_MONTHS = 12;
export const MAX_SEATS = 300;
export const schoolRef = (classId: string) => `school:${classId}`;
export function cleanSeats(v: unknown, taken = 0): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SEATS) throw new SchoolError(`How many students are in the class? (1 to ${MAX_SEATS})`);
  if (n < taken) throw new SchoolError(`${taken} students have already joined. Remove some first, or keep at least ${taken} places.`);
  return n;
}
export const seatsLeft = (c: Pick<SchoolClass, "seats" | "members">) => Math.max(0, (c.seats ?? 0) - (c.members ?? 0));

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function cleanSchool(b: Record<string, unknown>) {
  const name = clip(b.name, 120), state = clip(b.state, 40), address = clip(b.address, 200), leadName = clip(b.leadName, 80), phone = clip(b.phone, 20);
  if (name.length < 3) throw new SchoolError("Enter the school's full name.");
  if (!state) throw new SchoolError("Which state is the school in?");
  if (!leadName) throw new SchoolError("Enter your full name.");
  if (!(SCHOOL_ROLES as readonly string[]).includes(String(b.leadRole))) throw new SchoolError("Choose your role at the school.");
  if (phone && !/^\+?[0-9 ]{7,20}$/.test(phone)) throw new SchoolError("Check the phone number.");
  const students = Number(b.students ?? 0);
  if (!Number.isInteger(students) || students < 1 || students > 20_000) throw new SchoolError("About how many students would use it?");
  return { name, state, address, leadName, leadRole: String(b.leadRole), phone, students };
}

export function cleanClass(b: Record<string, unknown>) {
  const name = clip(b.name, 40);
  if (name.length < 2) throw new SchoolError("Name the class, for example SS3 Gold.");
  if (!isExamId(b.exam)) throw new SchoolError("Choose the exam.");
  const subjects = Array.from(new Set((Array.isArray(b.subjects) ? b.subjects : []).map((s) => clip(s, 40)).filter(Boolean))).slice(0, 12);
  return { name, exam: b.exam as ExamId, subjects, seats: cleanSeats(b.seats) };
}

// An access code like GFC-SS3G-7KQ: the school's initials, the class, and three characters that are easy to read aloud.
const EASY = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function classCode(school: string, cls: string, rand: () => number = Math.random): string {
  const initials = school.split(/[^A-Za-z]+/).filter((w) => w && !/^(the|of|and)$/i.test(w)).map((w) => w[0]).join("").toUpperCase().slice(0, 3).padEnd(3, "X");
  const c = cls.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "CLS";
  const tail = Array.from({ length: 3 }, () => EASY[Math.floor(rand() * EASY.length)]).join("");
  return `${initials}-${c}-${tail}`;
}
export const normaliseCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{3})(.{1,4}?)(.{3})$/, "$1-$2-$3");
export const isCode = (v: string) => /^[A-Z]{3}-[A-Z0-9]{1,4}-[A-Z0-9]{3}$/.test(v);

// What a teacher sees of a student: their first name and the initial of their last.
export function studentLabel(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Student";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// A student's week, for the class view: questions answered, the share right, and the weakest topic (3 answers or more).
export function studentWeek(byQuestion: Record<string, { ok: boolean; at: string; t: string }>, sinceIso: string, subjects: string[] = []) {
  const recent = Object.values(byQuestion).filter((a) => a.at >= sinceIso && (!subjects.length || subjects.some((s) => a.t.split("/")[1] === s)));
  const byTopic = new Map<string, { n: number; ok: number }>();
  for (const a of recent) { const x = byTopic.get(a.t) ?? { n: 0, ok: 0 }; x.n++; if (a.ok) x.ok++; byTopic.set(a.t, x); }
  const weak = Array.from(byTopic.entries()).filter(([, x]) => x.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
  return { answered: recent.length, right: recent.filter((a) => a.ok).length, weakest: weak ? weak[0].split("/").pop()! : "" };
}

export function classCsv(rows: { name: string; answered: number; right: number; weakest: string }[]): string {
  const q = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [["Student", "Questions this week", "Right", "Score %", "Weakest topic"], ...rows.map((r) => [r.name, r.answered, r.right, r.answered ? Math.round((r.right / r.answered) * 100) : 0, r.weakest])].map((l) => l.map(q).join(",")).join("\n");
}
