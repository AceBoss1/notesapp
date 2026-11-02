import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { setting } from "@/lib/config";
import { trackJob } from "@/lib/ops-metrics-server";
import { runAgentJobs } from "@/lib/agents/jobs-server";

// Nana's jobs (lib/agents/jobs-server.ts): run every 15 minutes by the same external scheduler as /api/cron/reminders, and once a day by
// Vercel Cron (vercel.json), each with Authorization: Bearer $CRON_SECRET. Safe to run as often as you like: every item is idempotent.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = setting("CRON_SECRET");
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  return NextResponse.json(await trackJob(db, () => runAgentJobs(db)));
}
