import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { presignGet, presignUpload, privateFilesConfigured } from "@/lib/private-files";
import { TaskError } from "@/lib/tasks";
import {
  applyTo, closeTask, decide, deleteDraft, fileLink, listOpen, myTasks, posterCheck, publishTask, rate, review, saveTask, startUpload,
  submitWork, viewTask, withdraw, type FileDeps,
} from "@/lib/tasks-server";
import type { UserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";

// Notes Tasks (lib/tasks-server.ts).
//   GET                         the open tasks (?category=)
//   GET ?id=                    one task as you may see it
//   GET ?mine=1                 the tasks you posted and applied to; ?canPost=1 whether you may post
//   GET ?id=&file=&worker=      a short-lived link to a brief's file (or, with worker, a submission's)
//   POST { action, ... }        save · delete · publish · apply · withdraw · decide · upload · submit · review · rate · close
//   (Admins remove tasks through /api/admin/tasks.)
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const files: FileDeps = {
  presignPut: (key, type, size) => presignUpload(key, type, size),
  presignGet: (key, name, type) => presignGet(key, name, type, false),
};
function fail(err: unknown, fallback: string) {
  if (err instanceof TaskError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof Error && /Missing auth token|verifyIdToken|ID token/i.test(err.message)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
const signedIn = async (req: NextRequest) => {
  const me = await verifySignedInRequest(bearer(req)).catch(() => { throw new TaskError(401, "Sign in first."); });
  return { uid: me.uid, emailVerified: me.emailVerified === true };
};

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    const uid = bearer(req) ? (await verifySignedInRequest(bearer(req)).catch(() => null))?.uid ?? null : null;
    const noStore = { headers: { "Cache-Control": "no-store" } };
    if (q.get("canPost")) {
      const me = await signedIn(req);
      const u = (await db.doc(`users/${me.uid}`).get()).data() as UserProfile | undefined;
      return NextResponse.json({ ...posterCheck(u, me.emailVerified), tier: u?.accountTier ?? "standard" }, noStore);
    }
    if (q.get("mine")) { const me = await signedIn(req); return NextResponse.json(await myTasks(db, me.uid), noStore); }
    if (q.get("file")) {
      if (!uid) throw new TaskError(401, "Sign in first.");
      if (!privateFilesConfigured()) throw new TaskError(503, "Files aren't set up yet.");
      return NextResponse.json(await fileLink(db, uid, q.get("id"), q.get("file"), q.get("worker"), files), noStore);
    }
    if (q.get("id")) return NextResponse.json(await viewTask(db, uid, q.get("id")), noStore);
    return NextResponse.json({ tasks: await listOpen(db, { category: q.get("category") || undefined }) }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (err) { return fail(err, "Couldn't load tasks"); }
}

export async function POST(req: NextRequest) {
  try {
    const db = getAdminDb();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const me = await signedIn(req);
    const limited = await rateLimit(req, "tasks", me.uid, 60, 600);
    if (limited) return limited;
    switch (b.action) {
      case "save": return NextResponse.json(await saveTask(db, me, b.id, b as never));
      case "delete": return NextResponse.json(await deleteDraft(db, me, b.id));
      case "publish": return NextResponse.json(await publishTask(db, me, b.id));
      case "apply": return NextResponse.json(await applyTo(db, me, b.id, { pitch: b.pitch, agree: b.agree }));
      case "withdraw": return NextResponse.json(await withdraw(db, me, b.id));
      case "decide": return NextResponse.json(await decide(db, me, b.id, b.worker, b.accept === true));
      case "upload":
        if (!privateFilesConfigured()) throw new TaskError(503, "Files aren't set up yet.");
        return NextResponse.json(await startUpload(db, me, { name: b.name, size: b.size, purpose: b.purpose, taskId: b.id }, files));
      case "submit": return NextResponse.json(await submitWork(db, me, b.id, { note: b.note, fileIds: b.fileIds }));
      case "review": return NextResponse.json(await review(db, me, b.id, b.worker, b.decision, b.feedback));
      case "rate": return NextResponse.json(await rate(db, me, b.id, b.worker, b.stars, b.comment));
      case "close": return NextResponse.json(await closeTask(db, me, b.id));
      default: throw new TaskError(400, "Unknown action.");
    }
  } catch (err) { return fail(err, "Couldn't do that"); }
}
