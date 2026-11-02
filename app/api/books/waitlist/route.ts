import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { LeadError, submitBooksWaitlist } from "@/lib/leads-server";
import { WAITLIST_LIMIT } from "@/lib/books-waitlist";

export const dynamic = "force-dynamic";

// The Business books waitlist (/books, components/BooksWaitlistForm.tsx). Anyone can join, signed in or not; a signed-in member's
// sign-up is linked to their account and gets a bell too. Saved as a lead of category "books-waitlist" (Admin → Leads → Business
// books waitlist). POST { name, email, businessType, sells, keepsBooks, otherApp?, city, notify } → { ok, id, again }.
// 5 an hour per address (and per member).
export async function POST(req: NextRequest) {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  const limited = (await rateLimit(req, "books-waitlist", `ip:${clientIp(req)}`, WAITLIST_LIMIT.max, WAITLIST_LIMIT.windowSec))
    ?? (me ? await rateLimit(req, "books-waitlist", me.uid, WAITLIST_LIMIT.max, WAITLIST_LIMIT.windowSec) : null);
  if (limited) return limited;
  try {
    const r = await submitBooksWaitlist(getAdminDb(), await req.json().catch(() => ({})), { uid: me?.uid ?? null });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    if (err instanceof LeadError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[books-waitlist]", err);
    return NextResponse.json({ error: "Couldn't add you just now. Try again." }, { status: 500 });
  }
}
