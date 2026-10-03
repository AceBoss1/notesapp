import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { slotLockId } from "./paystack";
import { loadPublisher } from "./publishers";
import { formatSlot, sessionEnd, sessionStart, weekdayOf } from "./booking-time";
import { RESCHEDULE_MAX, RESCHEDULE_MAX_DAYS, RESCHEDULE_MIN_HOURS, canReschedule } from "./cancellation";
import type { LedgerEntry } from "./payments";

export class BookingFail extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Moves a client's own confirmed session to another open slot of the same publisher, under the
// published policy (lib/cancellation.ts). Price, refund rights and the publisher's earnings
// carry over; the payout hold now runs from the new end time. Used by /api/bookings/reschedule.
export async function rescheduleBooking(uid: string, reference: string, date: string, slot: string) {
  const db = getAdminDb();
  const bRef = db.doc(`bookings/${reference}`);
  const b0 = (await bRef.get()).data();
  if (!b0 || b0.clientUid !== uid) throw new BookingFail("Booking not found.", 404);

  // The new time must be inside the publisher's availability, and far enough ahead.
  const pub = await loadPublisher(b0.username);
  const s = pub.settings?.session;
  if (!s?.enabled || !pub.hasPayoutAccount) throw new BookingFail("This publisher isn't taking bookings right now — you can cancel instead.", 409);
  if (!(s.availability[String(weekdayOf(date))] || []).includes(slot)) throw new BookingFail("That time isn't offered. Pick one of the open times.");
  const newStart = sessionStart(date, slot);
  const hoursAhead = (newStart.getTime() - Date.now()) / 3_600_000;
  if (hoursAhead < RESCHEDULE_MIN_HOURS) throw new BookingFail(`Pick a time at least ${RESCHEDULE_MIN_HOURS} hours from now.`);
  if (hoursAhead > RESCHEDULE_MAX_DAYS * 24) throw new BookingFail(`Pick a date within the next ${RESCHEDULE_MAX_DAYS} days.`);

  const now = new Date().toISOString();
  const newLockRef = db.doc(`slotLocks/${slotLockId(b0.username, date, slot)}`);
  const result = await db.runTransaction(async (t) => {
    const b = (await t.get(bRef)).data();
    const ledgerRef = db.doc(`ledger/${reference}`);
    const ledger = (await t.get(ledgerRef)).data() as LedgerEntry | undefined;
    const lock = await t.get(newLockRef);
    if (!b || b.clientUid !== uid || b.status !== "confirmed") throw new BookingFail("This booking can't be rescheduled.", 409);
    if (!ledger || ledger.status !== "held") throw new BookingFail("This booking can't be rescheduled — its payout is already being processed.", 409);
    const before = (new Date(b.startsAt).getTime() - Date.now()) / 3_600_000;
    const used = Number(b.rescheduleCount || 0);
    if (used >= RESCHEDULE_MAX) throw new BookingFail(`You've already rescheduled this session ${RESCHEDULE_MAX} times. You can cancel instead (see the policy).`, 409);
    if (!canReschedule(before, used)) throw new BookingFail(`Sessions can only be rescheduled at least ${RESCHEDULE_MIN_HOURS} hours before they start. You can cancel instead (see the policy).`, 409);
    if (b.date === date && b.slot === slot) throw new BookingFail("That's the time you already have.");
    if (lock.exists) throw new BookingFail("That time was just taken — pick another.", 409);
    const oldLockRef = db.doc(`slotLocks/${slotLockId(b.username, b.date, b.slot)}`);
    const oldLock = await t.get(oldLockRef);
    t.set(newLockRef, { reference, createdAt: now });
    if (oldLock.exists && oldLock.data()?.reference === reference) t.delete(oldLockRef);
    t.update(bRef, {
      date,
      slot,
      startsAt: newStart.toISOString(),
      rescheduleCount: used + 1,
      rescheduledFrom: FieldValue.arrayUnion({ date: b.date, slot: b.slot, at: now }),
      reminder24Sent: false,
      reminder1Sent: false,
    });
    // The publisher is paid after the session actually happens.
    t.update(ledgerRef, { releaseAfter: sessionEnd(date, slot, b.minutes).toISOString() });
    return { was: `${b.date} at ${formatSlot(b.slot)}`, minutes: b.minutes, left: RESCHEDULE_MAX - (used + 1), clientEmail: b.clientEmail as string, publisherUid: b.publisherUid as string, username: b.username as string };
  });
  return result;
}
