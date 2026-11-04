import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { giftGate } from "@/lib/gifts-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// GET ?uid= or ?username= → whether the viewer may gift this member, for the gift action beside a name (lib/gifts-server.ts giftGate):
// { ok, reason?, message?, uid, username, name }. The same check runs again at checkout, so this only decides how the button looks.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "gift-can", clientIp(req), 120, 60);
  if (limited) return limited;
  try {
    const q = req.nextUrl.searchParams;
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const me = token ? await verifySignedInRequest(token).catch(() => null) : null;
    const gate = await giftGate(getAdminDb(), me?.uid ?? null, { uid: q.get("uid") ?? undefined, username: (q.get("username") ?? "").replace(/^@/, "") || undefined });
    return NextResponse.json(gate, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
