import { NextRequest, NextResponse } from "next/server";
import { weeklyViews } from "@/lib/discovery-server";

export const dynamic = "force-dynamic";

// GET ?kind=note|profile|item|course → { views: { <id>: visits in the last 7 days } }, for the Most viewed shelves.
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "note" && kind !== "profile" && kind !== "item" && kind !== "course") return NextResponse.json({ error: "Which kind?" }, { status: 400 });
  return NextResponse.json({ views: (await weeklyViews())[kind] }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
