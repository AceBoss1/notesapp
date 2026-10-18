import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { ensurePricing } from "@/lib/pricing-server";
import { currentPricing } from "@/lib/pricing";
import { academyOf, saveAcademy } from "@/lib/certificates-server";
import { academyClosed, academyError, NO_STORE, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// A teacher's one-time academy setup (app/(main)/academy/setup; lib/certificates.ts): who issues and signs their certificates, an
// accrediting institution (shown once #NotesApp approves it) and their margin on top of our part of the price.
// GET → { academy | null, minKobo, late }   POST { …the form } → { academy }
export async function GET(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  const uid = await signedInUid(req);
  if (!uid) return signInFirst();
  await ensurePricing();
  const p = currentPricing();
  return NextResponse.json({ academy: await academyOf(getAdminDb(), uid), minKobo: p.coursePackages.certificateMinKobo, late: p.certificateLate }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-setup", uid, 30, 3600);
    if (limited) return limited;
    return NextResponse.json({ academy: await saveAcademy(getAdminDb(), uid, await req.json().catch(() => ({}))) });
  } catch (err) {
    return academyError(err, "Couldn't save your academy");
  }
}
