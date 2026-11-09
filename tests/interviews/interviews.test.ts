// Job interviews, the pure rules (lib/interviews.ts). Run: npm run test:interviews → "ALL OK" (twice).
import assert from "node:assert/strict";
import { InterviewError, cleanInterview, interviewMessage, interviewWhen, maxInterviewers, reminderDue } from "../../lib/interviews";

const now = new Date("2026-11-09T09:00:00Z"); // 10:00 Lagos, Monday
const ok = cleanInterview({ date: "2026-11-10", time: "10:00", minutes: 30, mode: "video" }, now);
assert.equal(ok.startAt, "2026-11-10T09:00:00.000Z", "Lagos time, like bookings");
assert.equal(ok.endAt, "2026-11-10T09:30:00.000Z");
assert.equal(interviewWhen(ok), "Tuesday 10 November 2026, 10:00 AM to 10:30 AM (WAT)");
assert.match(interviewMessage(ok, "https://app.example/messages/interview_x"), /^Interview booked: Tuesday 10 November 2026, 10:00 AM to 10:30 AM \(WAT\), a video call on NotesApp\. Join here when it's time: https:\/\/app\.example\/messages\/interview_x$/);
assert.throws(() => cleanInterview({ date: "2026-11-09", time: "10:15", minutes: 30 }, now), InterviewError, "less than half an hour's notice");
assert.throws(() => cleanInterview({ date: "2027-03-01", time: "10:00", minutes: 30 }, now), InterviewError, "more than 60 days ahead");
assert.throws(() => cleanInterview({ date: "2026-11-10", time: "10:00", minutes: 25 }, now), InterviewError, "a set length");
assert.throws(() => cleanInterview({ date: "2026-11-10", time: "25:00", minutes: 30 }, now), InterviewError);
assert.equal(cleanInterview({ date: "2026-11-10", time: "10:00", minutes: 30, mode: "audio" }, now).mode, "audio");
assert.equal(maxInterviewers("video"), 3); assert.equal(maxInterviewers("audio"), 5);

const i = { startAt: "2026-11-10T09:00:00.000Z", status: "scheduled" as const };
assert.equal(reminderDue(i, {}, new Date("2026-11-09T08:00:00Z")), null, "more than a day ahead");
assert.equal(reminderDue(i, {}, new Date("2026-11-09T10:00:00Z")), "day");
assert.equal(reminderDue(i, { day: true }, new Date("2026-11-09T10:00:00Z")), null, "once");
assert.equal(reminderDue(i, { day: true }, new Date("2026-11-10T08:15:00Z")), "hour");
assert.equal(reminderDue(i, { day: true, hour: true }, new Date("2026-11-10T08:30:00Z")), null);
assert.equal(reminderDue({ ...i, status: "cancelled" }, {}, new Date("2026-11-10T08:30:00Z")), null);
assert.equal(reminderDue(i, {}, new Date("2026-11-10T09:05:00Z")), null, "already started");
console.log("ALL OK");
