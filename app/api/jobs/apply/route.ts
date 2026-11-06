import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { applyToJob, myApplications, withdrawApplication } from "@/lib/jobs-server";
import { jobsFail, signedIn } from "@/lib/jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET: my job applications. POST { jobId, coverNote, links?, phone?, city?, consent: true } applies; { withdraw: <applicationId> } withdraws.
export async function GET(req: NextRequest) {
  try {
    const me = await signedIn(req, false);
    return NextResponse.json({ applications: await myApplications(getAdminDb(), me.uid) });
  } catch (err) {
    return jobsFail(err, "Couldn't load your applications");
  }
}
export async function POST(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const b = await req.json().catch(() => ({}));
    if (b.withdraw) { await withdrawApplication(getAdminDb(), me.uid, b.withdraw); return NextResponse.json({ ok: true }); }
    const limited = await rateLimit(req, "jobs-apply", me.uid, 20, 86400);
    if (limited) return limited;
    return NextResponse.json(await applyToJob(getAdminDb(), me, b.jobId, b));
  } catch (err) {
    return jobsFail(err, "Couldn't send your application");
  }
}
