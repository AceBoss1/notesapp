import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { PasskeyError, deviceLabel, rpIdFor } from "@/lib/passkeys";
import { registrationOptions, verifyRegistration } from "@/lib/passkeys-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Adding a passkey to the signed-in account, in two steps:
//   POST { step: "options" }                           → { options, challengeId } for the browser's navigator.credentials.create
//   POST { step: "verify", challengeId, response, name? } → the saved passkey
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req));
    const limited = await rateLimit(req, "passkey-add", me.uid, 20, 3600);
    if (limited) return limited;
    const rpID = rpIdFor(req.headers.get("host"));
    if (!rpID) throw new PasskeyError(400, "Passkeys can be added on the NotesApp site and app, not on this address.");
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if (b.step === "options") return NextResponse.json(await registrationOptions(db, me, rpID), { headers: { "Cache-Control": "no-store" } });
    if (b.step === "verify") {
      const passkey = await verifyRegistration(db, me, b, req.headers.get("origin"), deviceLabel(req.headers.get("user-agent")));
      return NextResponse.json({ passkey });
    }
    throw new PasskeyError(400, "Unknown step.");
  } catch (err) {
    if (err instanceof PasskeyError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't add a passkey");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
