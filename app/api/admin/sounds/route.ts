import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { adminSounds, decideArtist, decideSong, setPoolPercent, SoundError } from "@/lib/sounds-server";
import { publicOnly } from "@/lib/sounds-api";

export const dynamic = "force-dynamic";
const NEED = ["content", "moderation", "finance"] as const;

// Admin → Sounds. GET → { artists, songs, poolPercent }.
// POST { action: "artist", uid, status: "verified" | "rejected", note? } · { action: "song", id, status: "approved" | "rejected" | "removed", note? }
//      { action: "pool", percent } (finance: the part of each month's ad revenue that goes to artists)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), NEED);
    return NextResponse.json(await adminSounds(getAdminDb(), publicOnly), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const body = await req.json().catch(() => ({}));
    const by = await verifyAdminRequest(token, body.action === "pool" ? ["finance"] : NEED);
    const db = getAdminDb();
    if (body.action === "artist") await decideArtist(db, body.uid, body.status, body.note, by);
    else if (body.action === "song") await decideSong(db, body.id, body.status, body.note, by);
    else if (body.action === "pool") await setPoolPercent(db, body.percent, by);
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
function fail(err: unknown) {
  if (err instanceof SoundError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Couldn't update Sounds");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
