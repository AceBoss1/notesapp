import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { createReport } from "@/lib/reports-server";
import { MomentError } from "@/lib/moments-server";
import { jobsFail, signedIn } from "@/lib/jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST { jobId, reason, note? }: report a job to Trust & safety (Admin → Reports). Actioning it takes the job down.
export async function POST(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const limited = await rateLimit(req, "jobs-report", me.uid, 20, 86400);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await createReport(getAdminDb(), me.uid, { kind: "job", targetId: b.jobId, reason: b.reason, note: b.note }));
  } catch (err) {
    if (err instanceof MomentError) return NextResponse.json({ error: err.message }, { status: err.status });
    return jobsFail(err, "Couldn't send the report");
  }
}
