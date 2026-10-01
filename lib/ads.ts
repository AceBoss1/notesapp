// Ads scaffold. Nothing renders until creatives exist (slots stay empty), so this
// is safe to ship before any ad is booked.
//
// Providers and the footer note each ad must carry:
//   notesapp — our own house banners (managed in /admin/ads)   "Sponsored: NotesApp Ads"
//   google   — Google ads (AdSense / Ad Manager on the web)      "Sponsored: Google Ads"
//   meta     — Meta ads                                          "Sponsored: Meta Ads"
//   admob    — Google AdMob (a MOBILE-APP SDK, not for websites)  "Sponsored: AdMob"
// Only `notesapp` is implemented. Third-party providers are intentionally NOT
// loaded: each needs its own account approval, a consent banner, and (Google)
// an ads.txt — see README "Ads scaffold".
export type AdProvider = "notesapp" | "google" | "meta" | "admob";

export const AD_FOOTER: Record<AdProvider, string> = {
  notesapp: "Sponsored: NotesApp Ads",
  google: "Sponsored: Google Ads",
  meta: "Sponsored: Meta Ads",
  admob: "Sponsored: AdMob",
};

// Where a banner can appear. "site" slots always show house ads; "publisher"
// slots sit on a publisher's own profile/posts and respect their ad setting.
export const AD_PLACEMENTS = {
  home: { label: "Home page (middle)", scope: "site" },
  journals: { label: "Journals list", scope: "site" },
  trending: { label: "Trending page", scope: "site" },
  profile: { label: "Publisher profile", scope: "publisher" },
  post: { label: "End of a post", scope: "publisher" },
} as const;
export type AdPlacement = keyof typeof AD_PLACEMENTS;
export const isPlacement = (v: unknown): v is AdPlacement => typeof v === "string" && v in AD_PLACEMENTS;

export type AdCreative = {
  id: string;
  title: string;
  text?: string;
  image?: string;
  href: string;
  placements: AdPlacement[];
  weight: number; // 1–10, relative share of rotation
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  provider: AdProvider; // "notesapp" for house ads
};

// Free Standard/Basic journals always carry ads (no share). Pro/Business/
// Enterprise show them only if the publisher opted in (to earn their ad share).
export function publisherShowsAds(p: { accountTier?: string; adsOptIn?: boolean } | null | undefined): boolean {
  if (!p) return true;
  const paid = p.accountTier === "pro" || p.accountTier === "business" || p.accountTier === "enterprise";
  return paid ? p.adsOptIn === true : true;
}
