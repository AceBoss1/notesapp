import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb } from "@/lib/firebase-admin";
import { PasskeyError, rpIdFor } from "@/lib/passkeys";
import { authenticationOptions, verifyAuthentication } from "@/lib/passkeys-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Signing in with a passkey (signed out), in two steps:
//   POST { step: "options" }                       → { options, challengeId } for navigator.credentials.get
//   POST { step: "verify", challengeId, response }  → { token }: a Firebase custom token the page signs in with
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "passkey-login", clientIp(req), 30, 600);
    if (limited) return limited;
    const rpID = rpIdFor(req.headers.get("host"));
    if (!rpID) throw new PasskeyError(400, "Passkeys work on the NotesApp site and app, not on this address.");
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if (b.step === "options") return NextResponse.json(await authenticationOptions(db, rpID), { headers: { "Cache-Control": "no-store" } });
    if (b.step === "verify") {
      const { token } = await verifyAuthentication(db, b, req.headers.get("origin"));
      return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
    }
    throw new PasskeyError(400, "Unknown step.");
  } catch (err) {
    if (err instanceof PasskeyError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't sign in with a passkey");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
