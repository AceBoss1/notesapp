import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { lagosDay } from "@/lib/ads-server";
import { countView } from "@/lib/arcade/tournaments-server";
import { isBot, visitorOf } from "@/lib/arcade/tournaments-api";

export const dynamic = "force-dynamic";

// POST /api/arcade/tournaments/[id]/view → { counted }
// A view of the tournament's page, for the sponsor's report (owner, 24 Nov 2026: "page-view counts in the sponsor's report"; §2 "The
// numbers"). Sent once by components/games/ArcadeTournament.tsx when the page opens; counted once per visitor per Lagos day, like
// adverts and the takeover; bots skipped; never breaks a page.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (isBot(req.headers.get("user-agent") || "")) return NextResponse.json({ counted: false });
  const limited = await rateLimit(req, "tournament-view", clientIp(req), 90, 60);
  if (limited) return limited;
  try {
    return NextResponse.json(await countView(getAdminDb(), params.id, visitorOf(req), lagosDay()));
  } catch {
    return NextResponse.json({ counted: false });
  }
}
