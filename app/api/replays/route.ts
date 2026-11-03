import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CommunityError } from "@/lib/community-server";
import { friendlyMessage } from "@/lib/api-errors";
import {
  allRecordings, deleteRecording, listedReplays, liveRecordingFigures, myRecordings, myReplays, playRecording, publishReplay, replayForViewer, shareReplayToJournal, unpublishReplay,
} from "@/lib/live-recording-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Recordings and replays (lib/live-recording.ts).
// GET ?id=                 → { replay, canWatch, player?, mine }        one replay, for anyone (the player only for who may watch)
// GET ?list=new            → { replays }                                Explore: the newest listed replays
// GET ?list=trending&days= → { replays }                                Trending: the most watched in the period
// GET ?mine=1              → { recordings, replays, figures }           the host's Media area
// GET ?all=1               → { recordings }                             admins (Trust & safety): every recording, for safety review
// POST { action: "play", id, admin? }       → { url, type }   a recording, for its host (or an admin with admin: true): a 15-minute link
//      { action: "delete", id }                          the host deletes a recording (and its replay)
//      { action: "publish", id, title, audience }        → { id, audience, why? }
//      { action: "unpublish", id }                       → { kept, keepUntil? }
//      { action: "journal", id }                         → { noteId, editHref, summary, transcript }   Share to Journal (a draft)
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const fail = (err: unknown, fallback: string) => {
  if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof Error && /Missing auth token|verifyIdToken|ID token/i.test(err.message)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
const member = async (req: NextRequest) => {
  const me = await verifySignedInRequest(bearer(req));
  const u = (await getAdminDb().doc(`users/${me.uid}`).get()).data();
  if (!u || u.suspended === true) throw new CommunityError(403, "Your account can't do that right now.");
  return me.uid;
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const db = getAdminDb();
    const noStore = { headers: { "Cache-Control": "no-store" } };
    if (sp.get("id")) {
      const limited = await rateLimit(req, "replay-view", clientIp(req), 60, 60);
      if (limited) return limited;
      const viewer = await verifySignedInRequest(bearer(req)).catch(() => null);
      return NextResponse.json(await replayForViewer(db, viewer?.uid, sp.get("id")), noStore);
    }
    if (sp.get("list")) {
      const replays = await listedReplays(db, { sort: sp.get("list") === "trending" ? "trending" : "new", days: Number(sp.get("days")) || 7 });
      return NextResponse.json({ replays }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
    }
    if (sp.get("all")) {
      await verifyAdminRequest(bearer(req), ["moderation", "legal"]);
      return NextResponse.json({ recordings: await allRecordings(db) }, noStore);
    }
    const uid = await member(req);
    const [recordings, replays, figures] = await Promise.all([myRecordings(db, uid), myReplays(db, uid), liveRecordingFigures(db)]);
    return NextResponse.json({ recordings, replays, figures }, noStore);
  } catch (err) {
    return fail(err, "Couldn't load the replays");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (body.action === "play" && body.admin === true) {
      const admin = await verifyAdminRequest(bearer(req), ["moderation", "legal"]);
      return NextResponse.json(await playRecording(db, admin, body.id, true));
    }
    const uid = await member(req);
    const limited = await rateLimit(req, "replays", uid, 60, 600);
    if (limited) return limited;
    switch (body.action) {
      case "play": return NextResponse.json(await playRecording(db, uid, body.id, false));
      case "delete": return NextResponse.json(await deleteRecording(db, uid, body.id));
      case "publish": return NextResponse.json(await publishReplay(db, uid, body.id, { title: body.title, audience: body.audience }));
      case "unpublish": return NextResponse.json(await unpublishReplay(db, uid, body.id));
      case "journal": return NextResponse.json(await shareReplayToJournal(db, uid, body.id));
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return fail(err, "Couldn't do that with the replay");
  }
}
