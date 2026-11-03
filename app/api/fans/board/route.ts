import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { fanBoard } from "@/lib/fans-server";

export const dynamic = "force-dynamic";

// GET ?username= → the creator's Top fans (lib/fans-server.ts fanBoard) and, when signed in, the viewer's own fan level with them.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "fan-board", clientIp(req), 60, 60);
  if (limited) return limited;
  const username = (req.nextUrl.searchParams.get("username") ?? "").replace(/^@/, "");
  if (!/^[a-z0-9._-]{1,40}$/i.test(username)) return NextResponse.json({ error: "Which creator?" }, { status: 400 });
  const db = getAdminDb();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const me = token ? await verifySignedInRequest(token).catch(() => null) : null;
  const myName = me ? String((await db.doc(`users/${me.uid}`).get()).data()?.username ?? "") : "";
  const board = await fanBoard(db, me ? { uid: me.uid, username: myName } : null, username);
  if (!board) return NextResponse.json({ error: "That creator wasn't found." }, { status: 404 });
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
