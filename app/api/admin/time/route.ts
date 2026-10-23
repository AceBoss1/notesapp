import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasDept, isSuper } from "@/lib/admin-access";
import { lagosDate, weekStart } from "@/lib/team";
import { TimeError, isApprover, teamCsv } from "@/lib/time";
import {
  addHoliday, addManual, cancelLeave, choices, confirm, decideLeave, decideSheet, deleteEntry, getTimer, myLeave, myWeek, removeHoliday, requestLeave,
  saveProject, setCell, setLead, start, stop, submit, teamWeek, viewerOf,
} from "@/lib/time-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const NO_STORE = { "Cache-Control": "no-store" };

async function who(req: NextRequest) {
  const me = await verifyAdminAccess(bearer(req));
  return { uid: me.uid, superAdmin: isSuper(me.access), owner: me.owner, finance: hasDept(me.access, "finance") };
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof TimeError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Time in the team hub (lib/time.ts has the rules). Any staff member, for their own time; team leads and super admins also see their teams.
// GET ?timer=1                → the running timer (stopping it first if it stopped itself)
// GET ?view=me&week=YYYY-MM-DD → my timer, week, choices and leave
// GET ?view=team&week=…        → the team report (leads and super admins); &csv=1 for the CSV
// POST { action: "start" | "stop" | "confirm" | "manual" | "cell" | "deleteEntry" | "submit" | "decide" | "leave" | "cancelLeave" |
//        "decideLeave" | "holiday" | "removeHoliday" | "project" | "lead", … }
export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    const db = getAdminDb();
    const sp = req.nextUrl.searchParams;
    if (sp.get("timer")) return NextResponse.json({ ...(await getTimer(db, me.uid)), now: new Date().toISOString() }, { headers: NO_STORE });
    const week = sp.get("week") || weekStart(lagosDate());
    const v = await viewerOf(db, me);
    if (sp.get("view") === "team") {
      const t = await teamWeek(db, v, week);
      if (sp.get("csv")) {
        const csv = teamCsv(t.rows.map((r) => ({ name: r.name, depts: r.depts.join(" "), s: r.summary, status: r.status, payKobo: r.payKobo ?? 0 })));
        return new NextResponse(csv, { headers: { ...NO_STORE, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="team-time-${week}.csv"` } });
      }
      return NextResponse.json(t, { headers: NO_STORE });
    }
    const [timer, w, c, leave] = await Promise.all([getTimer(db, me.uid), myWeek(db, me.uid, week), choices(db, me.uid), myLeave(db, me.uid)]);
    return NextResponse.json({
      ...timer, week: w, choices: c, leave, today: lagosDate(), now: new Date().toISOString(),
      viewer: { uid: me.uid, superAdmin: v.superAdmin, leads: v.leads, approver: isApprover(v), finance: v.finance },
    }, { headers: NO_STORE });
  } catch (err) {
    return fail(err, "Couldn't load your time");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    const limited = await rateLimit(req, "team-time", me.uid, 600, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const v = () => viewerOf(db, me);
    switch (b.action) {
      case "start": return NextResponse.json(await start(db, me.uid, b));
      case "stop": return NextResponse.json(await stop(db, me.uid));
      case "confirm": return NextResponse.json(await confirm(db, me.uid));
      case "manual": return NextResponse.json(await addManual(db, me.uid, b));
      case "cell": return NextResponse.json(await setCell(db, me.uid, b));
      case "deleteEntry": await deleteEntry(db, me.uid, b.id); return NextResponse.json({ ok: true });
      case "submit": return NextResponse.json(await submit(db, me.uid, b.week));
      case "decide": return NextResponse.json(await decideSheet(db, await v(), b));
      case "leave": return NextResponse.json(await requestLeave(db, me.uid, b));
      case "cancelLeave": await cancelLeave(db, me.uid, b.id); return NextResponse.json({ ok: true });
      case "decideLeave": return NextResponse.json(await decideLeave(db, await v(), b));
      case "holiday": return NextResponse.json(await addHoliday(db, await v(), b));
      case "removeHoliday": await removeHoliday(db, await v(), b.id); return NextResponse.json({ ok: true });
      case "project": return NextResponse.json(await saveProject(db, await v(), b));
      case "lead": return NextResponse.json(await setLead(db, await v(), b));
      default: throw new TimeError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
