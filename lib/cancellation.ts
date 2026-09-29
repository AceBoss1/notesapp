// Cancellation policy (approved). Shared by the server route that
// enforces it and the UI that shows it — change it here only.
//   client cancels ≥ 48 h before start  → 100% refund
//   client cancels 24–48 h before       →  50% refund
//   client cancels < 24 h before        →   0% refund
//   publisher cancels (any time)        → 100% refund
export const POLICY_TEXT =
  "Cancel 48+ hours before: full refund · 24–48 hours before: 50% refund · under 24 hours: no refund. If the publisher cancels, you always get a full refund.";

export function refundFraction(hoursBefore: number, cancelledBy: "client" | "publisher"): number {
  if (cancelledBy === "publisher") return 1;
  if (hoursBefore >= 48) return 1;
  if (hoursBefore >= 24) return 0.5;
  return 0;
}
