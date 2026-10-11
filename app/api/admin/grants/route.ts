import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasDept } from "@/lib/admin-access";
import { FinanceError } from "@/lib/finance";
import type { Caller } from "@/lib/finance-server";
import { addUsage, listGrants, recordInLedger, saveGrant, setStatus } from "@/lib/grants-server";
import { rateLimit } from "@/lib/rate-limit";
import { lagosDate } from "@/lib/team";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

async function caller(req: NextRequest): Promise<Caller> {
  const me = await verifyAdminAccess(bearer(req));
  const c = { uid: me.uid, email: me.email, owner: me.owner, finance: hasDept(me.access, "finance"), product: hasDept(me.access, "product") };
  if (!c.finance && !c.product) throw new FinanceError("Grants are for the finance and product teams.", 403);
  return c;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof FinanceError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Finance and product: GET → every grant and subscription. Finance: POST { action: "save" | "usage" | "status" | "ledger", … }.
export async function GET(req: NextRequest) {
  try {
    const c = await caller(req);
    return NextResponse.json({ grants: await listGrants(getAdminDb(), c), today: lagosDate(), canWrite: c.finance }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load grants");
  }
}

export async function POST(req: NextRequest) {
  try {
    const c = await caller(req);
    const limited = rateLimit(req, "grants", c.uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "save": return NextResponse.json({ grant: await saveGrant(db, c, b.id, b.grant ?? {}) });
      case "usage": await addUsage(db, c, b.id, b.usage ?? {}); return NextResponse.json({ ok: true });
      case "status": await setStatus(db, c, b.id, b.status); return NextResponse.json({ ok: true });
      case "ledger": return NextResponse.json(await recordInLedger(db, c, b.id));
      default: throw new FinanceError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
