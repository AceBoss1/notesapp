import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { CourseError } from "@/lib/courses-server";
import { myPurchase, refundable, undoCoursePurchase } from "@/lib/course-sales-server";
import { refundPayment } from "@/lib/refunds";
import { academyClosed, academyError, NO_STORE, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// GET ?courseId= → { purchase: { reference, refundable, refundUntil } | null }: the learner's purchase of a paid course.
// POST { action: "refund", courseId } → { ok }: the learner's own refund, within 7 days of buying and before they've started. The money
// goes back the way it came (card, or the wallet).
export async function GET(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    return NextResponse.json({ purchase: await myPurchase(getAdminDb(), uid, req.nextUrl.searchParams.get("courseId")) }, { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't load your purchase");
  }
}

export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-refund", uid, 5, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (b.action !== "refund") return NextResponse.json({ error: "What would you like to do?" }, { status: 400 });
    const db = getAdminDb();
    const p = await myPurchase(db, uid, b.courseId);
    if (!p) throw new CourseError("You haven't bought this course.", 404);
    const r = await refundable(db, p.reference);
    if (!r.ok) throw new CourseError(r.reason, 409);
    const shares = await db.collection("ledger").where("paymentReference", "==", p.reference).get();
    const main = (await db.doc(`ledger/${p.reference}`).get()).data();
    if ([main, ...shares.docs.map((d) => d.data())].some((e) => e && ["paid_out", "transferring"].includes(String(e.status)))) {
      throw new CourseError("This sale has already been paid out. Contact us and we'll sort the refund.", 409);
    }
    await refundPayment(p.reference);
    await undoCoursePurchase(db, p.reference);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return academyError(err, "Couldn't refund the course");
  }
}
