import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CoAuthorError, saveSharedDraft, sharedDraft } from "@/lib/coauthors-server";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

// A journal's draft for its co-authors (lib/coauthors-server.ts). Drafts stay unreadable from browsers (firestore.rules), so this is
// the only way in for a co-author:
//   GET  ?noteId=…                               → { note, access, version, leadName, inviteId }   "view" and "edit" co-authors
//   POST { noteId, title, content, version }     → { version }                                     "edit" co-authors, drafts only
async function who(req: NextRequest) {
  return verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
}
function fail(err: unknown, fallback: string) {
  if (err instanceof CoAuthorError) return NextResponse.json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}

export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "coauthor-draft", me.uid, 120, 600);
    if (limited) return limited;
    return NextResponse.json(await sharedDraft(getAdminDb(), me.uid, req.nextUrl.searchParams.get("noteId") ?? ""), { headers: NO_STORE });
  } catch (err) {
    return fail(err, "Couldn't open the draft");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "coauthor-draft-save", me.uid, 60, 600);
    if (limited) return limited;
    return NextResponse.json(await saveSharedDraft(getAdminDb(), me.uid, await req.json().catch(() => ({}))));
  } catch (err) {
    return fail(err, "Couldn't save the draft");
  }
}
