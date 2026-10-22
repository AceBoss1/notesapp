import { NextRequest } from "next/server";
import { recordAttempt } from "@/lib/exam-prep-server";
import { body, db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// POST { questionId } → an answer counted for the daily totals and, for a signed-in student who joined it, the effort board.
export async function POST(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "attempt", u?.uid ?? null, 600, 3600);
    if (limited) return limited;
    return ok(await recordAttempt(db(), u?.uid ?? null, (await body(req)).questionId));
  } catch (e) { return fail(e); }
}
