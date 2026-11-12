import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { remixSource } from "@/lib/media-server";

export const dynamic = "force-dynamic";

// GET ?id=<media post> → { source } or 404: what a remix starts from (its creator, sound and cover), when the post may be remixed
// (lib/media-rules.ts canRemix). The studio shows it and posts with remixOf; createMediaPost checks it again.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "media-remix", clientIp(req), 120, 600);
  if (limited) return limited;
  const source = await remixSource(getAdminDb(), req.nextUrl.searchParams.get("id"));
  if (!source) return NextResponse.json({ error: "That post can't be remixed." }, { status: 404 });
  const { ownerUid: _o, ...shown } = source;
  return NextResponse.json({ source: shown });
}
