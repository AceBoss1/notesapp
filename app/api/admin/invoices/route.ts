import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasDept } from "@/lib/admin-access";
import { InvoiceError } from "@/lib/invoices";
import type { Caller } from "@/lib/finance-server";
import { clientLink, listInvoices, makeDrafts, markPaid, refreshDraft, saveInvoiceSettings, sendInvoice, voidInvoice } from "@/lib/invoices-server";
import { lagosDate } from "@/lib/team";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

async function caller(req: NextRequest): Promise<Caller> {
  const me = await verifyAdminAccess(bearer(req));
  const c = { uid: me.uid, email: me.email, owner: me.owner, finance: hasDept(me.access, "finance"), product: hasDept(me.access, "product") };
  if (!c.finance) throw new InvoiceError("Invoices are for the finance team.", 403);
  return c;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof InvoiceError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Client invoices (lib/invoices.ts), finance and super admins. GET ?month=YYYY-MM → that month's invoices, unpaid ones from before,
// the settings and the billable projects. POST { action: "drafts" | "refresh" | "send" | "void" | "paid" | "settings" | "link", … }
export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month") || lagosDate().slice(0, 7);
    return NextResponse.json(await listInvoices(getAdminDb(), await caller(req), month), { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load invoices"); }
}

export async function POST(req: NextRequest) {
  try {
    const c = await caller(req);
    const limited = await rateLimit(req, "invoices", c.uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (b.action) {
      case "drafts": return NextResponse.json(await makeDrafts(db, c, b.month));
      case "refresh": return NextResponse.json(await refreshDraft(db, c, b.id));
      case "send": return NextResponse.json(await sendInvoice(db, c, b.id, b));
      case "void": await voidInvoice(db, c, b.id, b.reason); return NextResponse.json({ ok: true });
      case "paid": await markPaid(db, c, b.id, b.note); return NextResponse.json({ ok: true });
      case "settings": return NextResponse.json(await saveInvoiceSettings(db, c, b));
      case "link": return NextResponse.json(await clientLink(db, c, b.id), { headers: { "Cache-Control": "no-store" } });
      default: throw new InvoiceError("Unknown action.");
    }
  } catch (err) { return fail(err, "Couldn't save that"); }
}
