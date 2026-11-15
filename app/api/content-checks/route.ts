import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ContentAdminError, appealFlag, appealSuspension, issuePass, myChecks } from "@/lib/content-checks-server";
import { checkReply } from "@/lib/content-checks-reply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// AI content checks, for the signed-in member (lib/content-checks-server.ts).
// GET → their strikes, held posts, appeals and whether posting is paused (the account page).
// POST { action: "pass", kind: "journal", noteId } | { action: "pass", kind: "store_item", title, subtitle, image, images }
//      | { action: "pass", kind: "profile", displayName?, bio?, avatar? } → { passId } (null when checks are off), or { error, contentCheck }
// POST { action: "appeal", flagId, text? } · { action: "appeal_suspension", text? }
const fail = (err: unknown, what: string) => {
  const cc = checkReply(err);
  if (cc) return cc;
  if (err instanceof ContentAdminError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
const me = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid;

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await myChecks(getAdminDb(), await me(req)), { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load your content checks"); }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await me(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    if (b.action === "pass") {
      const limited = await rateLimit(req, "content-pass", uid, 60, 600);
      if (limited) return limited;
      return NextResponse.json(await issuePass(db, uid, b.kind, b));
    }
    const limited = await rateLimit(req, "content-appeal", uid, 20, 3600);
    if (limited) return limited;
    if (b.action === "appeal") { await appealFlag(db, uid, b.flagId, b.text); return NextResponse.json({ ok: true }); }
    if (b.action === "appeal_suspension") { await appealSuspension(db, uid, b.text); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) { return fail(err, "Couldn't do that"); }
}
