import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { WALLET_LIVE } from "@/lib/wallet";
import { walletSummary } from "@/lib/wallet-server";

export const dynamic = "force-dynamic";

// GET → { creditKobo, bonusKobo, bonusLots, activity } for the signed-in member. ?brief=1 leaves out the activity (checkout, top bar).
export async function GET(req: NextRequest) {
  try {
    if (!WALLET_LIVE) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "wallet", me.uid, 60, 60);
    if (limited) return limited;
    const brief = req.nextUrl.searchParams.get("brief") === "1";
    const s = await walletSummary(getAdminDb(), me.uid, brief ? 0 : 100);
    return NextResponse.json(brief ? { creditKobo: s.creditKobo, bonusKobo: s.bonusKobo } : s);
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load your wallet");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
