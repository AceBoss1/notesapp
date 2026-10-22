import { NextRequest } from "next/server";
import { startMock } from "@/lib/exam-prep-server";
import { body, db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// POST { exam, subject?, size: 10|20|40, minutes? } → a timed mock (questions without answers, and the server's deadline). Signed out,
// it comes with a token the browser keeps for this mock.
export async function POST(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "mock", u?.uid ?? null, 20, 3600);
    if (limited) return limited;
    const b = await body(req);
    return ok(await startMock(db(), { uid: u?.uid ?? null }, { exam: b.exam, subject: b.subject || undefined, size: b.size, minutes: b.minutes ?? undefined }));
  } catch (e) { return fail(e); }
}
