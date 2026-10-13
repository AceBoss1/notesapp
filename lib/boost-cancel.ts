import type { Firestore } from "firebase-admin/firestore";
import { refundTransaction } from "./paystack";
import { notifyBell } from "./email";
import { formatNaira } from "./booking-time";

// Cancelling a running boost. What was already delivered is spent; the undelivered share is what is at stake.
//   by the member:   half of the undelivered share is refunded, half is forfeited (the Terms say so before they cancel)
//   by an admin:     all of the undelivered share is refunded, with a reason the member is told
export const MEMBER_FORFEIT = 0.5;

export class BoostCancelError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function refundFor(b: { amountKobo: number; impressionsPurchased: number; impressionsDelivered: number }, by: "member" | "admin"): { undeliveredKobo: number; refundKobo: number } {
  const shortfall = Math.max(0, b.impressionsPurchased - b.impressionsDelivered);
  const undeliveredKobo = Math.floor((b.amountKobo * shortfall) / Math.max(1, b.impressionsPurchased));
  return { undeliveredKobo, refundKobo: by === "member" ? Math.floor(undeliveredKobo * (1 - MEMBER_FORFEIT)) : undeliveredKobo };
}

export async function cancelBoost(db: Firestore, reference: string, by: "member" | "admin", opts: { uid?: string; reason?: string; refund?: typeof refundTransaction } = {}): Promise<{ refundKobo: number; forfeitedKobo: number }> {
  const ref = db.doc(`boosts/${reference}`);
  const reason = (opts.reason ?? "").trim().slice(0, 300);
  if (by === "admin" && reason.length < 3) throw new BoostCancelError(400, "Give a reason; the member is told what it was.");

  // Claim it first, so two clicks can't refund twice.
  const b = await db.runTransaction(async (tx) => {
    const s = (await tx.get(ref)).data();
    if (!s) throw new BoostCancelError(404, "Boost not found.");
    if (by === "member" && s.publisherUid !== opts.uid) throw new BoostCancelError(403, "That isn't your boost.");
    if (s.status !== "active") throw new BoostCancelError(409, s.status === "closed" ? "This boost is already settled." : "This boost has already ended; its undelivered share is settled by an admin.");
    tx.update(ref, { status: "cancelling" });
    return s;
  });

  const { undeliveredKobo, refundKobo } = refundFor(b as never, by);
  try {
    if (refundKobo > 0) await (opts.refund ?? refundTransaction)(reference, refundKobo);
  } catch (e) {
    await ref.update({ status: "active" }); // nothing was refunded; leave it running
    throw e;
  }
  const forfeitedKobo = undeliveredKobo - refundKobo;
  await ref.update({
    status: "closed", refundedKobo: refundKobo, closedAt: new Date().toISOString(),
    cancelledBy: by, ...(by === "admin" ? { cancelReason: reason, cancelledByAdmin: true } : { forfeitedKobo }),
  });
  const title = String(b.title || "your boost");
  const message = by === "admin"
    ? `Your boost "${title}" was cancelled by #NotesApp: ${reason}. ${refundKobo ? `${formatNaira(refundKobo)} is on its way back to your card or bank.` : "Nothing was left undelivered to refund."}`
    : `You cancelled your boost "${title}". ${refundKobo ? `${formatNaira(refundKobo)} is on its way back (half of the undelivered share; ${formatNaira(forfeitedKobo)} was forfeited).` : "Nothing was left to refund."}`;
  await notifyBell({ uid: String(b.publisherUid), type: "plan", linkHref: "/profile/boosts", message }).catch(() => {});
  return { refundKobo, forfeitedKobo };
}
