// Notes Planner on the server (lib/planner-server.ts) against the Firestore emulator: who may use it, the interview (her answers kept
// even when Nana is away, the summary, the teen version), Nana writing the plan, writing it by hand, encryption at rest, ticks and the
// streak, the Sunday review and its numbers, her choices, the optional lock, My Calendar and the private feed, the bells, Download my
// plan, Delete everything and closing the account.
// Run: npm run test:planner-server → "ALL OK".
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.ACCOUNT_DATA_KEY = randomBytes(32).toString("base64");
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { encryptSecret } from "../../lib/account-crypto";
import { FEED_TITLE, MOVES_BELL_TEXT, OPENING, PlannerError, REVIEW_BELL_TEXT, SKIP_TEXT, TEEN_OPENING, planMonths } from "../../lib/planner";
import {
  UNLOCK_IDLE_MS, UNLOCK_MAX_MS, checkUnlock, enter, erasePlanner, exportPlanner, finishMonth, interviewTurn, issueUnlock, planCalendar, plannerBells,
  plannerDay, plannerStatus, plannerView, savePlan, savePrefs, saveReview, setGentle, startInterview, tickMove, tickTask, writePlan,
} from "../../lib/planner-server";
import { gatherCalendar, savePrefs as saveCalPrefs, newLink, feedFor } from "../../lib/my-calendar-server";
import { eraseAccount } from "../../lib/account-server";
import type { CompleteArgs, NanaDeps } from "../../lib/nana-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const TODAY = "2026-11-15";
const NOW = new Date("2026-11-15T10:00:00Z");
const refused = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => e instanceof PlannerError && e.status === status); };

// A stand-in for the AI: answers from a queue, and records what it was sent.
const sent: CompleteArgs[] = [];
const queue: string[] = [];
const at = (now: Date): NanaDeps => ({ now: () => now, complete: async (a) => { sent.push(a); return { text: queue.shift() ?? "[[PART 1]]\nTell me more?", refused: false }; } });
const ai = at(NOW);
const noAi: NanaDeps = { now: () => NOW, complete: async () => { throw new Error("should not be called"); } };
const sys = (a: CompleteArgs) => a.system.map((s) => s.text).join("\n");

const PLAN = (start: string, length = 12) => ({
  refuse: "Chasing money I've already earned.", vision: "My own shop.", becoming: "I am the type of person who is paid before she cuts the cloth.",
  goal: "Earn ₦500,000 a month from tailoring.",
  numbers: [{ label: "Paying customers a month", start: "12", target: "40" }, { label: "Saved for the shop", start: "₦0", target: "₦1.2m" }, { label: "Orders paid upfront", start: "20%", target: "90%" }],
  stop: ["Rush jobs on credit"], keep: ["Sunday service"],
  months: planMonths(start, length).map((month, i) => ({ month, project: `Project ${i + 1}`, done: "Finished", ...(i === 1 ? { tool: "booking" } : {}) })),
  risks: [{ habit: "Saying yes on credit", sign: "A cousin asks", response: "Quote the deposit by message" }, { habit: "b", sign: "b", response: "b" }, { habit: "c", sign: "c", response: "c" }],
  moves: ["Sew for 2 hours before 9 AM", "Post one finished piece", "Message 3 past customers"],
  tasks: ["Print the price list", "Add the deposit to my booking page", "Tell two customers"],
  review: ["What did I finish?", "Where did I slip?", "What is the one thing for next week?"],
});

(async () => {
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada Obi", role: "reader", accountTier: "standard" });
  await db.doc("users/u_tia").set({ username: "tia", displayName: "Tia", role: "reader", teen: true });
  await db.doc("users/u_bob").set({ username: "bob", displayName: "Bob", role: "reader" });
  await db.doc("users/kid_k1").set({ username: "kid1", displayName: "Kid", teen: true, kid: true });

  // Who may use it: adults and teens; never a child profile.
  assert.equal((await plannerStatus(db, "kid_k1")).eligible, false);
  await refused(enter(db, "kid_k1", undefined, NOW), 403);
  await refused(enter(db, "u_nobody", undefined, NOW), 403);
  const s0 = await plannerStatus(db, "u_ada");
  assert.deepEqual([s0.eligible, s0.teen, s0.has, s0.lock, s0.ready], [true, false, false, false, true]);
  assert.equal((await plannerStatus(db, "u_tia")).teen, true);
  const ada = await enter(db, "u_ada", undefined, NOW), tia = await enter(db, "u_tia", undefined, NOW);
  assert.equal(ada.since, null, "no lock, no unlock needed");
  const v0 = await plannerView(db, "u_ada", ada, TODAY);
  assert.deepEqual([v0.state, v0.starts, v0.lengths, v0.plan, v0.review], ["none", "2026-12-01", [12], null, null]);
  assert.deepEqual((await plannerView(db, "u_tia", tia, TODAY)).lengths, [3, 12]);

  // Start with Nana: our own first question, at once, with no AI call. Starting again returns the same interview.
  const i0 = await startInterview(db, "u_ada", ada, { length: 3 }, TODAY, NOW);
  assert.deepEqual([i0.messages.length, i0.messages[0].text, i0.asked, i0.part, i0.length, i0.start, i0.gentle], [1, OPENING, 1, 1, 12, "2026-12-01", false]);
  assert.equal((await startInterview(db, "u_ada", ada, {}, TODAY, NOW)).messages[0].at, i0.messages[0].at);
  assert.equal(sent.length, 0);
  assert.equal((await plannerView(db, "u_ada", ada, TODAY)).state, "interview");
  await refused(interviewTurn(db, "u_bob", { teen: false }, { message: "hello" }, ai), 409);

  // With no AI to hand, her answer is still kept, and she is told plainly.
  await refused(interviewTurn(db, "u_ada", ada, { message: "  " }, noAi), 400);
  await refused(interviewTurn(db, "u_ada", ada, { message: "The same small flat." }, noAi), 503);
  const kept = await plannerView(db, "u_ada", ada, TODAY);
  assert.deepEqual(kept.interview?.messages.map((m) => m.role), ["nana", "me"]);
  const raw0 = (await db.doc("plannerPlans/u_ada").get()).data()!;
  assert.doesNotMatch(JSON.stringify(raw0), /small flat|put up with/, "encrypted at rest");
  assert.equal(raw0.has, false);

  // Her own AI account answers. Nana is sent the interview so far and the rules, never her name.
  await db.doc("aiConnections/u_ada").set({ uid: "u_ada", secret: encryptSecret("test-own-key-000000000000000000"), last4: "0000" });
  queue.push("[[PART 2]]\nPicture an ordinary Wednesday in 2031.");
  const i1 = await interviewTurn(db, "u_ada", ada, { message: "Customers who pay late." }, ai);
  assert.deepEqual([i1.asked, i1.part, i1.summary], [2, 2, null]);
  assert.equal(i1.messages[i1.messages.length - 1].text, "Picture an ordinary Wednesday in 2031.");
  const a1 = sent[sent.length - 1];
  assert.match(sys(a1), /ONE question per reply/); assert.match(sys(a1), /not therapy/); assert.match(sys(a1), /December 2026 to November 2027/);
  assert.doesNotMatch(JSON.stringify(a1), /Ada|u_ada/);
  assert.deepEqual(a1.messages.map((m) => m.role), ["user", "assistant", "user", "user"]);
  assert.equal(a1.messages[a1.messages.length - 1].content, "Customers who pay late.");
  // Skip, and go gentler.
  queue.push("[[PART 2]]\nWho else is in the house that morning?");
  await interviewTurn(db, "u_ada", ada, { skip: true, gentle: true }, ai);
  assert.equal(sent[sent.length - 1].messages.slice(-1)[0].content, SKIP_TEXT);
  assert.match(sys(sent[sent.length - 1]), /go gentler/);
  assert.equal((await setGentle(db, "u_ada", ada, false, NOW)).gentle, false);
  // She can't have the plan written until Nana has checked she understood.
  await refused(writePlan(db, "u_ada", ada, ai), 409);
  // "Sum up now" → five lines → a correction reopens it → a new summary.
  queue.push("[[SUMMARY]]\n- One\n- Two\n- Three\n- Four\n- Five");
  const i2 = await interviewTurn(db, "u_ada", ada, { message: "My children.", sumUp: true }, ai);
  assert.match(sys(sent[sent.length - 1]), /asked you to sum up now/);
  assert.deepEqual(i2.summary, ["One", "Two", "Three", "Four", "Five"]);
  assert.equal((await plannerView(db, "u_ada", ada, TODAY)).state, "summary");
  queue.push("[[SUMMARY]]\n- One\n- Two, corrected\n- Three\n- Four\n- Five");
  assert.equal((await interviewTurn(db, "u_ada", ada, { message: "Line two is wrong." }, ai)).summary?.[1], "Two, corrected");

  // "Yes, write my plan": a reply that isn't a plan is refused and the interview stays; a good one is saved and the interview goes.
  queue.push("I'm sorry, I can't.");
  await refused(writePlan(db, "u_ada", ada, ai), 502);
  queue.push(JSON.stringify({ ...PLAN("2026-12-01"), numbers: [] }));
  await refused(writePlan(db, "u_ada", ada, ai), 400);
  assert.equal((await plannerView(db, "u_ada", ada, TODAY)).state, "summary");
  queue.push("```json\n" + JSON.stringify({ ...PLAN("2026-12-01"), months: PLAN("2026-12-01").months.map((m, i) => (i === 2 ? { ...m, tool: "calendly" } : m)) }) + "\n```");
  const w = await writePlan(db, "u_ada", ada, ai);
  assert.match(sys(sent[sent.length - 1]), /OUR OWN TOOLS FIRST/);
  assert.deepEqual([w.plan.by, w.plan.start, w.plan.months.length, w.plan.months[1].tool, w.plan.months[2].tool], ["nana", "2026-12-01", 12, "booking", undefined]);
  const v1 = await plannerView(db, "u_ada", ada, TODAY);
  assert.deepEqual([v1.state, v1.interview, v1.day?.inPlan, v1.day?.startsIn, v1.review?.open], ["plan", null, false, 16, false]);
  const raw1 = (await db.doc("plannerPlans/u_ada").get()).data()!;
  assert.equal(raw1.has, true);
  assert.doesNotMatch(JSON.stringify(raw1), /tailoring|Project 1|Sew for/, "the plan is encrypted at rest");
  assert.deepEqual(Object.keys((await db.doc("users/u_ada").get()).data()!).sort(), ["accountTier", "displayName", "role", "username"], "nothing is written on her profile");

  // The teen version: gentle always, a term or a year, no "life I refuse", learning links only.
  const t0 = await startInterview(db, "u_tia", tia, { length: 3 }, TODAY, NOW);
  assert.deepEqual([t0.messages[0].text, t0.gentle, t0.length, t0.target], [TEEN_OPENING, true, 3, 14]);
  assert.equal((await setGentle(db, "u_tia", tia, false, NOW)).gentle, true);
  await db.doc("aiConnections/u_tia").set({ uid: "u_tia", secret: encryptSecret("test-own-key-111111111111111111"), last4: "1111" });
  queue.push("[[SUMMARY]]\n- A\n- B\n- C\n- D\n- E");
  await interviewTurn(db, "u_tia", tia, { message: "Maths is hard.", gentle: false }, ai);
  assert.match(sys(sent[sent.length - 1]), /13 to 17/); assert.match(sys(sent[sent.length - 1]), /Never ask about money/);
  queue.push(JSON.stringify({ ...PLAN("2026-12-01", 3), months: PLAN("2026-12-01", 3).months.map((m) => ({ ...m, tool: "booking" })) }));
  const tw = await writePlan(db, "u_tia", tia, ai);
  assert.doesNotMatch(sys(sent[sent.length - 1]), /"refuse"/);
  assert.deepEqual([tw.plan.teen, tw.plan.refuse, tw.plan.months.length, tw.plan.months[0].tool], [true, "", 3, undefined]);

  // Write it myself: only a goal and one move are needed. Editing keeps the dates; starting fresh keeps the plan before it.
  await refused(savePlan(db, "u_bob", { teen: false }, { plan: { goal: "" } }, TODAY, NOW), 400);
  const b1 = await savePlan(db, "u_bob", { teen: false }, { plan: { goal: "Read 12 books", moves: ["Read 20 pages"] } }, TODAY, NOW);
  assert.deepEqual([b1.by, b1.start, b1.months.length], ["me", "2026-12-01", 12]);
  const b2 = await savePlan(db, "u_bob", { teen: false }, { plan: { goal: "Read 24 books", moves: ["Read 40 pages"] } }, "2027-03-10", new Date("2027-03-10T10:00:00Z"));
  assert.deepEqual([b2.goal, b2.start, b2.createdAt], ["Read 24 books", "2026-12-01", b1.createdAt]);
  const b3 = await savePlan(db, "u_bob", { teen: false }, { fresh: true, plan: { goal: "Run 5k", moves: ["Run"] } }, "2027-03-10", new Date("2027-03-10T10:00:00Z"));
  assert.equal(b3.start, "2027-04-01");
  assert.equal((await plannerView(db, "u_bob", { teen: false }, "2027-03-10")).old?.goal, "Read 24 books");

  // Ticks: on the day or a day gone, inside the plan, and the streak.
  await refused(tickMove(db, "u_ada", { i: 0, on: true }, TODAY, NOW), 400); // the plan hasn't started
  const D = "2026-12-08";
  await refused(tickMove(db, "u_ada", { day: "2026-12-09", i: 0, on: true }, D, NOW), 400);
  await refused(tickMove(db, "u_ada", { i: 9, on: true }, D, NOW), 400);
  for (const day of ["2026-12-06", "2026-12-07", D]) await tickMove(db, "u_ada", { day, i: 0, on: true }, D, NOW);
  const t1 = await tickMove(db, "u_ada", { i: 1, on: true }, D, NOW);
  assert.deepEqual(t1.view.moves.map((m) => m.done), [true, true, false]);
  assert.deepEqual((await tickMove(db, "u_ada", { i: 1, on: false }, D, NOW)).view.moves.map((m) => m.done), [true, false, false]);
  assert.doesNotMatch(JSON.stringify((await db.doc(`plannerDays/u_ada_${D}`).get()).data()), /true|false/, "ticks are encrypted too");
  const v2 = await plannerView(db, "u_ada", ada, D);
  assert.deepEqual([v2.streak, v2.day?.inPlan, v2.day?.month?.project, v2.day?.daysLeft], [3, true, "Project 1", 23]);
  const day = await plannerDay(db, "u_ada", D, D);
  assert.ok(day.has && day.canTick && day.tasks.length === 3 && day.view.moves[0].done);
  const ahead = await plannerDay(db, "u_ada", "2026-12-20", D);
  assert.ok(ahead.has && !ahead.canTick && ahead.tasks.length === 0);
  assert.equal((await plannerDay(db, "u_nobody2", D, D)).has, false);
  assert.equal((await tickTask(db, "u_ada", { i: 1, on: true }, NOW)).tasks[1].done, true);
  await refused(tickTask(db, "u_ada", { i: 5, on: true }, NOW), 400);
  assert.equal((await finishMonth(db, "u_ada", { month: "2026-12", on: true }, NOW)).months[0].finished, true);
  await refused(finishMonth(db, "u_ada", { month: "2028-12", on: true }, NOW), 400);

  // The Sunday review: from the plan's first Sunday; Nana's note (or ours); the numbers move on the plan.
  await refused(saveReview(db, "u_ada", ada, { answers: ["x"] }, "2026-12-05", at(new Date("2026-12-05T10:00:00Z"))), 400);
  const SUN = "2026-12-13";
  await tickMove(db, "u_ada", { day: "2026-12-09", i: 0, on: true }, SUN, NOW);
  queue.push("Four deposits in a week is the plan working.");
  const r1 = await saveReview(db, "u_ada", ada, { answers: ["Printed the price list.", "A rush job for a cousin.", "Deposit sign."], numbers: ["9", "₦40,000", ""], signs: [true] }, SUN, at(new Date("2026-12-13T17:00:00Z")));
  assert.deepEqual([r1.review.week, r1.review.ai, r1.review.note], [SUN, true, "Four deposits in a week is the plan working."]);
  assert.match(String(sent[sent.length - 1].messages[0].content), /Ticked on 3 of 7 days[\s\S]*Warning sign seen: A cousin asks/);
  assert.deepEqual(r1.plan.numbers.map((n) => n.now), ["9", "₦40,000", "20%"]);
  assert.deepEqual(r1.warnings, [{ sign: "A cousin asks", response: "Quote the deposit by message" }]);
  const v3 = await plannerView(db, "u_ada", ada, "2026-12-15");
  assert.deepEqual([v3.review?.week, v3.review?.done?.answers[0], v3.reviews.length, v3.plan?.numbers[0].now], [SUN, "Printed the price list.", 1, "9"]);
  assert.doesNotMatch(JSON.stringify((await db.doc(`plannerReviews/u_ada_${SUN}`).get()).data()), /cousin|deposit/i);
  // With Nana's note switched off, the note is ours and no AI is called.
  assert.equal((await savePrefs(db, "u_ada", { nanaNote: false, reviewBell: 19, movesBell: 99 }, NOW)).nanaNote, false);
  const r2 = await saveReview(db, "u_ada", ada, { answers: ["Again."] }, SUN, noAi);
  assert.equal(r2.review.ai, false); assert.match(r2.review.note ?? "", /3 days of 7/);

  // Her choices are kept beside the plan for the bells job; unknown values fall back.
  const p1 = (await plannerView(db, "u_ada", ada, SUN)).prefs;
  assert.deepEqual(p1, { movesBell: 7, reviewBell: 19, nanaNote: false, feedTitles: false, lock: false });
  const rawp = (await db.doc("plannerPlans/u_ada").get()).data()!;
  assert.deepEqual([rawp.movesBell, rawp.reviewBell, rawp.lock, rawp.has], [7, 19, false, true]);

  // My Calendar: the month's project on its last day and the Sunday reviews, as the Plan kind; the feed says only "Planner".
  const cal = await gatherCalendar(db, "u_ada", { from: "2026-12-01", to: "2026-12-31" }, { now: NOW });
  const plans = cal.entries.filter((e) => e.kind === "plan");
  assert.deepEqual(cal.failed, []);
  assert.deepEqual(plans.map((e) => e.id), ["plan:review:2026-12-06", "plan:review:2026-12-13", "plan:review:2026-12-20", "plan:review:2026-12-27", "plan:month:2026-12"]);
  assert.equal(plans[4].title, "Finished: Project 1"); assert.equal(plans[0].start, "2026-12-06T18:00:00.000Z", "her 7 PM review hour");
  assert.ok(plans.every((e) => e.feedTitle === FEED_TITLE));
  assert.equal((await gatherCalendar(db, "kid_k1", { from: "2026-12-01", to: "2026-12-31" }, { now: NOW })).entries.length, 0);
  // The private feed leaves the plan out until she turns it on, and carries real titles only if she chose them.
  const link = await newLink(db, "u_ada", NOW);
  const token = link.https!.split("/").pop()!.replace(/\.ics$/, "");
  assert.doesNotMatch((await feedFor(db, token, new Date("2026-12-01T10:00:00Z")))!, /Planner|Project 1/);
  await saveCalPrefs(db, "u_ada", { feed: { plan: true } }, NOW);
  const feed1 = (await feedFor(db, token, new Date("2026-12-01T10:00:00Z")))!;
  assert.match(feed1, /SUMMARY:Planner/); assert.doesNotMatch(feed1, /Project 1|Sunday review/);
  await savePrefs(db, "u_ada", { feedTitles: true }, NOW);
  assert.match((await feedFor(db, token, new Date("2026-12-01T10:00:00Z")))!, /SUMMARY:Finished: Project 1/);

  // The bells: today's moves from her hour on days inside the plan, once; the Sunday review from her hour when it isn't done, once.
  const bells: { uid: string; message: string; linkHref?: string }[] = [];
  const notify = async (n: { uid?: string; message: string; linkHref?: string }) => { bells.push({ uid: n.uid ?? "", message: n.message, linkHref: n.linkHref }); };
  assert.equal(await plannerBells(db, new Date("2026-11-20T08:00:00Z"), notify as never), 0, "no plan has started");
  assert.equal(await plannerBells(db, new Date("2026-12-08T05:30:00Z"), notify as never), 0, "6:30 AM in Lagos is before her hour");
  assert.equal(await plannerBells(db, new Date("2026-12-08T06:05:00Z"), notify as never), 2, "Ada and Tia, once each; Bob's new plan starts in April");
  assert.equal(await plannerBells(db, new Date("2026-12-08T09:00:00Z"), notify as never), 0);
  assert.ok(bells.every((b) => b.message === MOVES_BELL_TEXT && b.linkHref === "/calendar"));
  bells.length = 0;
  await plannerBells(db, new Date("2026-12-20T18:10:00Z"), notify as never); // a Sunday, 7:10 PM in Lagos
  assert.deepEqual(bells.filter((b) => b.uid === "u_ada").map((b) => b.message).sort(), [MOVES_BELL_TEXT, REVIEW_BELL_TEXT].sort());
  assert.equal(bells.filter((b) => b.message === REVIEW_BELL_TEXT && b.uid === "u_tia").length, 1, "Tia's default 5 PM has passed too");
  bells.length = 0;
  await plannerBells(db, new Date("2026-12-20T19:10:00Z"), notify as never);
  assert.equal(bells.length, 0, "each bell once");
  await savePrefs(db, "u_tia", { movesBell: 0, reviewBell: 0 }, NOW);
  await plannerBells(db, new Date("2026-12-27T19:10:00Z"), notify as never);
  assert.equal(bells.filter((b) => b.uid === "u_tia").length, 0, "switched off");

  // The optional lock: with it on, every request needs her fresh unlock, and the plan leaves the calendar and the feed.
  const tok = issueUnlock("u_ada", NOW);
  assert.equal(checkUnlock(tok, "u_ada", NOW), NOW.getTime());
  assert.throws(() => checkUnlock(tok, "u_bob", NOW), PlannerError);
  assert.throws(() => checkUnlock(tok.slice(0, -2) + "xx", "u_ada", NOW), PlannerError);
  assert.throws(() => checkUnlock(tok, "u_ada", new Date(NOW.getTime() + UNLOCK_IDLE_MS + 1000)), PlannerError);
  assert.throws(() => checkUnlock(issueUnlock("u_ada", new Date(NOW.getTime() + UNLOCK_MAX_MS - 10_000), NOW.getTime()), "u_ada", new Date(NOW.getTime() + UNLOCK_MAX_MS + 1000)), PlannerError);
  await savePrefs(db, "u_ada", { lock: true }, NOW);
  assert.equal((await plannerStatus(db, "u_ada")).lock, true);
  await refused(enter(db, "u_ada", undefined, NOW), 423);
  await refused(enter(db, "u_ada", issueUnlock("u_bob", NOW), NOW), 423);
  assert.equal((await enter(db, "u_ada", tok, NOW)).since, NOW.getTime());
  assert.equal((await planCalendar(db, "u_ada", "2026-12-01", "2026-12-31")).length, 0);
  assert.doesNotMatch((await feedFor(db, token, new Date("2026-12-01T10:00:00Z")))!, /Planner|Project 1/);
  await savePrefs(db, "u_ada", { lock: false }, NOW);
  assert.equal((await enter(db, "u_ada", undefined, NOW)).since, null);

  // Download my plan, then Delete everything.
  const ex = await exportPlanner(db, "u_ada", NOW);
  assert.equal(ex.plan?.goal, "Earn ₦500,000 a month from tailoring."); assert.equal(ex.reviews.length, 1); assert.deepEqual(ex.ticks[D], [true, false, false]);
  assert.ok((await erasePlanner(db, "u_ada")) >= 6);
  for (const c of ["plannerPlans", "plannerDays", "plannerReviews"]) assert.equal((await db.collection(c).where("uid", "==", "u_ada").get()).size, 0);
  const gone = await plannerView(db, "u_ada", ada, TODAY);
  assert.deepEqual([gone.state, gone.streak, gone.reviews.length], ["none", 0, 0]);

  // Closing the account takes the Planner with it.
  await tickMove(db, "u_tia", { day: "2026-12-08", i: 0, on: true }, "2026-12-08", NOW);
  await eraseAccount(db, "u_tia");
  for (const c of ["plannerPlans", "plannerDays", "plannerReviews"]) assert.equal((await db.collection(c).where("uid", "==", "u_tia").get()).size, 0, c);

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
