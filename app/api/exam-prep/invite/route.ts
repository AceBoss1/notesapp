import { NextRequest } from "next/server";
import { acceptInvite } from "@/lib/exam-prep-server";
import { body, db, fail, limit, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
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
