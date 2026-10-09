import type { Firestore } from "firebase-admin/firestore";
import { WEEKDAYS, formatNaira, formatSlot, weekdayOf, type PublisherSettings } from "./booking-time";
import { SITE_URL } from "./api-v1";
import { slotLockId } from "./paystack";
import { addDays, lagosDate } from "./team";

// What Nana may offer when someone in a conversation asks for a session or a time: the member's own booking page and the next few open slots
// from their calendar (the availability they set, minus what is already booked). Null when the member doesn't take paid sessions or can't be
// paid yet, so Nana never offers a link that wouldn't work.
export const SLOT_DAYS = 7, SLOT_SHOW = 6;

export async function bookingContext(db: Firestore, uid: string, now = new Date()): Promise<string | null> {
  const [settingsSnap, payoutSnap, userSnap] = await Promise.all([db.doc(`publisherSettings/${uid}`).get(), db.doc(`payoutAccounts/${uid}`).get(), db.doc(`users/${uid}`).get()]);
  const s = (settingsSnap.data() as PublisherSettings | undefined)?.session;
  const username = String(userSnap.data()?.username || settingsSnap.data()?.username || "");
  if (!s?.enabled || !username || !(payoutSnap.exists && payoutSnap.data()?.recipientCode)) return null;

  const today = lagosDate(now), nowSlot = new Date(now.getTime() + 3_600_000).toISOString().slice(11, 16);
  const open: string[] = [];
  for (let i = 0; i <= SLOT_DAYS && open.length < SLOT_SHOW; i++) {
    const date = addDays(today, i);
    const cands = (s.availability[String(weekdayOf(date))] || []).filter((slot) => i > 0 || slot > nowSlot);
    if (!cands.length) continue;
    const taken = await Promise.all(cands.map((slot) => db.doc(`slotLocks/${slotLockId(username, date, slot)}`).get()));
    for (const [k, slot] of cands.entries()) {
      if (taken[k].exists || open.length >= SLOT_SHOW) continue;
      open.push(`${WEEKDAYS[weekdayOf(date)]} ${date} at ${formatSlot(slot)}`);
    }
  }
  return [
    `Booking page (the only link you may share for booking): ${SITE_URL()}/u/${username}`,
    `Paid session: ${s.minutes} minutes, ${formatNaira(s.priceKobo)}. Times are Lagos time.`,
    open.length ? `Next open times:\n${open.map((o) => `- ${o}`).join("\n")}` : "No open times in the next week; point them to the booking page for later dates.",
  ].join("\n");
}
