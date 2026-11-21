import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getTournament } from "@/lib/arcade/tournaments-server";
import { NO_STORE, signedIn, tournamentFail } from "@/lib/arcade/tournaments-api";

export const dynamic = "force-dynamic";

// GET /api/arcade/tournaments/[id] → { tournament, game: { slug, name, rankedBy }, rows: BoardRow[], mine: { tries, best, rank, openRun } | null }
// Anyone sees the tournament and its board; with a Bearer token, `mine` is the member's own entry.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await signedIn(req);
    return NextResponse.json(await getTournament(getAdminDb(), params.id, me?.uid), { headers: NO_STORE });
  } catch (err) {
    return tournamentFail(err, "Couldn't load the tournament");
  }
}
