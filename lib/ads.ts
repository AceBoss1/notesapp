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
// an ads.txt — see docs/BUILD_LOG.md "Ads scaffold".
export type AdProvider = "notesapp" | "google" | "meta" | "admob";

export const AD_FOOTER: Record<AdProvider, string> = {
  notesapp: "Sponsored: NotesApp Ads",
  google: "Sponsored: Google Ads",
  meta: "Sponsored: Meta Ads",
  admob: "Sponsored: AdMob",
};

// Where a banner can appear. "site" slots always show house ads; "publisher"
// slots sit on a publisher's own profile/posts and respect their ad setting.
// `where` is what /advertise/specifications says about each spot.
export const AD_PLACEMENTS = {
  home: { label: "Home page (middle)", scope: "site", where: "The middle of the home page." },
  journals: { label: "Journals list", scope: "site", where: "Between the posts in the journal feed." },
  trending: { label: "Trending page", scope: "site", where: "On Trending, under the tabs." },
  profile: { label: "Publisher profile", scope: "publisher", where: "On publishers' profiles, when they show adverts (their ad share)." },
  post: { label: "End of a post", scope: "publisher", where: "At the end of a journal, when its publisher shows adverts (their ad share)." },
  market: { label: "Notes Market", scope: "site", where: "In Notes Market, after the first row of For you and after Most viewed." },
  academy: { label: "Notes Academy", scope: "site", where: "In Notes Academy, between the course shelves." },
  explore: { label: "Explore", scope: "site", where: "On Explore, under the tabs." },
  search: { label: "Search results", scope: "site", where: "In search results (journals matching what was searched), after the 3rd result." },
  course: { label: "Free course pages", scope: "site", where: "On free course pages: under This course includes on a computer, after the curriculum on a phone. Never on paid courses, lessons or certificates." },
  digest: { label: "Weekly digest email", scope: "site", where: "In the Sunday weekly digest email, in its sponsored slots. Each email sent counts as an impression." },
  life: { label: "Notes Life billboards (in the game)", scope: "site", where: "On the roadside billboards in Notes Life, the free life game. Needs a billboard picture as well." },
} as const;
export type AdPlacement = keyof typeof AD_PLACEMENTS;
export const isPlacement = (v: unknown): v is AdPlacement => typeof v === "string" && v in AD_PLACEMENTS;

export type AdCreative = {
  id: string;
  title: string;
  text?: string;
  image?: string;
  billboard?: string; // the Notes Life billboard picture (1600 × 900), for the life spot
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
