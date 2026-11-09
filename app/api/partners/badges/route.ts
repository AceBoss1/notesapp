import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { profileBadges } from "@/lib/partner-network-server";

export const dynamic = "force-dynamic";

// GET ?uid= → { badges }: a member's Partner Network badges for their profile (verified association memberships, chapters, being a
// partner). Public: these are shown on the profile. Workplace staff are never listed. Cached 5 minutes per member on the server.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "partner-badges", clientIp(req), 300, 600);
  if (limited) return limited;
  const uid = req.nextUrl.searchParams.get("uid") ?? "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return NextResponse.json({ badges: [] });
  const badges = await profileBadges(getAdminDb(), uid).catch(() => []);
  return NextResponse.json({ badges }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
