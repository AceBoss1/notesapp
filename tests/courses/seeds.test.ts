// The owner's seeded courses (lib/course-seeds.ts): every lesson passes the editor's own checks, ids are fixed and unique, every video
// carries its creator's credit, and the safety lines are there. Run: npm run test:courses → "ALL OK".
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { COURSE_SEEDS, IT_SUPPORT_COURSE, RESTART_COURSE, seedByKey, seedSummary } from "../../lib/course-seeds";
import { COURSE_SUMMARY_MAX, MAX_COURSE_TOPICS, cleanCourseFields, cleanLesson, slugify } from "../../lib/courses";

for (const c of COURSE_SEEDS) {
  const f = cleanCourseFields({ title: c.title, summary: c.summary, cover: c.cover, topics: c.topics, level: c.level, language: c.language, format: c.format, outcomes: c.outcomes, requirements: c.requirements, modules: c.modules });
  assert.ok(typeof f !== "string", `${c.title}: ${f}`);
  assert.deepEqual(f.topics, c.topics, `${c.title}: every topic is on the list`); assert.ok(c.topics.length <= MAX_COURSE_TOPICS);
  assert.deepEqual(f.modules!.map((m) => m.id), c.modules.map((m) => m.id), `${c.title}: module ids are kept`);
  assert.equal(f.outcomes!.length, c.outcomes.length); assert.equal(f.requirements!.length, c.requirements.length);
  assert.ok(c.summary.length <= COURSE_SUMMARY_MAX);
  assert.ok(existsSync(`public${c.cover}`), `${c.title}: the cover is in public/`);
  assert.ok(c.subtopics.length <= 3 && c.subtopics.every((s) => c.topics.includes(s.parent)));
  const ids = new Set<string>();
  for (const l of c.lessons) {
    assert.ok(/^[A-Za-z0-9_-]{1,64}$/.test(l.id) && !ids.has(l.id), `${l.id}: a fixed, unique id`); ids.add(l.id);
    assert.ok(c.modules.some((m) => m.id === l.moduleId), `${l.title}: in one of the course's modules`);
    const input = cleanLesson({ kind: l.kind, title: l.title, minutes: l.minutes, body: l.body, url: l.youtubeId, videoCredit: l.videoCredit, moduleId: l.moduleId, quiz: l.quiz });
    assert.ok(typeof input !== "string", `${l.title}: ${input}`);
    if (l.kind !== "quiz") {
      assert.ok(/## Try this today/.test(l.body ?? ""), `${l.title}: ends with an exercise`);
      assert.ok(!/(^|\s)@\w/.test(l.body ?? ""), `${l.title}: no @ (it would become a mention)`);
      assert.ok(l.minutes >= 5 && l.minutes <= 30);
    }
    if (l.kind === "youtube") {
      assert.ok(input.videoCredit && input.videoCredit.url.startsWith("https://www.youtube.com/@"), `${l.title}: credited`);
      assert.ok((l.body ?? "").includes(l.videoCredit!.name === "TED" ? "TED" : l.videoCredit!.name), `${l.title}: the notes name the creator`);
    }
  }
  const s = seedSummary(c);
  assert.ok(s.videos.length >= 3 && s.videos.length <= 6, `${c.title}: 3 to 6 videos`);
  assert.equal(seedByKey(c.key), c);
}
assert.equal(seedByKey("nope"), null);
// Course A: a new draft at its own address, with the safety lines up front
assert.equal(RESTART_COURSE.slug, slugify(RESTART_COURSE.title));
assert.equal(RESTART_COURSE.lessons.filter((l) => /^Strategy \d:/.test(l.title)).length, 9, "nine strategies");
const welcome = RESTART_COURSE.lessons[0].body!;
assert.ok(welcome.includes("**112**") && /not a substitute for a doctor, psychologist or counsellor/.test(welcome) && /nearest hospital/.test(welcome));
assert.ok(RESTART_COURSE.summary.startsWith("9 strategies to get you moving again"));
// Course B: rewrites the published course in place, with the owner's outcomes and requirements
assert.equal(IT_SUPPORT_COURSE.existingId, "wLQCJdqolPh6A3WbvEZL"); assert.equal(IT_SUPPORT_COURSE.slug, "it-support-staff-training");
assert.deepEqual(IT_SUPPORT_COURSE.requirements, ["An interest in learning", "A notebook and a pen", "A smartphone, tablet or computer for accessing lessons"]);
assert.ok(IT_SUPPORT_COURSE.summary.endsWith("#Freelancing #RemoteWork #Monetization") && !IT_SUPPORT_COURSE.summary.includes("---"));
assert.equal(IT_SUPPORT_COURSE.lessons.filter((l) => l.kind !== "quiz").length, 10, "ten lessons");
console.log("ALL OK");
