import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { ACADEMY_LIVE } from "@/lib/courses";
import { ensurePricing } from "@/lib/pricing-server";
import { quote } from "@/lib/certificates-server";
import { academyClosed, academyError, NO_STORE, signInFirst, signedInUid } from "@/lib/academy-api";
import { claimIncludedCertificate } from "@/lib/course-sales-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET ?courseId=&name= → what the learner would pay today for their certificate (the late claim fee included), the certificate they'd
// get, and its ID if they already have it. The name defaults to the one on their profile.
export async function GET(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    await ensurePricing();
    const db = getAdminDb();
    const p = req.nextUrl.searchParams;
    const name = (p.get("name") || String((await db.doc(`users/${uid}`).get()).data()?.displayName ?? "")).slice(0, 70);
    return NextResponse.json({ quote: await quote(db, uid, String(p.get("courseId") ?? ""), name || "Your name"), name }, { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't price your certificate");
  }
}

// POST { courseId, learnerName } → { id }: the certificate of a paid course whose price includes it, issued without another payment.
export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-certificate", uid, 10, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ id: await claimIncludedCertificate(getAdminDb(), uid, b.courseId, b.learnerName) });
  } catch (err) {
    return academyError(err, "Couldn't issue your certificate");
  }
}
