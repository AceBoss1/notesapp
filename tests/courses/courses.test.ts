// Notes Academy checks (lib/courses.ts): YouTube links, addresses, lessons, publishing and progress. Run: npm run test:courses → "ALL OK".
import assert from "node:assert/strict";
import { cleanCourseFields, cleanLesson, durationLabel, progressOf, publishProblems, slugify, youtubeEmbed, youtubeId, LESSON_BODY_MAX } from "../../lib/courses";

// every form of YouTube link gives the 11-character id; anything else gives nothing
const ID = "Vl0H-qTclOg";
for (const url of [
  `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`, `http://m.youtube.com/watch?feature=share&v=${ID}`,
  `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc&t=10`, `youtu.be/${ID}`, `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/embed/${ID}?rel=0`,
  `https://www.youtube-nocookie.com/embed/${ID}`, `https://www.youtube.com/live/${ID}?feature=shared`, `https://music.youtube.com/watch?v=${ID}`, `  ${ID}  `,
]) assert.equal(youtubeId(url), ID, url);
for (const bad of ["", "hello", "https://vimeo.com/123456789", `https://www.youtube.com/watch?v=${ID}x`, "https://www.youtube.com/channel/UC1234567890", `https://evil.example/watch?v=${ID}`, `https://youtube.com.evil.example/watch?v=${ID}`, "https://www.youtube.com/watch?v=short"])
  assert.equal(youtubeId(bad), null, bad);
assert.equal(youtubeEmbed(ID), `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1&playsinline=1`);

// addresses: lowercase, no accents or symbols, never a page under /academy
assert.equal(slugify("Excel for Small Business Owners!"), "excel-for-small-business-owners");
assert.equal(slugify("Café & Crème: Ọ̀rọ̀"), "cafe-and-creme-oro");
assert.equal(slugify("   "), "course");
assert.equal(slugify("Teach"), "teach-course");
assert.ok(slugify("x".repeat(200)).length <= 60);

// course fields: tidied, limited, topics from the list only
assert.deepEqual(cleanCourseFields({ title: "  Excel   basics ", topics: ["fintech", "not-a-topic", "fintech"], cover: "/images/shop/x.jpg" }), { title: "Excel basics", topics: ["fintech"], cover: "/images/shop/x.jpg" });
assert.equal(typeof cleanCourseFields({ title: "x".repeat(121) }), "string");
assert.equal(typeof cleanCourseFields({ topics: ["a", "b", "c", "d"] }), "string");
assert.equal(typeof cleanCourseFields({ cover: "javascript:alert(1)" }), "string");
assert.equal(typeof cleanCourseFields({ cover: "//evil.example/x.png" }), "string");
assert.deepEqual(cleanCourseFields({ cover: "" }), { cover: "" });

// lessons
assert.deepEqual(cleanLesson({ kind: "youtube", title: " Formulas ", url: `https://youtu.be/${ID}`, minutes: "12" }), { title: "Formulas", kind: "youtube", youtubeId: ID, minutes: 12 });
assert.deepEqual(cleanLesson({ kind: "text", title: "Reading", body: "## Hi\n\nText", minutes: "" }), { title: "Reading", kind: "text", body: "## Hi\n\nText", minutes: null });
assert.equal(typeof cleanLesson({ kind: "youtube", title: "x", url: "https://vimeo.com/1" }), "string");
assert.equal(typeof cleanLesson({ kind: "text", title: "x", body: "" }), "string");
assert.equal(typeof cleanLesson({ kind: "text", title: "x", body: "a".repeat(LESSON_BODY_MAX + 1) }), "string");
assert.equal(typeof cleanLesson({ kind: "text", title: "", body: "a" }), "string");
assert.equal(typeof cleanLesson({ kind: "pdf", title: "x" }), "string");
assert.equal(typeof cleanLesson({ kind: "youtube", title: "x", url: ID, minutes: 0 }), "string");
assert.equal(typeof cleanLesson({ kind: "youtube", title: "x", url: ID, minutes: 601 }), "string");

// publishing needs a title, a summary and a lesson
assert.deepEqual(publishProblems({ title: "Excel", summary: "" }, 0), ["a summary", "at least one lesson"]);
assert.deepEqual(publishProblems({ title: "Excel", summary: "Learn it" }, 1), []);

// progress counts only the lessons the course still has
assert.deepEqual(progressOf(["a", "b", "c"], { done: { a: "t", gone: "t" } }), { done: 1, total: 3, pct: 33, next: "b", complete: false });
assert.deepEqual(progressOf(["a", "b"], { done: { a: "t", b: "t" } }), { done: 2, total: 2, pct: 100, next: "a", complete: true });
assert.deepEqual(progressOf(["a"], null), { done: 0, total: 1, pct: 0, next: "a", complete: false });
assert.deepEqual(progressOf([], { done: {} }), { done: 0, total: 0, pct: 0, next: null, complete: false });

assert.equal(durationLabel(45), "45 min"); assert.equal(durationLabel(60), "1 h"); assert.equal(durationLabel(135), "2 h 15 min"); assert.equal(durationLabel(0), "");
console.log("ALL OK");
