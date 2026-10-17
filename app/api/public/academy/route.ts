import { NextRequest, NextResponse } from "next/server";
import { ACADEMY_LIVE } from "@/lib/courses";
import { getAcademy } from "@/lib/courses-server";

export const dynamic = "force-dynamic";

// GET → { courses }: every published Notes Academy course with its teacher, learners and visits (lifetime and this week); the
// page arranges them (lib/discovery.ts). ?owner=<username> → only that teacher's (profiles and member sites). Kept a minute.
export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner")?.toLowerCase();
  const all = ACADEMY_LIVE ? await getAcademy() : [];
  const courses = owner ? all.filter((c) => c.ownerUsername.toLowerCase() === owner) : all;
  return NextResponse.json({ courses }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
