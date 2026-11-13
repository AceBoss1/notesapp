import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { isLocalHost } from "@/lib/host";
import { PasskeyError } from "@/lib/passkeys";
import { CycleError } from "@/lib/cycle";
import { UNLOCK_COOKIE, UNLOCK_IDLE_MS, issueUnlock } from "@/lib/cycle-server";

// Shared by the My Cycle routes (app/api/cycle): who is asking, the unlock cookie, and the errors.
export const NO_STORE = { "Cache-Control": "no-store, private" };

export async function signedIn(req: NextRequest) {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!me) throw new CycleError("Sign in first.", 401);
  return me;
}

export const unlockToken = (req: NextRequest) => req.cookies.get(UNLOCK_COOKIE)?.value;

// The cookie goes only to the My Cycle routes, never to scripts, and never to another site.
function cookieOpts(req: NextRequest, maxAge: number) {
  const local = isLocalHost(req.nextUrl.hostname);
  return { httpOnly: true, secure: !local, sameSite: "strict" as const, path: "/api/cycle", maxAge };
}
export function setUnlock(req: NextRequest, res: NextResponse, uid: string, since?: number) {
  res.cookies.set(UNLOCK_COOKIE, issueUnlock(uid, new Date(), since), cookieOpts(req, Math.ceil(UNLOCK_IDLE_MS / 1000)));
  return res;
}
export function clearUnlock(req: NextRequest, res: NextResponse) {
  res.cookies.set(UNLOCK_COOKIE, "", cookieOpts(req, 0));
  return res;
}

export function fail(req: NextRequest, err: unknown, fallback: string) {
  if (err instanceof CycleError || err instanceof PasskeyError) {
    const res = NextResponse.json({ error: err.message, ...(err.status === 423 ? { locked: true } : {}) }, { status: err.status, headers: NO_STORE });
    return err.status === 423 ? clearUnlock(req, res) : res;
  }
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status, headers: NO_STORE });
}
