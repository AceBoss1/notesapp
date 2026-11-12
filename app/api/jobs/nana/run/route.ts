import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { runFor } from "@/lib/nana-jobs-server";
import { liveDeps, me, njFail, noStore } from "@/lib/nana-jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Run it now (on demand), on top of the daily run. A few times a day: it's the member's AI and their bill.
export async function POST(req: NextRequest) {
  try {
    const uid = await me(req);
    const limited = await rateLimit(req, "nana-jobs-run", uid, 4, 86400);
    if (limited) return limited;
    return NextResponse.json({ run: await runFor(getAdminDb(), uid, { ...liveDeps(), budgetMs: 90_000 }, { manual: true }) }, noStore);
  } catch (err) { return njFail(err, "Couldn't run it just now"); }
}
