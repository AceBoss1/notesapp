import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { CommentError, postComment } from "@/lib/comments-server";

export const dynamic = "force-dynamic";

// POST { noteId, content, parentCommentId?, asBrand? } → { id }. Comments are written here, not by browsers (lib/comments-server.ts):
// the name and picture come from the account, and the bells to the journal's author, the person replied to and anyone @mentioned
// go out from here.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  let uid: string;
  try { uid = (await verifySignedInRequest(token)).uid; } catch { return NextResponse.json({ error: "Sign in to comment." }, { status: 401 }); }
  const limited = await rateLimit(req, "comments", uid, 10, 60);
  if (limited) return limited;
  try {
    const body = await req.json().catch(() => ({}));
    const canModerate = body?.asBrand === true ? await verifyAdminRequest(token, "moderation").then(() => true, () => false) : false;
    return NextResponse.json(await postComment(getAdminDb(), uid, body, canModerate));
  } catch (err) {
    if (err instanceof CommentError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't post your comment");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
