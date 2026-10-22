import { NextRequest } from "next/server";
import { initializeTransaction, newReference } from "@/lib/paystack";
import { LEGAL_VERSION } from "@/lib/legal";
import { callbackOrigin } from "@/lib/origin";
import { PrepError, startPackCheckout } from "@/lib/exam-prep-server";
import { body, db, fail, limit, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// POST { exam } → a Paystack checkout for that one pack, on this account. The price and months are read from the pack here.
export async function POST(req: NextRequest) {
  try {
    const u = await needUser(req);
    if (!u.email) throw new PrepError("Your account needs an email to pay.");
    if (!u.emailVerified) throw new PrepError("Verify your email first: check your inbox for the link.", 403);
    const limited = await limit(req, "checkout", u.uid, 10, 600);
    if (limited) return limited;
    const me = (await db().doc(`users/${u.uid}`).get()).data();
    if (me?.consent?.version !== LEGAL_VERSION) throw new PrepError("Please accept the Terms of Service and Privacy Policy first.", 403);
    return ok(await startPackCheckout(db(), { uid: u.uid, email: u.email }, (await body(req)).exam, await callbackOrigin(req), initializeTransaction, newReference));
  } catch (e) { return fail(e); }
}
