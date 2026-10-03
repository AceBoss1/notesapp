import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { refundTransaction, slotLockId } from "@/lib/paystack";
import { releaseLedgerEntry } from "@/lib/payouts";
import type { LedgerEntry } from "@/lib/payments";
import { confirmOrder, notifyBackInStock, returnStock } from "@/lib/orders-server";

// Admin-only money actions on a payment reference:
//   release  — pay the publisher (only after releaseAfter has passed)
//   refund   — return the payer's money (also for paid_slot_conflict)
//   dispute  — freeze a held payout (no-show, complaint) until resolved
//   confirm_order — store order: treat delivery as confirmed, so the seller's money becomes payable
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    await verifyAdminRequest(idToken);
    const { action, reference } = await req.json();
    if (typeof reference !== "string") return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const db = getAdminDb();
    const ledgerRef = db.doc(`ledger/${reference}`);
    const ledgerSnap = await ledgerRef.get();
    // A co-author's share of a gift has its own ledger doc (`<ref>_<uid>`); the
    // payment it came from is named by paymentReference.
    const paymentRef = (ledgerSnap.data()?.paymentReference as string | undefined) || reference;
    const payRef = db.doc(`payments/${paymentRef}`);
    const paySnap = await payRef.get();
    const isAdShare = ledgerSnap.data()?.kind === "adshare"; // ad-share entries have no customer payment behind them
    if (!paySnap.exists && !isAdShare) return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
    if (isAdShare && action === "refund") {
      return NextResponse.json({ error: "Ad share isn't refunded — withhold or dispute it instead." }, { status: 409 });
    }

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
      // Refunding returns the WHOLE payment, so every ledger entry from it (the
      // lead's plus any co-author shares) must still be unpaid.
      const entries = [paymentRef, ...(await db.collection("ledger").where("paymentReference", "==", paymentRef).get()).docs.map((d) => d.id)];
      const entrySnaps = await Promise.all(entries.map((id) => db.doc(`ledger/${id}`).get()));
      const existing = entrySnaps.filter((e) => e.exists);
      if (existing.some((e) => ["paid_out", "transferring"].includes(e.data()?.status))) {
        return NextResponse.json({ error: "Already (partly) paid out — a refund would come out of platform funds; handle in Paystack manually." }, { status: 409 });
      }
      if (existing.some((e) => e.data()?.status === "refunded") || paySnap.data()?.status === "refunded") {
        return NextResponse.json({ error: "Already refunded." }, { status: 409 });
      }
      let storeStatusBefore: string | undefined;
      if (paySnap.data()?.kind === "store") {
        const o = (await db.doc(`storeOrders/${paymentRef}`).get()).data();
        if (o && o.status === "refunded") return NextResponse.json({ error: "Already refunded." }, { status: 409 });
        storeStatusBefore = o?.status;
      }
      if (paySnap.data()?.kind === "digital") {
        // A download is final once the buyer has started it.
        const dp = (await db.doc(`digitalPurchases/${paymentRef}`).get()).data();
        if (dp?.firstDownloadAt) return NextResponse.json({ error: "The buyer has already downloaded this — digital sales are final, so it can't be refunded." }, { status: 409 });
      }
      if (paySnap.data()?.kind === "merch") {
        const o = (await db.doc(`merchOrders/${paymentRef}`).get()).data();
        if (o && ["printed", "shipped", "delivered"].includes(o.status)) {
          return NextResponse.json({ error: `This order is already ${o.status} — refund in Paystack manually if needed.` }, { status: 409 });
        }
      }
      await refundTransaction(paymentRef);
      const batch = db.batch();
      batch.update(payRef, { status: "refunded" });
      existing.forEach((e) => batch.update(e.ref, { status: "refunded" }));
      if (paySnap.data()?.kind === "merch") {
        batch.update(db.doc(`merchOrders/${paymentRef}`), { status: "refunded" });
        const mo = (await db.doc(`merchOrders/${paymentRef}`).get()).data();
        if (mo?.parcelId) batch.update(db.doc(`parcels/${mo.parcelId}`), { status: "refunded", merchStatus: "refunded" });
      }
      if (paySnap.data()?.kind === "store") {
        const o = (await db.doc(`storeOrders/${paymentRef}`).get()).data();
        if (o) {
          batch.update(db.doc(`storeOrders/${paymentRef}`), { status: "refunded" });
          batch.update(db.doc(`parcels/${o.parcelId}`), { status: "refunded" });
        }
      }
      const b = paySnap.data()?.booking;
      if (b && paySnap.data()?.status === "paid") {
        batch.update(db.doc(`bookings/${paymentRef}`), { status: "refunded" });
        batch.delete(db.doc(`slotLocks/${slotLockId(b.username, b.date, b.slot)}`));
      }
      await batch.commit();
      // An unshipped store order that is refunded goes back on the shelf.
      if (paySnap.data()?.kind === "store") {
        const was = storeStatusBefore;
        const st = paySnap.data()?.store;
        if (st && paySnap.data()?.status === "paid" && was === "paid") {
          await returnStock(st.itemId, st.quantity).catch(() => {});
          await notifyBackInStock(st.itemId).catch(() => {});
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (!ledger) return NextResponse.json({ error: "No payout entry for this payment" }, { status: 404 });

    if (action === "confirm_order") {
      if (ledger.kind !== "order") return NextResponse.json({ error: "Only store orders have a delivery hold." }, { status: 409 });
      if (!["held", "disputed"].includes(ledger.status)) return NextResponse.json({ error: `Payout is ${ledger.status}.` }, { status: 409 });
      await confirmOrder(reference, "admin");
      return NextResponse.json({ ok: true });
    }

    if (action === "dispute") {
      if (ledger.status !== "held") return NextResponse.json({ error: `Can't dispute a ${ledger.status} payout.` }, { status: 409 });
      await ledgerRef.update({ status: "disputed" });
      if (ledger.kind === "order") {
        const o = (await db.doc(`storeOrders/${reference}`).get()).data();
        if (o && o.status !== "disputed") {
          await db.doc(`storeOrders/${reference}`).update({ status: "disputed", disputeReason: o.disputeReason || "Frozen by an admin" });
          await db.doc(`parcels/${o.parcelId}`).update({ status: "disputed" });
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "release") {
      const r = await releaseLedgerEntry(reference, { allowDisputed: true });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
      return NextResponse.json({ ok: true, transferStatus: r.transferStatus });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Admin payment action failed:", err);
    { const f = friendlyMessage(err, "Failed"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}
