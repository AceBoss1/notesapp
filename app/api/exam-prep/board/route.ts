import { NextRequest } from "next/server";
import { board, joinBoard } from "@/lib/exam-prep-server";
import { body, db, fail, limit, maybeUser, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET → this week's effort board (nicknames and counts). POST { join, nickname } → join or leave it.
export async function GET(req: NextRequest) {
  try { return ok(await board(db(), (await maybeUser(req))?.uid ?? null)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const u = await needUser(req);
    const limited = await limit(req, "board", u.uid, 20, 3600);
    if (limited) return limited;
    const b = await body(req);
    return ok(await joinBoard(db(), u.uid, b.nickname, b.join === true));
  } catch (e) { return fail(e); }
}
