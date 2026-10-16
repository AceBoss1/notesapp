import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { StaffOpsError } from "@/lib/staff-ops";
import { acknowledge, ackStatus, attachDocFile, createDoc, docFileLink, listDocs, removeDocFile, startDocFile, updateDoc, type Me } from "@/lib/staff-ops-server";
import { headObject, presignDownload, presignUpload, privateFilesConfigured } from "@/lib/private-files";
import { rateLimit } from "@/lib/rate-limit";
import { getUserEmail } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

async function whoAmI(req: NextRequest): Promise<Me> {
  const a = await verifyAdminAccess(bearer(req));
  const name = (await getAdminDb().doc(`users/${a.uid}`).get()).data()?.displayName || (await getUserEmail(a.uid)) || a.email || "Staff";
  return { uid: a.uid, email: a.email, name: String(name), access: a.access };
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof StaffOpsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Staff: GET → the documents you may open (?archived=1 includes archived). GET ?file=<id>&i=<n> → a short-lived link. GET ?acks=<id> → who has confirmed (library maintainers).
// POST { action: "create" | "update" | "ack" | "fileStart" | "fileAttach" | "fileRemove", … }
export async function GET(req: NextRequest) {
  try {
    const me = await whoAmI(req);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("file")) return NextResponse.json(await docFileLink(db, me, q.get("file")!, Number(q.get("i") ?? 0), (key, name) => presignDownload(key, name)), { headers: { "Cache-Control": "no-store" } });
    if (q.get("acks")) return NextResponse.json(await ackStatus(db, me, q.get("acks")), { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ...(await listDocs(db, me, q.get("archived") === "1")), filesReady: privateFilesConfigured() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the library");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await whoAmI(req);
    const limited = await rateLimit(req, "staff-library", me.uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "create": return NextResponse.json({ doc: await createDoc(db, me, b.doc ?? {}) });
      case "update": await updateDoc(db, me, b.id, b.doc ?? {}); return NextResponse.json({ ok: true });
      case "ack": await acknowledge(db, me, b.id); return NextResponse.json({ ok: true });
      case "fileStart":
        if (!privateFilesConfigured()) throw new StaffOpsError("File storage isn't set up yet.", 503);
        return NextResponse.json(await startDocFile(db, me, String(b.id), b.file ?? {}, presignUpload));
      case "fileAttach": await attachDocFile(db, me, String(b.id), b.file ?? {}, headObject); return NextResponse.json({ ok: true });
      case "fileRemove": await removeDocFile(db, me, String(b.id), Number(b.index)); return NextResponse.json({ ok: true });
      default: throw new StaffOpsError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
