// Notes Jobs: a job board on NotesApp (the owner, 5 Nov 2026). Verified organisations (CAC-checked, lib/org.ts orgVerified) post jobs
// for free; members apply with their NotesApp account; jobs are shown on Explore → Jobs. Business and Enterprise organisations also get
// the matching: their jobs are ranked for each member ("Jobs for you"), members who switched on "I need a job" get a bell for strong
// matches, and the firm sees those members as suggested candidates. Pure rules here; the server side is lib/jobs-server.ts.
import type { AccountTier } from "./users";
import { INDUSTRY_LABEL, isIndustry } from "./profile-work";
import { cleanTopics, topicLabel } from "./topics";

export const JOBS_BRAND = "Notes Jobs";

export const JOB_TYPES = ["full_time", "part_time", "contract", "internship", "volunteer"] as const;
export type JobType = (typeof JOB_TYPES)[number];
export const JOB_TYPE_LABEL: Record<JobType, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship", volunteer: "Volunteer" };
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABEL: Record<WorkMode, string> = { onsite: "On site", hybrid: "Hybrid", remote: "Remote" };
export const PAY_PERIODS = ["month", "year", "hour", "project"] as const;
export type PayPeriod = (typeof PAY_PERIODS)[number];
export const PAY_PERIOD_LABEL: Record<PayPeriod, string> = { month: "a month", year: "a year", hour: "an hour", project: "for the project" };

export const OPEN_DAYS_DEFAULT = 30;
export const OPEN_DAYS_MAX = 60;
export const KEEP_DAYS = 183; // applications kept 6 months after a job closes
export const MAX_TOPICS = 5;
export const STRONG_MATCH = 5; // the score from which a member who needs a job is told, and a firm sees them suggested
export const BELLS_PER_DAY = 3; // job bells a member gets a day at most
export const BELLS_PER_JOB = 300; // members told about one job at most
export const SUGGESTED_MAX = 20;

export type JobStatus = "open" | "closed" | "removed";
export type Job = {
  id: string; orgUid: string; orgName: string; orgUsername: string; orgTier: AccountTier;
  title: string; summary: string; about: string; responsibilities: string[]; requirements: string[];
  type: JobType; mode: WorkMode; city: string; state: string;
  payMinKobo?: number; payMaxKobo?: number; payPeriod?: PayPeriod;
  industry: string; topics: string[];
  status: JobStatus; createdAt: string; updatedAt: string; closesAt: string; postedByUid: string; applicationCount?: number;
};
export type JobAppStatus = "new" | "reviewing" | "interview" | "offer" | "hired" | "declined" | "withdrawn";
export const JOB_APP_STATUS_LABEL: Record<JobAppStatus, string> = {
  new: "New", reviewing: "Reviewing", interview: "Interview", offer: "Offer", hired: "Hired", declined: "Not taken forward", withdrawn: "Withdrawn",
};
export const isJobAppStatus = (s: unknown): s is JobAppStatus => typeof s === "string" && s in JOB_APP_STATUS_LABEL;
export type JobApplication = {
  id: string; jobId: string; jobTitle: string; orgUid: string; uid: string; name: string; username: string;
  phone: string; city: string; coverNote: string; links: string[]; consentAt: string; status: JobAppStatus;
  createdAt: string; updatedAt: string; purgeAt?: string;
};
export type Seeker = { industry?: string; jobTitle?: string; interests?: string[]; city?: string };

export class JobsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const consentText = (orgName: string) =>
  `I agree that ${orgName} sees my application, my answers and my public NotesApp profile to consider me for this job, that #NotesApp keeps it, and that it's deleted 6 months after the job closes. My email address isn't shared.`;

const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const para = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
const list = (v: unknown, max: number, n: number) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : []).map((x) => line(x, max)).filter(Boolean).slice(0, n);
const kobo = (v: unknown) => {
  const n = Math.round(Number(v) * 100);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000 * 100 ? n : undefined; // naira in, kobo stored
};

// What a firm sends when it posts or edits a job. Pay is optional; when given it is in naira and needs a period.
export function cleanJob(b: Record<string, unknown>) {
  const title = line(b.title, 100);
  if (title.length < 3) throw new JobsError("Give the job a title.");
  const summary = line(b.summary, 200);
  if (summary.length < 10) throw new JobsError("Add a one-line summary of the job.");
  const requirements = list(b.requirements, 200, 12);
  if (!requirements.length) throw new JobsError("List at least one thing you're looking for.");
  const type = JOB_TYPES.includes(b.type as JobType) ? (b.type as JobType) : null;
  if (!type) throw new JobsError("Choose the type of job.");
  const mode = WORK_MODES.includes(b.mode as WorkMode) ? (b.mode as WorkMode) : null;
  if (!mode) throw new JobsError("Choose on site, hybrid or remote.");
  const city = line(b.city, 60), state = line(b.state, 40);
  if (mode !== "remote" && !city) throw new JobsError("Say which city the job is in.");
  const payMinKobo = b.payMin === "" || b.payMin == null ? undefined : kobo(b.payMin);
  const payMaxKobo = b.payMax === "" || b.payMax == null ? undefined : kobo(b.payMax);
  if ((b.payMin || b.payMax) && !(payMinKobo || payMaxKobo)) throw new JobsError("Pay must be an amount in naira.");
  if (payMinKobo && payMaxKobo && payMaxKobo < payMinKobo) throw new JobsError("The top of the pay range is below the bottom.");
  const payPeriod = PAY_PERIODS.includes(b.payPeriod as PayPeriod) ? (b.payPeriod as PayPeriod) : undefined;
  if ((payMinKobo || payMaxKobo) && !payPeriod) throw new JobsError("Say whether the pay is a month, a year, an hour or for the project.");
  const industry = isIndustry(b.industry) ? String(b.industry) : "";
  const topics = cleanTopics(Array.isArray(b.topics) ? (b.topics as unknown[]).map(String) : [], MAX_TOPICS);
  const days = Math.round(Number(b.openDays) || OPEN_DAYS_DEFAULT);
  if (days < 7 || days > OPEN_DAYS_MAX) throw new JobsError(`A job stays open for 7 to ${OPEN_DAYS_MAX} days.`);
  return {
    title, summary, about: para(b.about, 4000), responsibilities: list(b.responsibilities, 200, 12), requirements, type, mode,
    city, state, industry, topics,
    ...(payMinKobo ? { payMinKobo } : {}), ...(payMaxKobo ? { payMaxKobo } : {}), ...(payMinKobo || payMaxKobo ? { payPeriod } : {}),
    openDays: days,
  };
}

// An applicant's answers: a short note, links, optional phone and city, and consent. No email (firms reply on NotesApp).
export function cleanJobApplication(b: Record<string, unknown>) {
  const coverNote = para(b.coverNote, 4000);
  if (coverNote.length < 40) throw new JobsError("Tell them in a few sentences why this job, and what you'd bring to it.");
  if (b.consent !== true) throw new JobsError("Please read and agree to how your application is shared.");
  const links = list(b.links, 300, 5).filter((l) => /^https:\/\/[^\s]+\.[^\s]+/i.test(l));
  return { phone: line(b.phone, 30), city: line(b.city, 80), coverNote, links };
}

// Matching runs for Business and Enterprise organisations' jobs.
export const matchingTier = (t: unknown) => t === "business" || t === "enterprise";

const STOP = new Set(["and", "the", "of", "for", "a", "an", "to", "in", "at", "with", "team", "senior", "junior", "lead", "officer", "manager", "assistant", "head"]);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
const sameCity = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// How well a job fits a member, and why (the reasons are what the firm and the member see). Industry 3, each shared topic 2 (up to 4),
// each word of the job title in the member's own job title 2 (up to 4), the same city 2 (or 1 for a remote job, which suits anyone).
export function matchScore(job: Pick<Job, "industry" | "topics" | "title" | "city" | "mode">, s: Seeker): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (job.industry && s.industry === job.industry) { score += 3; reasons.push(`Works in ${INDUSTRY_LABEL[job.industry as keyof typeof INDUSTRY_LABEL] ?? job.industry}`); }
  const shared = job.topics.filter((t) => (s.interests ?? []).includes(t));
  if (shared.length) { score += Math.min(4, shared.length * 2); reasons.push(`Interested in ${shared.slice(0, 3).map(topicLabel).join(", ")}`); }
  if (s.jobTitle) {
    const mine = words(s.jobTitle);
    const hit = Array.from(words(job.title)).filter((w) => mine.has(w));
    if (hit.length) { score += Math.min(4, hit.length * 2); reasons.push(`Job title: ${s.jobTitle}`); }
  }
  if (job.mode === "remote") { score += 1; reasons.push("Remote"); }
  else if (sameCity(job.city, s.city)) { score += 2; reasons.push(`In ${job.city}`); }
  return { score, reasons };
}

export const payText = (j: Pick<Job, "payMinKobo" | "payMaxKobo" | "payPeriod">) => {
  if (!j.payMinKobo && !j.payMaxKobo) return "";
  const n = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;
  const range = j.payMinKobo && j.payMaxKobo ? `${n(j.payMinKobo)} to ${n(j.payMaxKobo)}` : j.payMinKobo ? `From ${n(j.payMinKobo)}` : `Up to ${n(j.payMaxKobo!)}`;
  return `${range} ${PAY_PERIOD_LABEL[j.payPeriod ?? "month"]}`;
};
export const placeText = (j: Pick<Job, "mode" | "city" | "state">) =>
  j.mode === "remote" ? (j.city ? `Remote (${j.city})` : "Remote") : [j.city, j.state].filter(Boolean).join(", ") + (j.mode === "hybrid" ? " · Hybrid" : "");

// ---- Nana and Notes Jobs ----
// Nana hears "I want remote work as a customer service rep" without the word "job"; these find that, and the open jobs that fit.
const JOB_WORDS = /\b(jobs?|work|working|vacanc(?:y|ies)|hiring|hire|recruit\w*|employ\w*|career|careers|apply|applying|application|cv|resume|intern(?:ship)?s?|role|roles|position|positions|opening|openings|salary|full[- ]time|part[- ]time|remote|freelance|gig)\b/i;
const SEEKING = /\b(i (?:want|need|am looking for|'m looking for|m looking for)|looking for|find|get|any|more|available|open|apply|hiring|vacanc|jobs?\b)/i;
const GAME_WORDS = /\b(notes life|life game|in the game|in game|shift|shifts|n\$|digital witch|my character|sim)\b/i;
export const jobIntent = (text: string) => JOB_WORDS.test(text) && SEEKING.test(text) && !GAME_WORDS.test(text);

const FILLER = new Set(["want", "need", "more", "work", "working", "job", "jobs", "apply", "applying", "can", "get", "find", "any", "looking", "for", "some", "please", "available", "open", "role", "roles", "position", "positions", "remote", "there", "with", "that", "what", "how", "who", "where", "which", "have", "from", "into", "about", "would", "like", "you", "your", "the", "and", "are", "help", "me", "so", "i"]);
const norm = (w: string) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2).map(norm);
// The words of a question that say what kind of job, with a few everyday equivalents (customer service = support = care).
const SAME: Record<string, string> = { support: "customer", care: "customer", service: "customer", helpdesk: "customer", agent: "rep", representative: "rep", advisor: "rep", adviser: "rep", developer: "engineer", programmer: "engineer", coder: "engineer", writer: "content", copywriter: "content", editor: "content", sale: "sales", seller: "sales" };
const keyWords = (s: string) => Array.from(new Set(wordsOf(s).filter((w) => !FILLER.has(w)).map((w) => SAME[w] ?? w)));

// Open jobs ranked for what someone asked: words in the title count 3, in the summary, requirements or industry 1; asking for remote
// (or a city) counts for jobs that are remote (or there). Only jobs with a match on what the job is, or on remote alone when that's
// all they said, are returned.
export type Rankable = Pick<Job, "title" | "summary" | "requirements" | "industry" | "city" | "state" | "mode" | "createdAt">;
export function jobsForQuestion<T extends Rankable>(question: string, jobs: T[], max = 5): T[] {
  const ws = keyWords(question);
  const remote = /\bremote(ly)?\b|from home|wfh/i.test(question);
  const scored = jobs.map((j) => {
    const title = new Set(keyWords(j.title)), rest = new Set(keyWords(`${j.summary} ${j.requirements.join(" ")} ${j.industry}`));
    const place = new Set(wordsOf(`${j.city} ${j.state}`));
    let what = 0, where = 0;
    for (const w of ws) { if (title.has(w)) what += 3; else if (rest.has(w)) what += 1; if (place.has(w)) where += 2; }
    if (remote && j.mode === "remote") where += 2; else if (remote && j.mode === "hybrid") where += 1;
    return { j, what, where };
  });
  const askedWhat = ws.some((w) => !jobs.some((j) => wordsOf(`${j.city} ${j.state}`).includes(w)));
  return scored.filter((x) => (askedWhat ? x.what > 0 : x.where > 0))
    .sort((a, b) => b.what + b.where - (a.what + a.where) || (a.j.createdAt < b.j.createdAt ? 1 : -1)).slice(0, max).map((x) => x.j);
}

// What Nana is given for each opening: a Notes Jobs job, or one of #NotesApp's own roles on /careers.
export type Opening = { title: string; org: string; place: string; kind: string; pay: string; summary: string; href: string };
export const openingOfJob = (j: Job): Opening =>
  ({ title: j.title, org: j.orgName, place: placeText(j), kind: JOB_TYPE_LABEL[j.type], pay: payText(j), summary: j.summary, href: `/jobs/${j.id}` });
