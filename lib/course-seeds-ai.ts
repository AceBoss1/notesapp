// Seven Notes Academy courses about AI for Africans, written by Emmanuel Adams and published under the corporate account @lwb (LWB
// academy). Content only, waiting to be wired into the course seeding and the Admin → Academy seed card (lib/course-seeds.ts and
// lib/course-seeds-server.ts on the course-seeds branch). Pure data, client-safe.
//
// The types below copy that branch's SeedCourse / SeedLesson / SeedQuestion / VideoCredit shapes exactly, except that a course here has
// `key: string`, `ownerUsername: "lwb"` and `byline: "Emmanuel Adams"`; so integrating is a one-line type change.
// Lessons are Markdown. A YouTube lesson's credit is what YouTube's oEmbed returned for the video, word for word (checked on
// 1 November 2026). Never add a video whose id hasn't been checked that way. Each course lives in lib/course-seeds-ai/<slug>.ts.
import type { CourseLevel, CourseModule } from "./courses";
import { AI_EVERYDAY } from "./course-seeds-ai/ai-for-everyday-africans";
import { AI_SMALL_BUSINESS } from "./course-seeds-ai/ai-for-small-businesses-and-traders";
import { AI_FARMERS } from "./course-seeds-ai/ai-for-farmers-and-agribusiness";
import { AI_TEACHERS } from "./course-seeds-ai/ai-for-teachers-schools-and-students";
import { AI_NGOS } from "./course-seeds-ai/ai-for-ngos-churches-and-public-organisations";
import { AI_CAREERS } from "./course-seeds-ai/ai-careers-and-freelancing-in-africa";
import { AI_PROFESSIONALS } from "./course-seeds-ai/ai-for-professionals";

export const AI_SEED_OWNER_USERNAME = "lwb";
export const AI_SEED_BYLINE = "Emmanuel Adams";

// Same shape as VideoCredit in lib/courses.ts on the course-seeds branch: the video's title, its creator and their YouTube address.
export type VideoCredit = { title: string; name: string; url: string };
export type AiSeedQuestion = { id: string; prompt: string; options: string[]; answer: number; explain?: string };
export type AiSeedLesson = {
  id: string; // fixed, so seeding again rewrites the same lessons and learners keep their ticks on them
  title: string; kind: "text" | "youtube" | "quiz"; minutes: number; moduleId: string;
  body?: string; // a text lesson, or a YouTube lesson's notes
  youtubeId?: string; videoCredit?: VideoCredit;
  quiz?: { passPercent: number; questions: AiSeedQuestion[] };
};
export type AiSeedCourse = {
  key: string;
  ownerUsername: "lwb"; // published by the LWB academy account
  byline: "Emmanuel Adams"; // written by Emmanuel Adams, a member of the LWB team
  existingId?: string;
  slug: string; title: string; summary: string; cover: string; topics: string[]; subtopics: { parent: string; label: string }[];
  level: CourseLevel; language: string; format: "self"; outcomes: string[]; requirements: string[];
  modules: CourseModule[]; lessons: AiSeedLesson[];
};

export const AI_COURSE_SEEDS: AiSeedCourse[] = [AI_EVERYDAY, AI_SMALL_BUSINESS, AI_FARMERS, AI_TEACHERS, AI_NGOS, AI_CAREERS, AI_PROFESSIONALS];
export const aiSeedByKey = (key: unknown) => AI_COURSE_SEEDS.find((c) => c.key === key) ?? null;
