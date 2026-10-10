import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { StoreStatsError, toggleFavorite } from "@/lib/store-stats-server";

export const dynamic = "force-dynamic";

// Signed-in members: POST { itemId } saves the item or, if it is already saved, removes it → { saved, favs }.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
    if (!d) throw new StoreStatsError("Sign in to save items.", 401);
    const limited = rateLimit(req, "store-fav", d.uid, 60, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await toggleFavorite(getAdminDb(), d.uid, String(b.itemId ?? "")), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof StoreStatsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't save that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
