import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { setting } from "@/lib/config";
import { isLogAction, type LogEntry } from "@/lib/backups";

export const dynamic = "force-dynamic";

// Admin → Backups (app/(main)/admin/backups, lib/backups.ts). The owner only. The page does the work in the browser with the
// owner's own Google sign-in, so this route never holds Google rights; it only says who may use the page and keeps the log.
// GET → { project, databaseId, clientId, log }. POST { action, detail } → records one action in backupLog (server-only).
async function owner(req: NextRequest) {
  const a = await verifyAdminAccess(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  return a?.owner ? a : null;
}
const no = () => NextResponse.json({ error: "The owner only." }, { status: 403 });

export async function GET(req: NextRequest) {
  if (!(await owner(req))) return no();
  const s = await getAdminDb().collection("backupLog").orderBy("at", "desc").limit(50).get();
  const log: LogEntry[] = s.docs.map((d) => ({ id: d.id, at: String(d.data().at), byName: String(d.data().byName ?? ""), action: d.data().action, detail: String(d.data().detail ?? "") }));
  return NextResponse.json({
    project: setting("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? "",
    databaseId: setting("NEXT_PUBLIC_FIRESTORE_DATABASE_ID")?.trim() || "(default)",
    clientId: setting("NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID") ?? "",
    log,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const a = await owner(req);
  if (!a) return no();
  const { action, detail } = (await req.json().catch(() => ({}))) as { action?: unknown; detail?: unknown };
  if (!isLogAction(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const db = getAdminDb();
  const byName = String((await db.doc(`users/${a.uid}`).get()).data()?.displayName ?? "") || a.email;
  await db.collection("backupLog").add({ at: new Date().toISOString(), by: a.uid, byName, action, detail: typeof detail === "string" ? detail.slice(0, 300) : "" });
  return NextResponse.json({ ok: true });
}
