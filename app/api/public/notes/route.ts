import { NextResponse } from "next/server";
import { getAllNotes } from "@/lib/firestore-notes";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Published notes for list views (home, journals, profiles, search) —
// WITHOUT note bodies (each note page loads its own). CDN-cached so all
// visitors share one Firestore read set instead of one each.
export async function GET() {
  try {
    const notes = (await getAllNotes({ publishedOnly: true })).map((n) => ({ ...n, content: "" }));
    return NextResponse.json({ notes }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch (err) {
    const { message, status } = friendlyMessage(err);
    return NextResponse.json({ error: message }, { status });
  }
}
