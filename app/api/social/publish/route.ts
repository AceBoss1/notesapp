import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { publishPost } from "@/lib/social-server";
import { socialAuthed, socialFail } from "@/lib/social-api";

export const dynamic = "force-dynamic";

// POST { noteId, targets: ["linkedin","x"], texts?: { linkedin?, x? }, force? } → { results: [{ provider, ok, url?, error?, code? }] }
// Each network answers on its own: one failing never stops the other. A post already shared to a network is refused unless force is true.
export async function POST(req: NextRequest) {
  try {
    const me = await socialAuthed(req, true);
    const limited = rateLimit(req, "social-publish", me.uid, 20, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const results = await publishPost(getAdminDb(), me.uid, { noteId: String(body.noteId ?? ""), targets: body.targets, texts: body.texts, force: body.force === true });
    return NextResponse.json({ results });
  } catch (err) {
    return socialFail(err, "Couldn't post");
  }
}
