import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { notifyNewPostServer } from "@/lib/new-post-notify";

export const dynamic = "force-dynamic";

// POST { noteId } — tells the followers and subscribers of a founder or @na-notesapp post. Admins only (they are the only ones who publish under those names); sends once per post.
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => { throw Object.assign(new Error("Admins only."), { status: 403 }); });
    const { noteId } = await req.json().catch(() => ({}));
    if (typeof noteId !== "string" || !noteId) return NextResponse.json({ error: "Missing note." }, { status: 400 });
    return NextResponse.json(await notifyNewPostServer(getAdminDb(), noteId));
  } catch (err) {
    if ((err as { status?: number }).status === 403) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    const f = friendlyMessage(err, "Couldn't send notifications");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
