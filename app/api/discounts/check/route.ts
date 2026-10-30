import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { DiscountError, NOTESAPP_OWNER, describeCode, isNotesAppTarget, isPublisherTarget } from "@/lib/discounts";
import { applyCode } from "@/lib/discounts-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// The "Apply" button at a checkout: does this code work here, and how much does it take off? Only a preview. The checkout
// (app/api/paystack/initialize) works the price out again from the server's own prices, so a wrong subtotal sent here changes nothing.
// POST { code, target, seller? (username, for a publisher's product), itemId?, itemIds?, subtotalKobo, extraKobo? }
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
    const subtotalKobo = Math.max(0, Math.round(Number(b.subtotalKobo) || 0));
    const r = await applyCode(db, owner, b.code, me.uid, {
      target, subtotalKobo, extraKobo: Math.max(0, Math.round(Number(b.extraKobo) || 0)),
      ...(typeof b.itemId === "string" ? { itemId: b.itemId } : {}),
      ...(Array.isArray(b.itemIds) ? { itemIds: b.itemIds.map(String) } : {}),
    } as Parameters<typeof applyCode>[4]);
    return NextResponse.json({ code: r.code.code, discountKobo: r.discountKobo, label: describeCode(r.code) });
  } catch (e) {
    if (e instanceof DiscountError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("discount check", e);
    return NextResponse.json({ error: "Couldn't check that code. Try again." }, { status: 500 });
  }
}
