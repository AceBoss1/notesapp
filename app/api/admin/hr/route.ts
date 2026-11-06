import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { canManageTeam } from "@/lib/admin-access";
import { CareersError } from "@/lib/careers";
import { deleteRole, hiringBoard, listDrafts, makeDrafts, saveRole, setApplicationStatus, setRoleStatus, summarise } from "@/lib/careers-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const fail = (err: unknown, fallback: string) => {
  if (err instanceof CareersError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Hiring and Nana-HR for super admins and the Chief of Staff.
// GET → roles, applications, onboarding drafts and the questions Nana-HR couldn't answer.
// POST { action: "saveRole" | "roleStatus" | "deleteRole" | "appStatus" | "summarise" | "drafts", … }
export async function GET(req: NextRequest) {
  try {
    const me = await verifyAdminAccess(bearer(req));
    if (!canManageTeam(me.access)) return NextResponse.json({ manage: false });
    const db = getAdminDb();
    const [board, drafts, chats] = await Promise.all([
      hiringBoard(db, me),
      listDrafts(db, me),
      db.collection("nanaChats").where("hr", "==", true).limit(200).get(),
    ]);
    const unanswered = chats.docs
      .map((d) => d.data())
      .filter((c) => c.gap === true)
      .map((c) => {
        const t = (c.transcript as { role: string; text: string; at: string }[] | undefined) ?? [];
        const q = [...t].reverse().find((m) => m.role === "user");
        return { name: String(c.name || ""), question: q?.text ?? "", at: q?.at ?? String(c.startedAt || "") };
      })
      .filter((q) => q.question)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 50);
    return NextResponse.json({ manage: true, ...board, drafts, unanswered }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load hiring"); }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyAdminAccess(bearer(req));
    const limited = await rateLimit(req, "admin-hr", me.uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "saveRole": return NextResponse.json({ role: await saveRole(db, me, b.id, b.role ?? {}) });
      case "roleStatus": await setRoleStatus(db, me, b.id, b.status); return NextResponse.json({ ok: true });
      case "deleteRole": return NextResponse.json({ ok: true, ...(await deleteRole(db, me, b.id)) });
      case "appStatus": await setApplicationStatus(db, me, b.id, b.status, b.notes); return NextResponse.json({ ok: true });
      case "summarise": return NextResponse.json({ summary: await summarise(db, me, b.id) });
      case "drafts": return NextResponse.json(await makeDrafts(db, me, b.terms ?? {}));
      default: throw new CareersError("Unknown action.");
    }
  } catch (err) { return fail(err, "Couldn't save that"); }
}
