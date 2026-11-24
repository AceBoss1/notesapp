import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { OFFICIAL_INBOX_DEPTS } from "@/lib/admin-access";
import { MessageError } from "@/lib/messages-server";
import { markOfficialRead, officialInbox, officialThread, replyAsOfficial } from "@/lib/official-inbox-server";

export const dynamic = "force-dynamic";

// Admin → #NotesApp inbox (lib/official-inbox-server.ts): the conversations of the official account @na-notesapp, where tournament
// winners reply (owner, 24 Nov 2026: "Set OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp"). Customer care and
// super admins (OFFICIAL_INBOX_DEPTS).
//   GET              → { rows, unread }   newest first
//   GET ?id=<cid>    → { id, memberUid, member, messages }   and marks it read for the team
//   POST { id, text }            → answers as @na-notesapp; the answer is stamped with your uid for the team (never shown to members)
//   POST { id, action: "read" }  → marks it read without opening it
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const failed = (err: unknown, fallback: string) => {
  if (err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), OFFICIAL_INBOX_DEPTS);
    const id = req.nextUrl.searchParams.get("id");
    const db = getAdminDb();
    return NextResponse.json(id ? await officialThread(db, id) : await officialInbox(db), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return failed(err, "Couldn't load #NotesApp's inbox");
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAdminRequest(bearer(req), OFFICIAL_INBOX_DEPTS);
    const body = (await req.json().catch(() => ({}))) as { id?: unknown; text?: unknown; action?: unknown };
    const db = getAdminDb();
    if (body.action === "read") { await markOfficialRead(db, body.id); return NextResponse.json({ ok: true }); }
    const limited = await rateLimit(req, "official-inbox", uid, 30, 60);
    if (limited) return limited;
    return NextResponse.json(await replyAsOfficial(db, uid, body.id, body.text));
  } catch (err) {
    return failed(err, "Couldn't send that");
  }
}
