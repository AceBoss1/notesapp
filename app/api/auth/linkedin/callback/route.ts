import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { SITE_URL } from "@/lib/host";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { linkedinCallback, realDeps } from "@/lib/social-auth-server";

export const dynamic = "force-dynamic";

// LinkedIn sends the browser back here (the main site of the visitor's domain family) with ?code&state, or ?error. We check the
// state (once only), swap the code for LinkedIn's ID token, check it, and send the browser back to the page that started, with a
// one-time ticket in the address fragment. Nothing is signed in, made or linked here: /finish does that, in the browser that started.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "social-callback", clientIp(req), 30, 600);
  if (limited) return limited;
  const q = req.nextUrl.searchParams;
  let to: string;
  try {
    to = await linkedinCallback(getAdminDb(), { code: q.get("code"), state: q.get("state"), error: q.get("error"), callbackHost: req.headers.get("host") }, realDeps());
  } catch (err) {
    console.error("[social-auth] callback failed", err);
    to = `${SITE_URL}/login#li_error=failed`;
  }
  const res = NextResponse.redirect(to, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
