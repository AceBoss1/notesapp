// Job interviews on NotesApp (the owner, 9 Nov 2026: "use the same schedule engine as booking to build a meeting link for the job
// interview"). A reviewer schedules an interview from an application's conversation: a date and a time (Africa/Lagos, like bookings:
// lib/booking-time.ts), a length, video or voice, and who interviews. The interview gets its own room in Messages, with the applicant and
// the interviewers, where they hold a group call: the link is that room, on NotesApp. The conversation shows it with a Join button,
// everyone gets a bell, and reminders a day and an hour before. Pure rules here; the server is lib/interviews-server.ts.
import { formatSlot, sessionStart, weekdayOf, WEEKDAYS } from "./booking-time";
import { GROUP_CALL_MAX } from "./group-calls";

export type InterviewMode = "video" | "audio";
export type InterviewStatus = "scheduled" | "cancelled";
export const INTERVIEW_MINUTES = [15, 20, 30, 45, 60, 90] as const;
export const INTERVIEW_MAX_DAYS = 60;
export const INTERVIEW_MIN_LEAD_MS = 30 * 60_000; // at least half an hour's notice
export const INTERVIEW_NOTE_MAX = 500;
// The room holds the applicant and the interviewers in one group call: up to 4 on video, 6 on voice (lib/group-calls.ts).
export const maxInterviewers = (mode: InterviewMode) => GROUP_CALL_MAX[mode] - 1;

export type Interview = {
  id: string; kind: "career" | "job"; applicationId: string; applicantUid: string; orgUid: string | null; org: string; title: string;
  date: string; time: string; minutes: number; mode: InterviewMode; startAt: string; endAt: string; roomId: string;
  interviewerUids: string[]; createdBy: string; status: InterviewStatus; note: string; createdAt: string;
};

export class InterviewError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function cleanInterview(b: Record<string, unknown>, now = new Date()) {
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : "";
  const time = typeof b.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time) ? b.time : "";
  if (!date || !time) throw new InterviewError("Choose the interview's date and time.");
  const minutes = Number(b.minutes);
  if (!(INTERVIEW_MINUTES as readonly number[]).includes(minutes)) throw new InterviewError(`Choose a length: ${INTERVIEW_MINUTES.join(", ")} minutes.`);
  const mode: InterviewMode = b.mode === "audio" ? "audio" : "video";
  const start = sessionStart(date, time);
  if (Number.isNaN(start.getTime())) throw new InterviewError("That date doesn't exist.");
  if (start.getTime() - now.getTime() < INTERVIEW_MIN_LEAD_MS) throw new InterviewError("Give the applicant at least half an hour's notice.");
  if (start.getTime() - now.getTime() > INTERVIEW_MAX_DAYS * 86_400_000) throw new InterviewError(`Interviews can be booked up to ${INTERVIEW_MAX_DAYS} days ahead.`);
  const note = typeof b.note === "string" ? b.note.replace(/\r\n/g, "\n").trim().slice(0, INTERVIEW_NOTE_MAX) : "";
  return { date, time, minutes, mode, note, startAt: start.toISOString(), endAt: new Date(start.getTime() + minutes * 60_000).toISOString() };
}

// "Tuesday 10 November 2026, 10:00 AM to 10:30 AM (WAT)"
export function interviewWhen(i: Pick<Interview, "date" | "time" | "minutes">): string {
  const [y, m, d] = i.date.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const end = new Date(sessionStart(i.date, i.time).getTime() + i.minutes * 60_000);
  const endSlot = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
  return `${WEEKDAYS[weekdayOf(i.date)]} ${d} ${month} ${y}, ${formatSlot(i.time)} to ${formatSlot(endSlot)} (WAT)`;
}

export const interviewMessage = (i: Pick<Interview, "date" | "time" | "minutes" | "mode" | "note">, link: string) =>
  `Interview booked: ${interviewWhen(i)}, a ${i.mode} call on NotesApp. Join here when it's time: ${link}${i.note ? `\n\n${i.note}` : ""}`;

// Reminders: a day before and an hour before (each once).
export function reminderDue(i: Pick<Interview, "startAt" | "status">, sent: { day?: boolean; hour?: boolean }, now: Date): "day" | "hour" | null {
  if (i.status !== "scheduled") return null;
  const left = Date.parse(i.startAt) - now.getTime();
  if (left <= 0) return null;
  if (left <= 3_600_000 && !sent.hour) return "hour";
  if (left <= 86_400_000 && left > 3_600_000 && !sent.day) return "day";
  return null;
}
