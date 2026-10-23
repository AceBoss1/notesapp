import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb } from "@/lib/firebase-admin";
import { InvoiceError } from "@/lib/invoices";
import { clientCheck, publicInvoice, startPay } from "@/lib/invoices-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const fail = (err: unknown, fallback: string) => {
  if (err instanceof InvoiceError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// A client's invoice, through the link we emailed (no sign-in: the token is the proof).
// GET ?id=…&t=… → the invoice and how it can be paid. POST { id, t, action: "pay", method } → a Paylony transfer account, a CardTap code
// or a Paystack page; POST { id, t, action: "check", reference } → whether that payment has gone through (settled on a clear yes).
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "invoice-view", clientIp(req), 60, 600);
    if (limited) return limited;
    const sp = req.nextUrl.searchParams;
    return NextResponse.json(await publicInvoice(getAdminDb(), sp.get("id"), sp.get("t")), { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (err) { return fail(err, "Couldn't open that invoice"); }
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "invoice-pay", clientIp(req), 60, 600);
    if (limited) return limited;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    if (b.action === "pay") return NextResponse.json(await startPay(db, b.id, b.t, b.method));
    if (b.action === "check") return NextResponse.json(await clientCheck(db, b.id, b.t, b.reference));
    throw new InvoiceError("Unknown action.");
  } catch (err) { return fail(err, "Couldn't do that"); }
}
