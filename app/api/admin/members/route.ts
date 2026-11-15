import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { notifyBell, sendEmail } from "@/lib/email";
import { walletSummary } from "@/lib/wallet-server";
import { collectExport } from "@/lib/account-server";
import {
  MemberError, USERS_DEPTS, addNote, deleteNote, detail, exportMember, logChange, markNotDuplicate, notifyMembers, resendVerification,
  sendPasswordReset, signals, type Staff,
} from "@/lib/admin-members-server";
import { hasAnyDept } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

// Admin → Users (lib/admin-members-server.ts).
//   GET ?uid=<uid>                                   one member's full picture (by department)
//   POST { action: "signals", uids }                 sign-in method, email confirmed, last sign-in and seen, not-duplicate marks
//   POST { action: "note", uid, text } · { action: "deleteNote", id } · { action: "history", uid, what, detail }
//   POST { action: "notify", uids, message, link? } · { action: "verify", uid } · { action: "reset", uid }
//   POST { action: "export", uid, reason, note? } · { action: "notDuplicate", a, b }
async function staff(req: NextRequest): Promise<Staff> {
  const a = await verifyAdminAccess(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!a || !hasAnyDept(a.access, USERS_DEPTS)) throw new MemberError("Customer care, Trust & safety, Finance and Legal only.", 403);
  const name = String((await getAdminDb().doc(`users/${a.uid}`).get()).data()?.displayName ?? "") || a.email;
  return { uid: a.uid, name, access: a.access };
}
const notify = (n: { uid: string; message: string; linkHref: string }) => notifyBell({ uid: n.uid, type: "announcement", linkHref: n.linkHref, message: n.message });
const mail = (m: { to: string; subject: string; text: string; action: { label: string; url: string } }) => sendEmail(m);

export async function GET(req: NextRequest) {
  try {
    const s = await staff(req);
    const db = getAdminDb();
    const out = await detail(db, getAuth(getAdminApp()), s, req.nextUrl.searchParams.get("uid"), { wallet: (uid) => walletSummary(db, uid, 10) });
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const s = await staff(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    const auth = getAuth(getAdminApp());
    if (b.action === "signals") return NextResponse.json({ signals: await signals(db, auth, b.uids) });
    const limited = await rateLimit(req, "admin-members", s.uid, 60, 600);
    if (limited) return limited;
    switch (b.action) {
      case "note": return NextResponse.json(await addNote(db, s, b.uid, b.text));
      case "deleteNote": return NextResponse.json(await deleteNote(db, s, b.id));
      case "history": return NextResponse.json(await logChange(db, s, b.uid, b.what, b.detail));
      case "notify": return NextResponse.json(await notifyMembers(db, s, b.uids, b.message, b.link, notify));
      case "verify": return NextResponse.json(await resendVerification(db, auth, s, b.uid, mail));
      case "reset": return NextResponse.json(await sendPasswordReset(db, auth, s, b.uid, mail));
      case "export": return NextResponse.json(await exportMember(db, auth, s, b.uid, b.reason, b.note, (uid, email) => collectExport(db, uid, email)));
      case "notDuplicate": return NextResponse.json(await markNotDuplicate(db, s, b.a, b.b));
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) { return fail(e); }
}

function fail(e: unknown) {
  if (e instanceof MemberError) return NextResponse.json({ error: e.message }, { status: e.status });
  const f = friendlyMessage(e, "Couldn't do that");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
