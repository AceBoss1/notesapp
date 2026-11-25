import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { ensurePricing } from "@/lib/pricing-server";
import { rateLimit } from "@/lib/rate-limit";
import { trialView } from "@/lib/trial-earnings-server";

export const dynamic = "force-dynamic";

// What a free trial kept you (lib/trial-earnings.ts): the running total while a trial runs, or the last trial's result. Only the member's
// own figures. GET → { view }.
export async function GET(req: NextRequest) {
  let uid: string;
  try { uid = (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid; }
  catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const limited = await rateLimit(req, "trial-view", uid, 30, 60);
  if (limited) return limited;
  await ensurePricing();
  return NextResponse.json({ view: await trialView(getAdminDb(), uid) }, { headers: { "Cache-Control": "no-store" } });
}
