// The seven AI courses (lib/course-seeds-ai.ts): shape, limits and credits. Run: npm run test:ai-seeds → "ALL OK".
import assert from "node:assert/strict";
import { AI_COURSE_SEEDS } from "../../lib/course-seeds-ai";
import { COURSE_SUMMARY_MAX, COURSE_TITLE_MAX, LESSON_BODY_MAX, LESSON_MINUTES_MAX, LESSON_TITLE_MAX, MAX_LESSONS, MAX_MODULES, MAX_OUTCOMES, MAX_REQUIREMENTS, MODULE_TITLE_MAX, OUTCOME_MAX, QUIZ_EXPLAIN_MAX, QUIZ_MAX_OPTIONS, QUIZ_MAX_QUESTIONS, QUIZ_MIN_OPTIONS, QUIZ_OPTION_MAX, QUIZ_PROMPT_MAX, slugify } from "../../lib/courses";
import { MAX_NOTE_TOPICS, isTopic } from "../../lib/topics";
import { MAX_SUBTOPICS, cleanSubtopicLabel } from "../../lib/subtopics";

// The limits these seeds are written to (copied from lib/courses.ts on 1 Nov 2026), so a change there shows up here.
assert.equal(COURSE_TITLE_MAX, 120); assert.equal(COURSE_SUMMARY_MAX, 1_000); assert.equal(LESSON_TITLE_MAX, 120);
assert.equal(LESSON_BODY_MAX, 50_000); assert.equal(MAX_OUTCOMES, 12); assert.equal(MAX_REQUIREMENTS, 8);

const TITLES = ["AI for Everyday Africans", "AI for Small Businesses and Traders", "AI for Farmers and Agribusiness", "AI for Teachers, Schools and Students", "AI for NGOs, Churches and Public Organisations", "AI Careers and Freelancing in Africa", "AI for Professionals"];
assert.deepEqual(AI_COURSE_SEEDS.map((c) => c.title), TITLES, "the seven approved courses, in order");
assert.equal(new Set(AI_COURSE_SEEDS.map((c) => c.key)).size, 7, "unique keys");
assert.equal(new Set(AI_COURSE_SEEDS.map((c) => c.slug)).size, 7, "unique slugs");
const allLessonIds = AI_COURSE_SEEDS.flatMap((c) => c.lessons.map((l) => l.id));
assert.equal(new Set(allLessonIds).size, allLessonIds.length, "lesson ids are unique across all seven courses");

let videos = 0, lessons = 0;
for (const c of AI_COURSE_SEEDS) {
  const at = (m: string) => `${c.title}: ${m}`;
  assert.equal(c.ownerUsername, "lwb", at("owner")); assert.equal(c.byline, "Emmanuel Adams", at("byline"));
  assert.equal(c.slug, slugify(c.title), at("slug is the title's slug"));
  assert.equal(c.cover, `/images/academy/covers/${c.slug}.webp`, at("cover path matches the slug"));
  assert.ok(c.title.length <= COURSE_TITLE_MAX, at("title length"));
  assert.ok(c.summary.length > 0 && c.summary.length <= COURSE_SUMMARY_MAX, at(`summary length ${c.summary.length}`));
  assert.ok(c.topics.length >= 1 && c.topics.length <= MAX_NOTE_TOPICS && c.topics.every(isTopic), at("topics are real topics"));
  assert.ok(c.subtopics.length <= MAX_SUBTOPICS, at("subtopics count"));
  for (const s of c.subtopics) { assert.ok(c.topics.includes(s.parent), at(`subtopic ${s.label} under one of its topics`)); assert.equal(cleanSubtopicLabel(s.label), s.label, at(`subtopic label ${s.label}`)); }
  assert.ok(c.level === "beginner" || (c.key === "ai-professionals" && c.level === "intermediate"), at("level"));
  assert.equal(c.language, "English", at("language")); assert.equal(c.format, "self", at("format"));
  assert.ok(c.outcomes.length >= 1 && c.outcomes.length <= MAX_OUTCOMES && c.outcomes.every((o) => o.length <= OUTCOME_MAX), at("outcomes"));
  assert.ok(c.requirements.length >= 1 && c.requirements.length <= MAX_REQUIREMENTS && c.requirements.every((o) => o.length <= OUTCOME_MAX), at("requirements"));
  assert.ok(c.modules.length >= 2 && c.modules.length <= 4 && c.modules.length <= MAX_MODULES, at("2 to 4 modules"));
  assert.ok(c.modules.every((m) => m.title.length <= MODULE_TITLE_MAX), at("module titles"));
  assert.equal(new Set(c.modules.map((m) => m.id)).size, c.modules.length, at("unique module ids"));
  assert.ok(c.lessons.length >= 8 && c.lessons.length <= 12 && c.lessons.length <= MAX_LESSONS, at("8 to 12 lessons"));
  assert.equal(new Set(c.lessons.map((l) => l.id)).size, c.lessons.length, at("unique lesson ids"));
  const moduleIds = new Set(c.modules.map((m) => m.id));
  for (const m of c.modules) assert.ok(c.lessons.some((l) => l.moduleId === m.id), at(`module ${m.id} has lessons`));
  // Lessons sit in module order, so the seeded order is the order the Curriculum tab shows.
  const order = c.lessons.map((l) => c.modules.findIndex((m) => m.id === l.moduleId));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), at("lessons are in module order"));
  for (const l of c.lessons) {
    const lat = (m: string) => at(`${l.id}: ${m}`); lessons++;
    assert.match(l.id, /^[a-z0-9-]{3,40}$/, lat("id"));
    assert.ok(moduleIds.has(l.moduleId), lat("module exists"));
    assert.ok(l.title.length > 0 && l.title.length <= LESSON_TITLE_MAX, lat("title length"));
    assert.ok(Number.isInteger(l.minutes) && l.minutes >= 1 && l.minutes <= LESSON_MINUTES_MAX, lat("minutes"));
    if (l.kind === "quiz") {
      assert.equal(l.body, undefined, lat("a quiz has no body"));
      const q = l.quiz!; assert.ok(q, lat("quiz"));
      assert.ok(q.passPercent >= 50 && q.passPercent <= 100, lat("pass mark"));
      assert.ok(q.questions.length >= 6 && q.questions.length <= 10 && q.questions.length <= QUIZ_MAX_QUESTIONS, lat("6 to 10 questions"));
      assert.equal(new Set(q.questions.map((x) => x.id)).size, q.questions.length, lat("unique question ids"));
      for (const x of q.questions) {
        assert.match(x.id, /^[a-z0-9]{4,16}$/, lat(`question id ${x.id}`));
        assert.ok(x.prompt.length > 0 && x.prompt.length <= QUIZ_PROMPT_MAX, lat(`${x.id} prompt`));
        assert.ok(x.options.length >= QUIZ_MIN_OPTIONS && x.options.length <= QUIZ_MAX_OPTIONS, lat(`${x.id} options count`));
        assert.ok(x.options.every((o) => o.trim().length > 0 && o.length <= QUIZ_OPTION_MAX), lat(`${x.id} options`));
        assert.ok(Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length, lat(`${x.id} answer in range`));
        assert.ok(x.explain && x.explain.length <= QUIZ_EXPLAIN_MAX, lat(`${x.id} explanation`));
      }
    } else {
      assert.ok(l.body && l.body.length > 500 && l.body.length <= LESSON_BODY_MAX, lat(`body length ${l.body?.length}`));
      assert.match(l.body!, /## Try this today/, lat("has a Try this today exercise"));
      assert.match(l.body!, /[Pp]rivacy|NDPA|Data Protection Act|confidential/, lat("mentions privacy"));
      assert.doesNotMatch(l.body!, /set up a WhatsApp group|Linktree/i, lat("points to #NotesApp, not other tools"));
    }
    if (l.kind === "youtube") {
      videos++;
      assert.match(l.youtubeId ?? "", /^[A-Za-z0-9_-]{11}$/, lat("video id"));
      const v = l.videoCredit; assert.ok(v && v.title && v.name && v.url, lat("video credit"));
      assert.match(v!.url, /^https:\/\/www\.youtube\.com\/@/, lat("credit url is the channel"));
      assert.ok(l.body!.includes(v!.name.trim()), lat("the lesson names the creator"));
      assert.match(l.body!, /In this (video|talk|short video)/, lat("introduces the video"));
    } else {
      assert.equal(l.youtubeId, undefined, lat("no stray video id")); assert.equal(l.videoCredit, undefined, lat("no stray credit"));
    }
  }
  assert.equal(c.lessons[c.lessons.length - 1].kind, "quiz", at("ends with a quiz"));
  const v = c.lessons.filter((l) => l.kind === "youtube").length;
  assert.ok(v >= 2 && v <= 5, at(`2 to 5 videos (has ${v})`));
}
console.log(`${AI_COURSE_SEEDS.length} courses, ${lessons} lessons, ${videos} videos`);
console.log("ALL OK");
