import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail, verifyAdminAccess } from "@/lib/firebase-admin";
import { StaffOpsError } from "@/lib/staff-ops";
import { listHub, markRead, messageFileLink, prepareMessage, sendMessage, type Me } from "@/lib/staff-ops-server";
import { headObject, presignDownload, presignUpload, privateFilesConfigured } from "@/lib/private-files";
import { rateLimit } from "@/lib/rate-limit";

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

// Staff: GET → your inbox, copies and sent messages. GET ?file=<message id>&i=<n> → a short-lived link to an attachment (sender and To only).
// POST { action: "prepare" | "send" | "read", … }. "Also send by email" emails everyone as well; the hub copy always stays.
export async function GET(req: NextRequest) {
  try {
    const me = await whoAmI(req);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("file")) return NextResponse.json(await messageFileLink(db, me, q.get("file")!, Number(q.get("i") ?? 0), (key, name) => presignDownload(key, name)), { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ...(await listHub(db, me)), filesReady: privateFilesConfigured() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load your messages");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await whoAmI(req);
    const limited = rateLimit(req, "hub", me.uid, 60, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "prepare":
        if (Array.isArray(b.files) && b.files.length && !privateFilesConfigured()) throw new StaffOpsError("File storage isn't set up yet, so files can't be attached.", 503);
        return NextResponse.json(await prepareMessage(db, me, b.files, presignUpload));
      case "send": return NextResponse.json(await sendMessage(db, me, String(b.id), b.message ?? {}, headObject));
      case "read": await markRead(db, me, b.id); return NextResponse.json({ ok: true });
      default: throw new StaffOpsError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't send that");
  }
}
