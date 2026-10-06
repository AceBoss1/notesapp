import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { paylonyDiagnostics } from "@/lib/paylony";

export const dynamic = "force-dynamic";

// Admin: GET → does our Paylony key work (a wallet-balance request), which keys are set, and the latest webhook events.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const [diagnostics, events] = await Promise.all([
      paylonyDiagnostics(),
      getAdminDb().collection("paylonyEvents").orderBy("receivedAt", "desc").limit(25).get(),
    ]);
    return NextResponse.json({
      diagnostics,
      events: events.docs.map((d) => {
        const e = d.data();
        return { id: d.id, event: e.event, status: e.status, amount: e.amount, trx: e.trx, reference: e.reference, receivedAt: e.receivedAt, handled: e.handled === true };
      }),
    });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check Paylony");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
