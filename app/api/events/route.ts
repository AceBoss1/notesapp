import { NextRequest, NextResponse } from "next/server";
import { checkReply } from "@/lib/content-checks-reply";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CommunityError } from "@/lib/community-server";
import { EventError, cancelEvent, createEvent, decideRequest, getEvent, joinRequests, listedEvents, rsvp, updateEvent, upcoming } from "@/lib/events-server";
import { discover, discoverList } from "@/lib/events-discover-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  const cc = checkReply(err);
  if (cc) return cc;
  if (err instanceof EventError || err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// GET ?id= → one event · GET ?state=&city=&cid=&host=&mine=1 → { events } · GET ?explore=1 → { events }: Explore's Events tab, every
// listed event soonest first (public, upcoming, not cancelled, not from an invite-only community) (lib/events-server.ts)
export async function GET(req: NextRequest) {
  try {
    const uid = await viewer(req);
    const q = req.nextUrl.searchParams;
    const db = getAdminDb();
    // Discover (docs/EVENTS_DISCOVER.md): ?discover=1&city= → featured, counts, calendars, cities · ?list=1&category=&city=&region= → { events }
    const cached = { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } };
    if (q.get("discover")) return NextResponse.json(await discover(db, (q.get("city") ?? "Lagos").slice(0, 60)), cached);
    if (q.get("list")) return NextResponse.json({ events: await discoverList(db, { category: q.get("category") ?? undefined, city: q.get("city") ?? undefined, region: q.get("region") ?? undefined }) }, cached);
    if (q.get("requests")) {
      if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      return NextResponse.json({ people: await joinRequests(db, uid, q.get("requests")!) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (q.get("explore")) return NextResponse.json({ events: (await listedEvents(db)).slice(0, 60) }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    if (q.get("id")) return NextResponse.json(await getEvent(db, q.get("id")!, uid), { headers: { "Cache-Control": "no-store" } });
    const events = await upcoming(db, { state: q.get("state") ?? undefined, city: q.get("city") ?? undefined, cid: q.get("cid") ?? undefined, host: q.get("host") ?? undefined, mine: q.get("mine") === "1" }, uid);
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load events");
  }
}

// POST { action: create | update | cancel | rsvp | decide, … } (signed in); decide { id, who, accept } answers a request to join
export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "events", uid, 300, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if (b.action === "create") return NextResponse.json({ event: await createEvent(db, uid, b) });
    if (b.action === "update") return NextResponse.json({ event: await updateEvent(db, uid, String(b.id), b) });
    if (b.action === "cancel") { await cancelEvent(db, uid, String(b.id)); return NextResponse.json({ ok: true }); }
    if (b.action === "rsvp") return NextResponse.json(await rsvp(db, uid, String(b.id), b.status));
    if (b.action === "decide") { await decideRequest(db, uid, String(b.id), String(b.who), b.accept === true); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
