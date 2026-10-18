// Notes Academy, step 1 (docs/COURSES.md): free courses with YouTube and text lessons, enrolment and progress. Pure and
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
export type Course = {
  id: string; ownerUid: string; ownerUsername: string; ownerName: string; ownerAvatar: string;
  title: string; slug: string; summary: string; topics: string[]; cover: string; free: true; status: CourseStatus;
  lessonIds: string[]; // the lessons in order, so progress and completion need no extra reads
  lessonCount: number; minutes: number; enrolCount: number; viewCount: number;
  createdAt: string; updatedAt: string; publishedAt: string | null;
};
export type LessonKind = "youtube" | "text";
export type Lesson = { id: string; order: number; title: string; kind: LessonKind; youtubeId?: string; minutes?: number; body?: string };
export type Enrolment = { courseId: string; uid: string; enrolledAt: string; done: Record<string, string>; lastLessonId: string | null; completedAt: string | null; certificateId?: string };

// A published course on a shelf (GET /api/public/academy), with its teacher as they are now and this week's visits.
export type CourseListing = {
  id: string; slug: string; title: string; summary: string; cover: string; topics: string[];
  lessonIds: string[]; lessonCount: number; minutes: number; enrolCount: number; views: number; viewsWeek: number; publishedAt: string;
  ownerUid: string; ownerUsername: string; ownerName: string; ownerAvatar: string;
};

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
type CourseFields = { title?: string; summary?: string; topics?: string[]; cover?: string };
const text = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : undefined);
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
  return out;
}

export type LessonInput = { title: string; kind: LessonKind; youtubeId?: string; minutes: number | null; body?: string };
// A lesson as sent by the editor ({ kind, title, url or youtubeId, minutes, body }), checked; an error to show otherwise.
export function cleanLesson(b: Record<string, unknown>): LessonInput | string {
  const kind = b.kind;
  if (kind !== "youtube" && kind !== "text") return "Choose a video or a text lesson.";
  const title = text(b.title)?.replace(/\s+/g, " ") ?? "";
  if (!title) return "Give the lesson a title.";
  if (title.length > LESSON_TITLE_MAX) return `Keep the lesson title under ${LESSON_TITLE_MAX} characters.`;
  let minutes: number | null = null;
  if (b.minutes !== undefined && b.minutes !== null && b.minutes !== "") {
    const m = Number(b.minutes);
    if (!Number.isFinite(m) || m < 1 || m > LESSON_MINUTES_MAX) return `Minutes: a number from 1 to ${LESSON_MINUTES_MAX}, or leave it empty.`;
    minutes = Math.round(m);
  }
  if (kind === "youtube") {
    const id = youtubeId(String(b.url ?? b.youtubeId ?? ""));
    if (!id) return "Paste a link to a YouTube video (for example https://www.youtube.com/watch?v=… or https://youtu.be/…).";
    return { title, kind, youtubeId: id, minutes };
  }
  const body = text(b.body) ?? "";
  if (!body) return "Write the lesson first.";
  if (body.length > LESSON_BODY_MAX) return `Keep a text lesson under ${LESSON_BODY_MAX.toLocaleString("en-GB")} characters (it has ${body.length.toLocaleString("en-GB")}).`;
  return { title, kind, body, minutes };
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
