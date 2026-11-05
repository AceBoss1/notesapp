import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { listJobs } from "@/lib/jobs-server";
import { jobsFail, optionalUid } from "@/lib/jobs-api";

export const dynamic = "force-dynamic";

// GET: every open job on Notes Jobs, newest first (Explore → Jobs); signed in, also "Jobs for you" (Business and Enterprise jobs that fit).
export async function GET(req: NextRequest) {
  try {
    const uid = await optionalUid(req);
    return NextResponse.json(await listJobs(getAdminDb(), uid));
  } catch (err) {
    return jobsFail(err, "Couldn't load jobs");
  }
}
