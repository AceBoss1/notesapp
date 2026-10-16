import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CommentError, notifyLike } from "@/lib/comments-server";

export const dynamic = "force-dynamic";

// POST { noteId } after the browser records a like: the server checks the like is there and tells the author, once per person per journal.
export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid; } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const limited = await rateLimit(req, "like-notify", uid, 30, 60);
  if (limited) return limited;
  const { noteId } = (await req.json().catch(() => ({}))) as { noteId?: unknown };
  try { return NextResponse.json({ sent: await notifyLike(getAdminDb(), uid, String(noteId ?? "")) }); }
  catch (err) { return NextResponse.json({ error: err instanceof CommentError ? err.message : "Couldn't send that." }, { status: err instanceof CommentError ? err.status : 500 }); }
}
