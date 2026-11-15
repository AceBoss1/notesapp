import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { accessFromClaims } from "@/lib/admin-access";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { notifyBell } from "@/lib/email";
import {
  CampusError, addAmbassador, appointCoordinator, createTask, deleteTask, leaderboard, me, moveTeam, overview, removeMember, report, review, tasks, team,
  updateTask, viewerOf, type Notify,
} from "@/lib/campus-server";

export const dynamic = "force-dynamic";

// Campus (lib/campus.ts): coordinators, their ambassadors and their tasks. Any signed-in account may ask; what it gets follows its
// campus record and, for leads, its staff access.
//   GET ?view=me | team | tasks | overview | leaderboard (&scope=team|country &period=month|all)   (&country=NG &coordinator=<uid> for leads)
//   POST { action: "coordinator", who, country, campus?, state? } · { action: "ambassador", who, campus, state?, coordinatorUid? }
//        { action: "remove", uid } · { action: "move", from, to }
//        { action: "task", title, details, kind, target?, due, assignees: "all" | uid[] } · { action: "edit", id, ... } · { action: "delete", id }
//        { action: "report", id, status, note?, proofUrl? } · { action: "review", id, uid, verdict: "approved" | "redo", note? }
async function who(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new CampusError("Sign in first.", 401);
  const decoded = await getAuth(getAdminApp()).verifyIdToken(token, true).catch(() => null);
  if (!decoded) throw new CampusError("Sign in again.", 401);
  return viewerOf(getAdminDb(), decoded.uid, accessFromClaims(decoded as unknown as Record<string, unknown>));
}
const notify: Notify = (n) => notifyBell({ uid: n.uid, type: "team", linkHref: n.linkHref, message: n.message });

export async function GET(req: NextRequest) {
  try {
    const v = await who(req);
    const db = getAdminDb();
    const sp = req.nextUrl.searchParams;
    const opts = { country: sp.get("country") ?? undefined, coordinatorUid: sp.get("coordinator") ?? undefined };
    const view = sp.get("view") ?? "me";
    const body = view === "team" ? { team: await team(db, v, opts) }
      : view === "tasks" ? { tasks: await tasks(db, v, opts) }
      : view === "overview" ? await overview(db, v, opts)
      : view === "leaderboard" ? await leaderboard(db, v, { ...opts, scope: sp.get("scope") ?? undefined, period: sp.get("period") ?? undefined })
      : await me(db, v);
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const v = await who(req);
    const limited = await rateLimit(req, "campus", v.uid, 60, 600);
    if (limited) return limited;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    const auth = getAuth(getAdminApp());
    switch (b.action) {
      case "coordinator": return NextResponse.json(await appointCoordinator(db, auth, v, b, notify));
      case "ambassador": return NextResponse.json(await addAmbassador(db, auth, v, b, notify));
      case "remove": return NextResponse.json(await removeMember(db, v, b.uid, notify));
      case "move": return NextResponse.json(await moveTeam(db, v, b.from, b.to, notify));
      case "task": return NextResponse.json(await createTask(db, v, b, notify));
      case "edit": return NextResponse.json(await updateTask(db, v, b.id, b, notify));
      case "delete": return NextResponse.json(await deleteTask(db, v, b.id));
      case "report": return NextResponse.json(await report(db, v, b.id, b, notify));
      case "review": return NextResponse.json(await review(db, v, b.id, b.uid, b.verdict, b.note, notify));
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) { return fail(e); }
}

function fail(e: unknown) {
  if (e instanceof CampusError) return NextResponse.json({ error: e.message }, { status: e.status });
  const f = friendlyMessage(e, "Couldn't update Campus");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
