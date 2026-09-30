// Gold badge pricing — the same for every plan tier.
//   Personal  : endorsement ₦1,999/mo · identity check ₦999 non-refundable deposit + ₦1,999/mo
//   Corporate : endorsement ₦2,999/mo · identity check ₦1,999 non-refundable deposit + ₦2,999/mo
// The deposit covers the third-party check (Dojah: NIN + face liveness for
// people, CAC lookup for organisations) whether or not it passes.
// Endorsement is a manual review — no deposit.
import type { GoldBadgeKind } from "./badges";

export type GoldTrack = "personal" | "corporate";

export const GOLD_PRICING: Record<GoldTrack, { label: string; monthlyKobo: number; identityDepositKobo: number }> = {
  personal: { label: "Personal", monthlyKobo: 1999 * 100, identityDepositKobo: 999 * 100 },
  corporate: { label: "Corporate / organisation", monthlyKobo: 2999 * 100, identityDepositKobo: 1999 * 100 },
};

// Dojah hosted identity widgets (configured in the Dojah dashboard): one for
// people (NIN + liveness…), one for organisations (CAC…). The ids are not
// secrets. Results are read by an admin in the Dojah dashboard — we do not
// receive or store any ID data ourselves.
export function dojahWidgetUrl(track: GoldTrack, reference: string): string | null {
  const id = track === "corporate" ? process.env.NEXT_PUBLIC_DOJAH_WIDGET_CORPORATE : process.env.NEXT_PUBLIC_DOJAH_WIDGET_PERSONAL;
  if (!id) return null;
  return `https://identity.dojah.io?widget_id=${encodeURIComponent(id)}&reference_id=${encodeURIComponent(reference)}`;
}

export const isGoldTrack = (v: unknown): v is GoldTrack => v === "personal" || v === "corporate";
export const isGoldKind = (v: unknown): v is GoldBadgeKind => v === "endorsement" || v === "identity";

// badgeRequests/{uid}.status
//   awaiting_deposit  identity only — deposit not paid yet
//   pending           waiting for admin review
//   approved          approved — member can now subscribe
//   active            subscribed, badge showing
//   rejected          declined (a paid deposit is not refunded)
export type GoldRequestStatus = "awaiting_deposit" | "pending" | "approved" | "active" | "rejected";
