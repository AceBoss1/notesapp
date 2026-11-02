import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { LeadError, submitFeedback } from "@/lib/leads-server";

export const dynamic = "force-dynamic";

// The one-month feedback form (/contact?topic=feedback, components/FeedbackForm.tsx). Anyone can send it, signed in or not; a
// signed-in member's reply is linked to their account. Saved as a lead of category "feedback" (Admin → Leads → Feedback).
// POST { name, email, mood 1-5, love, missing, recommend 0-10, contactOk } → { ok, id }. 5 an hour per address (and per member).
export async function POST(req: NextRequest) {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  const limited = (await rateLimit(req, "feedback", `ip:${clientIp(req)}`, 5, 3600)) ?? (me ? await rateLimit(req, "feedback", me.uid, 5, 3600) : null);
  if (limited) return limited;
  try {
    const r = await submitFeedback(getAdminDb(), await req.json().catch(() => ({})), { uid: me?.uid ?? null });
    return NextResponse.json({ ok: true, id: r.id });
  } catch (err) {
    if (err instanceof LeadError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[feedback]", err);
    return NextResponse.json({ error: "Couldn't send that. Try again." }, { status: 500 });
  }
}
