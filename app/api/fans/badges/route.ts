import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { fanBadges } from "@/lib/fans-server";

export const dynamic = "force-dynamic";

// GET ?creator={username}&uids=a,b,c → { creatorFirstName, badges: { uid: { rank?, tier? } } }: the fan and subscription badges next to
// names in a creator's space (lib/fans-server.ts). Public: a badge only says what the creator's Top fans and subscribers show anyway.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "fan-badges", clientIp(req), 120, 60);
  if (limited) return limited;
  const q = req.nextUrl.searchParams;
  const creator = (q.get("creator") ?? "").replace(/^@/, "");
  if (!/^[a-z0-9._-]{1,40}$/i.test(creator)) return NextResponse.json({ error: "Which creator?" }, { status: 400 });
  const uids = (q.get("uids") ?? "").split(",").filter(Boolean).slice(0, 100);
  const out = await fanBadges(getAdminDb(), creator, uids).catch(() => ({ creatorFirstName: "", badges: {} }));
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
}
