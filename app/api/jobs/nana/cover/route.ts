import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { coverNote } from "@/lib/nana-jobs-server";
import { liveDeps, me, njFail, noStore } from "@/lib/nana-jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { hash } → a cover note for that shortlisted job, written by the member's own AI from their "shipped" list only. They edit it and
// apply themselves: Nana never applies.
export async function POST(req: NextRequest) {
  try {
    const uid = await me(req);
    const limited = await rateLimit(req, "nana-jobs-cover", uid, 20, 86400);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await coverNote(getAdminDb(), uid, b.hash, liveDeps()), noStore);
  } catch (err) { return njFail(err, "Couldn't write it just now"); }
}
