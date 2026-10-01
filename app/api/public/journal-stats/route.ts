import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Follower + subscriber counts for one journal. Every journal card on the
// home, Journals and profile pages used to run two uncached Firestore count
// queries per visitor (tens of thousands of reads a day). Now one cached
// answer per journal serves everyone: CDN for 5 min, plus a per-instance map.
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;
const memo = new Map<string, { at: number; data: { followers: number; subscribers: number } }>();

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "journal-stats", clientIp(req), 120, 60);
  if (limited) return limited;
  const username = (req.nextUrl.searchParams.get("username") || "").toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(username)) return NextResponse.json({ error: "Invalid journal." }, { status: 400 });

  try {
    const hit = memo.get(username);
    let data = hit && Date.now() - hit.at < TTL_MS ? hit.data : null;
    if (!data) {
      const db = getAdminDb();
      const [f, s] = await Promise.all([
        db.collection("follows").where("username", "==", username).count().get(),
        db.collection("subscriptions").where("username", "==", username).count().get(),
      ]);
      data = { followers: f.data().count, subscribers: s.data().count };
      if (memo.size >= MAX_ENTRIES) memo.clear();
      memo.set(username, { at: Date.now(), data });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch (err) {
    const f = friendlyMessage(err);
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
