import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import {
  adminAction, adminList, adminResults, createTournament, prizesBlockerOf, publishResultsPost, resultsPostDraft, sponsorReport, tellWinners, updateTournament, winnersPlan,
} from "@/lib/arcade/tournaments-server";
import { NO_STORE, bearer, tournamentFail } from "@/lib/arcade/tournaments-api";
import { TOURNAMENT_ADMIN_DEPTS } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

// Admin → Arcade tournaments (lib/arcade/tournaments-server.ts).
//   GET                 → { tournaments }    every tournament, drafts and seeds included
//   GET ?id=x             → { results, report, prizesBlocker } the top entrants with all their tries, the sponsor's report, and why
//                                            "Mark prizes sent" can't be pressed yet (null when it can)
//   GET ?id=x&winners=n   → { plan }         "Tell winners" previewed: who gets which place, prize and message, who's skipped and why
//   GET ?id=x&resultsPost → { draft }        the results post's draft (title, Markdown body, the winners it names)
//   POST { action: "create", draft }                                           → { tournament }
//   POST { action: "update", id, draft }                                       → { tournament }
//   POST { action: "open" | "close" | "results-checked" | "prizes-sent", id }  → { tournament }
//   POST { action: "tell-winners", id, count }                                 → { sent, failed, skipped, tournament }  (§5; owner, 24 Nov 2026)
//   POST { action: "publish-results-post", id, title, body }                   → { resultsPost, tournament }  posted as #NotesApp, once (§2)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), TOURNAMENT_ADMIN_DEPTS);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    const id = q.get("id");
    if (id && q.has("winners")) return NextResponse.json({ plan: await winnersPlan(db, id, q.get("winners") || undefined) }, { headers: NO_STORE });
    if (id && q.has("resultsPost")) return NextResponse.json({ draft: await resultsPostDraft(db, id) }, { headers: NO_STORE });
    if (id) {
      const [results, report, prizesBlocker] = await Promise.all([adminResults(db, id), sponsorReport(db, id), prizesBlockerOf(db, id)]);
      return NextResponse.json({ results, report, prizesBlocker }, { headers: NO_STORE });
    }
    return NextResponse.json({ tournaments: await adminList(db) }, { headers: NO_STORE });
  } catch (err) {
    return tournamentFail(err, "Couldn't load tournaments");
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAdminRequest(bearer(req), TOURNAMENT_ADMIN_DEPTS);
    const db = getAdminDb();
    const body = await req.json().catch(() => ({}));
    if (body.action === "create") return NextResponse.json({ tournament: await createTournament(db, body.draft, uid) });
    if (body.action === "update") return NextResponse.json({ tournament: await updateTournament(db, body.id, body.draft) });
    if (body.action === "tell-winners") return NextResponse.json(await tellWinners(db, body.id, body.count));
    if (body.action === "publish-results-post") return NextResponse.json(await publishResultsPost(db, body.id, { title: body.title, body: body.body }, uid));
    return NextResponse.json({ tournament: await adminAction(db, body.id, body.action) });
  } catch (err) {
    return tournamentFail(err, "Couldn't do that");
  }
}
