import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { lagosDay } from "@/lib/ads-server";
import { activeSponsor, countListView, listTournaments } from "@/lib/arcade/tournaments-server";
import { NO_STORE, isBot, tournamentFail, visitorOf } from "@/lib/arcade/tournaments-api";

export const dynamic = "force-dynamic";

// Notes Arcade tournaments (lib/arcade/tournaments-server.ts; owner, 21 Nov 2026: "start tournaments"). Public: anyone can look.
//   GET                      → { tournaments: PublicTournament[] }   (no drafts, no seeds)
//   GET ?active=1&game=whot  → { sponsor: { id, name, sponsor } | null }  the sponsor taking over that game's advert spots right now
//                              (components/games/ArcadeAdSpot.tsx; cached a minute at the edge, since every spot on every game page asks)
//   POST { event: "view" }   → { counted }  a view of the list page (components/games/ArcadeTournaments.tsx), once per visitor per Lagos
//                              day, bots skipped; the sponsor's report counts the days its tournament ran (owner, 24 Nov 2026)
export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("active")) {
      return NextResponse.json({ sponsor: await activeSponsor(db, q.get("game")) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
    }
    return NextResponse.json({ tournaments: await listTournaments(db) }, { headers: NO_STORE });
  } catch (err) {
    return tournamentFail(err, "Couldn't load tournaments");
  }
}

export async function POST(req: NextRequest) {
  if (isBot(req.headers.get("user-agent") || "")) return NextResponse.json({ counted: false });
  const limited = await rateLimit(req, "tournament-view", clientIp(req), 90, 60);
  if (limited) return limited;
  try {
    const { event } = await req.json().catch(() => ({}));
    if (event !== "view") return NextResponse.json({ counted: false }, { status: 400 });
    return NextResponse.json(await countListView(getAdminDb(), visitorOf(req), lagosDay()));
  } catch {
    return NextResponse.json({ counted: false });
  }
}
