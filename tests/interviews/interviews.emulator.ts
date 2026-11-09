// Job interviews on the Firestore emulator (lib/interviews-server.ts): the hiring team books an interview with its own NotesApp room;
// the conversation carries the link; interviewers must be on the hiring team; blocks are respected; reminders go once; Nana-HR's drafts
// get the real link and nothing else. Run: npm run test:interviews → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const I = await import("../../lib/interviews-server");
  const R = await import("../../lib/app-replies-server");
  const J = await import("../../lib/jobs-server");
  const { InterviewError } = await import("../../lib/interviews");
  const refused = async (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => (e instanceof InterviewError || e instanceof R.RepliesError) && (e as { status: number }).status === status);
  const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => String(d.data().message));
  const now = new Date("2026-11-09T09:00:00Z");

  await db.doc("users/org").set({ username: "acme", displayName: "Acme Ltd", accountKind: "organisation", org: { rcStatus: "verified" }, accountTier: "business" });
  for (const [u, n] of [["hr1", "ada"], ["hr2", "wole"], ["nohr", "tunde"], ["bola", "bola"], ["x1", "chi"], ["x2", "dayo"], ["x3", "efe"]]) await db.doc(`users/${u}`).set({ username: n, displayName: n[0].toUpperCase() + n.slice(1), accountTier: "pro" });
  for (const u of ["hr1", "hr2", "x1", "x2", "x3"]) await db.doc(`orgMembers/org_${u}`).set({ orgUid: "org", memberUid: u, role: "writer", hr: true });
  await db.doc("orgMembers/org_nohr").set({ orgUid: "org", memberUid: "nohr", role: "admin" });
  const job = await J.postJob(db, { uid: "hr1" }, "org", { title: "Community manager", summary: "Grow our communities across Lagos", requirements: ["Communities"], type: "full_time", mode: "onsite", city: "Lagos" });
  const app = await J.applyToJob(db, { uid: "bola" }, job.id, { coverNote: "I have run communities for a church of 2,000 people and a creators' group, and I love it.", consent: true });
  const base = { kind: "job", id: app.id, date: "2026-11-10", time: "10:00", minutes: 30, mode: "video" };

  // only the hiring team books, and only hiring-team members interview
  await refused(I.scheduleInterview(db, { uid: "bola" }, base, now), 403);
  await refused(I.scheduleInterview(db, { uid: "nohr" }, base, now), 403);
  await refused(I.scheduleInterview(db, { uid: "hr1" }, { ...base, interviewers: "@tunde" }, now), 403);
  await refused(I.scheduleInterview(db, { uid: "hr1" }, { ...base, interviewers: "@wole @chi @dayo" }, now), 400); // 4 interviewers on video
  await refused(I.scheduleInterview(db, { uid: "hr1" }, { ...base, interviewers: "@nobody" }, now), 404);

  const iv = await I.scheduleInterview(db, { uid: "hr1" }, { ...base, interviewers: "@wole", note: "Bring a sample post." }, now);
  // the room: the applicant and both interviewers, a group in Messages
  const room = (await db.doc(`conversations/${iv.roomId}`).get()).data()!;
  assert.equal(room.kind, "group"); assert.deepEqual([...room.participants].sort(), ["bola", "hr1", "hr2"]);
  assert.match(room.title, /^Interview: Community manager · Acme Ltd/);
  // the application moved to Interview; the conversation carries the booking and the NotesApp link; everyone heard
  assert.equal((await db.doc(`jobApplications/${app.id}`).get()).data()!.status, "interview");
  const list = await R.listReplies(db, { uid: "bola" }, "job", app.id);
  assert.equal(list.interviews.length, 1);
  assert.match(list.replies[0].text, new RegExp(`Interview booked: Tuesday 10 November 2026, 10:00 AM to 10:30 AM \\(WAT\\), a video call on NotesApp\\. Join here when it's time: https://.+/messages/${iv.roomId}\\n\\nBring a sample post\\.`));
  assert.ok((await bells("bola")).some((m) => m.includes("replied about your application")));
  assert.ok((await bells("hr2")).some((m) => m.includes("You're interviewing Bola for Community manager")));

  // Nana-HR's draft is given the real link (and her rules forbid any other)
  let prompt = "";
  const deps = { now: () => now, complete: async (a: { system: { text: string }[]; messages: { content: string }[] }) => { prompt = a.system[0].text + a.messages[0].content; return { text: "See you Tuesday.", refused: false }; } };
  await R.draftReply(db, { uid: "hr2" }, { kind: "job", id: app.id, intent: "remind them of the call and send the meeting link" }, deps as never);
  assert.ok(prompt.includes(`/messages/${iv.roomId}`) && prompt.includes("Never invent a link"));

  // a blocked interviewer can't be put in a room with the applicant
  await db.doc("dmBlocks/bola_x1").set({ at: "x" });
  await refused(I.scheduleInterview(db, { uid: "hr1" }, { ...base, date: "2026-11-11", interviewers: "@chi" }, now), 403);

  // reminders: a day before, then an hour before, each once, to everyone
  assert.equal(await I.sendInterviewReminders(db, new Date("2026-11-09T08:00:00Z")), 0, "more than a day ahead");
  assert.equal(await I.sendInterviewReminders(db, new Date("2026-11-09T10:00:00Z")), 3, "a day before: the applicant and two interviewers");
  assert.equal(await I.sendInterviewReminders(db, new Date("2026-11-09T11:00:00Z")), 0, "once");
  assert.equal(await I.sendInterviewReminders(db, new Date("2026-11-10T08:10:00Z")), 3, "an hour before");
  assert.ok((await bells("bola")).some((m) => m.startsWith("Interview in an hour: Community manager at Acme Ltd")));

  // cancelling: the hiring team only; the applicant is told in the conversation
  await refused(I.cancelInterview(db, { uid: "bola" }, iv.id, now), 403);
  await I.cancelInterview(db, { uid: "hr2" }, iv.id, now);
  assert.equal((await db.doc(`interviews/${iv.id}`).get()).data()!.status, "cancelled");
  assert.ok((await R.listReplies(db, { uid: "bola" }, "job", app.id)).replies.some((r) => r.text.startsWith("The interview on Tuesday 10 November 2026")));
  assert.equal(await I.sendInterviewReminders(db, new Date("2026-11-10T08:40:00Z")), 0, "no reminders for a cancelled interview");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
