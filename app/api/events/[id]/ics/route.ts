import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { SITE_URL } from "@/lib/host";
import { toIcs, type EventDoc } from "@/lib/events";

export const dynamic = "force-dynamic";

// The calendar file for a public event (Add to calendar). Members-only events aren't shared this way.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const e = (await getAdminDb().doc(`events/${params.id}`).get()).data() as EventDoc | undefined;
  if (!e || e.visibility !== "public") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ics = toIcs({ ...e, id: params.id }, `${SITE_URL}/events/${params.id}`);
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="event-${params.id}.ics"`, "Cache-Control": "no-store" } });
}
