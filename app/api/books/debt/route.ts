import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { fulfillPayment } from "@/lib/payments";
import { BooksError } from "@/lib/books-server";
import { checkDebtPayment, startDebtPayment } from "@/lib/books-debt-server";

// Paying a debt online from a customer's statement link (/statement/<code>; lib/books-debt-server.ts). No sign-in needed.
// POST { action: "start", code, amount, email } → { url, reference }: Paystack's checkout (card or bank transfer), for all or part of what
//   they owe. A signed-in member's uid is kept so their receipt also reaches their bell.
// POST { action: "check", code, reference } → { status, receiptUrl }: after Paystack sends them back. Paystack's webhook does the same, and
//   whichever lands first records it (lib/payments.ts fulfillPayment is idempotent).
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    await ensurePricing();
    if (b.action === "check") {
      const l = await rateLimit(req, "books-debt-check", ip, 60, 600);
      if (l) return l;
      return NextResponse.json(await checkDebtPayment(db, String(b.code ?? ""), String(b.reference ?? ""), fulfillPayment), { headers: { "Cache-Control": "no-store" } });
    }
    if (b.action !== "start") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    const l = (await rateLimit(req, "books-debt-start", ip, 10, 3600)) ?? (await rateLimit(req, "books-debt-code", String(b.code ?? "x"), 20, 3600));
    if (l) return NextResponse.json({ error: "Too many tries. Wait a little and try again." }, { status: 429 });
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    return NextResponse.json(await startDebtPayment(db, { code: b.code, amount: b.amount, email: b.email, uid: me?.uid }));
  } catch (err) {
    if (err instanceof BooksError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't start the payment");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
