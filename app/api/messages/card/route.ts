import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseCardLink } from "@/lib/chat-cards";
import { cardFor } from "@/lib/chat-cards-server";
import { KNOWN_ROOTS } from "@/lib/host";
import { authed, fail } from "@/lib/moments-api";
import { cacheGet, cacheSet } from "@/lib/shared-store";

export const dynamic = "force-dynamic";

// GET ?url= → { card } for a #NotesApp link in a message (null when it isn't one of ours, or isn't public). Kept for 10 minutes.
export async function GET(req: NextRequest) {
  try {
    await authed(req, "messages");
    const ref = parseCardLink(req.nextUrl.searchParams.get("url") ?? "", KNOWN_ROOTS);
    if (!ref) return NextResponse.json({ card: null });
    const key = `card:${ref.kind}:${ref.id}`;
    const hit = await cacheGet<{ card: unknown }>(key);
    if (hit) return NextResponse.json(hit);
    const card = await cardFor(getAdminDb(), ref).catch(() => null);
    await cacheSet(key, { card }, 600);
    return NextResponse.json({ card }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    return fail(err, "Couldn't read that link");
  }
}
