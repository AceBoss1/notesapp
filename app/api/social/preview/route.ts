import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { previewPost } from "@/lib/social-server";
import { socialAuthed, socialFail } from "@/lib/social-api";

export const dynamic = "force-dynamic";

// POST { noteId } → { title, url, texts: { linkedin, x }, limits }: what would be posted, for the member to read and edit.
export async function POST(req: NextRequest) {
  try {
    const me = await socialAuthed(req);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await previewPost(getAdminDb(), me.uid, String(body.noteId ?? "")));
  } catch (err) {
    return socialFail(err, "Couldn't prepare the post");
  }
}
