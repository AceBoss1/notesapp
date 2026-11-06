import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { deleteMediaPost, myMediaReaction, reactMediaPost, updateMediaPost, viewMediaPost } from "@/lib/media-server";
import { mediaCaller, mediaDeps, mediaFail, mediaViewer } from "@/lib/media-api";

export const dynamic = "force-dynamic";

// POST { action: "view" } → counts a view (signed-in viewers, once each), and says the viewer's reaction and the counts.
// POST { action: "react", emoji } → one reaction per member (the same one again takes it back): { reaction, reactions, reactionsCount }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await mediaViewer(req);
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (body.action === "react") {
      if (!viewer) return NextResponse.json({ error: "Sign in to react." }, { status: 401 });
      const limited = await rateLimit(req, "media-react", viewer.uid, 120, 600);
      if (limited) return limited;
      return NextResponse.json(await reactMediaPost(db, viewer, params.id, body.emoji));
    }
    const limited = await rateLimit(req, "media-view", viewer?.uid ?? clientIp(req), 300, 600);
    if (limited) return limited;
    await viewMediaPost(db, viewer, params.id);
    return NextResponse.json({ ok: true, ...(await myMediaReaction(db, viewer, params.id)) });
  } catch (err) {
    return mediaFail(err, "Couldn't do that");
  }
}

// PATCH { caption?, audience?, allowComments?, allowShares?, allowGifts?, allowDownloads?, pinned? } → { post } (the owner only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await mediaCaller(req, true);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ post: await updateMediaPost(getAdminDb(), me, params.id, body, mediaDeps()) });
  } catch (err) {
    return mediaFail(err, "Couldn't save that");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await mediaCaller(req, true);
    await deleteMediaPost(getAdminDb(), me.uid, params.id, mediaDeps());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mediaFail(err, "Couldn't delete the post");
  }
}
