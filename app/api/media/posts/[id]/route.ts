import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { deleteMediaPost, updateMediaPost, viewMediaPost } from "@/lib/media-server";
import { mediaCaller, mediaDeps, mediaFail, mediaViewer } from "@/lib/media-api";

export const dynamic = "force-dynamic";

// POST { action: "view" } → counts a view (signed-in viewers, once each).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await mediaViewer(req);
    const limited = await rateLimit(req, "media-view", viewer?.uid ?? clientIp(req), 300, 600);
    if (limited) return limited;
    await viewMediaPost(getAdminDb(), viewer, params.id);
    return NextResponse.json({ ok: true });
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
