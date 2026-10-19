import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { isSuper } from "@/lib/admin-access";
import { listStaff } from "@/lib/admin-access-server";
import { CreditError, canTopUp, recentTopUps, searchMembers, setTopUpAdmins, topUp, topUpAdmins, type Admin } from "@/lib/admin-credits";
import { cardtapConfig, cardtapReady, setCardtapFeeWaived } from "@/lib/cardtap-topup-server";

export const dynamic = "force-dynamic";

// Admin → Credits (app/(main)/admin/credits; lib/admin-credits.ts). Super admins only; adding credit is the owner's, and the super admins
// they allow.
// GET → { canTopUp, owner, supers: [{ uid, name, email, allowed }], log }; GET ?q= → { members } (search by email, username or name).
// POST { action: "topup", uid, kind: "nana" | "wallet", naira, reason } → { member, log }
// POST { action: "allow", uids } (owner only) → { allowed }
// POST { action: "cardtap_fee", waived } (whoever may add credit) → { cardtap } — the CardTap launch offer: we pay Paylony's fee.
// GET also returns { cardtap: { ready, feeWaived, at } }.
async function admin(req: NextRequest): Promise<Admin> {
  const a = await verifyAdminAccess(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (!isSuper(a.access)) throw new CreditError(403, "Owner and super admins only.");
  return a;
}
const fail = (e: unknown) => e instanceof CreditError
  ? NextResponse.json({ error: e.message }, { status: e.status })
  : NextResponse.json({ error: "Owner and super admins only." }, { status: 403 });

export async function GET(req: NextRequest) {
  let a: Admin;
  try { a = await admin(req); } catch (e) { return fail(e); }
  const db = getAdminDb();
  const q = req.nextUrl.searchParams.get("q");
  if (q !== null) return NextResponse.json({ members: await searchMembers(db, q.slice(0, 100)) }, { headers: { "Cache-Control": "no-store" } });
  const [allowed, staff, log, ct] = await Promise.all([topUpAdmins(db), listStaff(db), recentTopUps(db), cardtapConfig(db)]);
  const supers = staff.filter((s) => s.role === "super" && !s.owner).map((s) => ({ uid: s.uid, name: s.name, email: s.email, allowed: allowed.includes(s.uid) }));
  return NextResponse.json({ canTopUp: await canTopUp(db, a), owner: a.owner, supers, log, cardtap: { ready: cardtapReady(), feeWaived: ct.feeWaived, at: ct.at ?? null } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let a: Admin;
  try { a = await admin(req); } catch (e) { return fail(e); }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getAdminDb();
  try {
    if (body.action === "allow") {
      const supers = (await listStaff(db)).filter((s) => s.role === "super");
      return NextResponse.json({ allowed: await setTopUpAdmins(db, a, body.uids, supers) });
    }
    if (body.action === "topup") return NextResponse.json(await topUp(db, a, body));
    if (body.action === "cardtap_fee") {
      if (!(await canTopUp(db, a))) throw new CreditError(403, "Only the owner, and the super admins they allow, can change this.");
      await setCardtapFeeWaived(db, body.waived === true, a.uid);
      const ct = await cardtapConfig(db);
      return NextResponse.json({ cardtap: { ready: cardtapReady(), feeWaived: ct.feeWaived, at: ct.at ?? null } });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof CreditError) return fail(e);
    console.error("[admin credits]", e);
    return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  }
}
