import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { activeSponsor, listTournaments } from "@/lib/arcade/tournaments-server";
import { NO_STORE, tournamentFail } from "@/lib/arcade/tournaments-api";

export const dynamic = "force-dynamic";

// Notes Arcade tournaments (lib/arcade/tournaments-server.ts; owner, 21 Nov 2026: "start tournaments"). Public: anyone can look.
//   GET                      → { tournaments: PublicTournament[] }   (no drafts, no seeds)
//   GET ?active=1&game=whot  → { sponsor: { id, name, sponsor } | null }  the sponsor taking over that game's advert spots right now
//                              (components/games/ArcadeAdSpot.tsx; cached a minute at the edge, since every spot on every game page asks)
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
