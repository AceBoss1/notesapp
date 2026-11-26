import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { jobsFail, signedIn } from "@/lib/jobs-api";
import { RepliesError, type Viewer } from "@/lib/app-replies-server";
import { InterviewError } from "@/lib/interviews";
import { cancelInterview, scheduleInterview } from "@/lib/interviews-server";
import { hrCheck, hrDraft, hrInbox, hrMarkRead, hrReply, hrThread } from "@/lib/hr-inbox-server";

export const dynamic = "force-dynamic";

// A firm's #Nana-HR inbox (lib/hr-inbox-server.ts; the page is app/(main)/profile/jobs/hr-inbox). Owner, 26 Nov 2026: "Notes Jobs:
// applications to other firms' jobs stay with those firms. Who sees it: whoever already reviews firms' job applications, probably owner
// or admin they appoint with hr privilege." Every request names the firm (org) and is checked against its hiring team (jobs-server
// hiringTeamFor: the organisation account and the team members its owner put in HR); only that firm's Notes Jobs threads are reachable.
// Rate limits share their buckets with /api/applications/replies and the Admin inbox, so answering from anywhere counts once.
//   GET ?org=<uid>&filter=all|unread|needs-reply  → { rows, counts, unread }   newest activity first
//   GET ?org=<uid>&id=<applicationId>             → { replies, reviewer, org, username, interviews, application, hubHref }   marks it read
//   POST { org, id, as: "hr"|"owner"|"nana", text }  → { reply }   a firm answers as HR, as itself or with a Nana-HR draft, never as "me"
//   POST { org, id, intent, action: "draft" }        → { draft }   Nana-HR drafts; the person reads, edits and sends it. She never sends.
//   POST { org, id, action: "read" }                 → marks it read without opening it
//   POST { org, id, action: "interview", ... } / { interviewId, action: "cancelInterview" }   as on /api/applications/replies
const failed = (err: unknown, fallback: string) => {
  if (err instanceof RepliesError || err instanceof InterviewError) return NextResponse.json({ error: err.message }, { status: err.status });
  return jobsFail(err, fallback);
};
// Anyone signed in can ask; the firm's hiring team check is in every lib/hr-inbox-server.ts call. No staff access: a #NotesApp admin
// is no one special in a firm's inbox.
const viewer = async (req: NextRequest): Promise<Viewer> => ({ uid: (await signedIn(req, false)).uid, access: null });
const orgOf = (v: unknown) => (typeof v === "string" && v ? v : "-"); // never empty: no org must not fall through to #NotesApp's careers

export async function GET(req: NextRequest) {
  try {
    const v = await viewer(req);
    const p = req.nextUrl.searchParams;
    const org = orgOf(p.get("org"));
    const id = p.get("id");
    const db = getAdminDb();
    return NextResponse.json(id ? await hrThread(db, v, id, { org }) : await hrInbox(db, v, p.get("filter") ?? "all", org), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return failed(err, "Couldn't load the #Nana-HR inbox");
  }
}

export async function POST(req: NextRequest) {
  try {
    const v = await viewer(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const org = orgOf(b.org);
    const db = getAdminDb();
    if (b.action === "read") { await hrMarkRead(db, v, b.id, new Date(), org); return NextResponse.json({ ok: true }); }
    if (b.action === "draft") {
      const limited = await rateLimit(req, "app-reply-draft", v.uid, 30, 3600);
      if (limited) return limited;
      return NextResponse.json(await hrDraft(db, v, { id: b.id, intent: b.intent, org }));
    }
    if (b.action === "interview") {
      const limited = await rateLimit(req, "app-interview", v.uid, 30, 3600);
      if (limited) return limited;
      const { id } = await hrCheck(db, v, b.id, org);
      return NextResponse.json({ interview: await scheduleInterview(db, v, { ...b, kind: "job", id }) });
    }
    if (b.action === "cancelInterview") { await cancelInterview(db, v, b.interviewId); return NextResponse.json({ ok: true }); }
    const limited = await rateLimit(req, "app-reply", v.uid, 60, 3600);
    if (limited) return limited;
    return NextResponse.json({ reply: await hrReply(db, v, { id: b.id, as: b.as, text: b.text, org }) });
  } catch (err) {
    return failed(err, "Couldn't send that");
  }
}
