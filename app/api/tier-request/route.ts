import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

// A Free Standard member applies for Free Basic (publishing). An admin
// reviews it in /admin/users. Clients can't write `tierRequest` directly
// (firestore.rules), so it goes through here.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email first, then apply." }, { status: 403 });
    const limited = rateLimit(req, "tier-request", user.uid, 5, 3600);
    if (limited) return limited;

    const { message } = await req.json();
    const text = typeof message === "string" ? message.trim().slice(0, 500) : "";
    if (text.length < 10) return NextResponse.json({ error: "Tell us a little about what you'd like to publish (at least a sentence)." }, { status: 400 });

    const ref = getAdminDb().doc(`users/${user.uid}`);
    const me = (await ref.get()).data();
    if (!me) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (me.accountTier && me.accountTier !== "standard") return NextResponse.json({ error: "Your account can already publish." }, { status: 409 });
    if (me.tierRequest?.status === "pending") return NextResponse.json({ error: "Your application is already waiting for review." }, { status: 409 });

    await ref.set({ tierRequest: { status: "pending", message: text, requestedAt: new Date().toISOString() } }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't submit your application");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
