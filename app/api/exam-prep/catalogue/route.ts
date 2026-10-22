import { NextRequest } from "next/server";
import { catalogue } from "@/lib/exam-prep-server";
import { db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET → exams, the subjects and topics with published questions (and how many, free and in the pack), the packs, and this account's access.
export async function GET(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "catalogue", u?.uid ?? null, 120, 600);
    if (limited) return limited;
    return ok(await catalogue(db(), u?.uid ?? null));
  } catch (e) { return fail(e); }
}
