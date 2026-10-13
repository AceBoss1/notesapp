import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasDept } from "@/lib/admin-access";
import { FinanceError } from "@/lib/finance";
import type { Caller } from "@/lib/finance-server";
import { addStaff, adjustRunLine, markLinePaid, payrollView, removeRunLine, revealAccount, startRun, updateStaff } from "@/lib/payroll-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

async function caller(req: NextRequest): Promise<Caller> {
  const me = await verifyAdminAccess(bearer(req));
  const c = { uid: me.uid, email: me.email, owner: me.owner, finance: hasDept(me.access, "finance"), product: hasDept(me.access, "product") };
  if (!c.finance) throw new FinanceError("Payroll is for the finance team.", 403);
  return c;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof FinanceError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Finance and super admins: GET → staff, runs, totals.
// POST { action: "addStaff" | "updateStaff" | "reveal" | "startRun" | "adjust" | "removeLine" | "paid", … }
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await payrollView(getAdminDb(), await caller(req)), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load payroll");
  }
}

export async function POST(req: NextRequest) {
  try {
    const c = await caller(req);
    const limited = rateLimit(req, "payroll", c.uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "addStaff": return NextResponse.json({ staff: await addStaff(db, c, b.staff ?? {}) });
      case "updateStaff": await updateStaff(db, c, b.id, b.staff ?? {}); return NextResponse.json({ ok: true });
      case "reveal": return NextResponse.json(await revealAccount(db, c, b.id), { headers: { "Cache-Control": "no-store" } });
      case "startRun": return NextResponse.json({ run: await startRun(db, c, b.period) });
      case "adjust": await adjustRunLine(db, c, String(b.period), String(b.staffId), b.adjust, b.note); return NextResponse.json({ ok: true });
      case "removeLine": await removeRunLine(db, c, String(b.period), String(b.staffId)); return NextResponse.json({ ok: true });
      case "paid": return NextResponse.json(await markLinePaid(db, c, String(b.period), String(b.staffId)));
      default: throw new FinanceError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
