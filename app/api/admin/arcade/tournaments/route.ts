import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { adminAction, adminList, adminResults, createTournament, sponsorReport, tellWinners, updateTournament, winnersPlan } from "@/lib/arcade/tournaments-server";
import { NO_STORE, bearer, tournamentFail } from "@/lib/arcade/tournaments-api";
import { TOURNAMENT_ADMIN_DEPTS } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

// Admin → Arcade tournaments (lib/arcade/tournaments-server.ts).
//   GET                 → { tournaments }    every tournament, drafts and seeds included
//   GET ?id=x           → { results, report } the top entrants with all their tries, and the sponsor's report
//   GET ?id=x&winners=n → { plan }           "Tell winners" previewed: who gets which place, prize and message, who's skipped and why
//   POST { action: "create", draft }                                           → { tournament }
//   POST { action: "update", id, draft }                                       → { tournament }
//   POST { action: "open" | "close" | "results-checked" | "prizes-sent", id }  → { tournament }
//   POST { action: "tell-winners", id, count }                                 → { sent, failed, skipped, tournament }  (§5; owner, 24 Nov 2026)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), TOURNAMENT_ADMIN_DEPTS);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    const id = q.get("id");
    if (id && q.has("winners")) return NextResponse.json({ plan: await winnersPlan(db, id, q.get("winners") || undefined) }, { headers: NO_STORE });
    if (id) {
      const [results, report] = await Promise.all([adminResults(db, id), sponsorReport(db, id)]);
      return NextResponse.json({ results, report }, { headers: NO_STORE });
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
    return NextResponse.json({ tournament: await adminAction(db, body.id, body.action) });
  } catch (err) {
    return tournamentFail(err, "Couldn't do that");
  }
}
