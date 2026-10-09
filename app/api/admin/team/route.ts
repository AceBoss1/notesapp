import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { TeamError, lagosDate, metricValue, milestoneProgress } from "@/lib/team";
import { addDecision, addMeetingAction, cachedTraction, createItem, createMeeting, createMilestone, deleteItem, deleteMilestone, getMeeting, listMeetings, listTeam, listTeamPeople, meetingActions, removeDecision, syncTeamRooms, teamSignals, updateItem, updateMeeting } from "@/lib/team-server";
import { TEAM_ROOM_ID } from "@/lib/groups-server";

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
    // One meeting: its details, the actions that came out of it and the team.
    const meetingId = req.nextUrl.searchParams.get("meeting");
    if (meetingId) {
      const [meeting, actions, people] = await Promise.all([getMeeting(db, meetingId), meetingActions(db, meetingId), listTeamPeople(db)]);
      return NextResponse.json({ me, meeting, actions, people }, { headers: { "Cache-Control": "no-store" } });
    }
    const people0 = await listTeamPeople(db);
    await syncTeamRooms(db, me, people0.map((p) => p.uid)).catch(() => {}); // the Team room and upcoming meetings follow who is on the team
    const [{ items, milestones }, meetings, signals, t] = await Promise.all([listTeam(db), listMeetings(db), teamSignals(db), cachedTraction(db)]);
    const people = people0;
    return NextResponse.json({
      me, today, items, people, signals, meetings, teamRoomId: TEAM_ROOM_ID,
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
      case "createMeeting": return NextResponse.json(await createMeeting(db, me, body, (await listTeamPeople(db)).map((p) => p.uid)));
      case "updateMeeting": await updateMeeting(db, id, body); break;
      case "addDecision": await addDecision(db, id, me, body.text); break;
      case "removeDecision": await removeDecision(db, id, body.at); break;
      case "addMeetingAction": return NextResponse.json(await addMeetingAction(db, me, id, body));
      default: throw new TeamError("Unknown action.");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TeamError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't save that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
