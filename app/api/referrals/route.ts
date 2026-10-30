import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { REFERRAL_COOKIE } from "@/lib/referrals";
import { ReferralError, claimReferral, referralOfferFor, summary, withdraw } from "@/lib/referrals-server";
import { creditEarnings } from "@/lib/wallet-server";
import { WALLET_LIVE } from "@/lib/wallet";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// A member's referrals: GET → their earnings, friends and (if they were invited) their first-month offer.
// POST { action: "claim" }                       after sign-up: record who brought them (from the referral cookie)
// POST { action: "withdraw", method: "cash"|"credit" }
async function me(req: NextRequest) {
  const u = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!u) throw new ReferralError(401, "Sign in first.");
  return u;
}
const fail = (e: unknown) => {
  if (e instanceof ReferralError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("referrals", e);
  return NextResponse.json({ error: "Couldn't do that. Try again." }, { status: 500 });
};

export async function GET(req: NextRequest) {
  try {
    const u = await me(req);
    const db = getAdminDb();
    const [s, offer, username, bank] = await Promise.all([
      summary(db, u.uid), referralOfferFor(db, u.uid), db.doc(`users/${u.uid}`).get().then((d) => String(d.data()?.username ?? "")),
      db.doc(`payoutAccounts/${u.uid}`).get().then((d) => d.data()),
    ]);
    const payout = bank?.recipientCode ? { bankName: String(bank.bankName ?? ""), accountLast4: String(bank.accountLast4 ?? "") } : null;
    return NextResponse.json({ ...s, username, verified: u.emailVerified, walletLive: WALLET_LIVE, payout, offer: offer ? { from: offer.referrerUsername } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await me(req);
    const limited = await rateLimit(req, "referrals", u.uid, 20, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (body.action === "claim") {
      const r = await claimReferral(db, u.uid, req.cookies.get(REFERRAL_COOKIE)?.value);
      return NextResponse.json(r);
    }
    if (body.action === "withdraw") {
      if (!u.emailVerified) throw new ReferralError(403, "Verify your email first.");
      const method = body.method === "credit" ? "credit" : "cash";
      const r = await withdraw(db, u.uid, method, new Date(), {
        walletLive: WALLET_LIVE,
        creditWallet: (t, uid, creditKobo, bonusKobo, id, now) => creditEarnings(t, db, uid, creditKobo, bonusKobo, id, now),
      });
      return NextResponse.json(r);
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return fail(e); }
}
