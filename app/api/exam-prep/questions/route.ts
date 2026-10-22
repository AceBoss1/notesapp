import { NextRequest } from "next/server";
import { practiceSet } from "@/lib/exam-prep-server";
import { db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET ?exam=&subject=&topic= → practice questions with their answers and explanations: the free ones for anyone, the pack's with access.
export async function GET(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "questions", u?.uid ?? null, 120, 600);
    if (limited) return limited;
    const q = req.nextUrl.searchParams;
    return ok(await practiceSet(db(), u?.uid ?? null, { exam: q.get("exam"), subject: q.get("subject") || undefined, topic: q.get("topic") || undefined }));
  } catch (e) { return fail(e); }
}
