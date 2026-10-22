import { NextRequest } from "next/server";
import { fulfillPayment } from "@/lib/payments";
import { restorePurchases } from "@/lib/exam-prep-server";
import { db, fail, limit, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// POST → "Restore my pack": this account's pack payments whose confirmation was missed are checked with Paystack again (no new charge).
export async function POST(req: NextRequest) {
  try {
    const u = await needUser(req);
    const limited = await limit(req, "restore", u.uid, 10, 3600);
    if (limited) return limited;
    return ok(await restorePurchases(db(), u.uid, fulfillPayment));
  } catch (e) { return fail(e); }
}
