import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { countOn, lagosToday } from "@/lib/my-calendar";
import { calendarMode, cleanRange, gatherCalendar, getPrefs, linkView, newLink, savePrefs, stopLink } from "@/lib/my-calendar-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// My Calendar (lib/my-calendar-server.ts), for the signed-in member.
//   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → { entries, failed, mode, prefs, today } (up to two months)
//   GET ?count=today                   → { count, today }: the number beside "📅 My Calendar" in the menu
//   GET ?settings=1                    → { prefs, link, mode }
//   POST { action: "save", prefs } · { action: "new_link" } (Make a new link: the old one stops at once) · { action: "stop_link" }
// The feed itself is /api/calendar/<token>.ics.
const noStore = { headers: { "Cache-Control": "no-store" } };
const uidOf = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => { const f = friendlyMessage(err, what); return NextResponse.json({ error: f.message }, { status: f.status }); };

export async function GET(req: NextRequest) {
  try {
    const uid = await uidOf(req);
    if (!uid) return NextResponse.json({ error: "Sign in to see your calendar." }, { status: 401 });
    const limited = await rateLimit(req, "calendar", uid, 300, 3600);
    if (limited) return limited;
    const db = getAdminDb(), q = req.nextUrl.searchParams, now = new Date(), today = lagosToday(now);
    if (q.get("settings")) {
      const [prefs, link, mode] = await Promise.all([getPrefs(db, uid), linkView(db, uid), calendarMode(db, uid)]);
      return NextResponse.json({ prefs, link, mode }, noStore);
    }
    if (q.get("count") === "today") {
      const { entries } = await gatherCalendar(db, uid, { from: today, to: today }, { now });
      return NextResponse.json({ count: countOn(entries, today), today }, noStore);
    }
    const range = cleanRange(q.get("from"), q.get("to"), now);
    const [cal, prefs] = await Promise.all([gatherCalendar(db, uid, range, { now }), getPrefs(db, uid)]);
    return NextResponse.json({ ...cal, range, prefs, today }, noStore);
  } catch (err) {
    return fail(err, "Couldn't load your calendar");
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await uidOf(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "calendar-settings", uid, 60, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = (await req.json().catch(() => ({}))) as { action?: string; prefs?: unknown };
    if ((await calendarMode(db, uid)).kid) return NextResponse.json({ error: "Child profiles don't have a calendar." }, { status: 403 });
    if (b.action === "save") return NextResponse.json({ prefs: await savePrefs(db, uid, b.prefs) }, noStore);
    if (b.action === "new_link") return NextResponse.json({ link: await newLink(db, uid) }, noStore);
    if (b.action === "stop_link") { await stopLink(db, uid); return NextResponse.json({ link: await linkView(db, uid) }, noStore); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
