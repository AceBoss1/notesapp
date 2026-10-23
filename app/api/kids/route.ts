import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { isKidUid } from "@/lib/kids";
import { addKid, enterKid, exitKid, kidMe, listKids, removeKid, updateKid } from "@/lib/kids-server";
import { YoungError } from "@/lib/young";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const fail = (err: unknown, fallback: string) => {
  if (err instanceof YoungError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
async function who(req: NextRequest) {
  const me = await verifySignedInRequest(bearer(req)).catch(() => null);
  if (!me) throw new YoungError("Sign in first.", 401);
  return me;
}

// Kids mode (lib/kids.ts). The parent: GET → their child profiles; POST { action: "add" | "update" | "remove" | "enter", … }.
// A child profile: GET → what it may open and today's play time left; POST { action: "exit", pin } → back to the parent's account.
export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    const db = getAdminDb();
    if (isKidUid(me.uid)) return NextResponse.json({ kid: await kidMe(db, me.uid) }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ kids: await listKids(db, me.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load that"); }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    const limited = await rateLimit(req, "kids", me.uid, 60, 900);
    if (limited) return limited;
    const db = getAdminDb();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (b.action) {
      case "add": return NextResponse.json({ kid: await addKid(db, me, b) });
      case "update": return NextResponse.json({ kid: await updateKid(db, me.uid, b.id, b) });
      case "remove": await removeKid(db, me.uid, b.id); return NextResponse.json({ ok: true });
      case "enter": return NextResponse.json(await enterKid(db, me.uid, b.id), { headers: { "Cache-Control": "no-store" } });
      case "exit": return NextResponse.json(await exitKid(db, me.uid, b.pin), { headers: { "Cache-Control": "no-store" } });
      default: throw new YoungError("Unknown action.");
    }
  } catch (err) { return fail(err, "Couldn't do that"); }
}
