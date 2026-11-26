import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { HR_INBOX_NEED, canOpen } from "@/lib/admin-access";
import { RepliesError, type Viewer } from "@/lib/app-replies-server";
import { InterviewError } from "@/lib/interviews";
import { cancelInterview, scheduleInterview } from "@/lib/interviews-server";
import { hrDraft, hrInbox, hrMarkRead, hrReply, hrThread } from "@/lib/hr-inbox-server";

export const dynamic = "force-dynamic";

// Admin → #Nana-HR inbox (lib/hr-inbox-server.ts). Owner, 26 Nov 2026: "Admin → #Nana-HR inbox: HR reads and answers replies there."
// Applicants' replies on #NotesApp's own roles, for the people who review those applications (HR_INBOX_NEED, canReviewHiring: super
// admins, the Chief of Staff and People & HR). Career threads only: no org is ever passed on, so a firm's conversation can't be reached
// from here (each firm has its own inbox, /api/jobs/hr-inbox). Rate limits share their buckets with /api/applications/replies, so
// answering from here, the team hub or a firm's inbox counts once.
//   GET ?filter=all|unread|needs-reply  → { rows, counts, unread }   newest activity first
//   GET ?id=<applicationId>             → { replies, reviewer, org, username, interviews, application, hubHref }   and marks it read
//   POST { id, as: "hr"|"nana"|"me", text }   → { reply }   (action "send" or none; components/ApplicationThread.tsx sends "send")
//   POST { id, intent, action: "draft" }      → { draft }   Nana-HR drafts; the person reads, edits and sends it. She never sends.
//   POST { id, action: "read" }               → marks it read without opening it
//   POST { id, action: "interview", ... } / { interviewId, action: "cancelInterview" }   as on /api/applications/replies
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const failed = (err: unknown, fallback: string) => {
  if (err instanceof RepliesError || err instanceof InterviewError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
async function viewer(req: NextRequest): Promise<Viewer> {
  const a = await verifyAdminAccess(bearer(req));
  if (!canOpen(a.access, HR_INBOX_NEED)) throw new RepliesError("Your role doesn't include this area", 403);
  return { uid: a.uid, access: a.access };
}

export async function GET(req: NextRequest) {
  try {
    const v = await viewer(req);
    const p = req.nextUrl.searchParams;
    const id = p.get("id");
    const db = getAdminDb();
    return NextResponse.json(id ? await hrThread(db, v, id) : await hrInbox(db, v, p.get("filter") ?? "all"), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return failed(err, "Couldn't load the #Nana-HR inbox");
  }
}

export async function POST(req: NextRequest) {
  try {
    const v = await viewer(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    if (b.action === "read") { await hrMarkRead(db, v, b.id); return NextResponse.json({ ok: true }); }
    if (b.action === "draft") {
      const limited = await rateLimit(req, "app-reply-draft", v.uid, 30, 3600);
      if (limited) return limited;
      return NextResponse.json(await hrDraft(db, v, { id: b.id, intent: b.intent }));
    }
    if (b.action === "interview") {
      const limited = await rateLimit(req, "app-interview", v.uid, 30, 3600);
      if (limited) return limited;
      return NextResponse.json({ interview: await scheduleInterview(db, v, { ...b, kind: "career" }) });
    }
    if (b.action === "cancelInterview") { await cancelInterview(db, v, b.interviewId); return NextResponse.json({ ok: true }); }
    const limited = await rateLimit(req, "app-reply", v.uid, 60, 3600);
    if (limited) return limited;
    return NextResponse.json({ reply: await hrReply(db, v, { id: b.id, as: b.as, text: b.text }) });
  } catch (err) {
    return failed(err, "Couldn't send that");
  }
}
