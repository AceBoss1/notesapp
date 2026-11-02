// Seven Notes Academy courses about AI for Africans, written by Emmanuel Adams and published under the corporate account @lwb (LWB
// Academy), seeded as drafts by lib/course-seeds-server.ts. Pure data, client-safe.
//
// The shapes are lib/course-seeds.ts's SeedCourse / SeedLesson; each course has ownerUsername "lwb" (the organisation's account),
// byline "Emmanuel Adams" and teacherUsername "emmanuel" (the team member who makes it). Seeded from Admin → Academy → Seed courses.
// Lessons are Markdown. A YouTube lesson's credit is what YouTube's oEmbed returned for the video, word for word (checked on
// 1 November 2026). Never add a video whose id hasn't been checked that way. Each course lives in lib/course-seeds-ai/<slug>.ts.
import type { SeedCourse } from "./course-seeds";
import { AI_EVERYDAY } from "./course-seeds-ai/ai-for-everyday-africans";
import { AI_SMALL_BUSINESS } from "./course-seeds-ai/ai-for-small-businesses-and-traders";
import { AI_FARMERS } from "./course-seeds-ai/ai-for-farmers-and-agribusiness";
import { AI_TEACHERS } from "./course-seeds-ai/ai-for-teachers-schools-and-students";
import { AI_NGOS } from "./course-seeds-ai/ai-for-ngos-churches-and-public-organisations";
import { AI_CAREERS } from "./course-seeds-ai/ai-careers-and-freelancing-in-africa";
import { AI_PROFESSIONALS } from "./course-seeds-ai/ai-for-professionals";

export const AI_SEED_OWNER_USERNAME = "lwb";
export const AI_SEED_BYLINE = "Emmanuel Adams";

export const AI_SEED_TEACHER_USERNAME = "emmanuel"; // a member of @lwb's team: makes the courses and is credited as their teacher
export const AI_SEED_GROUP = "LWB Academy";
export const AI_COURSE_SEEDS: SeedCourse[] = [AI_EVERYDAY, AI_SMALL_BUSINESS, AI_FARMERS, AI_TEACHERS, AI_NGOS, AI_CAREERS, AI_PROFESSIONALS]
  .map((c) => ({ ...c, teacherUsername: AI_SEED_TEACHER_USERNAME, group: AI_SEED_GROUP }));
export const aiSeedByKey = (key: unknown) => AI_COURSE_SEEDS.find((c) => c.key === key) ?? null;
