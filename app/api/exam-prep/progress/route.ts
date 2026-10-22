import { NextRequest } from "next/server";
import { getProgress, syncProgress } from "@/lib/exam-prep-server";
import { body, db, fail, limit, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET → this account's progress. POST { progress } → merged with what the account has, and the merge returned.
export async function GET(req: NextRequest) {
  try { const u = await needUser(req); return ok(await getProgress(db(), u.uid)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const u = await needUser(req);
    const limited = await limit(req, "progress", u.uid, 60, 3600);
    if (limited) return limited;
    return ok(await syncProgress(db(), u.uid, (await body(req)).progress));
  } catch (e) { return fail(e); }
}
