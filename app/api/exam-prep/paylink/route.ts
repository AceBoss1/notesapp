import { NextRequest } from "next/server";
import { initializeTransaction, newReference } from "@/lib/paystack";
import { callbackOrigin } from "@/lib/origin";
import { createPayLink, payLinkInfo, startPayLinkCheckout } from "@/lib/exam-prep-server";
import { body, db, fail, limit, maybeUser, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET ?code= → what a pay link is for (the student's nickname, the pack, the price). Nothing private.
export async function GET(req: NextRequest) {
  try {
    const limited = await limit(req, "paylink-read", null, 60, 600);
    if (limited) return limited;
    const { uid: _uid, ...info } = await payLinkInfo(db(), req.nextUrl.searchParams.get("code"));
    void _uid;
    return ok(info);
  } catch (e) { return fail(e); }
}
// POST { exam, nickname } → a new pay link for this account (signed in).
// POST { code, email } → the payer (no account needed) starts paying.
export async function POST(req: NextRequest) {
  try {
    const b = await body(req);
    if (b.code) {
      const limited = await limit(req, "paylink-pay", (await maybeUser(req))?.uid ?? null, 10, 600);
      if (limited) return limited;
      return ok(await startPayLinkCheckout(db(), b.code, b.email, await callbackOrigin(req), initializeTransaction, newReference));
    }
    const u = await needUser(req);
    const limited = await limit(req, "paylink-new", u.uid, 10, 3600);
    if (limited) return limited;
    const link = await createPayLink(db(), u.uid, b.exam, b.nickname);
    return ok({ code: link.code, expiresAt: link.expiresAt, nickname: link.nickname });
  } catch (e) { return fail(e); }
}
