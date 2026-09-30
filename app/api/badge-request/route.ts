import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { GOLD_KIND_LIVE } from "@/lib/badges";
import { isGoldKind, isGoldTrack } from "@/lib/gold";

export const dynamic = "force-dynamic";

// A member applies for the gold badge (endorsement, or identity once live).
// Text only — we never collect ID documents. An admin reviews it in /admin/users.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email first, then apply." }, { status: 403 });
    const limited = rateLimit(req, "badge-request", user.uid, 5, 3600);
    if (limited) return limited;

    const { message, kind = "endorsement", track = "personal" } = await req.json().catch(() => ({}));
    if (!isGoldKind(kind) || !isGoldTrack(track)) return NextResponse.json({ error: "Choose a badge type and track." }, { status: 400 });
    if (!GOLD_KIND_LIVE[kind]) return NextResponse.json({ error: "That badge type isn't open yet." }, { status: 409 });
    const text = typeof message === "string" ? message.trim().slice(0, 800) : "";
    if (text.length < 20) return NextResponse.json({ error: "Tell us who you are and why you should be endorsed — include links (website, LinkedIn, published work)." }, { status: 400 });

    const db = getAdminDb();
    const me = (await db.doc(`users/${user.uid}`).get()).data();
    if (!me) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (me.suspended) return NextResponse.json({ error: "Suspended accounts can't apply." }, { status: 403 });
    if (me.goldBadge) return NextResponse.json({ error: "You already have a gold badge." }, { status: 409 });
    const ref = db.doc(`badgeRequests/${user.uid}`);
    const existing = (await ref.get()).data();
    if (existing && ["pending", "approved", "active"].includes(existing.status)) {
      return NextResponse.json({ error: "You already have an application in progress." }, { status: 409 });
    }
    // A rejected identity check's deposit isn't refundable; reapplying starts
    // again at awaiting_deposit, so a new deposit is due.

    await ref.set({
      status: kind === "identity" ? "awaiting_deposit" : "pending",
      kind,
      track,
      message: text,
      requestedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't submit your application");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
