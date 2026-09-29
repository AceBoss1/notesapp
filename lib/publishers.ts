import { getAdminDb } from "./firebase-admin";
import type { PublisherSettings } from "./booking-time";
import { commissionRateFor } from "./payments";
import type { AccountTier } from "./users";

// Server-only lookup used by checkout: who is this publisher, what do
// they charge, and can they actually be paid.
export async function loadPublisher(username: string) {
  const db = getAdminDb();
  const reservation = await db.doc(`usernames/${username}`).get();
  const uid = reservation.data()?.uid as string | undefined;
  if (!uid) throw new Error("Journal not found.");
  const [userSnap, settingsSnap, payoutSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`publisherSettings/${uid}`).get(),
    db.doc(`payoutAccounts/${uid}`).get(),
  ]);
  const user = userSnap.data();
  if (!user || user.suspended === true) throw new Error("This journal isn't available.");
  return {
    uid,
    username,
    settings: settingsSnap.data() as PublisherSettings | undefined,
    hasPayoutAccount: payoutSnap.exists && !!payoutSnap.data()?.recipientCode,
    commissionRate: commissionRateFor((user.accountTier as AccountTier) || "basic"),
  };
}
