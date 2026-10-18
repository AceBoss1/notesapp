import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SubtopicError, ensureMany, isKind } from "@/lib/subtopics-server";

export const dynamic = "force-dynamic";

// Signed-in members, when saving a journal or Market item: POST { kind: "topic" | "category", items: [{ parent, label }] } → the subtopics
// (or subcategories) as saved, creating any that don't exist yet. Courses do this on the server when they're saved.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
    if (!d) throw new SubtopicError("Sign in first.", 401);
    const limited = await rateLimit(req, "subtopics", d.uid, 60, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (!isKind(b.kind)) throw new SubtopicError("Topics or categories?");
    return NextResponse.json({ items: await ensureMany(getAdminDb(), d.uid, b.kind, b.items) });
  } catch (err) {
    if (err instanceof SubtopicError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't save that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
