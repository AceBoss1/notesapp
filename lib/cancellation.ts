// Booking policy (approved). Shared by the server routes that enforce it and
// the UI that shows it — change it here only.
//
// Cancelling:
//   client cancels ≥ 48 h before start  → 100% refund
//   client cancels 24–48 h before       →  50% refund
//   client cancels < 24 h before        →   0% refund
//   publisher cancels (any time)        → 100% refund
// Rescheduling (client): free, up to RESCHEDULE_MAX times, only while the session is at
//   least RESCHEDULE_MIN_HOURS away, to a free slot in the publisher's availability that is
//   itself at least RESCHEDULE_MIN_HOURS away (and within RESCHEDULE_MAX_DAYS). Inside 24 h
//   a session can only be cancelled. The cancellation policy then applies to the new time.
// Payout: the publisher's earnings are released automatically PAYOUT_HOLD_HOURS after the
//   session ends, unless the client reported a problem in that window (an admin then decides).
export const RESCHEDULE_MAX = 2;
export const RESCHEDULE_MIN_HOURS = 24;
export const RESCHEDULE_MAX_DAYS = 60;
export const PAYOUT_HOLD_HOURS = 24;

export const POLICY_TEXT =
  "Cancel 48+ hours before: full refund · 24–48 hours before: 50% refund · under 24 hours: no refund. If the publisher cancels, you always get a full refund. " +
  `You can reschedule free up to ${RESCHEDULE_MAX} times, at least ${RESCHEDULE_MIN_HOURS} hours before the session, to another open time (within ${RESCHEDULE_MAX_DAYS} days); inside ${RESCHEDULE_MIN_HOURS} hours a session can only be cancelled. ` +
  `The publisher is paid automatically ${PAYOUT_HOLD_HOURS} hours after the session ends; if something went wrong, report it within that time and we'll review before any payout.`;

export function refundFraction(hoursBefore: number, cancelledBy: "client" | "publisher"): number {
  if (cancelledBy === "publisher") return 1;
  if (hoursBefore >= 48) return 1;
  if (hoursBefore >= 24) return 0.5;
  return 0;
}

// Can the client still move this session? (`count` = reschedules already used)
export function canReschedule(hoursBefore: number, count = 0): boolean {
  return hoursBefore >= RESCHEDULE_MIN_HOURS && count < RESCHEDULE_MAX;
}
