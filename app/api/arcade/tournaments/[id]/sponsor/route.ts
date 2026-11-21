import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { lagosDay } from "@/lib/ads-server";
import { setting } from "@/lib/config";
import { countSponsor } from "@/lib/arcade/tournaments-server";

export const dynamic = "force-dynamic";

// POST /api/arcade/tournaments/[id]/sponsor { event: "impression" | "click" } → { counted }
// A sponsor's takeover of a game's advert spots (components/games/ArcadeAdSpot.tsx), counted on the tournament for the sponsor's report
// rather than as a booked advert's impression in /api/ads/track. Once per visitor per day, like adverts; bots skipped; never breaks a page.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawler|spider|headless|preview/i.test(ua)) return NextResponse.json({ counted: false });
  const limited = await rateLimit(req, "tournament-sponsor", clientIp(req), 90, 60);
  if (limited) return limited;
  try {
    const { event } = await req.json().catch(() => ({}));
    const visitor = createHash("sha256").update(`${clientIp(req)}|${ua}|${setting("AD_HASH_SALT") || "notesapp"}`).digest("hex").slice(0, 24);
    return NextResponse.json(await countSponsor(getAdminDb(), params.id, event, visitor, lagosDay()));
  } catch {
    return NextResponse.json({ counted: false });
  }
}
