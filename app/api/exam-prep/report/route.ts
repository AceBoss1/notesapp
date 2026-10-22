import { NextRequest } from "next/server";
import { reportQuestion } from "@/lib/exam-prep-server";
import { body, db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// POST { questionId, reason: wrong-answer | unclear | typo | other, note? } → "Report a problem" on a question, for the editors.
export async function POST(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "report", u?.uid ?? null, 20, 3600);
    if (limited) return limited;
    const b = await body(req);
    return ok(await reportQuestion(db(), u?.uid ?? null, { questionId: b.questionId, reason: b.reason, note: b.note }));
  } catch (e) { return fail(e); }
}
