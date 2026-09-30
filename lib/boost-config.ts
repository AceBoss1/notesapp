// Post boosts — suggested packages (adjust here; nothing else hard-codes
// them). Boosts are sold by VALIDATED IMPRESSIONS, delivered over
// several days, not by time on the clock:
//   • an impression = a real visitor saw the boosted card on screen for
//     ~1 second (IntersectionObserver), counted once per visitor per
//     boost per day, bots and the publisher's own views excluded;
//   • `maxPerDay` caps delivery so a package can't burn out in an hour —
//     that's what spreads it over multiple days (≥ minDays);
//   • if the window ends with impressions undelivered, the undelivered
//     share is refunded pro-rata (admin-triggered, see /admin/payments).
export type BoostPackage = {
  id: string;
  name: string;
  impressions: number;
  priceKobo: number;
  windowDays: number; // hard stop, delivery window
  minDays: number; // delivery is spread over at least this many days
  maxPerDay: number;
};

const pkg = (p: Omit<BoostPackage, "maxPerDay">): BoostPackage => ({ ...p, maxPerDay: Math.ceil(p.impressions / p.minDays) });

export const BOOST_PACKAGES: BoostPackage[] = [
  pkg({ id: "starter", name: "Starter", impressions: 1_000, priceKobo: 3_000 * 100, windowDays: 7, minDays: 3 }),
  pkg({ id: "growth", name: "Growth", impressions: 5_000, priceKobo: 12_500 * 100, windowDays: 14, minDays: 5 }),
  pkg({ id: "scale", name: "Scale", impressions: 20_000, priceKobo: 45_000 * 100, windowDays: 30, minDays: 10 }),
];

export const getBoostPackage = (id: string) => BOOST_PACKAGES.find((p) => p.id === id);

// Gifts (approved): tier commission, held 7 days like subscriptions.
export const GIFT_PRESETS_NAIRA = [200, 500, 1000, 2000, 5000];
export const GIFT_MIN_KOBO = 200 * 100;
export const GIFT_MAX_KOBO = 500_000 * 100;
export const GIFT_MESSAGE_MAX = 200;
