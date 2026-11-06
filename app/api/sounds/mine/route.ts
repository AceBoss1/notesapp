import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { applyAsArtist, finishSongUpload, mySounds, removeMySong, startSongUpload } from "@/lib/sounds-server";
import { soundCaller, soundDeps, soundFail } from "@/lib/sounds-api";

export const dynamic = "force-dynamic";

// The artist's side of NotesApp Sounds (/profile/sounds).
// GET → { artist, isHouse, songs (with plays by where, this month, last month, the last 30 days), royalties, poolPercent }
// POST { action: "apply", stageName, links, about, ownsRights } → { artist }
//      { action: "start", title, size, contentType, durationSec, hook, coverType, coverSize } → { id, uploadUrl, coverUrl } (verified artists)
//      { action: "finish", id } → { song } (waits for the team's review)
//      { action: "remove", id } → takes the artist's own song down
export async function GET(req: NextRequest) {
  try {
    const me = await soundCaller(req);
    return NextResponse.json(await mySounds(getAdminDb(), me.uid, me.username, soundDeps()), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return soundFail(err, "Couldn't load your sounds");
  }
}
export async function POST(req: NextRequest) {
  try {
    const me = await soundCaller(req, true);
    const limited = await rateLimit(req, "sounds-mine", me.uid, 40, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (body.action === "apply") return NextResponse.json({ artist: await applyAsArtist(db, me, body) });
    if (body.action === "start") return NextResponse.json(await startSongUpload(db, me, body, soundDeps()));
    if (body.action === "finish") return NextResponse.json({ song: await finishSongUpload(db, me, body.id, soundDeps()) });
    if (body.action === "remove") { await removeMySong(db, me.uid, body.id); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return soundFail(err, "Couldn't do that");
  }
}
