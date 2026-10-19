import { getAdminDb } from "./firebase-admin";
import { refundTransaction } from "./paystack";
import { refundToWallet, restoreTopup, reverseTopup } from "./wallet-server";
import { revokeForPayment } from "./certificates-server";

// Every refund goes through here. A payment made from the NotesApp Credit wallet goes back to the wallet (never to a card, since
// nothing was charged to one); a wallet top-up refunded to the card first takes the unspent credit (and its bonus) back out;
// anything else is refunded through Paystack as before. amountKobo left out = the whole payment.
export async function refundPayment(reference: string, amountKobo?: number): Promise<void> {
  const db = getAdminDb();
  const p = (await db.doc(`payments/${reference}`).get()).data();
  // Notesville Naira has already been spent in the game, maybe; it is game money and final (Terms, Notes Life).
  if (p?.kind === "life_naira") throw new Error("Notesville Naira purchases are final and can't be refunded here.");
  // A refunded certificate (or a refunded course whose certificate came with it) stops being valid; its verification page says it was revoked and why.
  if (p?.kind === "certificate" || p?.kind === "course") await revokeForPayment(db, reference);
  if (p?.payWith === "wallet") { await refundToWallet(db, reference, amountKobo); return; }
  // CardTap top-ups: Paylony returns the money (they handle settlement and refunds), so here we only take the credit back and mark
  // the payment for Paylony; finance asks Paylony to refund it with the payment's reference.
  if (p?.kind === "wallet_topup" && p.payWith === "cardtap") {
    const taken = await reverseTopup(db, reference, amountKobo);
    if (taken.kobo) await db.doc(`payments/${reference}`).update({ cardtapRefund: { kobo: taken.kobo, status: "ask_paylony", at: new Date().toISOString() } });
    return;
  }
  if (p?.kind === "wallet_topup") {
    const taken = await reverseTopup(db, reference, amountKobo);
    if (!taken.kobo) return;
    try { await refundTransaction(reference, taken.kobo === p.amountKobo ? undefined : taken.kobo); }
    catch (e) { await restoreTopup(db, reference, taken); throw e; } // Paystack refused: the member loses nothing
    return;
  }
  await refundTransaction(reference, amountKobo);
}
