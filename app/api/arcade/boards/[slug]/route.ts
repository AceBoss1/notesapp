import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { BoardError, getBoard } from "@/lib/arcade/boards-server";

export const dynamic = "force-dynamic";

// GET /api/arcade/boards/[slug] → { game, metric, label, npcLabel, npcs: [top 5 🤖], people: [top 20], me?: { rank, value } }
// One game's leaderboard (owner, Nov 2026: "each game has leaderboard makeup of top npc 🤖 and top human"; lib/arcade/boards-server.ts).
// Anyone can read it. Without a Bearer token the answer is the same for everyone (no one kept off lists in it), so it's cached for a
// minute; with one, it adds the member's own place and the rows only they may see (themselves, and teen friends who follow them back),
// so it's private.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const me = token ? await verifySignedInRequest(token).catch(() => null) : null;
  const limited = await rateLimit(req, "arcade-boards", me?.uid ?? clientIp(req), 120, 60);
  if (limited) return limited;
  try {
    const view = await getBoard(getAdminDb(), String(params.slug), me?.uid ?? null);
    return NextResponse.json(view, {
      headers: { "Cache-Control": me ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    if (err instanceof BoardError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't load the leaderboard.");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
