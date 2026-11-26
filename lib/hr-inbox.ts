import type { ReplyFrom } from "./app-replies";

// Admin → #Nana-HR inbox (owner, 26 Nov 2026: "Admin → #Nana-HR inbox: HR reads and answers replies there"): every conversation on an
// application to #NotesApp's own roles (/careers), in one list, so an applicant's reply is seen without opening each role in the team
// hub. Notes Jobs conversations belong to each firm and stay on its job pages. Pure rules here (tested in tests/hr/hr-inbox.test.ts);
// the server is lib/hr-inbox-server.ts, and the replies themselves are lib/app-replies-server.ts.

export type HrInboxFilter = "all" | "unread" | "needs-reply";
export const HR_INBOX_FILTERS: { key: HrInboxFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "unread", label: "Unread" }, { key: "needs-reply", label: "Needs reply" },
];
export const isHrInboxFilter = (v: unknown): v is HrInboxFilter => HR_INBOX_FILTERS.some((f) => f.key === v);

export type HrInboxRow = {
  id: string; // the application (careerApplications/{roleId}_{uid})
  applicant: { uid: string; name: string; username: string; avatar: string };
  roleId: string; roleTitle: string; status: string; statusLabel: string;
  lastText: string; lastAt: string; lastFrom: ReplyFrom; lastLabel: string;
  count: number; unread: number; needsReply: boolean;
};

type Line = { from: ReplyFrom | string; text: string; createdAt: string; label: string };

/** What one thread says in the list. unread: the applicant's replies after the hiring team last read it (hrReadAt; all of them if
 *  nobody has). needsReply: the applicant wrote last, so the ball is with us, read or not. */
export function threadSummary(lines: Line[], hrReadAt?: string | null) {
  const sorted = [...lines].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const last = sorted[sorted.length - 1];
  const unread = sorted.filter((l) => l.from === "applicant" && (!hrReadAt || l.createdAt > hrReadAt)).length;
  return {
    lastText: last ? last.text : "", lastAt: last ? last.createdAt : "", lastFrom: (last?.from ?? "hr") as ReplyFrom, lastLabel: last ? last.label : "",
    count: sorted.length, unread, needsReply: last?.from === "applicant",
  };
}

export const filterRows = (rows: HrInboxRow[], f: HrInboxFilter) =>
  f === "unread" ? rows.filter((r) => r.unread > 0) : f === "needs-reply" ? rows.filter((r) => r.needsReply) : rows;

/** Newest activity first. */
export const sortRows = (rows: HrInboxRow[]) => [...rows].sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
