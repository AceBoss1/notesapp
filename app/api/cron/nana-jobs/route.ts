import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { setting } from "@/lib/config";
import { trackJob } from "@/lib/ops-metrics-server";
import { collectPool, runDue } from "@/lib/nana-jobs-server";
import { liveDeps } from "@/lib/nana-jobs-api";

// Nana Jobs (lib/nana-jobs-server.ts): once a day by Vercel Cron (vercel.json), with Authorization: Bearer $CRON_SECRET. Collects every
// opening from the feeds, the watched company boards and Notes Jobs into the shared pool, once for everyone, then starts any daily runs
// that are due. The members' runs at their own hour carry on from /api/cron/reminders every 15 minutes.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = setting("CRON_SECRET");
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  return NextResponse.json(await trackJob(db, async () => {
    const pool = await collectPool(db, liveDeps());
    const ran = await runDue(db, liveDeps(), { max: 10, budgetMs: 150_000 }).catch(() => 0);
    return { ...pool, ran };
  }));
}
