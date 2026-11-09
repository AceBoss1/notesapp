import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { accessFromClaims } from "./admin-access";
import { notifyBell } from "./email";
import { APP_URL } from "./host";
import { context, sendReply, type Viewer } from "./app-replies-server";
import { InterviewError, cleanInterview, interviewMessage, interviewWhen, maxInterviewers, reminderDue, type Interview } from "./interviews";

// Job interviews (lib/interviews.ts). interviews/{id} (server only): the booking. Its room is a group conversation the server creates
// (conversations/interview_<id>) with the applicant and the interviewers: applying for the job is the applicant's agreement to be
// contacted about it, so the room skips the follow check new groups have, but never adds someone who blocked an interviewer or whose
// account is suspended. The group call in the room is the interview (up to 4 people on video, 6 on voice).

const COLL = "interviews";
export const roomLink = (roomId: string) => `${APP_URL}/messages/${roomId}`;
const toInterview = (id: string, d: FirebaseFirestore.DocumentData) => ({ ...(d as Omit<Interview, "id">), id }) as Interview;

// Who may interview: on our own roles, staff; on Notes Jobs, the organisation account or an HR member of its team.
async function mayInterview(db: Firestore, kind: "career" | "job", orgUid: string | null, uid: string): Promise<boolean> {
  if (kind === "career") {
    const u = await getAuth(getAdminApp()).getUser(uid).catch(() => null);
    return !!accessFromClaims((u?.customClaims ?? null) as Record<string, unknown> | null);
  }
  if (!orgUid) return false;
  if (uid === orgUid) return true;
  return (await db.doc(`orgMembers/${orgUid}_${uid}`).get()).data()?.hr === true;
}

export async function scheduleInterview(
  db: Firestore, v: Viewer, input: { kind?: unknown; id?: unknown; date?: unknown; time?: unknown; minutes?: unknown; mode?: unknown; note?: unknown; interviewers?: unknown },
  now = new Date(),
): Promise<Interview> {
  const c = await context(db, v, input.kind, input.id);
  if (!c.reviewer) throw new InterviewError("Only the hiring team can book an interview.", 403);
  if (c.status === "withdrawn") throw new InterviewError("The applicant withdrew this application.", 409);
  const clean = cleanInterview(input as Record<string, unknown>, now);
  // The interviewers: the person booking, and up to two or four more by @username, each of whom must be on the hiring team.
  const names = (Array.isArray(input.interviewers) ? input.interviewers : typeof input.interviewers === "string" ? input.interviewers.split(/[\s,]+/) : [])
    .map((x) => String(x).replace(/^@/, "").trim().toLowerCase()).filter(Boolean);
  const uids = [v.uid];
  for (const name of Array.from(new Set(names))) {
    const q = await db.collection("users").where("username", "==", name).limit(1).get();
    const u = q.docs[0];
    if (!u) throw new InterviewError(`There's no @${name} on NotesApp.`, 404);
    if (u.id === c.applicantUid) continue;
    if (!(await mayInterview(db, c.kind, c.orgUid, u.id))) throw new InterviewError(`@${name} isn't on the hiring team${c.kind === "job" ? " (the owner puts people in HR on the team page)" : ""}.`, 403);
    if (!uids.includes(u.id)) uids.push(u.id);
  }
  if (uids.length > maxInterviewers(clean.mode)) throw new InterviewError(`A ${clean.mode} interview holds ${maxInterviewers(clean.mode)} interviewers and the applicant.`);
  // Never put the applicant in a room with someone they blocked, or a suspended account.
  const applicant = (await db.doc(`users/${c.applicantUid}`).get()).data();
  if (!applicant || applicant.suspended === true) throw new InterviewError("The applicant's account isn't available.", 404);
  for (const u of uids) if ((await db.doc(`dmBlocks/${c.applicantUid}_${u}`).get()).exists) throw new InterviewError("The applicant can't be added to a room with one of the interviewers.", 403);

  const ref = db.collection(COLL).doc();
  const roomId = `interview_${ref.id}`;
  const everyone = [...uids, c.applicantUid];
  const createdAt = now.toISOString();
  const title = `Interview: ${c.title} · ${c.org}`.slice(0, 80);
  await db.doc(`conversations/${roomId}`).set({
    kind: "group", scope: "public", title, participants: everyone, adminUids: uids, createdBy: v.uid, createdAt, lastMessageAt: createdAt,
    unread: Object.fromEntries(everyone.map((u) => [u, 0])), interviewId: ref.id,
  });
  const doc: Omit<Interview, "id"> & { reminders: { day: boolean; hour: boolean } } = {
    kind: c.kind, applicationId: c.appId, applicantUid: c.applicantUid, orgUid: c.orgUid, org: c.org, title: c.title, ...clean, roomId,
    interviewerUids: uids, createdBy: v.uid, status: "scheduled", createdAt, reminders: { day: false, hour: false },
  };
  await ref.set(doc);
  // The application moves to Interview (if it was earlier), and the conversation carries the booking and its link.
  const appRef = db.doc(`${c.kind === "career" ? "careerApplications" : "jobApplications"}/${c.appId}`);
  if (c.status === "new" || c.status === "reviewing") await appRef.update({ status: "interview", updatedAt: createdAt });
  await sendReply(db, v, { kind: c.kind, id: c.appId, as: "hr", text: interviewMessage(clean, roomLink(roomId)) }, now);
  for (const u of uids.filter((x) => x !== v.uid)) {
    await notifyBell({ uid: u, type: c.bellType, linkHref: `/messages/${roomId}`, message: `You're interviewing ${c.applicantName || "an applicant"} for ${c.title}: ${interviewWhen(clean)}.` }).catch(() => {});
  }
  return toInterview(ref.id, doc);
}

export async function cancelInterview(db: Firestore, v: Viewer, interviewId: unknown, now = new Date()): Promise<void> {
  if (typeof interviewId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(interviewId)) throw new InterviewError("Which interview?");
  const ref = db.doc(`${COLL}/${interviewId}`);
  const i = (await ref.get()).data() as Interview | undefined;
  if (!i) throw new InterviewError("That interview isn't there any more.", 404);
  const c = await context(db, v, i.kind, i.applicationId);
  if (!c.reviewer) throw new InterviewError("Only the hiring team can cancel an interview.", 403);
  if (i.status === "cancelled") return;
  await ref.update({ status: "cancelled", cancelledAt: now.toISOString(), cancelledBy: v.uid });
  await sendReply(db, v, { kind: i.kind, id: i.applicationId, as: "hr", text: `The interview on ${interviewWhen(i)} is cancelled. We'll be in touch.` }, now);
}

export async function interviewsFor(db: Firestore, kind: "career" | "job", applicationId: string): Promise<Interview[]> {
  const s = await db.collection(COLL).where("applicationId", "==", applicationId).get();
  return s.docs.map((d) => toInterview(d.id, d.data())).filter((i) => i.kind === kind).sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
}

// Every 15 minutes (app/api/cron/reminders): a bell to the applicant and the interviewers a day before and an hour before.
export async function sendInterviewReminders(db: Firestore, now = new Date()): Promise<number> {
  const until = new Date(now.getTime() + 25 * 3_600_000).toISOString();
  const s = await db.collection(COLL).where("status", "==", "scheduled").where("startAt", ">", now.toISOString()).where("startAt", "<=", until).get();
  let n = 0;
  for (const d of s.docs) {
    const i = toInterview(d.id, d.data());
    const sent = (d.data().reminders ?? {}) as { day?: boolean; hour?: boolean };
    const due = reminderDue(i, sent, now);
    if (!due) continue;
    await d.ref.update({ [`reminders.${due}`]: true, ...(due === "hour" ? { "reminders.day": true } : {}) });
    const when = due === "hour" ? "in an hour" : "tomorrow";
    for (const u of [i.applicantUid, ...i.interviewerUids]) {
      await notifyBell({ uid: u, type: i.kind === "career" ? "team" : "job", linkHref: `/messages/${i.roomId}`, message: `Interview ${when}: ${i.title} at ${i.org}, ${interviewWhen(i)}. Join in Messages.` }).catch(() => {});
      n++;
    }
  }
  return n;
}
