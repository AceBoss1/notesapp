import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SavedJournalError, toggleSavedJournal } from "@/lib/saved-journals-server";

export const dynamic = "force-dynamic";

// Signed-in members: POST { noteId } saves the journal or, if it is already saved, removes it → { saved }.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
    if (!d) throw new SavedJournalError("Sign in to save journals.", 401);
    const limited = await rateLimit(req, "journal-save", d.uid, 60, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await toggleSavedJournal(getAdminDb(), d.uid, String(b.noteId ?? "")), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof SavedJournalError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't save that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
