import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { RepliesError, draftReply, listReplies, sendReply, summariseJobApplication, type Viewer } from "@/lib/app-replies-server";
import { JobsError } from "@/lib/jobs";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const fail = (err: unknown, fallback: string) => {
  if (err instanceof RepliesError || err instanceof JobsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
// The signed-in person, with their team access if they're staff (only staff review #NotesApp's own roles).
async function viewer(req: NextRequest): Promise<Viewer> {
  const token = bearer(req);
  const me = await verifySignedInRequest(token);
  const staff = await verifyAdminAccess(token).catch(() => null);
  return { uid: me.uid, access: staff?.access ?? null };
}

// Replies on a job application (lib/app-replies-server.ts).
// GET ?kind=career|job&id= → { replies, reviewer, org, username }
// POST { action: "send", kind, id, as?: "hr"|"nana"|"me", text } → { reply }
// POST { action: "draft", kind, id, intent } → { draft }: Nana-HR drafts a reply for a reviewer to edit and send.
// POST { action: "summarise", id } → { summary }: Nana-HR's screening summary of a Notes Jobs application, for the firm's hiring team.
export async function GET(req: NextRequest) {
  try {
    const v = await viewer(req);
    const p = req.nextUrl.searchParams;
    return NextResponse.json(await listReplies(getAdminDb(), v, p.get("kind"), p.get("id")), { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load the messages"); }
}

export async function POST(req: NextRequest) {
  try {
    const v = await viewer(req);
    const b = await req.json().catch(() => ({}));
    if (b.action === "summarise") {
      const limited = await rateLimit(req, "app-summarise", v.uid, 60, 3600);
      if (limited) return limited;
      return NextResponse.json({ summary: await summariseJobApplication(getAdminDb(), v, b.id) });
    }
    if (b.action === "draft") {
      const limited = await rateLimit(req, "app-reply-draft", v.uid, 30, 3600);
      if (limited) return limited;
      return NextResponse.json(await draftReply(getAdminDb(), v, b));
    }
    const limited = await rateLimit(req, "app-reply", v.uid, 60, 3600);
    if (limited) return limited;
    return NextResponse.json({ reply: await sendReply(getAdminDb(), v, b) });
  } catch (err) { return fail(err, "Couldn't send the message"); }
}
