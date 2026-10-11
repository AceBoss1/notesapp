import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ReviewError } from "@/lib/reviews";
import { answerRecommendation, deleteRecommendation, listRecommendations, writeRecommendation } from "@/lib/reviews-server";

export const dynamic = "force-dynamic";
const uidOf = async (req: NextRequest) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return token ? (await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null))?.uid : undefined;
};
const fail = (err: unknown, fallback: string) => {
  if (err instanceof ReviewError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Anyone: GET ?subjectUid=… → the approved recommendations. The person recommended also gets what is waiting; an author gets their own.
export async function GET(req: NextRequest) {
  try {
    const limited = rateLimit(req, "recs-read", clientIp(req), 120, 60);
    if (limited) return limited;
    const subjectUid = req.nextUrl.searchParams.get("subjectUid") || "";
    if (!subjectUid || subjectUid.includes("/")) throw new ReviewError("Whose profile?");
    return NextResponse.json(await listRecommendations(getAdminDb(), subjectUid, await uidOf(req)), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load recommendations");
  }
}

// Signed in: POST { action: "write", subjectUid, relationship, text } | { action: "approve" | "hide", id } (the person recommended)
// | { action: "withdraw", id } (the author).
export async function POST(req: NextRequest) {
  try {
    const uid = await uidOf(req);
    if (!uid) throw new ReviewError("Sign in first.", 401);
    const limited = rateLimit(req, "recs-write", uid, 30, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "write": await writeRecommendation(db, uid, String(b.subjectUid ?? ""), b); return NextResponse.json({ ok: true });
      case "approve": case "hide": await answerRecommendation(db, uid, String(b.id ?? ""), b.action); return NextResponse.json({ ok: true });
      case "withdraw": await deleteRecommendation(db, uid, String(b.id ?? "")); return NextResponse.json({ ok: true });
      default: throw new ReviewError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
