import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { paidTierOf, startTrial, TrialError } from "@/lib/trials-server";
import { trialCheck } from "@/lib/trials";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// GET ?tier=pro|business → { ok, message? }: may the signed-in account start that free trial (lib/trials.ts), for the Pricing buttons.
export async function GET(req: NextRequest) {
  const me = await verifySignedInRequest(bearer(req)).catch(() => null);
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const db = getAdminDb();
  const user = (await db.doc(`users/${me.uid}`).get()).data() ?? {};
  const c = trialCheck(user, req.nextUrl.searchParams.get("tier"), new Date(), await paidTierOf(db, me.uid));
  return NextResponse.json(c.ok ? { ok: true } : { ok: false, reason: c.reason, message: c.message }, { headers: { "Cache-Control": "no-store" } });
}

// POST { tier } → { tier, until }: starts a 15-day free trial of Pro or Business (verified email; the rules in lib/trials.ts).
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "trial", me.uid, 10, 3600);
    if (limited) return limited;
    const { tier } = await req.json().catch(() => ({}));
    return NextResponse.json(await startTrial(getAdminDb(), me.uid, tier, { emailVerified: !!me.emailVerified }));
  } catch (err) {
    if (err instanceof TrialError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't start the trial");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
