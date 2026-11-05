import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { downloadPicture, downloadVideo } from "@/lib/media-server";
import { mediaDeps, mediaFail, mediaViewer } from "@/lib/media-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET ?i=<picture number from 0> → that picture, when the creator allowed downloads and the viewer can see the post: the stored file,
// which carries the permanent NotesApp mark (lib/media-mark.ts). Never a clean file, and never a teen's.
// GET ?video=1 → { url, filename }: Stream's MP4 of the (marked) video, same rules; 409 while it is being made.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await mediaViewer(req);
    const limited = await rateLimit(req, "media-download", viewer?.uid ?? clientIp(req), 30, 600);
    if (limited) return limited;
    if (req.nextUrl.searchParams.get("video") === "1") {
      const v = await downloadVideo(getAdminDb(), viewer, params.id, mediaDeps());
      return NextResponse.json(v, { headers: { "Cache-Control": "private, no-store" } });
    }
    const i = Number(req.nextUrl.searchParams.get("i") ?? 0);
    const out = await downloadPicture(getAdminDb(), viewer, params.id, i, mediaDeps());
    return new NextResponse(new Uint8Array(out.bytes), {
      headers: { "Content-Type": out.type, "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return mediaFail(err, "Couldn't download that");
  }
}
