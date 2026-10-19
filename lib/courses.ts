// Notes Academy (docs/COURSES.md): free and paid courses, their lessons (YouTube, text, uploaded video and PDFs), enrolment and progress. Pure and
// client-safe: the shapes, the limits, and the checks both the course editor and the server run. Everything is written by the
// server (lib/courses-server.ts); browsers only read published courses, their lessons and their own enrolments.
import { setting } from "@/lib/config";
import { MAX_NOTE_TOPICS, cleanTopics } from "./topics";

// On unless NEXT_PUBLIC_ACADEMY_LIVE=false: then /academy shows the opening-soon page, /academy/teach is closed and courses are
// hidden everywhere else (profiles, Trending, member sites, the digest).
export const ACADEMY_LIVE = setting("NEXT_PUBLIC_ACADEMY_LIVE") !== "false";

export const MAX_COURSES_PER_MEMBER = 30;
export const MAX_LESSONS = 100;
export const COURSE_TITLE_MAX = 120;
export const COURSE_SUMMARY_MAX = 1_000;
export const LESSON_TITLE_MAX = 120;
export const LESSON_BODY_MAX = 50_000;
export const LESSON_MINUTES_MAX = 600;
export const MAX_COURSE_TOPICS = MAX_NOTE_TOPICS;
// Addresses under /academy that aren't courses.
const RESERVED_SLUGS = new Set(["teach", "new", "courses", "learn"]);

export type CourseStatus = "draft" | "published";
// What a course page says about itself (borrowed from the best course sites: level, language, format, what you'll learn,
// requirements, how it runs). Every course can have them, free or paid.
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export const COURSE_LEVELS: { id: CourseLevel; label: string }[] = [{ id: "beginner", label: "Beginner" }, { id: "intermediate", label: "Intermediate" }, { id: "advanced", label: "Advanced" }];
export const levelLabel = (l?: string) => COURSE_LEVELS.find((x) => x.id === l)?.label ?? "";
export type CourseFormat = "self" | "live";
export const formatLabel = (f?: string, short = false) => (f === "live" ? (short ? "Live + recorded" : "Live classes + recordings") : "Self-paced");
export const COURSE_LANGUAGES = ["English", "Nigerian Pidgin", "Yoruba", "Igbo", "Hausa", "French"];
export const MAX_OUTCOMES = 12;
export const MAX_REQUIREMENTS = 8;
export const OUTCOME_MAX = 120;
export const MAX_MODULES = 20;
export const MODULE_TITLE_MAX = 80;
// A module groups lessons on the Curriculum tab ("1 · Getting started"); lessons carry its id.
export type CourseModule = { id: string; title: string };
// Each lesson as anyone may see it (title, kind, length, free preview): kept on the course, so a paid course can list its lessons
// without showing what's in them.
export type OutlineItem = { id: string; title: string; kind: LessonKind; minutes?: number; preview?: boolean; moduleId?: string };
// Who teaches it. The lead is the course's owner (a member, or an organisation's account); co-tutors accepted an invitation.
export type Tutor = { uid: string; username: string; name: string; avatar: string; role: "lead" | "co" };

// Paid courses (docs/COURSES.md step 3). Prices in kobo; 0 is a free course.
export const COURSE_PRICE_MIN_KOBO = 50_000; // ₦500
export const COURSE_PRICE_MAX_KOBO = 500_000_000; // ₦5,000,000
export const COURSE_REFUND_DAYS = 7; // a refund within 7 days of buying, if the learner hasn't started
export const PDF_MAX_BYTES = 50 * 1024 * 1024;
// Which plans may do what (the owner's plan: the member's own, or the organisation's). Free courses: every publishing plan.
// Paid courses with text, PDFs or YouTube lessons: Pro and up. Uploaded video: Business and Enterprise.
export const canSellCourses = (tier?: string) => tier === "pro" || tier === "business" || tier === "enterprise";
export const canUploadVideo = (tier?: string) => tier === "business" || tier === "enterprise";

export type Course = {
  id: string; ownerUid: string; ownerUsername: string; ownerName: string; ownerAvatar: string;
  title: string; slug: string; summary: string; topics: string[]; cover: string; free: boolean; status: CourseStatus;
  lessonIds: string[]; // the lessons in order, so progress and completion need no extra reads
  lessonCount: number; minutes: number; enrolCount: number; viewCount: number;
  createdAt: string; updatedAt: string; publishedAt: string | null;
  likeCount?: number; ratingSum?: number; ratingCount?: number; // kept by lib/course-social-server.ts
  subtopics?: { parent: string; slug: string; label: string }[]; // under its topics (lib/subtopics.ts), shown as #Topic › #Subtopic
  priceKobo?: number; certificateIncluded?: boolean;
  level?: CourseLevel | ""; language?: string; format?: CourseFormat; outcomes?: string[]; requirements?: string[]; runsFor?: string; schedule?: string;
  modules?: CourseModule[]; outline?: OutlineItem[];
  hasClassLink?: boolean; hasCommunityLink?: boolean; communityKind?: string; // the links themselves are private (courseLinks/{id})
  tutors?: Tutor[]; tutorUids?: string[]; // accepted co-tutors (the lead is the owner)
  isOrg?: boolean; createdByUid?: string; // published by an organisation; who on its team made it
};
export type LessonKind = "youtube" | "text" | "video" | "pdf";
export const lessonKindLabel = (k: LessonKind) => (k === "text" ? "Reading" : k === "pdf" ? "PDF" : "Video");
export type Lesson = {
  id: string; order: number; title: string; kind: LessonKind; youtubeId?: string; minutes?: number; body?: string;
  preview?: boolean; moduleId?: string;
  streamUid?: string; fileKey?: string; fileName?: string; // uploads (paid courses): never public
};
export type Enrolment = {
  courseId: string; uid: string; enrolledAt: string; done: Record<string, string>; lastLessonId: string | null; completedAt: string | null; certificateId?: string;
  purchaseRef?: string; // a paid course: the payment that bought it
};

export const isPaid = (c: { priceKobo?: number } | null | undefined) => (Number(c?.priceKobo) || 0) > 0;
export const nairaLabel = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-GB")}`;
export const priceLabel = (c: { priceKobo?: number }) => (isPaid(c) ? nairaLabel(c.priceKobo!) : "Free");
// The lessons in the order the Curriculum tab shows them: by module (in the course's module order; lessons in no module first),
// then by their own order. Progress and "next lesson" follow the same order.
export function orderedLessons<T extends { order?: number; moduleId?: string }>(lessons: T[], modules: CourseModule[] = []): T[] {
  const at = new Map(modules.map((m, i) => [m.id, i + 1]));
  return lessons.map((l, i) => ({ l, i })).sort((a, b) => (at.get(a.l.moduleId ?? "") ?? 0) - (at.get(b.l.moduleId ?? "") ?? 0) || (a.l.order ?? a.i) - (b.l.order ?? b.i)).map((x) => x.l);
}
// The Curriculum tab's groups: [{ module | null, items }], empty modules left out.
export function groupByModule<T extends { moduleId?: string }>(items: T[], modules: CourseModule[] = []): { module: CourseModule | null; items: T[] }[] {
  const known = new Set(modules.map((m) => m.id));
  const loose = items.filter((l) => !l.moduleId || !known.has(l.moduleId));
  const out: { module: CourseModule | null; items: T[] }[] = loose.length ? [{ module: null, items: loose }] : [];
  for (const m of modules) { const its = items.filter((l) => l.moduleId === m.id); if (its.length) out.push({ module: m, items: its }); }
  return out;
}
// "This course includes": worked out from the lessons, never typed.
export function includesOf(c: Pick<Course, "format" | "schedule" | "certificateIncluded" | "priceKobo">, items: { kind: LessonKind; minutes?: number }[]): string[] {
  const sum = (k: LessonKind[]) => items.filter((l) => k.includes(l.kind)).reduce((n, l) => n + (l.minutes ?? 0), 0);
  const count = (k: LessonKind) => items.filter((l) => l.kind === k).length;
  const video = sum(["youtube", "video"]), reading = sum(["text"]), pdfs = count("pdf"), texts = count("text");
  const out: string[] = [];
  if (video) out.push(`${durationLabel(video)} on-demand video`);
  else if (count("youtube") + count("video")) out.push(plural(count("youtube") + count("video"), "video lesson"));
  if (texts || pdfs) out.push([reading ? `${durationLabel(reading)} of text lessons` : texts ? plural(texts, "text lesson") : "", pdfs ? plural(pdfs, "PDF") : ""].filter(Boolean).join(" and "));
  if (c.format === "live") out.push(c.schedule ? `Live classes: ${c.schedule}, recorded` : "Live classes, recorded");
  out.push("Lifetime access", "Phone and computer");
  out.push(isPaid(c) ? (c.certificateIncluded ? "Verifiable certificate, included" : "Verifiable certificate") : "Verifiable certificate, when you finish");
  return out;
}
// What kind of group a community link is ("WhatsApp", "Telegram"…), for the course page.
export function communityKindOf(url: string): string {
  const h = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  if (/whatsapp\.com$/.test(h)) return "WhatsApp";
  if (/(^|\.)t\.me$|telegram\./.test(h)) return "Telegram";
  if (/discord\.(gg|com)$/.test(h)) return "Discord";
  if (/slack\.com$/.test(h)) return "Slack";
  if (/facebook\.com$/.test(h)) return "Facebook";
  return "";
}

// A published course on a shelf (GET /api/public/academy), with its teacher as they are now and this week's visits.
export type CourseListing = {
  id: string; slug: string; title: string; summary: string; cover: string; topics: string[];
  lessonIds: string[]; lessonCount: number; minutes: number; enrolCount: number; views: number; viewsWeek: number; publishedAt: string;
  ownerUid: string; ownerUsername: string; ownerName: string; ownerAvatar: string;
  likeCount: number; rating: { count: number; average: number };
  priceKobo: number; level: string; format: string; language: string; subtopics: { parent: string; slug: string; label: string }[];
  tutorCount: number; isOrg: boolean;
};

// Likes, saves and reviews (lib/course-social-server.ts). A course shows its stars from RATING_SHOWN_FROM reviews; a learner may review
// once they've done half its lessons (rounded up).
export const RATING_SHOWN_FROM = 2;
export const showsRating = (r: { count: number } | null | undefined) => !!r && r.count >= RATING_SHOWN_FROM;
export const courseRating = (c: { ratingSum?: number; ratingCount?: number }) => {
  const count = Number(c.ratingCount) || 0;
  return { count, average: count ? Math.round(((Number(c.ratingSum) || 0) / count) * 10) / 10 : 0 };
};
export function reviewProgress(lessonIds: string[], done: Record<string, string> | undefined): { done: number; total: number; needed: number; ok: boolean } {
  const total = lessonIds.length;
  const n = lessonIds.filter((id) => done?.[id]).length;
  const needed = Math.max(1, Math.ceil(total / 2));
  return { done: n, total, needed, ok: total > 0 && n >= needed };
}

export const courseHref = (slug: string) => `/academy/${slug}`;
export const lessonHref = (slug: string, lessonId: string) => `/academy/${slug}/${lessonId}`;

// ---- YouTube ----
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
// The 11-character video id from any form of YouTube link (watch?v=, youtu.be/, shorts/, embed/, live/, m. and music.), or a
// bare id. Null when it isn't one.
export function youtubeId(input: string): string | null {
  const s = String(input ?? "").trim();
  if (YT_ID.test(s)) return s;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] || null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
  }
  return id && YT_ID.test(id) ? id : null;
}
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
// YouTube's privacy-enhanced player: no cookies until the learner plays the video.
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;

// ---- addresses ----
export function slugify(title: string): string {
  const s = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  const base = s || "course";
  return RESERVED_SLUGS.has(base) ? `${base}-course` : base;
}

// ---- checks (the editor runs them before sending; the server runs them again) ----
type CourseFields = {
  title?: string; summary?: string; topics?: string[]; cover?: string;
  level?: CourseLevel | ""; language?: string; format?: CourseFormat; outcomes?: string[]; requirements?: string[]; runsFor?: string; schedule?: string;
  modules?: CourseModule[]; certificateIncluded?: boolean;
};
const text = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : undefined);
const oneLine = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
// A list typed one per line (or sent as an array): tidied, empty lines dropped.
function lines(v: unknown, maxItems: number, maxLen: number, what: string): string[] | string {
  const raw = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split("\n") : null;
  if (!raw) return `${what}: one per line.`;
  const out = raw.map((x) => x.replace(/^\s*[-•*✓✔]\s*/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (out.length > maxItems) return `${what}: up to ${maxItems}.`;
  if (out.some((x) => x.length > maxLen)) return `${what}: keep each under ${maxLen} characters.`;
  return out;
}
const moduleIdOk = (id: unknown) => typeof id === "string" && /^[a-z0-9]{4,16}$/.test(id);
const newModuleId = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");
// The fields present in a request body, tidied, or an error to show.
export function cleanCourseFields(b: Record<string, unknown>): CourseFields | string {
  const out: CourseFields = {};
  if (b.title !== undefined) {
    const t = text(b.title)?.replace(/\s+/g, " ");
    if (t === undefined) return "The title must be text.";
    if (t.length > COURSE_TITLE_MAX) return `Keep the title under ${COURSE_TITLE_MAX} characters.`;
    out.title = t;
  }
  if (b.summary !== undefined) {
    const s = text(b.summary);
    if (s === undefined) return "The summary must be text.";
    if (s.length > COURSE_SUMMARY_MAX) return `Keep the summary under ${COURSE_SUMMARY_MAX.toLocaleString("en-GB")} characters.`;
    out.summary = s;
  }
  if (b.topics !== undefined) {
    if (!Array.isArray(b.topics)) return "Choose topics from the list.";
    if (b.topics.length > MAX_COURSE_TOPICS) return `Choose up to ${MAX_COURSE_TOPICS} topics.`;
    out.topics = cleanTopics(b.topics, MAX_COURSE_TOPICS);
  }
  if (b.cover !== undefined) {
    const c = text(b.cover) ?? "";
    if (c && (c.length > 500 || !(/^https:\/\/[^\s]+$/i.test(c) || /^\/(?!\/)[^\s]+$/.test(c)))) return "That cover picture address isn't valid. Upload the picture again.";
    out.cover = c;
  }
  if (b.level !== undefined) {
    if (b.level !== "" && !COURSE_LEVELS.some((l) => l.id === b.level)) return "Choose a level from the list.";
    out.level = b.level as CourseLevel | "";
  }
  if (b.language !== undefined) out.language = oneLine(b.language, 30) || "English";
  if (b.format !== undefined) {
    if (b.format !== "self" && b.format !== "live") return "Choose self-paced, or live classes with recordings.";
    out.format = b.format;
  }
  if (b.outcomes !== undefined) { const v = lines(b.outcomes, MAX_OUTCOMES, OUTCOME_MAX, "What learners will learn"); if (typeof v === "string") return v; out.outcomes = v; }
  if (b.requirements !== undefined) { const v = lines(b.requirements, MAX_REQUIREMENTS, OUTCOME_MAX, "Requirements"); if (typeof v === "string") return v; out.requirements = v; }
  if (b.runsFor !== undefined) out.runsFor = oneLine(b.runsFor, 40);
  if (b.schedule !== undefined) out.schedule = oneLine(b.schedule, 90);
  if (b.modules !== undefined) {
    if (!Array.isArray(b.modules)) return "Send the modules as a list.";
    if (b.modules.length > MAX_MODULES) return `A course can have up to ${MAX_MODULES} modules.`;
    const mods: CourseModule[] = [];
    for (const m of b.modules as { id?: unknown; title?: unknown }[]) {
      const title = oneLine(m?.title, MODULE_TITLE_MAX);
      if (!title) return "Give every module a title.";
      const id = moduleIdOk(m?.id) && !mods.some((x) => x.id === m.id) ? String(m.id) : newModuleId();
      mods.push({ id, title });
    }
    out.modules = mods;
  }
  if (b.certificateIncluded !== undefined) out.certificateIncluded = b.certificateIncluded === true;
  return out;
}

// The course's price as sent by the editor (naira or kobo), or an error. 0 makes it free.
export function cleanPrice(b: { priceKobo?: unknown; priceNaira?: unknown }): number | string {
  const kobo = b.priceNaira !== undefined ? Math.round(Number(String(b.priceNaira).replace(/[,\s₦]/g, "")) * 100) : Math.round(Number(b.priceKobo));
  if (!Number.isFinite(kobo) || kobo < 0) return "Type the price in naira, or 0 for a free course.";
  if (kobo === 0) return 0;
  if (kobo < COURSE_PRICE_MIN_KOBO) return `A paid course costs at least ${nairaLabel(COURSE_PRICE_MIN_KOBO)}.`;
  if (kobo > COURSE_PRICE_MAX_KOBO) return `A course can cost up to ${nairaLabel(COURSE_PRICE_MAX_KOBO)}.`;
  return Math.round(kobo / 100) * 100;
}
// The private links (the live class and the learners' group): https only.
export function cleanLink(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length > 500 || !/^https:\/\/[^\s]+$/i.test(s)) return null;
  try { new URL(s); return s; } catch { return null; }
}

export type LessonInput = {
  title: string; kind: LessonKind; youtubeId?: string; minutes: number | null; body?: string; preview: boolean; moduleId?: string;
  streamUid?: string; fileKey?: string; fileName?: string;
};
// A lesson as sent by the editor ({ kind, title, url or youtubeId, minutes, body, preview, moduleId; uploads: streamUid or fileKey }),
// checked; an error to show otherwise. Whether an upload is really the course's is checked on the server.
export function cleanLesson(b: Record<string, unknown>): LessonInput | string {
  const kind = b.kind;
  if (kind !== "youtube" && kind !== "text" && kind !== "video" && kind !== "pdf") return "Choose a video, a text lesson or a PDF.";
  const title = text(b.title)?.replace(/\s+/g, " ") ?? "";
  if (!title) return "Give the lesson a title.";
  if (title.length > LESSON_TITLE_MAX) return `Keep the lesson title under ${LESSON_TITLE_MAX} characters.`;
  let minutes: number | null = null;
  if (b.minutes !== undefined && b.minutes !== null && b.minutes !== "") {
    const m = Number(b.minutes);
    if (!Number.isFinite(m) || m < 1 || m > LESSON_MINUTES_MAX) return `Minutes: a number from 1 to ${LESSON_MINUTES_MAX}, or leave it empty.`;
    minutes = Math.round(m);
  }
  const extra = { preview: b.preview === true, ...(moduleIdOk(b.moduleId) ? { moduleId: String(b.moduleId) } : {}) };
  if (kind === "youtube") {
    const id = youtubeId(String(b.url ?? b.youtubeId ?? ""));
    if (!id) return "Paste a link to a YouTube video (for example https://www.youtube.com/watch?v=… or https://youtu.be/…).";
    return { title, kind, youtubeId: id, minutes, ...extra };
  }
  if (kind === "video") {
    const uid = String(b.streamUid ?? "");
    if (!/^[a-f0-9]{32}$/i.test(uid)) return "Upload the video first.";
    return { title, kind, streamUid: uid, minutes, ...extra };
  }
  if (kind === "pdf") {
    const key = String(b.fileKey ?? "");
    if (!/^courses\/[A-Za-z0-9_-]{1,64}\/[^\s]{1,200}$/.test(key)) return "Upload the PDF first.";
    return { title, kind, fileKey: key, fileName: oneLine(b.fileName, 120) || "lesson.pdf", minutes, ...extra };
  }
  const body = text(b.body) ?? "";
  if (!body) return "Write the lesson first.";
  if (body.length > LESSON_BODY_MAX) return `Keep a text lesson under ${LESSON_BODY_MAX.toLocaleString("en-GB")} characters (it has ${body.length.toLocaleString("en-GB")}).`;
  return { title, kind, body, minutes, ...extra };
}

// What a course still needs before it can be published (empty when it's ready).
export function publishProblems(c: Pick<Course, "title" | "summary">, lessons: number): string[] {
  const out: string[] = [];
  if (!c.title.trim()) out.push("a title");
  if (!c.summary.trim()) out.push("a summary");
  if (lessons < 1) out.push("at least one lesson");
  return out;
}

// ---- showing ----
export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (!m) return "";
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

// How far a learner is: lessons done (of the ones the course still has), the percentage, and the lesson to open next
// (the first one not done, or the first lesson once everything is done).
export function progressOf(lessonIds: string[], e: Pick<Enrolment, "done"> | null | undefined): { done: number; total: number; pct: number; next: string | null; complete: boolean } {
  const total = lessonIds.length;
  const done = e ? lessonIds.filter((id) => !!e.done?.[id]).length : 0;
  const complete = total > 0 && done === total;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, next: lessonIds.find((id) => !e?.done?.[id]) ?? lessonIds[0] ?? null, complete };
}

// ---- co-tutors ----
// The course's lead (its owner) invites other members; each accepts before they're listed. A co-tutor can edit the course's
// content and lessons; the price, the tutors, publishing and deleting stay with the lead. Sales are split like a co-authored
// post's gifts (lib/payments.ts): each co-tutor's agreed percent, the lead keeps the rest, every share at its own plan's commission.
export const MAX_CO_TUTORS = 4;
export const MIN_LEAD_TUTOR_PERCENT = 10;
export type TutorInviteStatus = "pending" | "accepted" | "declined" | "removed";
export type TutorInvite = {
  courseId: string; courseTitle: string; courseSlug: string; ownerUid: string; ownerName: string;
  uid: string; username: string; name: string; avatar: string; percent: number; status: TutorInviteStatus;
  invitedByUid: string; createdAt: string; respondedAt?: string;
};
export const tutorInviteId = (courseId: string, uid: string) => `${courseId}_${uid}`;
export const leadTutorPercent = (invites: Pick<TutorInvite, "percent" | "status">[]) =>
  100 - invites.filter((i) => i.status === "pending" || i.status === "accepted").reduce((n, i) => n + i.percent, 0);
