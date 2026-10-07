import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getLimitTable } from "@/lib/limits-server";

export const dynamic = "force-dynamic";

// Public: the current limit for every plan (what the app shows people, e.g. "up to 25 MB per file").
export async function GET() {
  try {
    return NextResponse.json({ limits: await getLimitTable(getAdminDb()) });
  } catch {
    return NextResponse.json({ error: "Couldn't load the limits" }, { status: 500 });
  }
}
