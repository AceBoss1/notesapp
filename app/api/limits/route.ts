import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getLimitTable } from "@/lib/limits-server";
import { liveRoomFigures } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

// Public: the current limit for every plan (what the app shows people, e.g. "up to 25 MB per file"), and how many a new audio room holds.
export async function GET() {
  try {
    const db = getAdminDb();
    const [limits, rooms] = await Promise.all([getLimitTable(db), liveRoomFigures(db)]);
    return NextResponse.json({ limits, rooms });
  } catch {
    return NextResponse.json({ error: "Couldn't load the limits" }, { status: 500 });
  }
}
