import { getAdminDb, getUserEmail } from "./firebase-admin";
import { initiateTransfer } from "./paystack";
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
    const tr = await (opts.transfer ?? initiateTransfer)({
      amountKobo: ledger.netKobo,
      recipient: account.recipientCode,
      reference: `payout_${reference}`,
      reason: `#NotesApp ${ledger.kind} payout`,
    });
    await ledgerRef.update({ transferCode: tr.transfer_code });
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
// (PAYOUT_HOLD_HOURS) has passed. Skips anything an admin froze ("disputed"), publishers
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
    .filter((l) => l.kind === "booking" && new Date(l.releaseAfter).getTime() <= dueBefore && (l.autoAttempts ?? 0) < AUTO_MAX_ATTEMPTS)
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
        if (!to) await notifyBell({ uid: l.publisherUid, type: "booking", linkHref: "/profile/publishing", message: `Payout of ${formatNaira(l.netKobo)} for your session is on its way.` });
        else await sendEmail({
          to,
          subject: "Your session payout is on its way",
          text: `Your earnings of ${formatNaira(l.netKobo)} for a completed session are being paid to your bank account now. Transfers usually arrive within minutes.\nReference: ${l.reference}\n\n#NotesApp`,
          bell: { uid: l.publisherUid, type: "booking", linkHref: "/profile/publishing", message: `Payout of ${formatNaira(l.netKobo)} for your session is on its way.` },
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
