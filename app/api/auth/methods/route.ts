import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { SocialAuthError, isSocialProvider } from "@/lib/social-auth";
import { bearer, noStore, socialAuthFail } from "@/lib/social-auth-api";
import { linkedinConfigured, methodsOf, realDeps, unlinkMethod, verifyToken } from "@/lib/social-auth-server";

export const dynamic = "force-dynamic";

// GET (signed in): the account's sign-in methods. GET without a token: { linkedinAvailable } for the sign-in buttons.
// DELETE { provider: "google" | "linkedin" } (signed in): unlink one, never the last way in.
export async function GET(req: NextRequest) {
  try {
    const tok = bearer(req);
    if (!tok) return NextResponse.json({ linkedinAvailable: linkedinConfigured() }, { headers: { "Cache-Control": "public, max-age=300" } });
    const deps = realDeps();
    const t = await verifyToken(deps, tok);
    return NextResponse.json(await methodsOf(getAdminDb(), t.uid, deps), { headers: noStore });
  } catch (err) {
    return socialAuthFail(err, "Couldn't load your sign-in methods");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const deps = realDeps();
    const t = await verifyToken(deps, bearer(req));
    const limited = await rateLimit(req, "social-unlink", t.uid, 10, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (!isSocialProvider(b.provider)) throw new SocialAuthError(400, "Choose Google or LinkedIn.");
    await unlinkMethod(getAdminDb(), t.uid, b.provider, deps, clientIp(req));
    return NextResponse.json(await methodsOf(getAdminDb(), t.uid, deps), { headers: noStore });
  } catch (err) {
    return socialAuthFail(err, "Couldn't unlink that");
  }
}
