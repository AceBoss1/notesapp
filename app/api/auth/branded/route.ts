import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, verifySignedInRequest } from "@/lib/firebase-admin";
import { whiteLabelOwner } from "@/lib/domains";
import { sendEmail, type EmailBrand } from "@/lib/email";
import { normalizeHost, isMainHost } from "@/lib/host";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// The emails around signing in on an Enterprise member's own domain, sent under the member's name and logo with links that open
// on their domain (never a #NotesApp or Firebase page).
//   POST { kind: "reset", email }        → a password reset link (also how someone who signed up with Google sets a password)
//   POST { kind: "verify" } + Bearer      → the verification link for the signed-in caller
// The domain is the one the request arrived on; anything that isn't an active full-white-label domain is refused.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "auth-branded", clientIp(req), 10, 3600);
  if (limited) return limited;
  try {
    const host = normalizeHost((req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0]);
    if (!host || isMainHost(host)) return NextResponse.json({ error: "Not available here." }, { status: 400 });
    const owner = await whiteLabelOwner(host);
    if (!owner) return NextResponse.json({ error: "Not available here." }, { status: 400 });
    const brand: EmailBrand = { name: owner.displayName, logoUrl: /^https?:/.test(owner.avatar) ? owner.avatar : `https://${host}${owner.avatar}`, siteUrl: `https://${host}` };
    const body = await req.json().catch(() => ({}));
    const auth = getAuth(getAdminApp());

    // Takes the one-time code out of Firebase's link, and builds ours on the member's domain.
    const ours = (firebaseLink: string, mode: string) => `https://${host}/auth/action?mode=${mode}&oobCode=${encodeURIComponent(new URL(firebaseLink).searchParams.get("oobCode") || "")}`;

    if (body.kind === "reset") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
      const byEmail = rateLimit(req, "auth-branded-email", email, 3, 3600);
      if (byEmail) return byEmail;
      try {
        const link = ours(await auth.generatePasswordResetLink(email), "resetPassword");
        await sendEmail({
          to: email, brand, subject: `Reset your password — ${brand.name}`,
          text: `Someone asked to reset the password for your NotesApp account on ${brand.name}. If it was you, use the button below. If not, you can ignore this email and nothing will change.`,
          action: { label: "Choose a new password", url: link },
        });
      } catch { /* an unknown email looks the same as a known one */ }
      return NextResponse.json({ ok: true });
    }

    if (body.kind === "verify") {
      const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
      if (!me || !me.email) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      if (me.emailVerified) return NextResponse.json({ ok: true, already: true });
      const byUser = rateLimit(req, "auth-branded-verify", me.uid, 3, 3600);
      if (byUser) return byUser;
      const link = ours(await auth.generateEmailVerificationLink(me.email), "verifyEmail");
      const sent = await sendEmail({
        to: me.email, brand, subject: `Confirm your email — ${brand.name}`,
        text: `Welcome to ${brand.name}. Please confirm your email address so we can send you booking and order updates.`,
        action: { label: "Confirm my email", url: link },
      });
      return NextResponse.json({ ok: sent });
    }
    return NextResponse.json({ error: "Unknown request." }, { status: 400 });
  } catch (err) {
    console.error("branded auth email failed:", err);
    return NextResponse.json({ error: "Couldn't send that right now. Try again in a few minutes." }, { status: 500 });
  }
}
