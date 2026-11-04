import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { bearer, noStore, socialAuthFail } from "@/lib/social-auth-api";
import { confirmGoogle, realDeps, verifyToken } from "@/lib/social-auth-server";

export const dynamic = "force-dynamic";

// POST { mode: "signin" | "link" } with the ID token from right after "Continue with Google" or "Link Google" (lib/social-auth-server.ts).
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "social-google", clientIp(req), 30, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const deps = realDeps();
    const t = await verifyToken(deps, bearer(req));
    const r = await confirmGoogle(getAdminDb(), t, b.mode === "link" ? "link" : "signin", deps, clientIp(req));
    return NextResponse.json(r, { headers: noStore });
  } catch (err) {
    return socialAuthFail(err, "Couldn't finish signing in with Google");
  }
}
