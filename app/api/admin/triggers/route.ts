import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { storedTriggers } from "@/lib/ops-metrics-server";

export const dynamic = "force-dynamic";

// The five numbers that start each stage of the speed and infrastructure plan (lib/ops-metrics.ts), for the admin dashboard.
// Super admins, product & tech and engineering. GET → { triggers, asOf }; ?fresh=1 gathers them again now.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["product", "engineering"]);
  } catch {
    return NextResponse.json({ error: "Super admins, product and engineering only." }, { status: 403 });
  }
  return NextResponse.json(await storedTriggers(getAdminDb(), req.nextUrl.searchParams.get("fresh") === "1"), { headers: { "Cache-Control": "no-store" } });
}
