import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { DiscountError, NOTESAPP_OWNER, describeCode, isNotesAppTarget, isPublisherTarget } from "@/lib/discounts";
import { applyCode } from "@/lib/discounts-server";
import { rateLimit } from "@/lib/rate-limit";
import { tierPrice } from "@/lib/tier-billing";
import { ReferralError, referralByCode } from "@/lib/referrals-server";

export const dynamic = "force-dynamic";

// The "Apply" button at a checkout: does this code work here, and how much does it take off? Only a preview. The checkout
// (app/api/paystack/initialize) works the price out again from the server's own prices, so a wrong subtotal sent here changes nothing.
// POST { code, target, seller? (username, for a publisher's product), itemId?, itemIds?, subtotalKobo, extraKobo? }
// Plans: { code, target: "plan", tier, interval }, priced here; a code that isn't #NotesApp's is tried as a member's referral code.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in to use a code." }, { status: 401 });
    // Guessing codes one after another is slowed right down.
    const limited = await rateLimit(req, "discount-check", me.uid, 20, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const target = String(b.target ?? "");
    const db = getAdminDb();
    let owner: string;
    if (isNotesAppTarget(target)) owner = NOTESAPP_OWNER;
    else if (isPublisherTarget(target)) {
      const u = String(b.seller ?? "").toLowerCase();
      owner = /^[a-z0-9_-]{2,30}$/.test(u) ? String((await db.doc(`usernames/${u}`).get()).data()?.uid ?? "") : "";
      if (!owner) return NextResponse.json({ error: "That code isn't valid here." }, { status: 404 });
    } else return NextResponse.json({ error: "Unknown checkout." }, { status: 400 });
    if (target === "plan") {
      const tier = b.tier === "business" ? "business" : "pro", interval = b.interval === "annually" ? "annually" : "monthly";
      const price = tierPrice(tier, interval) ?? 0, month = tierPrice(tier, "monthly") ?? 0;
      let notOurs: DiscountError | null = null;
      try {
        const r = await applyCode(db, NOTESAPP_OWNER, b.code, me.uid, { target: "plan", subtotalKobo: price, itemId: tier });
        return NextResponse.json({ code: r.code.code, discountKobo: r.discountKobo, label: `${describeCode(r.code)} your first ${interval === "monthly" ? "month" : "year"}` });
      } catch (e) {
        if (!(e instanceof DiscountError && e.status === 404)) throw e;
        notOurs = e;
      }
      try {
        const ref = await referralByCode(db, me.uid, b.code);
        return NextResponse.json({
          code: String(b.code).trim(), discountKobo: interval === "monthly" ? month : Math.min(month, price),
          label: interval === "monthly" ? `@${ref.username} invited you: first month free (a ₦100 card check, given back)` : `@${ref.username} invited you: one month off your first year`,
        });
      } catch (e) {
        if (e instanceof ReferralError) return NextResponse.json({ error: e.status === 404 && notOurs ? notOurs.message : e.message }, { status: e.status });
        throw e;
      }
    }
    const subtotalKobo = Math.max(0, Math.round(Number(b.subtotalKobo) || 0));
    const r = await applyCode(db, owner, b.code, me.uid, {
      target, subtotalKobo, extraKobo: Math.max(0, Math.round(Number(b.extraKobo) || 0)),
      ...(typeof b.itemId === "string" ? { itemId: b.itemId } : {}),
      ...(Array.isArray(b.itemIds) ? { itemIds: b.itemIds.map(String) } : {}),
    } as Parameters<typeof applyCode>[4]);
    return NextResponse.json({ code: String(b.code).trim().toUpperCase(), discountKobo: r.discountKobo, label: describeCode(r.code) + (r.affiliate ? ` · shared by @${r.affiliate.username}` : "") });
  } catch (e) {
    if (e instanceof DiscountError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("discount check", e);
    return NextResponse.json({ error: "Couldn't check that code. Try again." }, { status: 500 });
  }
}
