import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { TeamError, lagosDate, metricValue, milestoneProgress } from "@/lib/team";
import { cachedTraction, createItem, createMilestone, deleteItem, deleteMilestone, listTeam, listTeamPeople, teamSignals, updateItem } from "@/lib/team-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: the team hub. GET → everything the page needs (work items, milestones with live progress, who is on the team, what is waiting in
// the review queues, a few platform numbers). POST { action: "createItem" | "updateItem" | "deleteItem" | "createMilestone" |
// "deleteMilestone", … }.
export async function GET(req: NextRequest) {
  try {
    const me = await verifyAdminRequest(bearer(req));
    const db = getAdminDb();
    const today = lagosDate();
    const [{ items, milestones }, people, signals, t] = await Promise.all([listTeam(db), listTeamPeople(db), teamSignals(db), cachedTraction(db)]);
    return NextResponse.json({
      me, today, items, people, signals,
      milestones: milestones.map((m) => ({ ...m, progress: milestoneProgress(m, metricValue(t, m.metric), today) })),
      snapshot: { registered: t.people.registered, newLast30Days: t.people.newLast30Days, paidPlans: t.people.paidPlans, goldBadges: t.people.goldBadges, processedLast30DaysKobo: t.money.processedLast30DaysKobo, inEscrowKobo: t.money.inEscrowKobo, generatedAt: t.generatedAt },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the team hub");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyAdminRequest(bearer(req));
    const db = getAdminDb();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? "");
    switch (body.action) {
      case "createItem": return NextResponse.json(await createItem(db, me, body));
      case "updateItem": await updateItem(db, id, body); break;
      case "deleteItem": await deleteItem(db, id); break;
      case "createMilestone": return NextResponse.json(await createMilestone(db, me, body));
      case "deleteMilestone": await deleteMilestone(db, id); break;
      default: throw new TeamError("Unknown action.");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TeamError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't save that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
