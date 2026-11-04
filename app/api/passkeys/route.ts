import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { PasskeyError } from "@/lib/passkeys";
import { listPasskeys, removePasskey, renamePasskey } from "@/lib/passkeys-server";
import { rateLimit } from "@/lib/rate-limit";
import { SocialAuthError } from "@/lib/social-auth";
import { assertCanRemove, realDeps } from "@/lib/social-auth-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const fail = (err: unknown, fallback: string) => {
  if (err instanceof PasskeyError || err instanceof SocialAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// The signed-in member's passkeys: GET lists them, PATCH { id, name } renames one, DELETE { id } removes one.
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req));
    return NextResponse.json({ passkeys: await listPasskeys(getAdminDb(), me.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load your passkeys"); }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req));
    const limited = await rateLimit(req, "passkeys", me.uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    await renamePasskey(getAdminDb(), me.uid, b.id, b.name);
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err, "Couldn't rename that passkey"); }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req));
    const limited = await rateLimit(req, "passkeys", me.uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    // Never the last way in: an account that signs in only with this passkey keeps it (lib/social-auth.ts, canRemove).
    await assertCanRemove(getAdminDb(), me.uid, "passkey", realDeps());
    await removePasskey(getAdminDb(), me.uid, b.id);
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err, "Couldn't remove that passkey"); }
}
