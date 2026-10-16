import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { GranolaError, askGranola, candidateItems, disconnect, granolaStatus, listMeetings, startAuth } from "@/lib/granola";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const fail = (err: unknown, fallback: string) => {
  if (err instanceof GranolaError) return NextResponse.json({ error: err.message, ...(err.status === 409 ? { reconnect: true } : {}) }, { status: err.status === 409 ? 409 : err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Staff only (any team hub member), each for their own Granola account.
//   GET → { connected, connectedAt, canConnect }
//   POST { action: "start" } → { url }  (send the browser there to approve access)
//   POST { action: "meetings", range } → { text }  (Granola's list of meetings)
//   POST { action: "ask", query } → { text, items }  (Granola's answer, with bullet lines the person can add to the work board)
//   POST { action: "disconnect" }
export async function GET(req: NextRequest) {
  try {
    const me = await verifyAdminAccess(bearer(req));
    return NextResponse.json(await granolaStatus(getAdminDb(), me.uid), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load Granola");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyAdminAccess(bearer(req));
    const limited = await rateLimit(req, "granola", me.uid, 60, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "start": return NextResponse.json(await startAuth(db, me.uid));
      case "disconnect": await disconnect(db, me.uid); return NextResponse.json({ ok: true });
      case "meetings": { const r = await listMeetings(db, me.uid, b.range); return NextResponse.json({ text: r.text, error: r.isError ? r.text : undefined }); }
      case "ask": { const r = await askGranola(db, me.uid, b.query); return NextResponse.json({ text: r.text, items: r.isError ? [] : candidateItems(r.text) }); }
      default: throw new GranolaError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't reach Granola");
  }
}
