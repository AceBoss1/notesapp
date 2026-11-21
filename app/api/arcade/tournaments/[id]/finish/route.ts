import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { finishRun } from "@/lib/arcade/tournaments-server";
import { signedIn, tournamentFail } from "@/lib/arcade/tournaments-api";

export const dynamic = "force-dynamic";

// POST /api/arcade/tournaments/[id]/finish { runId, recording } → { result: { summary, score, rank }, best: { summary, score }, rank, triesLeft }
// The server replays the recording from the tournament's seed with the game's own code; the browser's word for the result is never taken.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await signedIn(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "tournament-run", me.uid, 30, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await finishRun(getAdminDb(), me, params.id, body.runId, body.recording));
  } catch (err) {
    return tournamentFail(err, "Couldn't send your try in");
  }
}
