import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { mediaStudio } from "@/lib/media-server";
import { mediaCaller, mediaDeps, mediaFail } from "@/lib/media-api";

export const dynamic = "force-dynamic";

// GET → my Media studio: my posts (any status, with stats), my plan's Media limits and what's used, my site pictures with their Hide
// switches, and my settings.
export async function GET(req: NextRequest) {
  try {
    const me = await mediaCaller(req);
    return NextResponse.json(await mediaStudio(getAdminDb(), me, me.tier, mediaDeps()));
  } catch (err) {
    return mediaFail(err, "Couldn't load your Media");
  }
}
