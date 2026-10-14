import { getAdminDb } from "./firebase-admin";
import { refundTransaction } from "./paystack";
import { refundToWallet, restoreTopup, reverseTopup } from "./wallet-server";

// Every refund goes through here. A payment made from the NotesApp Credit wallet goes back to the wallet (never to a card, since
// nothing was charged to one); a wallet top-up refunded to the card first takes the unspent credit (and its bonus) back out;
// anything else is refunded through Paystack as before. amountKobo left out = the whole payment.
export async function refundPayment(reference: string, amountKobo?: number): Promise<void> {
  const db = getAdminDb();
  const p = (await db.doc(`payments/${reference}`).get()).data();
  // Notesville Naira has already been spent in the game, maybe; it is game money and final (Terms, Notes Life).
  if (p?.kind === "life_naira") throw new Error("Notesville Naira purchases are final and can't be refunded here.");
  if (p?.payWith === "wallet") { await refundToWallet(db, reference, amountKobo); return; }
  if (p?.kind === "wallet_topup") {
    const taken = await reverseTopup(db, reference, amountKobo);
    if (!taken.kobo) return;
    try { await refundTransaction(reference, taken.kobo === p.amountKobo ? undefined : taken.kobo); }
    catch (e) { await restoreTopup(db, reference, taken); throw e; } // Paystack refused: the member loses nothing
    return;
  }
  await refundTransaction(reference, amountKobo);
}
