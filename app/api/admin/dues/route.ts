import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasDept } from "@/lib/admin-access";
import { FinanceError } from "@/lib/finance";
import type { Caller } from "@/lib/finance-server";
import { addDue, cancelDue, listDues, markPaid } from "@/lib/dues-server";
import { rateLimit } from "@/lib/rate-limit";
import { lagosDate } from "@/lib/team";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

async function caller(req: NextRequest): Promise<Caller> {
  const me = await verifyAdminAccess(bearer(req));
  const c = { uid: me.uid, email: me.email, owner: me.owner, finance: hasDept(me.access, "finance"), product: hasDept(me.access, "product") };
  if (!c.finance && !c.product) throw new FinanceError("Expenses due are for the finance and product teams.", 403);
  return c;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof FinanceError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Finance and product: GET → what is still to pay. Finance: POST { action: "add" | "paid" | "cancel", … }.
export async function GET(req: NextRequest) {
  try {
    const c = await caller(req);
    return NextResponse.json({ dues: await listDues(getAdminDb(), c), today: lagosDate(), canWrite: c.finance }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load expenses due");
  }
}

export async function POST(req: NextRequest) {
  try {
    const c = await caller(req);
    const limited = rateLimit(req, "dues", c.uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "add": return NextResponse.json({ due: await addDue(db, c, b.due ?? {}) });
      case "paid": return NextResponse.json(await markPaid(db, c, b.id, b.amount));
      case "cancel": await cancelDue(db, c, b.id); return NextResponse.json({ ok: true });
      default: throw new FinanceError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
