import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { BIND_COOKIE, STATE_TTL_MS, SocialAuthError } from "@/lib/social-auth";
import { bearer, noStore, socialAuthFail } from "@/lib/social-auth-api";
import { realDeps, requireFresh, startLinkedIn, verifyToken } from "@/lib/social-auth-server";

export const dynamic = "force-dynamic";

// POST { mode: "signin" | "link", returnPath } → { url }: send the browser to LinkedIn. "link" needs the signed-in member's fresh
// ID token (Authorization: Bearer). Sets a short-lived cookie that ties the answer to this browser (checked by /finish).
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "social-start", clientIp(req), 20, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const mode = b.mode === "link" ? "link" : b.mode === "signin" ? "signin" : null;
    if (!mode) throw new SocialAuthError(400, "Unknown request.");
    const deps = realDeps();
    let uid: string | undefined;
    if (mode === "link") {
      const t = await verifyToken(deps, bearer(req));
      requireFresh(t, deps);
      uid = t.uid;
    }
    const host = req.headers.get("host");
    const { url, bind } = await startLinkedIn(getAdminDb(), { host, mode, uid, returnPath: b.returnPath }, deps);
    const res = NextResponse.json({ url }, { headers: noStore });
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || "");
    res.cookies.set(BIND_COOKIE, bind, { httpOnly: true, sameSite: "lax", secure: !local, path: "/api/auth/linkedin", maxAge: Math.floor(STATE_TTL_MS / 1000) + 120 });
    return res;
  } catch (err) {
    return socialAuthFail(err, "Couldn't start LinkedIn sign-in");
  }
}
