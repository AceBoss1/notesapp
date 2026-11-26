import type { Firestore } from "firebase-admin/firestore";
import { canReviewHiring } from "./admin-access";
import { APP_STATUS_LABEL, isAppStatus } from "./careers";
import { JOB_APP_STATUS_LABEL, isJobAppStatus } from "./jobs";
import { hiringTeamFor } from "./jobs-server";
import { RepliesError, context, draftReply, listReplies, markHrRead, sendReply, type Viewer } from "./app-replies-server";
import { filterRows, isHrInboxFilter, sortRows, threadSummary, type HrInboxFilter, type HrInboxRow } from "./hr-inbox";

// The #Nana-HR inboxes: every conversation on a hiring team's applications in one list, newest activity first.
//   - Admin → #Nana-HR inbox (app/(main)/admin/hr-inbox, /api/admin/hr-inbox). Owner, 26 Nov 2026: "Admin → #Nana-HR inbox: HR reads and
//     answers replies there." Applications to #NotesApp's own roles (appReplies with kind "career"), for whoever reviews hiring
//     (lib/admin-access.ts canReviewHiring: super admins, the Chief of Staff and People & HR). Never a firm's conversation.
//   - A firm's #Nana-HR inbox (app/(main)/profile/jobs/hr-inbox, /api/jobs/hr-inbox). Owner, 26 Nov 2026: "applications to other firms'
//     jobs stay with those firms. Who sees it: whoever already reviews firms' job applications, probably owner or admin they appoint
//     with hr privilege." That firm's Notes Jobs applications only (kind "job", orgUid = the firm), for its hiring team (jobs-server
//     hiringTeamFor: the organisation account and the team members its owner put in HR). Never another firm's or #NotesApp's.
// The scope is the firm's uid (org) or none (#NotesApp's careers). Nothing new is stored but the team's read stamp, hrReadAt/hrReadBy on
// the application (lib/app-replies-server.ts markHrRead): careerApplications and jobApplications are server-only and the applicant's own
// lists leave it out. Reading and answering go through the same functions as everywhere else (listReplies, sendReply, draftReply), so
// the permission check (context()), the sender labels and the bells are the same wherever HR answers from, and Nana-HR only drafts.

const LIST_MAX = 5_000; // replies read for the list; at REPLIES_MAX (200) a thread, this is far more than one team's hiring makes

type Scope = { kind: "career" } | { kind: "job"; orgUid: string };
const COLL = { career: "careerApplications", job: "jobApplications" } as const;

/** Who may open this inbox, and which one it is. No org: #NotesApp's careers (canReviewHiring). An org: that firm's hiring team. */
async function scopeFor(db: Firestore, v: Viewer, org: unknown): Promise<Scope> {
  if (org === undefined || org === null || org === "") {
    if (!canReviewHiring(v.access)) throw new RepliesError("Only super admins, the Chief of Staff and People & HR review applications to #NotesApp.", 403);
    return { kind: "career" };
  }
  const t = await hiringTeamFor(db, { uid: v.uid }, org).catch((e: { message?: string; status?: number }) => {
    throw new RepliesError(e?.message || "Only the organisation and the team members its owner put in HR can see its #Nana-HR inbox.", e?.status ?? 403);
  });
  return { kind: "job", orgUid: t.orgUid };
}

/** The application, only if it's in this inbox: a firm never opens another firm's application through its own inbox. */
async function inScope(db: Firestore, s: Scope, id: unknown): Promise<string> {
  const appId = String(id ?? "");
  if (s.kind === "job") {
    const a = /^[A-Za-z0-9_-]{1,200}$/.test(appId) ? (await db.doc(`${COLL.job}/${appId}`).get()).data() : undefined;
    if (!a || a.orgUid !== s.orgUid) throw new RepliesError("That application isn't in this organisation's inbox.", 404);
  }
  return appId;
}

const statusLabel = (kind: Scope["kind"], s: string) =>
  kind === "career" ? (isAppStatus(s) ? APP_STATUS_LABEL[s] : s) : (isJobAppStatus(s) ? JOB_APP_STATUS_LABEL[s] : s);
const person = (uid: string, name: string, u: FirebaseFirestore.DocumentData | undefined) => ({
  uid, name: name || String(u?.displayName ?? "") || "The applicant", username: String(u?.username ?? ""), avatar: String(u?.avatar ?? ""),
});
// What the list calls the role or job (careerApplications: roleId/roleTitle; jobApplications: jobId/jobTitle).
const roleOf = (kind: Scope["kind"], d: FirebaseFirestore.DocumentData) =>
  kind === "career" ? { roleId: String(d.roleId ?? ""), roleTitle: String(d.roleTitle ?? "the role") } : { roleId: String(d.jobId ?? ""), roleTitle: String(d.jobTitle ?? "the job") };
// Where the full application is: the team hub for our own roles, the firm's Your jobs page for a firm's.
const fullHref = (s: Scope, appId: string) =>
  s.kind === "career" ? `/admin/team/hr?app=${encodeURIComponent(appId)}` : `/profile/jobs?org=${encodeURIComponent(s.orgUid)}&app=${encodeURIComponent(appId)}`;

/** Every application with a conversation in this inbox, newest activity first, filtered. counts are threads per filter; unread is the
 *  total number of applicant replies the team hasn't read (the eyebrow on the page). */
export async function hrInbox(db: Firestore, v: Viewer, filter: unknown = "all", org?: unknown): Promise<{ rows: HrInboxRow[]; counts: Record<HrInboxFilter, number>; unread: number }> {
  const s = await scopeFor(db, v, org);
  const f: HrInboxFilter = isHrInboxFilter(filter) ? filter : "all";
  let q = db.collection("appReplies").where("kind", "==", s.kind);
  if (s.kind === "job") q = q.where("orgUid", "==", s.orgUid);
  const snap = await q.limit(LIST_MAX).get();
  const byApp = new Map<string, { from: string; text: string; createdAt: string; label: string }[]>();
  for (const d of snap.docs) {
    const r = d.data();
    const id = String(r.applicationId ?? "");
    if (!id) continue;
    const list = byApp.get(id) ?? [];
    list.push({ from: String(r.from), text: String(r.text ?? ""), createdAt: String(r.createdAt ?? ""), label: String(r.label ?? "") });
    byApp.set(id, list);
  }
  const ids = Array.from(byApp.keys());
  const apps = ids.length ? await db.getAll(...ids.map((id) => db.doc(`${COLL[s.kind]}/${id}`))) : [];
  // A conversation outliving its application (deleteRepliesFor normally takes both) isn't shown; nor, belt and braces, is an
  // application that isn't this firm's.
  const live = apps.filter((a) => a.exists && (s.kind === "career" || a.data()?.orgUid === s.orgUid));
  const uids = Array.from(new Set(live.map((a) => String(a.data()?.uid ?? "")).filter(Boolean)));
  const users = uids.length ? await db.getAll(...uids.map((u) => db.doc(`users/${u}`))) : [];
  const byUid = new Map(users.map((u) => [u.id, u.data()]));
  const rows = sortRows(live.map((a) => {
    const d = a.data()!;
    const uid = String(d.uid ?? "");
    return {
      id: a.id, applicant: person(uid, String(d.name ?? ""), byUid.get(uid)), ...roleOf(s.kind, d),
      status: String(d.status ?? ""), statusLabel: statusLabel(s.kind, String(d.status ?? "")),
      ...threadSummary(byApp.get(a.id)!, d.hrReadAt ? String(d.hrReadAt) : null),
    };
  }));
  return {
    rows: filterRows(rows, f),
    counts: { all: rows.length, unread: filterRows(rows, "unread").length, "needs-reply": filterRows(rows, "needs-reply").length },
    unread: rows.reduce((n, r) => n + r.unread, 0),
  };
}

/** One conversation, oldest first, in the shape components/ApplicationThread.tsx reads, plus the application it's on and where the full
 *  application is (hubHref). Opening it marks it read for the team (listReplies), unless markRead is false. */
export async function hrThread(db: Firestore, v: Viewer, id: unknown, o: { markRead?: boolean; now?: Date; org?: unknown } = {}) {
  const s = await scopeFor(db, v, o.org);
  const appId = await inScope(db, s, id);
  const listed = await listReplies(db, v, s.kind, appId, o);
  const a = (await db.doc(`${COLL[s.kind]}/${appId}`).get()).data() ?? {};
  const uid = String(a.uid ?? "");
  const u = uid ? (await db.doc(`users/${uid}`).get()).data() : undefined;
  return {
    ...listed,
    application: {
      id: appId, ...roleOf(s.kind, a), status: String(a.status ?? ""), statusLabel: statusLabel(s.kind, String(a.status ?? "")),
      createdAt: String(a.createdAt ?? ""), applicant: person(uid, String(a.name ?? ""), u),
    },
    hubHref: fullHref(s, appId),
  };
}

/** Answer (lib/app-replies-server.ts sendReply): on our own roles as HR, as Nana-HR (a draft the person read and sent) or as themselves;
 *  on a firm's job as HR, as the firm ("owner") or as Nana-HR. sendReply refuses a sender the kind doesn't take. */
export async function hrReply(db: Firestore, v: Viewer, input: { id?: unknown; as?: unknown; text?: unknown; org?: unknown }, now = new Date()) {
  const s = await scopeFor(db, v, input.org);
  return sendReply(db, v, { kind: s.kind, id: await inScope(db, s, input.id), as: input.as, text: input.text }, now);
}

/** Nana-HR drafts from the person's instruction; nothing is sent or saved. The person reads, edits and sends it with hrReply. */
export async function hrDraft(db: Firestore, v: Viewer, input: { id?: unknown; intent?: unknown; org?: unknown }, deps?: Parameters<typeof draftReply>[3]) {
  const s = await scopeFor(db, v, input.org);
  return draftReply(db, v, { kind: s.kind, id: await inScope(db, s, input.id), intent: input.intent }, deps);
}

export async function hrMarkRead(db: Firestore, v: Viewer, id: unknown, now = new Date(), org?: unknown): Promise<void> {
  const s = await scopeFor(db, v, org);
  const c = await context(db, v, s.kind, await inScope(db, s, id));
  await markHrRead(db, c.kind, c.appId, v.uid, now);
}

/** The application an interview is booked or cancelled on must be in this inbox too (the routes check, then call interviews-server). */
export async function hrCheck(db: Firestore, v: Viewer, id: unknown, org?: unknown): Promise<{ kind: "career" | "job"; id: string }> {
  const s = await scopeFor(db, v, org);
  return { kind: s.kind, id: await inScope(db, s, id) };
}
