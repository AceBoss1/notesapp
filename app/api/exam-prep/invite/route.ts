import { NextRequest } from "next/server";
import { acceptInvite, inviteInfo } from "@/lib/exam-prep-server";
import { body, db, fail, limit, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET ?token= → what the invite is for (its subjects) and whether it still works; no sign-in needed.
export async function GET(req: NextRequest) {
  try {
    const limited = await limit(req, "invite-info", null, 60, 600);
    if (limited) return limited;
    return ok(await inviteInfo(db(), req.nextUrl.searchParams.get("token")));
  } catch (e) { return fail(e); }
}
// POST { token } → a signed-in member accepts a reviewer invite link.
export async function POST(req: NextRequest) {
  try {
    const u = await needUser(req);
    const limited = await limit(req, "invite", u.uid, 10, 3600);
    if (limited) return limited;
    const me = (await db().doc(`users/${u.uid}`).get()).data();
    return ok(await acceptInvite(db(), { uid: u.uid, name: String(me?.displayName || me?.username || "Reviewer") }, (await body(req)).token));
  } catch (e) { return fail(e); }
}
