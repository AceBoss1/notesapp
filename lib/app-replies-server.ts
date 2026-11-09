import type { Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { canManageTeam, type Access } from "./admin-access";
import { notifyBell } from "./email";
import { gemModel, realDeps, runAi, type NanaDeps } from "./nana-server";
import { memberTier, type Meter } from "./nana-meter";
import { hiringTeamFor } from "./jobs-server";
import { SCREEN_SYSTEM } from "./careers-server";
import {
  INTENT_MAX, REPLIES_MAX, REPLY_DRAFT_SYSTEM, cleanReplyText, draftPrompt, isSendAs, senderLabel,
  type AppKind, type Reply, type ReplyFrom,
} from "./app-replies";
import type { Interview } from "./interviews";

// Replies on job applications (lib/app-replies.ts has the rules). appReplies/{id} (server only; TTL on expireAt, 12 months): one message
// in an application's thread. Reviewers: for #NotesApp's own roles, super admins and the Chief of Staff (canManageTeam); for a Notes Jobs
// application, the organisation's hiring team: the organisation, its admins and its writers (jobs-server hiringTeamFor). The applicant is the person who applied.

export class RepliesError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const COLL = "appReplies";
const KEEP_DAYS = 365;
export type Viewer = { uid: string; access?: Access | null };
export type Ctx = {
  kind: AppKind; appId: string; applicantUid: string; applicantName: string; org: string; orgUid: string | null; title: string; status: string;
  reviewer: boolean; bellType: "team" | "job"; reviewerUid: string | null;
};
const safeId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(v);
const isKind = (v: unknown): v is AppKind => v === "career" || v === "job";
const standInAllowed = () => !!setting("NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST");

export async function context(db: Firestore, v: Viewer, kind: unknown, appId: unknown): Promise<Ctx> {
  if (!isKind(kind) || !safeId(appId)) throw new RepliesError("Which application?");
  if (kind === "career") {
    const a = (await db.doc(`careerApplications/${appId}`).get()).data();
    if (!a) throw new RepliesError("That application isn't there any more.", 404);
    const reviewer = !!v.access && canManageTeam(v.access);
    if (!reviewer && a.uid !== v.uid) throw new RepliesError("Only the applicant and the hiring team can see this.", 403);
    return { kind, appId, applicantUid: String(a.uid), applicantName: String(a.name ?? ""), org: "#NotesApp", orgUid: null, title: String(a.roleTitle ?? "the role"), status: String(a.status ?? ""), reviewer, bellType: "team", reviewerUid: a.decidedBy ? String(a.decidedBy) : null };
  }
  const a = (await db.doc(`jobApplications/${appId}`).get()).data();
  if (!a) throw new RepliesError("That application isn't there any more.", 404);
  let reviewer = false;
  if (a.uid !== v.uid) {
    await hiringTeamFor(db, { uid: v.uid }, a.orgUid).catch(() => { throw new RepliesError("Only the applicant and the organisation's hiring team can see this.", 403); });
    reviewer = true;
  }
  const org = (await db.doc(`users/${a.orgUid}`).get()).data() ?? {};
  return { kind, appId, applicantUid: String(a.uid), applicantName: String(a.name ?? ""), org: String(org.displayName || org.username || "The organisation"), orgUid: String(a.orgUid), title: String(a.jobTitle ?? "the job"), status: String(a.status ?? ""), reviewer, bellType: "job", reviewerUid: String(a.orgUid) };
}

const toReply = (id: string, d: FirebaseFirestore.DocumentData, forReviewer: boolean): Reply => ({
  id, kind: d.kind, applicationId: String(d.applicationId), from: d.from as ReplyFrom, text: String(d.text ?? ""), createdAt: String(d.createdAt ?? ""),
  label: String(d.label ?? ""),
  // The applicant sees @username only on a reply sent as a person; who pressed send on an HR or Nana-HR reply stays with the reviewers.
  ...(d.byUsername && (forReviewer || d.from === "me") ? { byUsername: String(d.byUsername) } : {}),
});

export async function listReplies(db: Firestore, v: Viewer, kind: unknown, appId: unknown): Promise<{ replies: Reply[]; reviewer: boolean; org: string; username: string; interviews: Interview[] }> {
  const c = await context(db, v, kind, appId);
  const snap = await db.collection(COLL).where("kind", "==", c.kind).where("applicationId", "==", c.appId).get();
  const replies = snap.docs.map((d) => toReply(d.id, d.data(), c.reviewer)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const me = c.reviewer ? (await db.doc(`users/${v.uid}`).get()).data() : null;
  const interviews = await (await import("./interviews-server")).interviewsFor(db, c.kind, c.appId); // loaded here: it imports this file
  return { replies, reviewer: c.reviewer, org: c.org, username: String(me?.username ?? ""), interviews };
}

export async function sendReply(db: Firestore, v: Viewer, input: { kind?: unknown; id?: unknown; as?: unknown; text?: unknown }, now = new Date()): Promise<Reply> {
  const c = await context(db, v, input.kind, input.id);
  const text = cleanReplyText(input.text);
  if (!text) throw new RepliesError("Write your message first.");
  const count = (await db.collection(COLL).where("kind", "==", c.kind).where("applicationId", "==", c.appId).count().get()).data().count;
  if (count >= REPLIES_MAX) throw new RepliesError("This conversation is full. Carry on by message or email.", 409);
  let from: ReplyFrom, byUsername = "";
  if (c.reviewer) {
    if (!isSendAs(input.as)) throw new RepliesError("Choose who it's from: HR, Nana-HR or you.");
    from = input.as;
    byUsername = String((await db.doc(`users/${v.uid}`).get()).data()?.username ?? "");
    if (from === "me" && !byUsername) throw new RepliesError("Set a username on your profile to reply as yourself, or reply as HR.");
  } else {
    from = "applicant";
  }
  const label = senderLabel(from, c.org, byUsername, c.applicantName);
  const ref = db.collection(COLL).doc();
  const doc = {
    kind: c.kind, applicationId: c.appId, applicantUid: c.applicantUid, orgUid: c.orgUid, from, text, label, byUid: v.uid,
    ...(byUsername ? { byUsername } : {}), createdAt: now.toISOString(), expireAt: new Date(now.getTime() + KEEP_DAYS * 86_400_000),
  };
  await ref.set(doc);
  await db.doc(`${c.kind === "career" ? "careerApplications" : "jobApplications"}/${c.appId}`).update({ lastReplyAt: now.toISOString(), lastReplyFrom: from === "applicant" ? "applicant" : "team" }).catch(() => {});
  if (c.reviewer) {
    await notifyBell({ uid: c.applicantUid, type: c.bellType, linkHref: "/profile/applications", message: `${label} replied about your application for ${c.title}.` }).catch(() => {});
  } else if (c.reviewerUid) {
    await notifyBell({ uid: c.reviewerUid, type: c.bellType, linkHref: c.kind === "career" ? "/admin/team/hr" : "/profile/jobs", message: `${c.applicantName || "An applicant"} replied about ${c.title}.` }).catch(() => {});
  }
  return toReply(ref.id, doc, c.reviewer);
}

// A reply drafted by Nana-HR from the reviewer's instruction, for them to read, edit and send. Nothing is sent or saved here.
export async function draftReply(db: Firestore, v: Viewer, input: { kind?: unknown; id?: unknown; intent?: unknown }, deps: NanaDeps = realDeps()): Promise<{ draft: string }> {
  const c = await context(db, v, input.kind, input.id);
  if (!c.reviewer) throw new RepliesError("Only the hiring team can ask Nana-HR for a draft.", 403);
  const intent = cleanReplyText(input.intent, INTENT_MAX);
  if (!intent) throw new RepliesError("Tell Nana-HR what to say, like \"invite them to a 30-minute call on Tuesday at 10am\".");
  const snap = await db.collection(COLL).where("kind", "==", c.kind).where("applicationId", "==", c.appId).get();
  const thread = snap.docs.map((d) => d.data()).sort((a, b) => (String(a.createdAt) < String(b.createdAt) ? -1 : 1)).map((d) => ({ from: String(d.label), text: String(d.text) }));
  const I = await import("./interviews-server");
  const { interviewWhen } = await import("./interviews");
  const interviews = (await I.interviewsFor(db, c.kind, c.appId)).filter((i) => i.status === "scheduled" && i.endAt > new Date().toISOString())
    .map((i) => ({ when: interviewWhen(i), link: I.roomLink(i.roomId) }));
  const content = draftPrompt({ org: c.org, title: c.title, applicantName: c.applicantName, status: c.status, intent, thread, interviews });
  const now = deps.now();
  // Our own roles: the team's allowance (like Nana-HR's summaries). A firm: the reviewer's own Nana allowance.
  const meter: Meter | undefined = c.kind === "job" ? { uid: v.uid, tier: await memberTier(db, v.uid), gem: "pearl", effort: "low" } : undefined;
  const ran = await runAi(db, deps, now, v.uid, { system: [{ type: "text", text: REPLY_DRAFT_SYSTEM }], messages: [{ role: "user", content }], maxTokens: 400, model: gemModel("pearl"), effort: "low" }, 200, meter);
  if (!ran.completion) {
    if (standInAllowed() && !ran.notice) return { draft: `Hello ${c.applicantName.split(" ")[0] || "there"}, thank you for applying for ${c.title}. (Stand-in draft: no AI key here.) ${intent}` };
    throw new RepliesError(ran.notice ?? "Nana-HR couldn't draft that just now. Write it yourself, or try again later.", 503);
  }
  if (ran.completion.refused || !ran.completion.text.trim()) throw new RepliesError("Nana-HR couldn't draft that one. Please write it yourself.", 422);
  return { draft: ran.completion.text.trim().slice(0, 2_000) };
}

// When an application goes (its role or job deleted, the account erased), its conversation goes with it.
export async function deleteRepliesFor(db: Firestore, kind: AppKind, appIds: string[]): Promise<number> {
  let n = 0;
  for (const id of appIds) {
    const snap = await db.collection(COLL).where("kind", "==", kind).where("applicationId", "==", id).get();
    for (const d of snap.docs) { await d.ref.delete(); n++; }
    const ivs = await db.collection("interviews").where("applicationId", "==", id).get(); // its interview bookings too (the rooms stay in Messages)
    for (const d of ivs.docs) if (d.data().kind === kind) await d.ref.delete();
  }
  return n;
}

// Nana-HR's screening summary of a Notes Jobs application, for the firm's hiring team (the team hub has the same for #NotesApp's own
// roles): each stated requirement met, not met or unclear, with the applicant's own words. No ranking, scoring or recommendation
// (careers-server SCREEN_SYSTEM). Paid from the reviewer's Nana allowance; kept on the application, never shown to the applicant.
export async function summariseJobApplication(db: Firestore, v: Viewer, appId: unknown, deps: NanaDeps = realDeps()): Promise<{ text: string; at: string }> {
  if (!safeId(appId)) throw new RepliesError("Which application?");
  const ref = db.doc(`jobApplications/${appId}`);
  const a = (await ref.get()).data();
  if (!a) throw new RepliesError("That application isn't there any more.", 404);
  await hiringTeamFor(db, { uid: v.uid }, a.orgUid).catch(() => { throw new RepliesError("Only the organisation's hiring team can do that.", 403); });
  const job = (await db.doc(`jobs/${a.jobId}`).get()).data();
  if (!job) throw new RepliesError("That job isn't there any more.", 404);
  const user = `ROLE: ${job.title}\nREQUIREMENTS:\n${(job.requirements as string[]).map((r) => `- ${r}`).join("\n")}\n\nAPPLICATION (from the applicant, as written):\nCity: ${a.city || "not given"}\nLinks: ${((a.links as string[]) ?? []).join(", ") || "none"}\nWhy this job and what they'd bring:\n${a.coverNote}`;
  const now = deps.now();
  const meter: Meter = { uid: v.uid, tier: await memberTier(db, v.uid), gem: "pearl", effort: "low" };
  const ran = await runAi(db, deps, now, v.uid, { system: [{ type: "text", text: SCREEN_SYSTEM }], messages: [{ role: "user", content: user }], maxTokens: 900, model: gemModel("pearl"), effort: "low" }, 200, meter);
  let text = "";
  if (ran.completion && !ran.completion.refused && ran.completion.text.trim()) text = ran.completion.text.trim().slice(0, 4000);
  else if (!ran.completion && standInAllowed() && !ran.notice) text = (job.requirements as string[]).map((r) => `${r}: Unclear (stand-in summary: no AI key here)`).join("\n");
  else throw new RepliesError(ran.notice ?? "Nana-HR couldn't write a summary just now. Try again later.", 503);
  const summary = { text, at: now.toISOString() };
  await ref.update({ summary });
  return summary;
}

