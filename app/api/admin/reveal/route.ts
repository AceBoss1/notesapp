import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasDept, isSuper } from "@/lib/admin-access";
import { RevealError, reveal, viewLog } from "@/lib/pii-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Masked contact details in admin pages (lib/pii.ts). POST { kind, subject, reason, note?, page } → { value }: the real email or
// phone, for a department allowed to see it, logged in adminViewLog with the reason. 30 reveals per 10 minutes per staff member.
// GET → { log } the view log, newest first (?subject=<uid or reference> or ?admin=<uid>): super admins and Legal & compliance.
const token = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

export async function POST(req: NextRequest) {
  let a;
  try { a = await verifyAdminAccess(token(req)); } catch { return NextResponse.json({ error: "Staff only." }, { status: 403 }); }
  const limited = await rateLimit(req, "admin-reveal", a.uid, 30, 600);
  if (limited) return limited;
  const db = getAdminDb();
  const name = String((await db.doc(`users/${a.uid}`).get()).data()?.displayName ?? "") || a.email;
  try {
    const out = await reveal(db, { uid: a.uid, name, access: a.access }, await req.json().catch(() => ({})));
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof RevealError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function GET(req: NextRequest) {
  let a;
  try { a = await verifyAdminAccess(token(req)); } catch { return NextResponse.json({ error: "Staff only." }, { status: 403 }); }
  if (!isSuper(a.access) && !hasDept(a.access, "legal")) return NextResponse.json({ error: "Super admins and Legal & compliance only." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const log = await viewLog(getAdminDb(), { subject: p.get("subject")?.slice(0, 128) || undefined, adminUid: p.get("admin")?.slice(0, 128) || undefined });
  return NextResponse.json({ log }, { headers: { "Cache-Control": "no-store" } });
}
