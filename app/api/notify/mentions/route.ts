import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { notifyMentions } from "@/lib/mentions-server";

export const dynamic = "force-dynamic";

// POST { kind: "comment", noteId, commentId } | { kind: "journal", noteId } — after the browser saves a comment or a journal, the
// server reads what was saved and tells the people @mentioned in it (lib/mentions-server.ts). Only the author can ask, and only
// for what is published. Safe to call again after an edit: each person is told once per comment or journal.
// (Reviews, recommendations and moments are saved on the server, which notifies there.)
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const { uid } = await verifySignedInRequest(token).catch(() => { throw Object.assign(new Error("Sign in first."), { status: 401 }); });
    const limited = rateLimit(req, "mentions", uid, 30, 60);
    if (limited) return limited;
    const b = (await req.json().catch(() => ({}))) as { kind?: unknown; noteId?: unknown; commentId?: unknown };
    const noteId = typeof b.noteId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(b.noteId) ? b.noteId : "";
    if (!noteId) return NextResponse.json({ error: "Which journal?" }, { status: 400 });
    const db = getAdminDb();
    const note = (await db.doc(`notes/${noteId}`).get()).data();
    if (!note || note.status !== "published") return NextResponse.json({ sent: 0 });
    const title = String(note.title ?? "a journal");
    const href = `/journals/${String(note.slug ?? noteId)}`;

    if (b.kind === "comment") {
      const commentId = typeof b.commentId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(b.commentId) ? b.commentId : "";
      if (!commentId) return NextResponse.json({ error: "Which comment?" }, { status: 400 });
      const c = (await db.doc(`notes/${noteId}/comments/${commentId}`).get()).data();
      if (!c || c.authorUid !== uid) return NextResponse.json({ error: "Only the person who wrote it can do that." }, { status: 403 });
      // The journal's author and, for a reply, the person replied to get their own bell already.
      const parent = c.parentCommentId ? (await db.doc(`notes/${noteId}/comments/${String(c.parentCommentId)}`).get()).data() : null;
      const skip = [note.authorUid, note.writerUid, parent?.authorUid].filter((x): x is string => typeof x === "string" && !!x);
      return NextResponse.json(await notifyMentions(db, {
        kind: "comment", sourceId: `${noteId}_${commentId}`, text: String(c.content ?? ""),
        author: { uid, name: String(c.authorDisplayName ?? "Someone"), username: String(c.authorUsername ?? ""), avatar: String(c.authorAvatar ?? "") },
        where: `in a comment on “${title}”`, linkHref: `${href}#comments`, skipUids: skip,
      }));
    }

    if (b.kind === "journal") {
      // The author, the team member who wrote an organisation's post, or an admin publishing under a founder's or @na-notesapp's name.
      const own = uid === note.authorUid || uid === note.writerUid;
      if (!own) await verifyAdminRequest(token).catch(() => { throw Object.assign(new Error("Only the author can do that."), { status: 403 }); });
      return NextResponse.json(await notifyMentions(db, {
        kind: "journal", sourceId: noteId, text: `${String(note.excerpt ?? "")}\n\n${String(note.content ?? "")}`, markdown: true,
        author: { uid: String(note.authorUid ?? uid), name: String(note.author ?? "Someone"), username: String(note.authorUsername ?? ""), avatar: String(note.author_avatar ?? "") },
        where: `in “${title}”`, linkHref: href,
      }));
    }
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) return NextResponse.json({ error: (err as Error).message }, { status });
    const f = friendlyMessage(err, "Couldn't send mention notifications");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
