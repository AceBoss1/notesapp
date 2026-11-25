import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess, verifyAdminRequest } from "@/lib/firebase-admin";
import { hasAnyDept } from "@/lib/admin-access";
import { friendlyMessage } from "@/lib/api-errors";
import { TaskError } from "@/lib/tasks";
import { adminTaskApplications, adminTasks, removeTask } from "@/lib/tasks-server";

export const dynamic = "force-dynamic";
// Admin → Tasks (lib/tasks-server.ts). Trust & safety and Legal see every task, with who really posted the anonymous ones; Trust & safety
// removes a task (what's held goes back to the poster, anyone working on it is told).
//   GET ?status=&q=        the tasks and how many in each status
//   GET ?id=               one task's applications (for disputes; the work itself stays between poster and worker)
//   POST { action: "remove", id, reason }
const VIEW = ["moderation", "legal", "support"] as const;
const REMOVE = ["moderation"] as const;
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
function fail(err: unknown, fallback: string) {
  if (err instanceof TaskError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), VIEW);
    const q = req.nextUrl.searchParams, db = getAdminDb();
    const out = q.get("id") ? await adminTaskApplications(db, q.get("id")) : await adminTasks(db, { status: q.get("status"), q: q.get("q") });
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load tasks"); }
}

export async function POST(req: NextRequest) {
  try {
    const a = await verifyAdminAccess(bearer(req));
    if (!hasAnyDept(a.access, REMOVE)) throw new TaskError(403, "Only Trust & safety removes tasks.");
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (b.action !== "remove") throw new TaskError(400, "Unknown action.");
    return NextResponse.json(await removeTask(getAdminDb(), b.id, b.reason, { uid: a.uid, email: a.email }));
  } catch (err) { return fail(err, "Couldn't remove it"); }
}
