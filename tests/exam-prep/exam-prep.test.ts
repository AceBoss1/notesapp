// Naija Exam Prep rules (lib/exam-prep.ts). Run: npm run test:exam-prep → "ALL OK".
import assert from "node:assert/strict";
import {
  accessState, addMonths, applySource, checkNickname, checkQuestion, emptyProgress, mark, mergeProgress, parseCsv, recomputeExpiry,
  recordAnswer, refundable, rowsToInputs, summarise, topicVerdict, weekId, toMock, toStudent, passExpiry, type Question,
} from "../../lib/exam-prep";
import { DEFAULT_SUBJECTS } from "../../lib/exam-prep-catalog";
import starter from "../../content/exam-prep/starter.json";

// months the way people count them
assert.equal(addMonths("2026-10-22T09:00:00.000Z", 12), "2027-10-22T09:00:00.000Z");
assert.equal(addMonths("2027-01-31T00:00:00.000Z", 1), "2027-02-28T00:00:00.000Z", "the last day of a shorter month");
assert.equal(addMonths("2028-02-29T00:00:00.000Z", 12), "2029-02-28T00:00:00.000Z");

// access: a confirmed payment adds 12 months; the same reference twice adds nothing; renewing early runs on from the end
const now = "2026-10-22T09:00:00.000Z";
const a1 = applySource(null, "u1", "jamb", { kind: "payment", ref: "r1", months: 12, at: now }, now);
assert.equal(a1.changed, true); assert.equal(a1.doc.expiresAt, "2027-10-22T09:00:00.000Z");
const dup = applySource(a1.doc, "u1", "jamb", { kind: "payment", ref: "r1", months: 12, at: now }, now);
assert.equal(dup.changed, false, "a repeated webhook changes nothing"); assert.equal(dup.doc.expiresAt, a1.doc.expiresAt);
const early = applySource(a1.doc, "u1", "jamb", { kind: "payment", ref: "r2", months: 12, at: "2027-09-01T00:00:00.000Z" }, "2027-09-01T00:00:00.000Z");
assert.equal(early.doc.expiresAt, "2028-10-22T09:00:00.000Z", "renewing before it ends adds to the end");
const late = applySource(a1.doc, "u1", "jamb", { kind: "payment", ref: "r3", months: 12, at: "2028-01-05T00:00:00.000Z" }, "2028-01-05T00:00:00.000Z");
assert.equal(late.doc.expiresAt, "2029-01-05T00:00:00.000Z", "after it ended: 12 months from now");
assert.equal(accessState(a1.doc, "2027-10-22T08:59:59.000Z").active, true);
assert.equal(accessState(a1.doc, "2027-10-22T09:00:00.000Z").active, false, "ends exactly at the expiry");
assert.deepEqual(accessState(null, now), { active: false, expiresAt: null, daysLeft: 0 });
assert.equal(accessState(a1.doc, now).daysLeft, 365);

// refunds: within 7 days and only before a paid question was opened
assert.equal(refundable(a1.doc, "r1", "2026-10-28T09:00:00.000Z").ok, true);
assert.match(refundable(a1.doc, "r1", "2026-10-30T09:00:00.000Z").why, /more than 7 days/);
assert.match(refundable({ ...a1.doc, firstPaidQuestionAt: "2026-10-23T00:00:00.000Z" }, "r1", "2026-10-24T00:00:00.000Z").why, /paid question was opened/);
assert.match(refundable(a1.doc, "nope", now).why, /didn't open/);
const refunded = { ...early.doc, sources: early.doc.sources.map((s) => (s.ref === "r2" ? { ...s, refundedAt: "2027-09-02T00:00:00.000Z" } : s)) };
assert.equal(recomputeExpiry(refunded), "2027-10-22T09:00:00.000Z", "a refund takes its months back off");

// marking
const qs = [{ id: "q1", topic: "algebra", answer: "B" as const }, { id: "q2", topic: "algebra", answer: "A" as const }, { id: "q3", topic: "statistics", answer: "D" as const }];
const m = mark(qs, { q1: "B", q2: "C", q4: "A", q3: "x" });
assert.equal(m.score, 1); assert.equal(m.total, 3); assert.equal(m.answered, 2, "an invalid answer counts as unanswered");
assert.deepEqual(m.perTopic, { algebra: { right: 1, total: 2 }, statistics: { right: 0, total: 1 } });
assert.equal(m.items[2].chosen, null);

// progress: only what was done; merge keeps the later answer
let p = emptyProgress();
p = recordAnswer(p, qs[0], "B", "2026-10-20T10:00:00.000Z");
p = recordAnswer(p, qs[1], "C", "2026-10-21T10:00:00.000Z");
p = recordAnswer(p, qs[1], "A", "2026-10-22T10:00:00.000Z");
const s = summarise(p, "2026-10-22T12:00:00.000Z");
assert.equal(s.answered, 2); assert.equal(s.right, 2); assert.equal(s.firstTime, 1, "q2 was right on the second try"); assert.equal(s.streak, 3);
assert.equal(summarise(p, "2026-10-24T12:00:00.000Z").streak, 0, "a missed day ends the streak");
assert.deepEqual(recordAnswer(emptyProgress(), { id: "x", exam: "waec", subject: "mathematics", topic: "mensuration", answer: "A" }, "A", "2026-10-22T10:00:00.000Z").byQuestion.x.t, "waec/mathematics/mensuration", "topics keyed by exam and subject");
const other = recordAnswer(emptyProgress(), qs[2], "D", "2026-10-23T10:00:00.000Z");
const merged = mergeProgress(p, other);
assert.equal(Object.keys(merged.byQuestion).length, 3); assert.equal(merged.days.length, 4);
assert.equal(mergeProgress(merged, p).byQuestion.q2.c, "A");
assert.equal(topicVerdict({ right: 2, total: 3 }), "too few answers yet"); assert.equal(topicVerdict({ right: 4, total: 5 }), "strong"); assert.equal(topicVerdict({ right: 2, total: 5 }), "practise more");

// the board's week
assert.equal(weekId("2026-10-19T08:00:00.000Z"), "2026-W43"); assert.equal(weekId("2026-10-25T20:00:00.000Z"), "2026-W43"); assert.equal(weekId("2026-10-26T01:00:00.000Z"), "2026-W44");
assert.equal(weekId("2027-01-01T12:00:00.000Z"), "2026-W53");
assert.equal(checkNickname("SharpLion42"), "SharpLion42"); assert.equal(checkNickname("Chidi Okafor"), null); assert.equal(checkNickname("08031234567"), null); assert.equal(checkNickname("Ab"), null); assert.equal(checkNickname("Lion08031234"), null);

// questions: what an editor must give, and what publishing needs
const good = { exam: "jamb" as const, subject: "mathematics", topic: "algebra", stem: "Solve 2x + 3 = 11.", options: ["3", "4", "5", "7"], answer: "B" as const, explanation: "2x = 8, so x = 4.", difficulty: 1, access: "free" as const, whyNot: { A: "3 gives 9.", B: "ignored: it's the answer" } };
const ok = checkQuestion(good, DEFAULT_SUBJECTS, true);
assert.equal(ok.ok, true);
if (ok.ok) { assert.deepEqual(ok.value.options.map((o) => o.key), ["A", "B", "C", "D"]); assert.deepEqual(ok.value.whyNot, { A: "3 gives 9." }); }
const bad = checkQuestion({ ...good, exam: "gce" as never, answer: "E" as never, options: ["1", "1"], difficulty: 5, access: undefined }, DEFAULT_SUBJECTS);
assert.equal(bad.ok, false);
if (!bad.ok) assert.ok(bad.errors.length >= 4);
assert.equal(checkQuestion({ ...good, topic: "poetry" }, DEFAULT_SUBJECTS).ok, false, "the topic must belong to the subject");
assert.equal(checkQuestion({ ...good, explanation: "" }, DEFAULT_SUBJECTS).ok, true, "a draft may wait for its explanation");
assert.equal(checkQuestion({ ...good, explanation: "" }, DEFAULT_SUBJECTS, true).ok, false, "but it can't be published without one");

// what students get: mocks never carry the answer
const q: Question = { ...((ok as { value: Omit<Question, "id"> }).value as Omit<Question, "id">), id: "q9", status: "published", provenance: { kind: "original", by: "ai-draft" }, reviews: [], approvals: 1, reviewedBy: "Mrs A.", createdAt: now, updatedAt: now, version: 1 };
assert.equal("answer" in toMock(toStudent(q)), false); assert.equal("explanation" in toMock(q), false);
assert.equal(toStudent(q).reviewedBy, "Mrs A."); assert.equal("status" in toStudent(q), false); assert.equal("provenance" in toStudent(q), false);

// spreadsheet import
const csv = 'Exam,Subject,Topic,Question,Option A,Option B,Option C,Option D,Correct answer,Explanation,why_A,Access\nJAMB,Mathematics,Algebra,"Solve 2x + 3 = 11, for x.",3,4,5,7,b,"2x = 8, so ""x"" = 4.",Gives 9,free\n';
const rows = parseCsv(csv);
assert.equal(rows.length, 2); assert.equal(rows[1][3], "Solve 2x + 3 = 11, for x."); assert.equal(rows[1][9], '2x = 8, so "x" = 4.');
const inputs = rowsToInputs(rows, DEFAULT_SUBJECTS);
assert.equal(inputs[0].line, 2);
const imp = checkQuestion(inputs[0].input, DEFAULT_SUBJECTS, true);
assert.equal(imp.ok, true); if (imp.ok) { assert.equal(imp.value.answer, "B"); assert.equal(imp.value.access, "free"); assert.equal(imp.value.subject, "mathematics"); }

// the offline pass: 30 days, or the end of access if sooner
assert.equal(passExpiry("2027-10-22T09:00:00.000Z", now), "2026-11-21T09:00:00.000Z");
assert.equal(passExpiry("2026-11-01T00:00:00.000Z", now), "2026-11-01T00:00:00.000Z");

// the starter set (content/exam-prep/starter.json, built and maths-checked by scripts/exam-prep-starter.mjs): every question
// passes the publishing check, ids are unique, every subject has free questions and every topic is covered, and the correct
// letter isn't always the same
const sq = starter.questions as unknown as (Question & { id: string })[];
assert.equal(new Set(sq.map((q) => q.id)).size, sq.length, "unique ids");
for (const q of sq) { const c = checkQuestion(q, DEFAULT_SUBJECTS, true); assert.ok(c.ok, `${q.id}: ${c.ok ? "" : c.errors.join(" ")}`); }
for (const s of DEFAULT_SUBJECTS) {
  const mine = sq.filter((q) => q.exam === s.exam && q.subject === s.id);
  assert.ok(mine.length >= 20, `${s.exam} ${s.id}: 20 questions`);
  assert.ok(mine.filter((q) => q.access === "free").length >= 8, `${s.exam} ${s.id}: 8 free`);
  for (const t of s.topics) assert.ok(mine.some((q) => q.topic === t.id), `${s.exam} ${s.id}: a question in ${t.id}`);
}
const letters = new Set(sq.map((q) => q.answer));
assert.ok(letters.size === 4, "answers spread over A to D");
console.log("ALL OK");
