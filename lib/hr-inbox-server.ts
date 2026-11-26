import type { Firestore } from "firebase-admin/firestore";
import { HR_INBOX_NEED, canOpen } from "./admin-access";
import { APP_STATUS_LABEL, isAppStatus } from "./careers";
import { RepliesError, context, draftReply, listReplies, markHrRead, sendReply, type Viewer } from "./app-replies-server";
import { filterRows, isHrInboxFilter, sortRows, threadSummary, type HrInboxFilter, type HrInboxRow } from "./hr-inbox";

// Admin → #Nana-HR inbox (app/(main)/admin/hr-inbox, /api/admin/hr-inbox). Owner, 26 Nov 2026: "Admin → #Nana-HR inbox: HR reads and
// answers replies there." The conversations on applications to #NotesApp's own roles (appReplies with kind "career"), newest activity
// first; Notes Jobs conversations (kind "job") belong to each firm and never show here. Nothing new is stored but the team's read stamp,
// hrReadAt on the application (lib/app-replies-server.ts markHrRead): careerApplications is server-only and the applicant's own list
// leaves it out. Reading and answering go through the same functions as the team hub (listReplies, sendReply, draftReply), so the
// permission check (context()), the sender labels and the applicant's bell are the same wherever HR answers from.

const LIST_MAX = 5_000; // career replies read for the list; at REPLIES_MAX (200) a thread, this is far more than hiring makes

const need = (v: Viewer) => {
  if (!canOpen(v.access, HR_INBOX_NEED)) throw new RepliesError("Only super admins and the Chief of Staff review applications to #NotesApp.", 403);
};
const statusLabel = (s: string) => (isAppStatus(s) ? APP_STATUS_LABEL[s] : s);
const person = (uid: string, name: string, u: FirebaseFirestore.DocumentData | undefined) => ({
  uid, name: name || String(u?.displayName ?? "") || "The applicant", username: String(u?.username ?? ""), avatar: String(u?.avatar ?? ""),
});

/** Every career application with a conversation, newest activity first, filtered. counts are threads per filter; unread is the total
 *  number of applicant replies the team hasn't read (the eyebrow on the page). */
export async function hrInbox(db: Firestore, v: Viewer, filter: unknown = "all"): Promise<{ rows: HrInboxRow[]; counts: Record<HrInboxFilter, number>; unread: number }> {
  need(v);
  const f: HrInboxFilter = isHrInboxFilter(filter) ? filter : "all";
  const snap = await db.collection("appReplies").where("kind", "==", "career").limit(LIST_MAX).get();
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
  const apps = ids.length ? await db.getAll(...ids.map((id) => db.doc(`careerApplications/${id}`))) : [];
  const live = apps.filter((a) => a.exists); // a conversation outliving its application (deleteRepliesFor normally takes both) isn't shown
  const uids = Array.from(new Set(live.map((a) => String(a.data()?.uid ?? "")).filter(Boolean)));
  const users = uids.length ? await db.getAll(...uids.map((u) => db.doc(`users/${u}`))) : [];
  const byUid = new Map(users.map((u) => [u.id, u.data()]));
  const rows = sortRows(live.map((a) => {
    const d = a.data()!;
    const uid = String(d.uid ?? "");
    return {
      id: a.id, applicant: person(uid, String(d.name ?? ""), byUid.get(uid)), roleId: String(d.roleId ?? ""), roleTitle: String(d.roleTitle ?? "the role"),
      status: String(d.status ?? ""), statusLabel: statusLabel(String(d.status ?? "")),
      ...threadSummary(byApp.get(a.id)!, d.hrReadAt ? String(d.hrReadAt) : null),
    };
  }));
  return {
    rows: filterRows(rows, f),
    counts: { all: rows.length, unread: filterRows(rows, "unread").length, "needs-reply": filterRows(rows, "needs-reply").length },
    unread: rows.reduce((n, r) => n + r.unread, 0),
  };
}

/** One conversation, oldest first, in the shape components/ApplicationThread.tsx reads, plus the application it's on and where it is
 *  in the team hub. Opening it marks it read for the team (listReplies), unless markRead is false. */
export async function hrThread(db: Firestore, v: Viewer, id: unknown, o: { markRead?: boolean; now?: Date } = {}) {
  need(v);
  const listed = await listReplies(db, v, "career", id, o);
  const appId = String(id);
  const a = (await db.doc(`careerApplications/${appId}`).get()).data() ?? {};
  const uid = String(a.uid ?? "");
  const u = uid ? (await db.doc(`users/${uid}`).get()).data() : undefined;
  return {
    ...listed,
    application: {
      id: appId, roleId: String(a.roleId ?? ""), roleTitle: String(a.roleTitle ?? "the role"), status: String(a.status ?? ""), statusLabel: statusLabel(String(a.status ?? "")),
      createdAt: String(a.createdAt ?? ""), applicant: person(uid, String(a.name ?? ""), u),
    },
    hubHref: `/admin/team/hr?app=${encodeURIComponent(appId)}`,
  };
}

/** Answer as HR, as Nana-HR (a draft the person read and sent) or as themselves (lib/app-replies-server.ts sendReply). */
export async function hrReply(db: Firestore, v: Viewer, input: { id?: unknown; as?: unknown; text?: unknown }, now = new Date()) {
  need(v);
  return sendReply(db, v, { kind: "career", id: input.id, as: input.as, text: input.text }, now);
}

/** Nana-HR drafts from the person's instruction; nothing is sent or saved. The person reads, edits and sends it with hrReply. */
export async function hrDraft(db: Firestore, v: Viewer, input: { id?: unknown; intent?: unknown }, deps?: Parameters<typeof draftReply>[3]) {
  need(v);
  return draftReply(db, v, { kind: "career", id: input.id, intent: input.intent }, deps);
}

export async function hrMarkRead(db: Firestore, v: Viewer, id: unknown, now = new Date()): Promise<void> {
  need(v);
  const c = await context(db, v, "career", id);
  await markHrRead(db, c.appId, v.uid, now);
}
