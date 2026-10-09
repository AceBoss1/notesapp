import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { NanaError } from "@/lib/nana";
import { assist } from "@/lib/nana-assist";
import { rateLimit } from "@/lib/rate-limit";
import { aiStatus } from "@/lib/ai-connect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Signed-in members: POST { task, surface: "draft" | "social" | "chat", text, platform?, context? } → { text, via }. Writing help for drafts,
// a post for LinkedIn or X, and messages. Nothing is stored. Uses the member's own AI account when connected, else #NotesApp's (with a daily allowance).
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
    if (!d) throw new NanaError("Sign in to use Nana's writing help.", 401);
    // The hourly limit protects #NotesApp's bill; a member using their own AI account is not limited.
    const db = getAdminDb();
    if (!(await aiStatus(db, d.uid)).connected) {
      const limited = rateLimit(req, "nana-assist", d.uid, 30, 3600);
      if (limited) return limited;
    }
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await assist(db, d.uid, b), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NanaError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't help with that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
