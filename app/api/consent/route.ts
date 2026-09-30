import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { LEGAL_VERSION } from "@/lib/legal";
import { rateLimit } from "@/lib/rate-limit";

// Records that the signed-in user accepted the current Terms + Privacy
// Policy (for accounts created before consent was collected).
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "consent", user.uid, 10, 3600);
    if (limited) return limited;
    await getAdminDb()
      .doc(`users/${user.uid}`)
      .set({ consent: { version: LEGAL_VERSION, acceptedAt: new Date().toISOString() } }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
