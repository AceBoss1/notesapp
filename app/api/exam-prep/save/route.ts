import { NextRequest } from "next/server";
import { packForSaving } from "@/lib/exam-prep-server";
import { db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET ?exam= → a pack to keep in this browser for offline practice: the questions this account may use and, with paid ones, a signed pass.
export async function GET(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "save", u?.uid ?? null, 30, 3600);
    if (limited) return limited;
    return ok(await packForSaving(db(), u?.uid ?? null, req.nextUrl.searchParams.get("exam")));
  } catch (e) { return fail(e); }
}
