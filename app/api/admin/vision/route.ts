import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { visionFor } from "@/lib/vision-server";

export const dynamic = "force-dynamic";

// The Vision model's starting numbers for whoever is signed in. Founders get the founders' split, Nora Bawa her own option, nobody else anything (403).
// The owner may add ?as=chimdinma|akujuobi|nora|emmanuel to see the page as that person sees it.
export async function GET(req: NextRequest) {
  try {
    const me = await verifyAdminAccess(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const payload = await visionFor(getAdminDb(), { uid: me.uid, email: me.email, owner: me.owner }, req.nextUrl.searchParams.get("as"));
    if (!payload) return NextResponse.json({ error: "The Vision model is for the founders and Nora Bawa." }, { status: 403 });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the Vision model");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
