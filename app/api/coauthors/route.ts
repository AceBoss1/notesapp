import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CoAuthorError, changeCoAuthor, inviteCoAuthor, leaveCoAuthor, respondCoAuthor, revokeCoAuthor } from "@/lib/coauthors-server";

export const dynamic = "force-dynamic";

// POST { action, ... } — all co-author state changes go through here (lib/coauthors-server.ts) so consent, access and the
// percentage rules can't be skipped:
//   invite  { noteId, username, percent, access: "view" | "edit" }   the lead, on a draft
//   change  { inviteId, access, percent }                             the lead: less access applies now, more (or a new share) is asked
//   revoke  { inviteId }                                              the lead withdraws an invite or removes a co-author
//   respond { inviteId, accept, agree, termsVersion, seen: { access, percent } }   the invitee (also answers a proposed change)
//   leave   { inviteId }                                              an accepted co-author leaves before publishing
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const me = await verifySignedInRequest(idToken).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "coauthors", me.uid, 40, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    switch (body.action) {
      case "invite": return NextResponse.json({ ok: true, invite: await inviteCoAuthor(db, me.uid, body) });
      case "change": return NextResponse.json({ ok: true, ...(await changeCoAuthor(db, me.uid, body)) });
      case "revoke": await revokeCoAuthor(db, me.uid, body.inviteId); return NextResponse.json({ ok: true });
      case "leave": await leaveCoAuthor(db, me.uid, body.inviteId); return NextResponse.json({ ok: true });
      case "respond":
        return NextResponse.json({ ok: true, ...(await respondCoAuthor(db, me.uid, body.inviteId, {
          accept: !!body.accept, agree: body.agree, termsVersion: body.termsVersion, seen: body.seen, userAgent: req.headers.get("user-agent") ?? undefined,
        })) });
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof CoAuthorError) return NextResponse.json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't update co-authors");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
