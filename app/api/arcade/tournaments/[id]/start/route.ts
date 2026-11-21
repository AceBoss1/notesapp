import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { startRun } from "@/lib/arcade/tournaments-server";
import { signedIn, tournamentFail } from "@/lib/arcade/tournaments-api";

export const dynamic = "force-dynamic";

// POST /api/arcade/tournaments/[id]/start → { runId, seed, level, game, try, tries }
// Signed-in, verified members who may enter (lib/arcade/tournaments.ts canEnter), in the play window, with a try left. Starting again gives
// up the open try (it still counts).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await signedIn(req);
    if (!me) return NextResponse.json({ error: "Sign in to enter. Tournaments are for signed-in #NotesApp members (entry is free)." }, { status: 401 });
    const limited = await rateLimit(req, "tournament-run", me.uid, 30, 3600);
    if (limited) return limited;
    return NextResponse.json(await startRun(getAdminDb(), me, params.id));
  } catch (err) {
    return tournamentFail(err, "Couldn't start a try");
  }
}
