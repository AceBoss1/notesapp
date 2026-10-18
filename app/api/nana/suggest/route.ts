import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SubtopicError, suggestFor } from "@/lib/subtopics-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Signed-in members: POST { kind: "journal" | "course" | "item", title, summary? } → Nana's topics and subtopics (journals, courses) or
// categories and subcategories (Market items) for it (lib/subtopics-server.ts). On #NotesApp's own AI, never the member's allowance.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
    if (!d) throw new SubtopicError("Sign in first.", 401);
    const limited = await rateLimit(req, "nana-suggest", d.uid, 60, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await suggestFor(getAdminDb(), b), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof SubtopicError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't suggest anything");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
