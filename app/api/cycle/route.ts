import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CycleError } from "@/lib/cycle";
import {
  answer, changePeriod, chatTurn, clearChat, cycleStatus, cycleView, dailyNote, eraseCycle, exportCycle, monthlyReport, pickToday,
  saveLog, saveSettings, unlocked,
} from "@/lib/cycle-server";
import { NO_STORE, clearUnlock, fail, setUnlock, signedIn, unlockToken } from "@/lib/cycle-api";

export const dynamic = "force-dynamic";

// My Cycle (lib/cycle-server.ts, docs/MY_CYCLE.md).
//   GET ?status=1            → whether she may use it, her answer, whether to show it in the menu (no unlock needed)
//   GET ?today=YYYY-MM-DD    → everything the page shows (unlocked)
//   GET ?export=1            → Download my data (unlocked)
//   POST { action: "answer", answer: "female" | "no" | "undo", consent, lastPeriod, cycleLength }   (first open; no unlock needed)
//   POST { action: "settings" | "period" | "log" | "note" | "report" | "chat" | "clear-chat", … }        (unlocked)
//   DELETE                   → Delete everything (unlocked)
// Every unlocked answer renews the 2-minute unlock cookie.
export async function GET(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("status")) return NextResponse.json(await cycleStatus(db, me.uid), { headers: NO_STORE });
    const today = pickToday(q.get("today"));
    const who = await unlocked(db, me.uid, unlockToken(req));
    if (q.get("export")) {
      const res = new NextResponse(JSON.stringify(await exportCycle(db, me.uid, who, today), null, 2), {
        headers: { ...NO_STORE, "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-cycle.json"' },
      });
      return setUnlock(req, res, me.uid, who.since);
    }
    if (q.get("ping")) return setUnlock(req, NextResponse.json({ ok: true }, { headers: NO_STORE }), me.uid, who.since);
    return setUnlock(req, NextResponse.json(await cycleView(db, me.uid, who, today), { headers: NO_STORE }), me.uid, who.since);
  } catch (err) { return fail(req, err, "Couldn't open My Cycle"); }
}

export async function POST(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const db = getAdminDb();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const today = pickToday(b.today);
    if (b.action === "answer") {
      const limited = await rateLimit(req, "cycle-answer", me.uid, 20, 3600);
      if (limited) return limited;
      return NextResponse.json(await answer(db, me.uid, b, today), { headers: NO_STORE });
    }
    const who = await unlocked(db, me.uid, unlockToken(req));
    const ai = b.action === "note" || b.action === "report" || b.action === "chat" || (b.action === "log" && b.ask === true);
    const limited = await rateLimit(req, ai ? "cycle-ai" : "cycle", me.uid, ai ? 60 : 200, 3600);
    if (limited) return limited;
    let out: unknown;
    switch (b.action) {
      case "settings": await saveSettings(db, me.uid, who, b); out = { ok: true }; break;
      case "period": await changePeriod(db, me.uid, b, today); out = { ok: true }; break;
      case "log": out = await saveLog(db, me.uid, who, b, today); break;
      case "note": out = await dailyNote(db, me.uid, who, today); break;
      case "report": out = await monthlyReport(db, me.uid, who, today, b.fresh === true); break;
      case "chat": out = await chatTurn(db, me.uid, who, b, today); break;
      case "clear-chat": await clearChat(db, me.uid); out = { ok: true }; break;
      default: throw new CycleError("Unknown action.");
    }
    return setUnlock(req, NextResponse.json(out, { headers: NO_STORE }), me.uid, who.since);
  } catch (err) { return fail(req, err, "Couldn't save that"); }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const db = getAdminDb();
    await unlocked(db, me.uid, unlockToken(req));
    const limited = await rateLimit(req, "cycle", me.uid, 200, 3600);
    if (limited) return limited;
    await eraseCycle(db, me.uid);
    return clearUnlock(req, NextResponse.json({ ok: true }, { headers: NO_STORE }));
  } catch (err) { return fail(req, err, "Couldn't delete that"); }
}
