import { NextRequest, NextResponse } from "next/server";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS, safeTarget } from "@/lib/referrals";

// A member's referral or affiliate link: /r/<username>, or /r/<username>?to=/shop/<item>. Remembers who sent the visitor for
// REFERRAL_COOKIE_DAYS (the latest link wins), then goes on to the page: sign-up by default, or the product. Whether the member can
// earn is checked later, when there is something to earn (lib/referrals-server.ts).
export function GET(req: NextRequest, { params }: { params: { username: string } }) {
  const to = safeTarget(req.nextUrl.searchParams.get("to") ?? "/signup");
  const res = NextResponse.redirect(new URL(to, req.nextUrl.origin));
  const u = String(params.username ?? "").toLowerCase();
  if (/^[a-z0-9_-]{2,30}$/.test(u)) {
    res.cookies.set(REFERRAL_COOKIE, u, { path: "/", maxAge: REFERRAL_COOKIE_DAYS * 86_400, sameSite: "lax", secure: req.nextUrl.protocol === "https:", httpOnly: true });
  }
  return res;
}
