import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { isDay } from "@/lib/my-calendar";
import { rpIdFor } from "@/lib/passkeys";
import { hasPasskeyFor } from "@/lib/passkeys-server";
import { PlannerError } from "@/lib/planner";
import {
  enter, erasePlanner, exportPlanner, finishMonth, interviewTurn, pickToday, plannerDay, plannerStatus, plannerView, savePlan, savePrefs,
  saveReview, setGentle, startInterview, tickMove, tickTask, writePlan,
} from "@/lib/planner-server";
import { NO_STORE, clearUnlock, fail, keepUnlock, signedIn, unlockToken } from "@/lib/planner-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Notes Planner (lib/planner-server.ts, docs/NOTES_PLANNER.md), for the signed-in member.
//   GET ?status=1                 → whether she may use it, whether she has a plan, whether it's locked (never needs the unlock)
//   GET ?today=YYYY-MM-DD         → everything the Planner tab shows
//   GET ?day=YYYY-MM-DD           → one day for My Calendar: the month's project and the moves to tick
//   GET ?export=1                 → Download my plan
//   POST { action: "start", length?, restart? } · { action: "answer", message | skip, gentle?, sumUp? } · { action: "gentle", on }
//        { action: "write" } (Nana writes the plan) · { action: "save", plan, fresh?, length? } (by hand, and every edit)
//        { action: "tick", day?, i, on } · { action: "task", i, on } · { action: "month", month, on } · { action: "review", answers, numbers, signs }
//        { action: "prefs", prefs }
//   DELETE                        → Delete my plan and answers
// With her lock on, everything but the status needs the unlock cookie (app/api/planner/unlock); each answer renews it.
export async function GET(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("status")) return NextResponse.json(await plannerStatus(db, me.uid), { headers: NO_STORE });
    const limited = await rateLimit(req, "planner", me.uid, 400, 3600);
    if (limited) return limited;
    const today = pickToday(q.get("today"));
    const who = await enter(db, me.uid, unlockToken(req));
    if (q.get("export")) {
      const res = new NextResponse(JSON.stringify(await exportPlanner(db, me.uid), null, 2), {
        headers: { ...NO_STORE, "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="notes-planner.json"' },
      });
      return keepUnlock(req, res, me.uid, who.since);
    }
    const day = q.get("day");
    const out = isDay(day) ? await plannerDay(db, me.uid, day, today) : await plannerView(db, me.uid, who, today);
    return keepUnlock(req, NextResponse.json(out, { headers: NO_STORE }), me.uid, who.since);
  } catch (err) { return fail(req, err, "Couldn't open Notes Planner"); }
}

export async function POST(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const db = getAdminDb();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const today = pickToday(b.today);
    const who = await enter(db, me.uid, unlockToken(req));
    const ai = b.action === "answer" || b.action === "write" || b.action === "review";
    const limited = await rateLimit(req, ai ? "planner-ai" : "planner", me.uid, ai ? 120 : 400, 3600);
    if (limited) return limited;
    let out: unknown;
    switch (b.action) {
      case "start": out = await startInterview(db, me.uid, who, b, today); break;
      case "answer": out = await interviewTurn(db, me.uid, who, b); break;
      case "gentle": out = await setGentle(db, me.uid, who, b.on === true); break;
      case "write": out = await writePlan(db, me.uid, who); break;
      case "save": out = { plan: await savePlan(db, me.uid, who, b, today) }; break;
      case "tick": out = await tickMove(db, me.uid, b, today); break;
      case "task": out = { plan: await tickTask(db, me.uid, b) }; break;
      case "month": out = { plan: await finishMonth(db, me.uid, b) }; break;
      case "review": out = await saveReview(db, me.uid, who, b, today); break;
      case "prefs": {
        // The lock can only be turned on by someone who has a passkey here, so she can't lock herself out.
        if ((b.prefs as { lock?: unknown } | undefined)?.lock === true && who.since === null) {
          const rpID = rpIdFor(req.headers.get("host"));
          if (!rpID || !(await hasPasskeyFor(db, me.uid, rpID))) throw new PlannerError("Add a passkey in Account settings first, then turn the lock on.", 409);
        }
        out = { prefs: await savePrefs(db, me.uid, b.prefs) };
        break;
      }
      default: throw new PlannerError("Unknown action.");
    }
    return keepUnlock(req, NextResponse.json(out, { headers: NO_STORE }), me.uid, who.since);
  } catch (err) { return fail(req, err, "Couldn't save that"); }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const db = getAdminDb();
    await enter(db, me.uid, unlockToken(req));
    const limited = await rateLimit(req, "planner", me.uid, 400, 3600);
    if (limited) return limited;
    await erasePlanner(db, me.uid);
    return clearUnlock(req, NextResponse.json({ ok: true }, { headers: NO_STORE }));
  } catch (err) { return fail(req, err, "Couldn't delete that"); }
}
