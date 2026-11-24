import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { lagosDay } from "@/lib/ads-server";
import { countSponsor } from "@/lib/arcade/tournaments-server";
import { isBot, visitorOf } from "@/lib/arcade/tournaments-api";

export const dynamic = "force-dynamic";

// POST /api/arcade/tournaments/[id]/sponsor { event: "impression" | "click" } → { counted }
// A sponsor's takeover of a game's advert spots (components/games/ArcadeAdSpot.tsx), counted on the tournament for the sponsor's report
// rather than as a booked advert's impression in /api/ads/track. Once per visitor per day, like adverts; bots skipped; never breaks a page.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (isBot(req.headers.get("user-agent") || "")) return NextResponse.json({ counted: false });
  const limited = await rateLimit(req, "tournament-sponsor", clientIp(req), 90, 60);
  if (limited) return limited;
  try {
    const { event } = await req.json().catch(() => ({}));
    return NextResponse.json(await countSponsor(getAdminDb(), params.id, event, visitorOf(req), lagosDay()));
  } catch {
    return NextResponse.json({ counted: false });
  }
}
