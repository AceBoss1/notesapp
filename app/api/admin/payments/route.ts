import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { initiateTransfer, refundTransaction, slotLockId } from "@/lib/paystack";
import type { LedgerEntry } from "@/lib/payments";

// Admin-only money actions on a payment reference:
//   release  — pay the publisher (only after releaseAfter has passed)
//   refund   — return the payer's money (also for paid_slot_conflict)
//   dispute  — freeze a held payout (no-show, complaint) until resolved
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    await verifyAdminRequest(idToken);
    const { action, reference } = await req.json();
    if (typeof reference !== "string") return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const db = getAdminDb();
    const ledgerRef = db.doc(`ledger/${reference}`);
    const payRef = db.doc(`payments/${reference}`);
    const [ledgerSnap, paySnap] = await Promise.all([ledgerRef.get(), payRef.get()]);
    if (!paySnap.exists) return NextResponse.json({ error: "Unknown payment" }, { status: 404 });

    // Boost that ended with impressions undelivered → refund the undelivered share.
    if (action === "refund_boost") {
      const boostRef = db.doc(`boosts/${reference}`);
      const b = (await boostRef.get()).data();
      if (!b) return NextResponse.json({ error: "Boost not found" }, { status: 404 });
      if (b.status === "closed") return NextResponse.json({ error: "Already settled." }, { status: 409 });
      const ended = new Date(b.endsAt).getTime() <= Date.now() || b.status === "completed";
      if (!ended) return NextResponse.json({ error: "Boost is still running." }, { status: 409 });
      const shortfall = Math.max(0, b.impressionsPurchased - b.impressionsDelivered);
      const refundKobo = Math.floor((b.amountKobo * shortfall) / b.impressionsPurchased);
      if (refundKobo > 0) await refundTransaction(reference, refundKobo);
      await boostRef.update({ status: "closed", refundedKobo: refundKobo, closedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true, refundKobo });
    }

    const ledger = ledgerSnap.data() as LedgerEntry | undefined;

    if (action === "refund") {
      if (ledger && (ledger.status === "paid_out" || ledger.status === "transferring")) {
        return NextResponse.json({ error: "Already paid out — refund would come out of platform funds; handle in Paystack manually." }, { status: 409 });
      }
      if (ledger?.status === "refunded" || paySnap.data()?.status === "refunded") {
        return NextResponse.json({ error: "Already refunded." }, { status: 409 });
      }
      if (paySnap.data()?.kind === "merch") {
        const o = (await db.doc(`merchOrders/${reference}`).get()).data();
        if (o && ["printed", "shipped", "delivered"].includes(o.status)) {
          return NextResponse.json({ error: `This order is already ${o.status} — refund in Paystack manually if needed.` }, { status: 409 });
        }
      }
      await refundTransaction(reference);
      const batch = db.batch();
      batch.update(payRef, { status: "refunded" });
      if (ledger) batch.update(ledgerRef, { status: "refunded" });
      if (paySnap.data()?.kind === "merch") batch.update(db.doc(`merchOrders/${reference}`), { status: "refunded" });
      const b = paySnap.data()?.booking;
      if (b && paySnap.data()?.status === "paid") {
        batch.update(db.doc(`bookings/${reference}`), { status: "refunded" });
        batch.delete(db.doc(`slotLocks/${slotLockId(b.username, b.date, b.slot)}`));
      }
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (!ledger) return NextResponse.json({ error: "No payout entry for this payment" }, { status: 404 });

    if (action === "dispute") {
      if (ledger.status !== "held") return NextResponse.json({ error: `Can't dispute a ${ledger.status} payout.` }, { status: 409 });
      await ledgerRef.update({ status: "disputed" });
      return NextResponse.json({ ok: true });
    }

    if (action === "release") {
      if (ledger.status !== "held" && ledger.status !== "disputed") {
        return NextResponse.json({ error: `Payout is ${ledger.status}.` }, { status: 409 });
      }
      if (new Date(ledger.releaseAfter).getTime() > Date.now()) {
        return NextResponse.json({ error: `Not releasable until ${ledger.releaseAfter}.` }, { status: 409 });
      }
      const account = (await db.doc(`payoutAccounts/${ledger.publisherUid}`).get()).data();
      if (!account?.recipientCode) return NextResponse.json({ error: "Publisher has no payout account." }, { status: 409 });

      // Claim first so a double-click can't send two transfers.
      const claimed = await db.runTransaction(async (t) => {
        const cur = (await t.get(ledgerRef)).data() as LedgerEntry;
        if (cur.status !== "held" && cur.status !== "disputed") return false;
        t.update(ledgerRef, { status: "transferring", failureReason: "" });
        return true;
      });
      if (!claimed) return NextResponse.json({ error: "Already being released." }, { status: 409 });
      try {
        const tr = await initiateTransfer({
          amountKobo: ledger.netKobo,
          recipient: account.recipientCode,
          reference: `payout_${reference}`,
          reason: `#NotesApp ${ledger.kind} payout`,
        });
        await ledgerRef.update({ transferCode: tr.transfer_code });
        return NextResponse.json({ ok: true, transferStatus: tr.status });
      } catch (err) {
        await ledgerRef.update({ status: "held", failureReason: err instanceof Error ? err.message : "Transfer failed" });
        throw err;
      }
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Admin payment action failed:", err);
    { const f = friendlyMessage(err, "Failed"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}
