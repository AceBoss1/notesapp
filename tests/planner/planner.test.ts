// Notes Planner's pure rules (lib/planner.ts, lib/planner-nana.ts): plan dates, the plan's checks, Nana's reply markers, the
// interview's progress, ticks and the streak, the Sunday review, what goes on the calendar, her choices, the bells, and what Nana is
// told (the teen wording, the care rules, our own tools first).
// Run: npm run test:planner → "ALL OK".
import assert from "node:assert/strict";
import { allowedKinds, feedKinds, DEFAULT_PREFS, cleanPrefs, KIND_LABEL } from "../../lib/my-calendar";
import {
  DEFAULT_PLANNER_PREFS, DEFAULT_REVIEW, FEED_TITLE, MAX_QUESTIONS, OPENING, PlannerError, SKIP_TEXT, TEEN_OPENING, TEEN_REVIEW, addMonths, amount,
  cleanAnswer, cleanLength, cleanPlan, cleanPlannerPrefs, cleanReview, cleanTicks, dayView, fallbackNote, hourLabel, inPlan, lastDayOf, monthName,
  monthShort, movesBellDue, mustSumUp, newInterview, parsePlanJson, parseReply, partTitle, planEnd, planEntries, planMonths, planSpan, planStart,
  progress, progressPct, reviewBellDue, reviewOpen, reviewWeek, streak, warnings, weekDays, withAnswer, withReply, withReviewNumbers,
} from "../../lib/planner";
import { interviewMessages, interviewState, interviewSystem, planSystem, reviewContext, reviewSystem } from "../../lib/planner-nana";

const NOW = new Date("2026-11-15T10:00:00Z");
const bad = (f: () => unknown, re?: RegExp) => assert.throws(f, (e: unknown) => e instanceof PlannerError && (!re || re.test(e.message)));

// ── Months and the plan's dates ──
assert.equal(addMonths("2026-11", 1), "2026-12"); assert.equal(addMonths("2026-11", 2), "2027-01"); assert.equal(addMonths("2027-01", -1), "2026-12");
assert.equal(lastDayOf("2027-02"), "2027-02-28"); assert.equal(lastDayOf("2028-02"), "2028-02-29"); assert.equal(lastDayOf("2026-12"), "2026-12-31");
assert.equal(monthName("2027-01"), "January 2027"); assert.equal(monthShort("2027-09"), "SEP");
assert.equal(planStart("2026-11-15"), "2026-12-01", "a plan starts on the 1st of next month");
assert.equal(planStart("2026-12-31"), "2027-01-01");
assert.deepEqual(planMonths("2027-01-01", 3), ["2027-01", "2027-02", "2027-03"]);
assert.equal(planEnd("2027-01-01", 12), "2027-12-31"); assert.equal(planEnd("2026-12-01", 12), "2027-11-30");
assert.equal(planSpan("2027-01-01", 12), "January to December 2027"); assert.equal(planSpan("2026-12-01", 12), "December 2026 to November 2027");
assert.equal(cleanLength(3, false), 12, "only a teen may plan one term"); assert.equal(cleanLength(3, true), 3); assert.equal(cleanLength("x", true), 12);

// ── The plan's checks ──
const months = planMonths("2027-01-01", 12).map((month, i) => ({ month, project: `Project ${i + 1}`, done: "It is finished", tool: i === 1 ? "booking" : i === 2 ? "zoom" : undefined }));
const RAW = {
  refuse: "Chasing money I've already earned.", vision: "My own shop, paid upfront.", becoming: "I am the type of person who is paid before she cuts the cloth.",
  goal: "Earn ₦500,000 a month from tailoring, from my own shop.",
  numbers: [{ label: "Paying customers a month", start: "12", target: "40" }, { label: "Saved for the shop", start: "₦0", target: "₦1.2m" }, { label: "Orders paid upfront", start: "20%", target: "90%" }],
  stop: ["Rush jobs on credit", "Sewing past 9 PM"], keep: ["Sunday service"],
  months, risks: [{ habit: "Saying yes to family on credit", sign: "A cousin asks for a favour", response: "Quote the deposit by message" }],
  moves: ["Sew for 2 focused hours before 9 AM", "Post one finished piece", "Message 3 past customers"],
  tasks: ["Print the new price list", { text: "Add the deposit to my booking page", done: true }, "", "four", "five"],
  review: ["a", "b"],
};
const opts = { start: "2027-01-01", length: 12, teen: false, by: "nana" as const, now: NOW };
const plan = cleanPlan(RAW, opts);
assert.equal(plan.months.length, 12); assert.equal(plan.months[11].month, "2027-12");
assert.equal(plan.months[1].tool, "booking"); assert.equal(plan.months[2].tool, undefined, "a link to anything but our own tools is dropped");
assert.equal(plan.numbers[0].now, "12", "a number starts where it is");
assert.deepEqual(plan.tasks, [{ text: "Print the new price list", done: false }, { text: "Add the deposit to my booking page", done: true }, { text: "four", done: false }]);
assert.deepEqual(plan.review, DEFAULT_REVIEW, "fewer than three review questions falls back to ours");
assert.equal(plan.by, "nana"); assert.equal(plan.createdAt, NOW.toISOString());
bad(() => cleanPlan({ ...RAW, goal: " " }, opts), /goal/);
bad(() => cleanPlan({ ...RAW, moves: [] }, opts), /move/);
bad(() => cleanPlan({ ...RAW, numbers: RAW.numbers.slice(0, 2) }, opts), /three numbers/);
bad(() => cleanPlan({ ...RAW, months: months.slice(0, 11) }, opts), /every month/);
bad(() => cleanPlan(RAW, { ...opts, start: "2027-01-15" }), /1st/);
// By hand, only the goal and one move are needed; months may be left blank.
const mine = cleanPlan({ goal: "Read 12 books", moves: ["Read 20 pages"] }, { ...opts, by: "me" });
assert.equal(mine.numbers.length, 0); assert.ok(mine.months.every((m) => m.project === "")); assert.equal(mine.by, "me");
// Months sent out of order or without a month land in their own slot; long text is cut; control characters go.
const shuffled = cleanPlan({ ...RAW, months: [{ month: "2027-03", project: "March" }, { project: "x".repeat(500) }] }, { ...opts, by: "me" });
assert.equal(shuffled.months[2].project, "March"); assert.equal(shuffled.months[1].project.length, 120); assert.equal(shuffled.months[0].project, "");
assert.equal(cleanPlan({ ...RAW, goal: "A\u0000 goal\n here" }, opts).goal, "A goal here");
// A teen's plan never carries "the life I refuse", and links only to learning.
const teenPlan = cleanPlan({ ...RAW, months: months.slice(0, 3).map((m, i) => ({ ...m, tool: i === 0 ? "booking" : "prep" })) }, { ...opts, teen: true, length: 3 });
assert.equal(teenPlan.refuse, ""); assert.equal(teenPlan.months.length, 3); assert.equal(teenPlan.months[0].tool, undefined); assert.equal(teenPlan.months[1].tool, "prep");
assert.deepEqual(teenPlan.review, TEEN_REVIEW);

// Nana's JSON, with or without a fence or a sentence around it.
assert.deepEqual(parsePlanJson('Here it is:\n```json\n{"goal":"x"}\n```'), { goal: "x" });
bad(() => parsePlanJson("I can't do that."), /didn't come out right/); bad(() => parsePlanJson("{ not json }"));

// Numbers and their progress.
assert.equal(amount("₦1.2m"), 1_200_000); assert.equal(amount("450k"), 450_000); assert.equal(amount("90%"), 90); assert.equal(amount("12,500"), 12_500); assert.equal(amount("lots"), null);
assert.equal(progress({ label: "", start: "12", target: "40", now: "26" }), 50);
assert.equal(progress({ label: "", start: "₦0", target: "₦1.2m", now: "₦40,000" }), 3);
assert.equal(progress({ label: "", start: "20%", target: "90%", now: "95%" }), 100, "never over 100");
assert.equal(progress({ label: "", start: "80", target: "60", now: "70" }), 50, "a number that should fall works too");
assert.equal(progress({ label: "", start: "12", target: "many", now: "13" }), null);

// ── The interview ──
let iv = newInterview({ teen: false, length: 12, today: "2026-11-15", now: NOW });
assert.equal(iv.messages[0].text, OPENING); assert.equal(iv.asked, 1); assert.equal(iv.part, 1); assert.equal(iv.start, "2026-12-01"); assert.equal(iv.gentle, false);
const tiv = newInterview({ teen: true, length: 3, today: "2026-11-15", now: NOW });
assert.equal(tiv.messages[0].text, TEEN_OPENING); assert.equal(tiv.gentle, true, "a teen's interview is always gentle"); assert.equal(tiv.length, 3);
assert.equal(cleanAnswer("  Still   sewing at home.  "), "Still sewing at home.");
bad(() => cleanAnswer("   "), /skip/); bad(() => cleanAnswer("x".repeat(1501)), /under 1500/);
// Reply markers: the part, then the summary.
assert.deepEqual(parseReply("[[PART 2]]\nPicture an ordinary Wednesday."), { text: "Picture an ordinary Wednesday.", part: 2, summary: null });
assert.equal(parseReply("No marker at all?").part, null);
const sum = parseReply("[[SUMMARY]]\n- You are good at the work.\n- You take every rush job.\n- You don't post your work.\n- Mornings for sewing.\n- Sunday service stays.\n- A sixth line");
assert.equal(sum.summary?.length, 5); assert.equal(sum.summary?.[0], "You are good at the work."); assert.equal(sum.part, 4);
assert.equal(parseReply("[[SUMMARY]]\nOnly one line").summary, null, "a summary needs its lines");
assert.equal(parseReply("[[HANDOFF]] [[PART 1]] Hello").text, "Hello", "every marker is stripped");
iv = withAnswer(iv, "The same small flat.", NOW);
iv = withReply(iv, parseReply("[[PART 2]]\nAnd in five years?"), NOW);
assert.equal(iv.asked, 2); assert.equal(iv.part, 2); assert.equal(iv.messages.length, 3);
iv = withReply(withAnswer(iv, SKIP_TEXT, NOW), parseReply("[[PART 1]]\nBack a step?"), NOW);
assert.equal(iv.part, 2, "parts only move forward");
assert.ok(progressPct(iv) > 0 && progressPct(iv) < 92);
const done = withReply(withAnswer(iv, "Yes.", NOW), sum, NOW);
assert.equal(done.asked, iv.asked, "a summary isn't a question"); assert.equal(done.part, 4); assert.equal(done.summary?.length, 5); assert.equal(progressPct(done), 96);
assert.match(done.messages[done.messages.length - 1].text, /^1\. You are good at the work\./);
assert.equal(withAnswer(done, "Line 2 is wrong.", NOW).summary, null, "a correction reopens the summary");
assert.equal(mustSumUp({ ...iv, asked: MAX_QUESTIONS }), true); assert.equal(mustSumUp(iv), false);
assert.equal(partTitle(2, false), "If nothing changes"); assert.equal(partTitle(2, true), "What gets in the way"); assert.equal(partTitle(9, false), "Did I get you right?");

// ── A day, ticks and the streak ──
assert.equal(inPlan(plan, "2026-12-31"), false); assert.equal(inPlan(plan, "2027-01-01"), true); assert.equal(inPlan(plan, "2027-12-31"), true); assert.equal(inPlan(plan, "2028-01-01"), false);
const d = dayView(plan, "2027-01-12", [true, true]);
assert.equal(d.month?.project, "Project 1"); assert.equal(d.daysLeft, 19); assert.deepEqual(d.moves.map((m) => m.done), [true, true, false]);
const before = dayView(plan, "2026-12-25");
assert.deepEqual([before.inPlan, before.startsIn, before.moves.length, before.month], [false, 7, 0, null]);
assert.deepEqual(cleanTicks([true, "yes", true, true], plan), [true, false, true]);
assert.equal(streak(["2027-01-10", "2027-01-11", "2027-01-12"], "2027-01-12"), 3);
assert.equal(streak(["2027-01-10", "2027-01-11"], "2027-01-12"), 2, "this morning doesn't break yesterday's streak");
assert.equal(streak(["2027-01-09"], "2027-01-12"), 0); assert.equal(streak([], "2027-01-12"), 0);

// ── The Sunday review ──
assert.equal(reviewWeek("2027-01-17"), "2027-01-17", "17 January 2027 is a Sunday"); assert.equal(reviewWeek("2027-01-20"), "2027-01-17"); assert.equal(reviewWeek("2027-01-23"), "2027-01-17");
assert.deepEqual(weekDays("2027-01-17"), ["2027-01-11", "2027-01-12", "2027-01-13", "2027-01-14", "2027-01-15", "2027-01-16", "2027-01-17"]);
assert.equal(reviewOpen(plan, "2027-01-02"), false, "before the plan's first Sunday"); assert.equal(reviewOpen(plan, "2027-01-03"), true); assert.equal(reviewOpen(plan, "2026-12-27"), false);
assert.equal(reviewOpen(plan, "2028-01-01"), true, "the last week's review stays open for the days after"); assert.equal(reviewOpen(plan, "2028-01-09"), false);
const review = cleanReview({ answers: ["Printed the price list.", "", "Deposit sign on the door."], numbers: ["9", "", "67%"], signs: [true] }, plan, "2027-01-17", NOW);
assert.deepEqual(review.numbers, ["9", "₦0", "67%"], "a number left blank keeps its last value"); assert.deepEqual(review.signs, [true]);
bad(() => cleanReview({ answers: ["", " ", ""] }, plan, "2027-01-17", NOW), /at least one/);
const after = withReviewNumbers(plan, review);
assert.deepEqual(after.numbers.map((n) => n.now), ["9", "₦0", "67%"]); assert.equal(after.numbers[0].start, "12");
assert.deepEqual(warnings(plan, review), [{ sign: "A cousin asks for a favour", response: "Quote the deposit by message" }]);
assert.match(fallbackNote(plan, review, 6), /6 days of 7.*Quote the deposit by message.*Deposit sign on the door/);
assert.match(fallbackNote(plan, { ...review, signs: [false] }, 1), /1 day of 7\. No warning signs/);

// ── In My Calendar ──
const jan = planEntries(plan, "2027-01-01", "2027-01-31");
assert.deepEqual(jan.map((e) => e.id), ["plan:month:2027-01", "plan:review:2027-01-03", "plan:review:2027-01-10", "plan:review:2027-01-17", "plan:review:2027-01-24", "plan:review:2027-01-31"]);
assert.ok(jan.every((e) => e.kind === "plan" && e.feedTitle === FEED_TITLE), "the feed says only Planner");
assert.equal(jan[0].title, "Finish: Project 1"); assert.equal(jan[0].allDay, true); assert.equal(jan[0].start, "2027-01-30T23:00:00.000Z");
assert.equal(jan[1].start, "2027-01-03T16:00:00.000Z", "5 PM in Lagos");
assert.equal(planEntries(plan, "2027-01-01", "2027-01-31", { titles: true, reviewHour: 19 })[0].feedTitle, "Finish: Project 1");
assert.equal(planEntries(plan, "2027-01-01", "2027-01-31", { reviewHour: 19 })[1].start, "2027-01-03T18:00:00.000Z");
assert.equal(planEntries(plan, "2026-12-01", "2026-12-31").length, 0, "nothing before the plan starts");
assert.equal(planEntries(plan, "2027-12-20", "2028-01-31").filter((e) => e.id.startsWith("plan:review")).length, 1, "no reviews after it ends");
assert.equal(planEntries(mine, "2027-01-01", "2027-01-31").filter((e) => e.id.startsWith("plan:month")).length, 0, "a blank month has no entry");
assert.match(planEntries({ ...plan, months: plan.months.map((m) => ({ ...m, finished: true })) }, "2027-01-31", "2027-01-31")[0].title, /^Finished: /);
// The Plan kind: teens see it, child profiles see nothing, and it stays off the phone until she turns it on.
assert.ok(allowedKinds({ teen: true, kid: false }).includes("plan")); assert.equal(allowedKinds({ teen: false, kid: true }).length, 0);
assert.equal(KIND_LABEL.plan, "Plan");
assert.equal(feedKinds(DEFAULT_PREFS).includes("plan"), false); assert.equal(feedKinds(cleanPrefs({ feed: { plan: true } })).includes("plan"), true);

// ── Her choices and the bells ──
assert.deepEqual(cleanPlannerPrefs({}), DEFAULT_PLANNER_PREFS);
assert.deepEqual(cleanPlannerPrefs({ movesBell: 0, reviewBell: 23, nanaNote: false, lock: "yes", feedTitles: true }), { movesBell: 0, reviewBell: 17, nanaNote: false, feedTitles: true, lock: false });
assert.equal(DEFAULT_PLANNER_PREFS.lock, false); assert.equal(DEFAULT_PLANNER_PREFS.feedTitles, false);
assert.equal(hourLabel(7), "7:00 AM"); assert.equal(hourLabel(17), "5:00 PM"); assert.equal(hourLabel(0), "Off");
assert.equal(movesBellDue(plan, 7, undefined, "2027-01-12", 7), true); assert.equal(movesBellDue(plan, 7, undefined, "2027-01-12", 6), false);
assert.equal(movesBellDue(plan, 7, "2027-01-12", "2027-01-12", 9), false, "once a day"); assert.equal(movesBellDue(plan, 0, undefined, "2027-01-12", 9), false, "off");
assert.equal(movesBellDue(plan, 7, undefined, "2026-12-12", 9), false, "not before the plan starts");
assert.equal(reviewBellDue(plan, 17, undefined, "2027-01-17", 17, false), true); assert.equal(reviewBellDue(plan, 17, undefined, "2027-01-18", 17, false), false, "Sundays only");
assert.equal(reviewBellDue(plan, 17, undefined, "2027-01-17", 17, true), false, "already reviewed"); assert.equal(reviewBellDue(plan, 17, "2027-01-17", "2027-01-17", 19, false), false);

// ── What Nana is told ──
const adult = interviewSystem({ teen: false, gentle: false }), gentle = interviewSystem({ teen: false, gentle: true }), teen = interviewSystem({ teen: true, gentle: true });
for (const s of [adult, gentle, teen]) {
  assert.match(s, /ONE question per reply/); assert.match(s, /\[\[SUMMARY\]\]/); assert.match(s, /not therapy/); assert.match(s, /Never invent facts/); assert.match(s, /Never ask for their name/);
}
assert.match(adult, /a number, a name or a date/); assert.doesNotMatch(gentle, /a number, a name or a date/); assert.match(gentle, /go gentler/);
assert.match(teen, /13 to 17/); assert.match(teen, /Never ask about money/); assert.doesNotMatch(teen, /five years from now|least flattering/);
assert.match(interviewState({ ...iv, asked: MAX_QUESTIONS }), /Sum up now/); assert.doesNotMatch(interviewState(iv), /Sum up/);
const msgs = interviewMessages(done);
assert.equal(msgs[0].role, "user"); assert.equal(msgs[1].role, "assistant"); assert.equal(msgs[1].content, OPENING);
const ps = planSystem({ teen: false, start: "2027-01-01", length: 12 }), tps = planSystem({ teen: true, start: "2027-01-01", length: 3 });
assert.match(ps, /"refuse"/); assert.match(ps, /exactly 12 objects/); assert.match(ps, /2027-01, 2027-02/); assert.match(ps, /OUR OWN TOOLS FIRST/); assert.match(ps, /"booking" \(Booking\)/);
assert.doesNotMatch(tps, /"refuse"/); assert.match(tps, /exactly 3 objects/); assert.doesNotMatch(tps, /"booking"/); assert.match(tps, /"prep"/);
assert.match(reviewSystem(false), /never say you have changed it/); assert.match(reviewSystem(true), /13 to 17/);
const ctx = reviewContext(plan, review, 6);
assert.match(ctx, /Ticked on 6 of 7 days/); assert.match(ctx, /Warning sign seen: A cousin asks for a favour/); assert.match(ctx, /now 9, target 40/);
console.log("ALL OK");
