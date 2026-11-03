import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { setMediaSettings } from "@/lib/media-server";
import { mediaCaller, mediaFail } from "@/lib/media-api";

export const dynamic = "force-dynamic";

// POST { hideAllSite? , showAlbum?, hide?: { id, hidden } } → { settings }
export async function POST(req: NextRequest) {
  try {
    const me = await mediaCaller(req);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ settings: await setMediaSettings(getAdminDb(), me.uid, body) });
  } catch (err) {
    return mediaFail(err, "Couldn't save that");
  }
}
