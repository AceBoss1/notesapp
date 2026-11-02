import { EXAMS, EXAM_IDS, subjectKey, type ExamId } from "./exam-prep";
import { DEFAULT_SUBJECTS } from "./exam-prep-catalog";
import { PREP_HOST, ROOT_DOMAIN } from "./host";

// Volunteer reviewers for Naija Exam Prep (owner, 1 Nov 2026: "ask for volunteers to sign up for naija exam prep reviewers… create
// community for them too… though joining is optional"). Pure: shared by the sign-up page (/exam-prep/reviewers), the server
// (lib/prep-reviewers-server.ts) and Admin → Leads.
//
// A sign-up is a lead of category "volunteer" (leads/{id}.volunteer). Staff approve it on Admin → Leads → Volunteers, which gives
// the person reviewer access for their subjects (prepReviewers/{uid}, the same record an invite link writes) or, if they have no
// #NotesApp account yet, emails them a one-person invite link for those subjects. Volunteers who ticked "join the community" get
// the private Naija Exam Prep Reviewers community's invite link once approved, so the community stays reviewers only.

export const REVIEWERS_PATH = "/reviewers"; // on prep.<domain>; /exam-prep/reviewers on the main site

// The 18 subjects across JAMB, WAEC and NECO, as a reviewer thinks of them (Use of English and English Language are one subject
// to a reviewer). `ids` are the catalogue's subject ids in each exam that has it.
export type ReviewerSubject = { id: string; name: string; group: SubjectGroup; ids: Partial<Record<ExamId, string>> };
export type SubjectGroup = "sciences" | "arts" | "commercial";
export const SUBJECT_GROUPS: { id: SubjectGroup; name: string }[] = [
  { id: "sciences", name: "Sciences" },
  { id: "arts", name: "Arts and humanities" },
  { id: "commercial", name: "Commercial" },
];
const GROUP_OF: Record<string, SubjectGroup> = {
  english: "arts", mathematics: "sciences", "further-mathematics": "sciences", physics: "sciences", chemistry: "sciences", biology: "sciences",
  "agricultural-science": "sciences", "computer-studies": "sciences", geography: "sciences", economics: "commercial", commerce: "commercial",
  "financial-accounting": "commercial", government: "arts", "literature-in-english": "arts", history: "arts", "civic-education": "arts",
  "christian-religious-studies": "arts", "islamic-studies": "arts",
};
const NAME_OF: Record<string, string> = { english: "English", mathematics: "Mathematics" };
// Built from the catalogue, so a subject added there shows here too (in "arts" until it's given a group above).
export const REVIEWER_SUBJECTS: ReviewerSubject[] = (() => {
  const out = new Map<string, ReviewerSubject>();
  for (const s of DEFAULT_SUBJECTS) {
    const id = s.id === "use-of-english" || s.id === "english-language" ? "english" : s.id;
    const cur = out.get(id) ?? { id, name: NAME_OF[id] ?? s.name, group: GROUP_OF[id] ?? "arts", ids: {} };
    cur.ids[s.exam] = s.id;
    out.set(id, cur);
  }
  return Array.from(out.values());
})();
export const subjectName = (id: string) => REVIEWER_SUBJECTS.find((s) => s.id === id)?.name ?? id;

export const BACKGROUNDS = [
  { id: "teacher", label: "Teacher" },
  { id: "examiner", label: "Examiner or marker (WAEC, NECO or JAMB)" },
  { id: "graduate", label: "Graduate in the subject" },
  { id: "student", label: "Student (university or polytechnic)" },
] as const;
export type Background = (typeof BACKGROUNDS)[number]["id"];

export type VolunteerAnswers = {
  subjects: string[]; // REVIEWER_SUBJECTS ids
  exams: ExamId[];
  background: Background[];
  years: number; // years of experience in the subject(s)
  phone?: string;
  joinCommunity: boolean;
  note?: string;
};

// The catalogue keys ("waec_physics") a volunteer would review: each subject they chose in each exam they chose that has it.
export function subjectKeysFor(subjects: string[], exams: ExamId[]): string[] {
  const keys: string[] = [];
  for (const s of REVIEWER_SUBJECTS) {
    if (!subjects.includes(s.id)) continue;
    for (const e of exams) if (s.ids[e]) keys.push(subjectKey(e, s.ids[e]!));
  }
  return keys;
}
export const examsLabel = (exams: ExamId[]) => exams.map((e) => EXAMS[e].short).join(", ");

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export type CheckedVolunteer = { ok: true; value: VolunteerAnswers & { name: string; email: string } } | { ok: false; error: string };
export function checkVolunteer(raw: unknown): CheckedVolunteer {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(o.name, 100), email = text(o.email, 200).toLowerCase();
  if (!name) return { ok: false, error: "Tell us your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter your email address." };
  const known = new Set(REVIEWER_SUBJECTS.map((s) => s.id));
  const subjects = Array.from(new Set((Array.isArray(o.subjects) ? o.subjects : []).map(String))).filter((s) => known.has(s));
  if (!subjects.length) return { ok: false, error: "Choose at least one subject you can review." };
  const exams = EXAM_IDS.filter((e) => Array.isArray(o.exams) && o.exams.includes(e));
  if (!exams.length) return { ok: false, error: "Choose at least one exam: JAMB, WAEC or NECO." };
  if (!subjectKeysFor(subjects, exams).length) return { ok: false, error: "None of those subjects is in those exams. JAMB has English, Mathematics and the sciences, Economics and Government; WAEC and NECO have all 18." };
  const background = BACKGROUNDS.map((b) => b.id).filter((b) => Array.isArray(o.background) && o.background.includes(b));
  if (!background.length) return { ok: false, error: "Tell us your background: teacher, examiner, graduate or student." };
  const years = typeof o.years === "number" ? o.years : Number(String(o.years ?? "").trim());
  if (!Number.isInteger(years) || years < 0 || years > 60) return { ok: false, error: "Years of experience: a whole number from 0 to 60." };
  const phone = text(o.phone, 30);
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) return { ok: false, error: "That phone number doesn't look right. It's optional: leave it empty if you like." };
  const note = String(o.note ?? "").replace(/\r/g, "").trim().slice(0, 1000);
  return { ok: true, value: { name, email, subjects, exams, background, years, ...(phone ? { phone } : {}), joinCommunity: o.joinCommunity === true, ...(note ? { note } : {}) } };
}

export function volunteerMessage(v: VolunteerAnswers): string {
  return [
    `Subjects: ${v.subjects.map(subjectName).join(", ")}`,
    `Exams: ${examsLabel(v.exams)}`,
    `Background: ${v.background.map((b) => BACKGROUNDS.find((x) => x.id === b)?.label ?? b).join(", ")}`,
    `Years of experience: ${v.years}`,
    `Join the reviewers' community: ${v.joinCommunity ? "yes" : "no"}`,
    v.note ? `Note: ${v.note}` : "",
  ].filter(Boolean).join("\n");
}

// ---- The Naija Exam Prep Reviewers community (seeded once from Admin → Leads → Volunteers) ----
export const REVIEWERS_COMMUNITY_ID = "naija-exam-prep-reviewers";
export const REVIEWERS_COMMUNITY_SEED = "prep-reviewers-2026-11";
export const REVIEWERS_COMMUNITY = {
  name: "Naija Exam Prep Reviewers",
  tagline: "For the volunteers who check Naija Exam Prep questions before students see them.",
  about: [
    "This is the private home of the volunteers who review Naija Exam Prep questions: teachers, examiners, graduates and students who check that every answer is right, every explanation is clear and every question is fair.",
    "Start here: read the pinned post in Start here. Then use your subject group's Space (Sciences, Arts and humanities, Commercial) to talk about questions in your subjects, and Questions to discuss for anything tricky, a disputed answer or a syllabus point.",
    `Reviewing happens in the review queue on ${PREP_HOST}/review; this community is for talking about it. Joining is optional: you can review without it.`,
    "Please keep student details and unpublished questions here, not on other sites.",
  ].join("\n\n"),
  contact: `Questions about reviewing? Post in Questions to discuss, or contact #NotesApp at ${ROOT_DOMAIN}/contact.`,
  spaces: [
    { id: "start-here", name: "Start here", visibility: "members", whoPosts: "admins" },
    { id: "sciences", name: "Sciences", visibility: "members", whoPosts: "members" },
    { id: "arts", name: "Arts and humanities", visibility: "members", whoPosts: "members" },
    { id: "commercial", name: "Commercial", visibility: "members", whoPosts: "members" },
    { id: "questions-to-discuss", name: "Questions to discuss", visibility: "members", whoPosts: "members" },
  ] as const,
  welcome: [
    "Welcome to the Naija Exam Prep Reviewers community, and thank you for volunteering.",
    `How reviewing works: open the review queue (${PREP_HOST}/review). You see only questions in your subjects. For each one, check the marked answer is right, the explanation is clear and correct, and the question is fair. Approve it, or Ask for changes with a note saying what to fix. You can't review a question you wrote.`,
    "Where to talk: your subject group's Space (Sciences, Arts and humanities, Commercial), and Questions to discuss for anything tricky. Quote the question's ID from the queue so others can find it.",
    "Every review you make is counted, in total and per month.",
  ].join("\n\n"),
};
