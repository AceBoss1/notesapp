import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { BIND_COOKIE } from "@/lib/social-auth";
import { bearer, noStore, socialAuthFail } from "@/lib/social-auth-api";
import { finishLinkedIn, realDeps, verifyToken } from "@/lib/social-auth-server";

export const dynamic = "force-dynamic";

// POST { ticket } (+ the cookie from /start; + Authorization: Bearer when linking) → one of
//   { status: "signin", token, needsProfile }  a Firebase custom token for the linked (or new) account
//   { status: "linked" }                         LinkedIn now signs in to the signed-in account
//   { status: "link-required", email }           that email has an account: sign in to it, then link LinkedIn
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "social-finish", clientIp(req), 20, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const deps = realDeps();
    const auth = bearer(req);
    const token = auth ? await verifyToken(deps, auth).catch(() => null) : null;
    const r = await finishLinkedIn(getAdminDb(), { ticket: b.ticket, bindCookie: req.cookies.get(BIND_COOKIE)?.value, host: req.headers.get("host"), token, ip: clientIp(req) }, deps);
    const res = NextResponse.json(r, { headers: noStore });
    res.cookies.set(BIND_COOKIE, "", { path: "/api/auth/linkedin", maxAge: 0 });
    return res;
  } catch (err) {
    return socialAuthFail(err, "Couldn't finish signing in with LinkedIn");
  }
}
