// Quiz lessons (lib/courses.ts): checking a tutor's quiz, and marking a learner's answers. Run: npm run test:courses → "ALL OK".
import assert from "node:assert/strict";
import { QUIZ_MAX_OPTIONS, QUIZ_MAX_QUESTIONS, QUIZ_OPTION_MAX, QUIZ_PROMPT_MAX, QUIZ_EXPLAIN_MAX, cleanLesson, gradeQuiz, includesOf, lessonKindLabel, quizForLearner, type LessonInput } from "../../lib/courses";

const q = (over: Record<string, unknown> = {}) => ({ prompt: "Which adds up cells?", options: ["SUM", "COUNT", "AVERAGE"], answer: 0, explain: "SUM adds them.", ...over });
const ok = (b: Record<string, unknown>) => { const r = cleanLesson(b); assert.notEqual(typeof r, "string", String(r)); return r as LessonInput; };
const bad = (b: Record<string, unknown>, why: string) => assert.equal(typeof cleanLesson(b), "string", why);

// a quiz: questions with their answers, a pass mark (70% unless set)
const l = ok({ kind: "quiz", title: " Check yourself ", quiz: { questions: [q(), q({ prompt: " Two?  ", options: [" yes ", "no"], answer: "1", explain: "" })] } });
assert.equal(l.kind, "quiz"); assert.equal(l.title, "Check yourself"); assert.equal(l.quiz!.passPercent, 70);
assert.equal(l.quiz!.questions.length, 2);
assert.deepEqual(l.quiz!.questions.map((x) => [x.prompt, x.options, x.answer, x.explain]), [["Which adds up cells?", ["SUM", "COUNT", "AVERAGE"], 0, "SUM adds them."], ["Two?", ["yes", "no"], 1, undefined]]);
assert.ok(l.quiz!.questions.every((x) => /^[a-z0-9]{4,16}$/.test(x.id)), "each question gets an id");
assert.equal(ok({ kind: "quiz", title: "Q", quiz: { passPercent: "85", questions: [q({ id: "abcd1234" })] } }).quiz!.questions[0].id, "abcd1234", "ids are kept");
assert.equal(ok({ kind: "quiz", title: "Q", quiz: { passPercent: 100, questions: [q()] } }).quiz!.passPercent, 100);
assert.equal(ok({ kind: "quiz", title: "Q", passPercent: 50, questions: [q()] }).quiz!.passPercent, 50, "flat fields work too");

// limits
bad({ kind: "quiz", title: "Q", quiz: { questions: [] } }, "at least one question");
bad({ kind: "quiz", title: "Q", quiz: {} }, "questions are needed");
bad({ kind: "quiz", title: "Q", quiz: { questions: Array.from({ length: QUIZ_MAX_QUESTIONS + 1 }, () => q()) } }, "up to 50 questions");
ok({ kind: "quiz", title: "Q", quiz: { questions: Array.from({ length: QUIZ_MAX_QUESTIONS }, () => q()) } });
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ options: ["only"] })] } }, "two answers at least");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ options: Array.from({ length: QUIZ_MAX_OPTIONS + 1 }, (_, i) => `o${i}`) })] } }, "six answers at most");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ options: ["a", " "] })] } }, "no empty answers");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ prompt: "" })] } }, "a question needs words");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ prompt: "a".repeat(QUIZ_PROMPT_MAX + 1) })] } }, "prompt length");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ options: ["a", "b".repeat(QUIZ_OPTION_MAX + 1)] })] } }, "option length");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ explain: "e".repeat(QUIZ_EXPLAIN_MAX + 1) })] } }, "explanation length");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ answer: 3 })] } }, "the answer must be one of the options");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ answer: null })] } }, "an answer must be picked");
bad({ kind: "quiz", title: "Q", quiz: { questions: [q({ answer: 0.5 })] } }, "a whole index");
bad({ kind: "quiz", title: "Q", quiz: { passPercent: 0, questions: [q()] } }, "pass mark from 1");
bad({ kind: "quiz", title: "Q", quiz: { passPercent: 101, questions: [q()] } }, "pass mark to 100");
bad({ kind: "quiz", title: "", quiz: { questions: [q()] } }, "a title");
assert.match(String(cleanLesson({ kind: "quiz", title: "Q", quiz: { questions: [q(), q({ answer: 9 })] } })), /^Question 2: pick the right answer/);

// what learners see: no answers or explanations
const seen = quizForLearner(l.quiz!);
assert.ok(seen.questions.every((x) => !("answer" in x) && !("explain" in x)));
assert.equal(JSON.stringify(seen).includes("SUM adds them"), false);

// marking
const key = { answers: [0, 1, 2, 3], explain: ["a", "", "c", ""] };
let g = gradeQuiz(key, [0, 1, 2, 3], 70);
assert.deepEqual([g.correct, g.total, g.percent, g.passed], [4, 4, 100, true]);
g = gradeQuiz(key, [0, 1, 0, 0], 70);
assert.deepEqual([g.correct, g.percent, g.passed], [2, 50, false]);
assert.deepEqual(g.results, [{ correct: true, answer: 0, explain: "a" }, { correct: true, answer: 1 }, { correct: false, answer: 2, explain: "c" }, { correct: false, answer: 3 }]);
assert.equal(gradeQuiz(key, [0, 1, 2, 0], 75).passed, true, "75% meets a 75% pass mark");
assert.equal(gradeQuiz(key, [0, 1, 2, 0], 76).passed, false);
assert.equal(gradeQuiz(key, ["0", 1, null, undefined] as unknown[], 70).correct, 1, "only a number counts");
assert.equal(gradeQuiz({ answers: [1, 1, 1], explain: [] }, [1, 1, 0], 70).percent, 67, "rounded");
assert.equal(gradeQuiz({ answers: [1], explain: [], passPercent: 100 }, [1]).passPercent, 100, "the key's pass mark by default");
assert.equal(gradeQuiz({ answers: [], explain: [] }, [], 70).passed, false, "an empty quiz is never passed");

// showing
assert.equal(lessonKindLabel("quiz"), "Quiz");
assert.ok(includesOf({ format: "self" }, [{ kind: "quiz" }, { kind: "quiz" }, { kind: "quiz" }, { kind: "text", minutes: 5 }]).includes("3 quizzes"));
assert.ok(includesOf({ format: "self" }, [{ kind: "quiz" }]).includes("1 quiz"));
console.log("ALL OK");
