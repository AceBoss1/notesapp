import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyPublisherRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { isMarkPurpose } from "@/lib/upload-rules";
import { MarkError, markUpload } from "@/lib/mark-uploads-server";
import { mediaDeps } from "@/lib/media-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST { key, purpose: "shop" | "service" | "note", noteId? } → { key, url }: the picture the caller just uploaded to their own folder
// (app/api/upload) with the permanent NotesApp mark drawn in (lib/mark-uploads-server.ts). The clean upload is deleted: the marked
// address is the only one the item, site or journal ever gets.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyPublisherRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const limited = await rateLimit(req, "upload-mark", uid, 60, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    if (!isMarkPurpose(body.purpose)) return NextResponse.json({ error: "Which kind of picture?" }, { status: 400 });
    return NextResponse.json(await markUpload(getAdminDb(), uid, { key: body.key, purpose: body.purpose, noteId: body.noteId }, mediaDeps()));
  } catch (err) {
    if (err instanceof MarkError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[upload/mark]", err);
    const msg = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: /auth|token|allowed/i.test(msg) ? "Sign in first." : "Couldn't add the NotesApp mark to the picture. Try again." }, { status: /auth|token|allowed/i.test(msg) ? 401 : 500 });
  }
}
