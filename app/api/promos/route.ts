import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { PromoError, claimPromoPlan, joinPromoTournament, myPromo, promoStatus } from "@/lib/promos-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Promo campaigns (lib/promos.ts), e.g. DAVIDO-at-34.
//   GET ?code=DAVIDO-at-34            → what's left: plans per tier, venture slots, tournament sign-ups (anyone)
//   GET ?code=…&mine=1                → plus { mine: { plan, tournament } } for the signed-in member
//   POST { action: "claim", code, tier: "pro" | "business" | "enterprise" } → { tier, until, left }   (signed in, verified email)
//   POST { action: "tournament", code } → { entries }                                                   (signed in, adults, on the day)
// Venture slots are claimed by sending a pitch with { promoCode } to /api/ventures (lib/ventures-server.ts).
export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const code = req.nextUrl.searchParams.get("code");
    const status = await promoStatus(db, code);
    if (req.nextUrl.searchParams.get("mine")) {
      const me = await verifySignedInRequest(bearer(req)).catch(() => null);
      if (me) return NextResponse.json({ ...status, mine: await myPromo(db, me.uid, code) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the offer");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "promo", me.uid, 20, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const who = { uid: me.uid, emailVerified: !!me.emailVerified };
    if (body.action === "claim") return NextResponse.json(await claimPromoPlan(db, who, body.code, body.tier));
    if (body.action === "tournament") return NextResponse.json(await joinPromoTournament(db, who, body.code));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}

function fail(err: unknown, fallback: string) {
  if (err instanceof PromoError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
