import { getAdminDb, getUserEmail } from "./firebase-admin";
import { emitWebhook } from "./webhooks";
import { initiateTransfer } from "./paystack";
import { canUsePaylony, payViaPaylony } from "./paylony-payouts";
import { notifyBell, sendEmail } from "./email";
import { formatNaira } from "./booking-time";
import { PAYOUT_HOLD_HOURS } from "./cancellation";
import type { LedgerEntry } from "./payments";

// Server-only. The one place a publisher payout is sent, used by the admin "Release" button and
// by the scheduled auto-release (bookings, PAYOUT_HOLD_HOURS after the session ends).
export type ReleaseResult = { ok: true; transferStatus: string } | { ok: false; status: number; error: string };

export async function releaseLedgerEntry(
  reference: string,
  opts: { allowDisputed?: boolean; transfer?: typeof initiateTransfer } = {}
): Promise<ReleaseResult> {
  const db = getAdminDb();
  const ledgerRef = db.doc(`ledger/${reference}`);
  const ledger = (await ledgerRef.get()).data() as LedgerEntry | undefined;
  if (!ledger) return { ok: false, status: 404, error: "No payout entry for this payment" };
  const releasable = ledger.status === "held" || (opts.allowDisputed === true && ledger.status === "disputed");
  if (!releasable) return { ok: false, status: 409, error: `Payout is ${ledger.status}.` };
  if (new Date(ledger.releaseAfter).getTime() > Date.now()) {
    return { ok: false, status: 409, error: `Not releasable until ${ledger.releaseAfter}.` };
  }
  const account = (await db.doc(`payoutAccounts/${ledger.publisherUid}`).get()).data();
  if (!account?.recipientCode) return { ok: false, status: 409, error: "Publisher has no payout account." };
  // Through Paylony only when the admin chose it and this account has what Paylony needs; otherwise Paystack, as before.
  const viaPaylony = await canUsePaylony({ uid: ledger.publisherUid, accountName: String(account.accountName || ""), paylonyBankCode: account.paylonyBankCode }).catch(() => false);

  // Claim first so a double-click (or the cron overlapping an admin) can't send two transfers.
  const claimed = await db.runTransaction(async (t) => {
    const cur = (await t.get(ledgerRef)).data() as LedgerEntry;
    const ok = cur.status === "held" || (opts.allowDisputed === true && cur.status === "disputed");
    if (!ok) return false;
    t.update(ledgerRef, { status: "transferring", failureReason: "" });
    return true;
  });
  if (!claimed) return { ok: false, status: 409, error: "Already being released." };
  try {
    if (viaPaylony) {
      // Our own reference is Paylony's idempotency key: sending it twice can't pay twice (Paylony answers "09 already exists").
      const attempt = (ledger as LedgerEntry).paylonyAttempts ?? 0;
      const reference_ = attempt ? `payout_${reference}_r${attempt}` : `payout_${reference}`;
      const res = await payViaPaylony({
        account: { uid: ledger.publisherUid, accountName: String(account.accountName || ""), paylonyBankCode: account.paylonyBankCode },
        amountKobo: ledger.netKobo,
        reference: reference_,
        narration: `#NotesApp ${ledger.kind} payout`,
      });
      if (res.state === "sent" || res.state === "uncertain") {
        // Accepted, or unclear: either way it may exist, so never fall back to Paystack. It stays "transferring" until Paylony's
        // result is read (webhook, scheduled check, or the admin's "Check now"); an unclear one is flagged for the admin.
        await ledgerRef.update({ transferProvider: "paylony", transferReference: reference_, transferStartedAt: new Date().toISOString(), failureReason: res.state === "uncertain" ? `Paylony reply unclear (${res.reason}) — check the transfer status` : "" });
        await emitWebhook(ledger.publisherUid, "payout.released", { id: reference, kind: ledger.kind, net_kobo: ledger.netKobo, transfer_status: "pending" });
        return { ok: true, transferStatus: "pending" };
      }
      // Definitely refused: nothing was created, so Paystack can safely take it.
      await ledgerRef.update({ failureReason: `Paylony refused (${res.reason}); sent through Paystack instead` });
    }
    const tr = await (opts.transfer ?? initiateTransfer)({
      amountKobo: ledger.netKobo,
      recipient: account.recipientCode,
      reference: `payout_${reference}`,
      reason: `#NotesApp ${ledger.kind} payout`,
    });
    await ledgerRef.update({ transferCode: tr.transfer_code });
    await emitWebhook(ledger.publisherUid, "payout.released", { id: reference, kind: ledger.kind, net_kobo: ledger.netKobo, transfer_status: tr.status });
    return { ok: true, transferStatus: tr.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transfer failed";
    await ledgerRef.update({ status: "held", failureReason: msg });
    throw err;
  }
}

const AUTO_MAX_ATTEMPTS = 3;
const AUTO_BATCH = 100;

// Scheduled: pay out booking earnings once the session is over and the problem-report window
// (PAYOUT_HOLD_HOURS) has passed, and digital-download earnings once their dispute window
// (releaseAfter, set at purchase) has passed. Skips anything an admin froze ("disputed"), publishers
// without a payout account, and entries that already failed AUTO_MAX_ATTEMPTS times (those
// wait for a manual release, with the reason shown on /admin/payments). Set
// AUTO_PAYOUTS=off in the environment to pause it. Returns how many transfers were started.
export async function autoReleasePayouts(opts: { transfer?: typeof initiateTransfer; now?: number } = {}): Promise<number> {
  if (process.env.AUTO_PAYOUTS === "off") return 0;
  const db = getAdminDb();
  const now = opts.now ?? Date.now();
  const dueBefore = now - PAYOUT_HOLD_HOURS * 3_600_000; // releaseAfter is the session end
  const snap = await db.collection("ledger").where("status", "==", "held").limit(AUTO_BATCH * 5).get();
  const due = snap.docs
    .map((d) => d.data() as LedgerEntry & { autoAttempts?: number })
    .filter((l) => {
      const due = l.kind === "booking" ? dueBefore : l.kind === "digital" ? now : -Infinity;
      return new Date(l.releaseAfter).getTime() <= due && (l.autoAttempts ?? 0) < AUTO_MAX_ATTEMPTS;
    })
    .slice(0, AUTO_BATCH);
  let started = 0;
  for (const l of due) {
    const ref = db.doc(`ledger/${l.reference}`);
    try {
      const r = await releaseLedgerEntry(l.reference, { transfer: opts.transfer });
      if (r.ok) {
        started++;
        await ref.update({ autoReleasedAt: new Date(now).toISOString() });
        const to = await getUserEmail(l.publisherUid);
        if (!to) await notifyBell({ uid: l.publisherUid, type: "booking", linkHref: "/profile/publishing", message: `Payout of ${formatNaira(l.netKobo)} for your ${l.kind === "digital" ? "sale" : "session"} is on its way.` });
        else await sendEmail({
          to,
          subject: l.kind === "digital" ? "Your download sale payout is on its way" : "Your session payout is on its way",
          text: `Your earnings of ${formatNaira(l.netKobo)} for ${l.kind === "digital" ? "a download sale" : "a completed session"} are being paid to your bank account now. Transfers usually arrive within minutes.\nReference: ${l.reference}\n\n#NotesApp`,
          bell: { uid: l.publisherUid, type: "booking", linkHref: "/profile/publishing", message: `Payout of ${formatNaira(l.netKobo)} for your ${l.kind === "digital" ? "sale" : "session"} is on its way.` },
        }).catch(() => {});
      } else if (r.error === "Publisher has no payout account.") {
        await ref.update({ failureReason: r.error, autoAttempts: AUTO_MAX_ATTEMPTS });
        await notifyBell({ uid: l.publisherUid, type: "booking", linkHref: "/profile/publishing", message: `We couldn't pay your session earnings of ${formatNaira(l.netKobo)} — add your bank account under Rates & payouts.` });
      }
    } catch (err) {
      const attempts = (l.autoAttempts ?? 0) + 1;
      await ref.update({ autoAttempts: attempts, ...(attempts >= AUTO_MAX_ATTEMPTS ? { failureReason: `Auto-release failed ${attempts} times — release manually. Last error: ${err instanceof Error ? err.message : "unknown"}` } : {}) }).catch(() => {});
    }
  }
  return started;
}
