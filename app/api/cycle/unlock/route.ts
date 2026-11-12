import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { PasskeyError, rpIdFor } from "@/lib/passkeys";
import { hasPasskeyFor, verifyUser, verifyUserOptions } from "@/lib/passkeys-server";
import { mayUnlock } from "@/lib/cycle-server";
import { NO_STORE, clearUnlock, fail, setUnlock, signedIn } from "@/lib/cycle-api";

export const dynamic = "force-dynamic";

// Unlocking My Cycle with a passkey (user verification required: her fingerprint, face or screen lock), every time.
//   GET                                          → { hasPasskey } for this address
//   POST { step: "options" }                     → { options, challengeId } for navigator.credentials.get
//   POST { step: "verify", challengeId, response } → sets the unlock cookie
//   POST ?lock=1 (or DELETE)                     → locks again (the page sends it when she switches apps; no sign-in needed)
export async function GET(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const rpID = rpIdFor(req.headers.get("host"));
    return NextResponse.json({ hasPasskey: !!rpID && (await hasPasskeyFor(getAdminDb(), me.uid, rpID)), passkeysHere: !!rpID }, { headers: NO_STORE });
  } catch (err) { return fail(req, err, "Couldn't check your passkeys"); }
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("lock")) return clearUnlock(req, NextResponse.json({ ok: true }, { headers: NO_STORE }));
  try {
    const me = await signedIn(req);
    const limited = await rateLimit(req, "cycle-unlock", me.uid, 60, 600);
    if (limited) return limited;
    const rpID = rpIdFor(req.headers.get("host"));
    if (!rpID) throw new PasskeyError(400, "Open My Cycle on the NotesApp site or app to unlock it.");
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if (b.step === "options") {
      await mayUnlock(db, me.uid);
      return NextResponse.json(await verifyUserOptions(db, me.uid, rpID), { headers: NO_STORE });
    }
    if (b.step === "verify") {
      await verifyUser(db, me.uid, b, req.headers.get("origin"));
      return setUnlock(req, NextResponse.json({ ok: true }, { headers: NO_STORE }), me.uid);
    }
    throw new PasskeyError(400, "Unknown step.");
  } catch (err) { return fail(req, err, "Couldn't unlock My Cycle"); }
}

export async function DELETE(req: NextRequest) {
  return clearUnlock(req, NextResponse.json({ ok: true }, { headers: NO_STORE }));
}
