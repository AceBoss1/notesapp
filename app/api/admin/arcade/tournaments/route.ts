import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { adminAction, adminList, adminResults, createTournament, sponsorReport, updateTournament } from "@/lib/arcade/tournaments-server";
import { NO_STORE, bearer, tournamentFail } from "@/lib/arcade/tournaments-api";
import { TOURNAMENT_ADMIN_DEPTS } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

// Admin → Arcade tournaments (lib/arcade/tournaments-server.ts).
//   GET                 → { tournaments }    every tournament, drafts and seeds included
//   GET ?id=x           → { results, report } the top entrants with all their tries, and the sponsor's report
//   POST { action: "create", draft }                                           → { tournament }
//   POST { action: "update", id, draft }                                       → { tournament }
//   POST { action: "open" | "close" | "results-checked" | "prizes-sent", id }  → { tournament }
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), TOURNAMENT_ADMIN_DEPTS);
    const db = getAdminDb();
    const id = req.nextUrl.searchParams.get("id");
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
    return NextResponse.json({ tournament: await adminAction(db, body.id, body.action) });
  } catch (err) {
    return tournamentFail(err, "Couldn't do that");
  }
}
