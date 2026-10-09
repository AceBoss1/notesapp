import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "./firebase-admin";
import { friendlyMessage } from "./api-errors";
import { SocialError } from "./social-server";

// Shared by the /api/social routes: a signed-in, non-suspended member (with a verified email when they are about to post), and our own errors
// turned into responses.
export async function socialAuthed(req: NextRequest, write = false): Promise<{ uid: string }> {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (write && !me.emailVerified) throw new SocialError(403, "Verify your email first.");
  const user = (await getAdminDb().doc(`users/${me.uid}`).get()).data();
  if (!user || user.suspended === true) throw new SocialError(403, "Your account can't do that right now.");
  return { uid: me.uid };
}

export function socialFail(err: unknown, fallback: string): NextResponse {
  if (err instanceof SocialError) return NextResponse.json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, { status: err.status });
  if (err instanceof Error && /Missing auth token|verifyIdToken|ID token/i.test(err.message)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
