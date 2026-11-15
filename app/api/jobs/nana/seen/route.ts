import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { seenJobs } from "@/lib/nana-jobs-server";
import { me, njFail, noStore } from "@/lib/nana-jobs-api";

export const dynamic = "force-dynamic";

// GET → every opening the member's latest run collected, with what happened to each (on the list, cut and why, or ranked below it).
// Read-only, and only the signed-in member's own run.
export async function GET(req: NextRequest) {
  try { return NextResponse.json(await seenJobs(getAdminDb(), await me(req)), noStore); }
  catch (err) { return njFail(err, "Couldn't load the collected jobs"); }
}
