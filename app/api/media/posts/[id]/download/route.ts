import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { downloadPicture } from "@/lib/media-server";
import { mediaDeps, mediaFail, mediaViewer } from "@/lib/media-api";
import { watermarkPicture } from "@/lib/media-watermark";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET ?i=<picture number from 0> → that picture as a JPEG stamped with @username and the NotesApp mark, when the creator allowed
// downloads and the viewer can see the post. Never the original file, and never a teen's.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await mediaViewer(req);
    const limited = await rateLimit(req, "media-download", viewer?.uid ?? clientIp(req), 30, 600);
    if (limited) return limited;
    const i = Number(req.nextUrl.searchParams.get("i") ?? 0);
    const out = await downloadPicture(getAdminDb(), viewer, params.id, i, mediaDeps(), watermarkPicture);
    return new NextResponse(new Uint8Array(out.bytes), {
      headers: { "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return mediaFail(err, "Couldn't download that");
  }
}
