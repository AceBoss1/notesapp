import { celebrationActive } from "./celebration";

// The #1MillionNairaNotesAppChallenge hero and top bar take over from the Independence Day ones the day after they
// expire (CELEBRATION.end), automatically. To retire them, set `end` (Lagos date, inclusive).
export const CHALLENGE_PROMO = {
  end: null as string | null, // e.g. "2026-12-31"
  name: "#1MillionNairaNotesAppChallenge",
  href: "/challenge",
};

export function challengePromoActive(now = new Date()): boolean {
  if (celebrationActive(now)) return false;
  if (!CHALLENGE_PROMO.end) return true;
  const today = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  return today <= CHALLENGE_PROMO.end;
}
