import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { finalizeTransfer, resendTransferOtp } from "@/lib/paystack";
import { handlePayoutOtp } from "@/lib/payout-otp-server";
import { emitWebhook } from "@/lib/webhooks";
import { rateLimit } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Paystack transfer OTPs, typed on /admin/payments instead of in the Paystack dashboard (lib/payout-otp-server.ts). Finance only.
//   POST { action: "finalize", reference, otp }  → { ok, status, ledgerStatus }   (POST /transfer/finalize_transfer)
//   POST { action: "resend", reference }         → { ok, otpSentAt, expiresAt }   (POST /transfer/resend_otp)
// 10 requests per 10 minutes per staff member, on top of the 5 tries per code the ledger entry keeps. Who did what goes in payoutOtpLog;
// the OTP is never stored or logged.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const db = getAdminDb();
  try {
    let admin: { uid: string; name: string } | null = null;
    try {
      const uid = await verifyAdminRequest(token, ["finance"]);
      const limited = await rateLimit(req, "payout-otp", uid, 10, 600);
      if (limited) return limited;
      const u = (await db.doc(`users/${uid}`).get()).data();
      admin = { uid, name: String(u?.displayName || u?.username || uid) };
    } catch { /* handlePayoutOtp answers 403 */ }
    const body = await req.json().catch(() => ({}));
    const out = await handlePayoutOtp(db, { token, body }, {
      verify: async () => { if (!admin) throw new Error("Finance only."); return admin; },
      finalize: finalizeTransfer,
      resend: resendTransferOtp,
      emit: (uid, event, data) => emitWebhook(uid, event, data),
    });
    return NextResponse.json(out.json, { status: out.status, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Payout OTP failed:", err instanceof Error ? err.message : "unknown");
    const f = friendlyMessage(err, "Couldn't reach Paystack");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
