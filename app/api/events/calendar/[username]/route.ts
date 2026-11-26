import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { upcoming } from "@/lib/events-server";
import { toIcsMany } from "@/lib/events";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";

// A host's calendar as a file phones and calendar apps subscribe to (docs/EVENTS_DISCOVER.md): their public upcoming events.
export async function GET(_req: NextRequest, { params }: { params: { username: string } }) {
  const username = params.username.replace(/\.ics$/, "").slice(0, 40);
  const list = await upcoming(getAdminDb(), { host: username }, null);
  const name = list[0]?.hostName ? `${list[0].hostName} on #NotesApp` : `@${username} on #NotesApp`;
  return new NextResponse(toIcsMany(list, (id) => `${SITE_URL}/events/${id}`, name), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600", "Content-Disposition": `inline; filename="${username}.ics"` },
  });
}
