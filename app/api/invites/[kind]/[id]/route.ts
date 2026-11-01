import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { InviteTermsError } from "@/lib/invite-agreements-server";
import { answerInvite, inviteView } from "@/lib/invites-server";

export const dynamic = "force-dynamic";
type Ctx = { params: { kind: string; id: string } };

// One co-author (kind "journal") or co-tutor (kind "course") invitation, for the accept screen /invites/<kind>/<id> (lib/invites-server.ts).
// GET → InviteView: who invited you, what, your access and share, what you'd agree to, and any agreement already made.
// POST { accept: true, agree: true, termsVersion, seen: { access, percent } } | { accept: false } → { ok }: the invited member's answer.
function kindOf(k: string) { return k === "journal" || k === "course" ? k : null; }
async function who(req: NextRequest) {
  return verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
}
function fail(err: unknown, fallback: string) {
  if (err instanceof InviteTermsError) return NextResponse.json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const kind = kindOf(params.kind);
    if (!kind) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "invite-read", me.uid, 120, 600);
    if (limited) return limited;
    return NextResponse.json(await inviteView(getAdminDb(), me.uid, kind, params.id), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the invite");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const kind = kindOf(params.kind);
    if (!kind) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "invite-answer", me.uid, 30, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    await answerInvite(getAdminDb(), me.uid, kind, params.id, {
      accept: b.accept === true, agree: b.agree, termsVersion: b.termsVersion, seen: b.seen, userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't answer the invite");
  }
}
