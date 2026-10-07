import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { createMoment, listFeed, listForOwner } from "@/lib/moments-server";
import { authed, fail, momentDeps } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET            → moments from people you follow, plus yours, grouped by member
// GET ?username= → that member's active moments, if you're in their audience (the ring on a profile picture)
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "moments");
    const username = new URL(req.url).searchParams.get("username");
    const db = getAdminDb();
    if (username) return NextResponse.json({ moments: await listForOwner(db, me.uid, username, momentDeps) });
    return NextResponse.json({ groups: await listFeed(db, me, momentDeps) });
  } catch (err) {
    return fail(err, "Couldn't load moments");
  }
}

// POST { kind: "text"|"image"|"video", text?, hours?: 24|48|72, imageKey?, videoUploadId? }
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "moments", true);
    const limited = rateLimit(req, "moment", me.uid, 20, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ moment: await createMoment(getAdminDb(), me, body, momentDeps) });
  } catch (err) {
    return fail(err, "Couldn't share the moment");
  }
}
