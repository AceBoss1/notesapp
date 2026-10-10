import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { recordView } from "@/lib/store-stats-server";

export const dynamic = "force-dynamic";

// POST { itemId }: counts one look at an item (anyone, signed in or not; the seller's own looks are ignored). Never an error to the page.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const itemId = String(b.itemId ?? "");
    if (rateLimit(req, "store-look", `${clientIp(req)}:${itemId}`, 2, 3600)) return NextResponse.json({ ok: false });
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
    return NextResponse.json({ ok: await recordView(getAdminDb(), itemId, d?.uid) });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
