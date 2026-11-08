// The Nana tutor's pure rules (lib/tutor.ts). Run: npm run test:tutor → "ALL OK".
import assert from "node:assert/strict";
import { cleanTutorMessages, cleanTutorSettings, lessonText, pickContext, tutorSystem, MODE_PROMPTS, TUTOR_LANGUAGES } from "../../lib/tutor";

// settings
assert.deepEqual(cleanTutorSettings({ on: true, notes: "  Use farm examples\r\nAnd short words  " }), { on: true, notes: "Use farm examples\nAnd short words" });
assert.equal(cleanTutorSettings({ on: "yes" }).on, false, "only true switches it on");
assert.equal(cleanTutorSettings({ notes: "x".repeat(9000) }).notes.length, 4000);

// messages: alternating, ending with the learner, newest kept
assert.deepEqual(cleanTutorMessages([{ role: "assistant", content: "hi" }, { role: "user", content: "a" }]), [{ role: "user", content: "a" }]);
assert.deepEqual(cleanTutorMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]), [], "must end with the learner");
assert.equal(cleanTutorMessages([{ role: "user", content: "x".repeat(5000) }])[0].content.length, 1000);
assert.equal(cleanTutorMessages(Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` })).concat([{ role: "user", content: "last" }])).length <= 12, true);

// what the tutor may read: never quiz answers; uploads by title only
const quiz = { title: "Check", kind: "quiz" as const, quiz: { passPercent: 50, questions: [{ id: "q1", prompt: "What is 2+2?", options: ["3", "4"], answer: 1, explain: "SECRET-EXPLAIN" }] } };
const qt = lessonText(quiz);
assert.ok(qt.includes("What is 2+2?") && !qt.includes("SECRET-EXPLAIN") && !qt.includes('"4"') && !qt.includes("answer: 1"));
assert.ok(!qt.includes("3\n") && !qt.includes("Options"), "options aren't sent either");
assert.ok(lessonText({ title: "Intro", kind: "pdf" }).includes("not available"));
assert.ok(lessonText({ title: "Vid", kind: "youtube", body: "Notes here" }).includes("Notes here"));

// context: current lesson first, then the best match, within the budget
const lessons = [
  { id: "a", title: "Photosynthesis", kind: "text" as const, body: "Plants make food from sunlight, water and carbon dioxide." },
  { id: "b", title: "Soil", kind: "text" as const, body: "Loamy soil holds water and nutrients for maize and cassava." },
  { id: "c", title: "Pests", kind: "text" as const, body: "Armyworms eat maize leaves; check crops weekly." },
];
const ctx = pickContext(lessons, "a", "How do armyworms damage maize?");
assert.ok(ctx.indexOf("Photosynthesis") < ctx.indexOf("Pests") && ctx.indexOf("Pests") < ctx.indexOf("Soil"), "current, then the best match, then the rest");
assert.ok(pickContext(lessons, null, "x", 70).length <= 120, "stays within the budget");

// the system prompt: the language, grounding and quiz rules, and the young-learner line only when it applies
const sys = tutorSystem({ course: { title: "Farm science", summary: "Basics", level: "beginner", outcomes: ["Name pests"] }, teacher: "Ada", notes: "Use farm examples", lang: "pcm", young: true });
assert.ok(sys.includes("Nigerian Pidgin") && sys.includes("ONLY the course material") && sys.includes("never give or work out their answers") && sys.includes("child or a teenager") && sys.includes("Use farm examples"));
assert.ok(!tutorSystem({ course: { title: "T", summary: "", level: "", outcomes: [] }, teacher: "Ada", notes: "", lang: "sw", young: false }).includes("child or a teenager"));
assert.ok(tutorSystem({ course: { title: "T", summary: "", level: "", outcomes: [] }, teacher: "Ada", notes: "", lang: "sw", young: false }).includes("Kiswahili"));
for (const l of TUTOR_LANGUAGES) for (const m of ["explain", "quiz", "summary"] as const) assert.ok(MODE_PROMPTS[m][l.id].length > 10);
assert.equal(lessonText({ title: "T", kind: "text", body: "<p>Green plants make <b>food</b>.</p><ul><li>Sun</li><li>Water &amp; air</li></ul>" }), "## T\nGreen plants make food.\n- Sun\n- Water & air");
console.log("ALL OK");
