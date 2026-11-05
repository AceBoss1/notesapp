import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { controlBackfill, getBackfill, runBackfill } from "@/lib/media-mark-backfill";
import { mediaDeps } from "@/lib/media-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin → Limits → Re-mark existing pictures and videos (lib/media-mark-backfill.ts).
// GET → { backfill }: where it is and the counts per kind.
// POST { action: "start" | "pause" | "resume" | "step" } → { backfill }. "start" also runs a first batch; "step" runs a batch now (the
// cron runs one on every tick while it is running).
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), ["product"]);
    return NextResponse.json({ backfill: await getBackfill(getAdminDb()) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the re-marking job");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminRequest(bearer(req), ["product"]);
    const db = getAdminDb();
    const { action } = await req.json().catch(() => ({}));
    if (action === "start" || action === "pause" || action === "resume") await controlBackfill(db, action, admin);
    else if (action !== "step") return NextResponse.json({ error: "Which action?" }, { status: 400 });
    if (action === "start" || action === "step") await runBackfill(db, mediaDeps(), { budgetMs: 40_000 });
    return NextResponse.json({ backfill: await getBackfill(db) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't run the re-marking job");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
