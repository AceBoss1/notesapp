import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { weeklyBoards } from "@/lib/gifts-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// GET ?week=this|last&creator={username} → the weekly "Top gifted" board and, with a creator, their weekly "Top gifters"
// (lib/gifts-server.ts weeklyBoards). Weeks reset at midnight going into Monday, Lagos time; last week's result stays readable.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "gift-boards", clientIp(req), 60, 60);
  if (limited) return limited;
  try {
    const q = req.nextUrl.searchParams;
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const me = token ? await verifySignedInRequest(token).catch(() => null) : null;
    const out = await weeklyBoards(getAdminDb(), me ? { uid: me.uid } : null, { which: q.get("week") === "last" ? "last" : "this", creatorUsername: (q.get("creator") ?? "").replace(/^@/, "") || undefined });
    return NextResponse.json(out, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the boards");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
