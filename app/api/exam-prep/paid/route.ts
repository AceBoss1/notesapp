import { NextRequest } from "next/server";
import { fulfillPayment } from "@/lib/payments";
import { confirmPackPayment } from "@/lib/exam-prep-server";
import { db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET ?reference=&code= → after Paystack sends the payer back: checked with Paystack, and the pack opened only if it says success.
// The buyer must be signed in as the account it's for, or (a pay link) give the link's code.
export async function GET(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "paid", u?.uid ?? null, 30, 600);
    if (limited) return limited;
    const q = req.nextUrl.searchParams;
    return ok(await confirmPackPayment(db(), q.get("reference"), { uid: u?.uid, code: q.get("code") || undefined }, fulfillPayment));
  } catch (e) { return fail(e); }
}
