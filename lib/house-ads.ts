// A house campaign kept in code, so it goes live on merge with no database step (owner, 21 Nov 2026: "deploy ads, different
// designs for each Ludo square, each in Ludo yard color, then one center... deploy directly on all games and all ad slots too...
// it should run 1 month"). lib/ads-server.ts loadActiveAds adds the ones whose window is open; each switches itself off after
// 21 Dec 2026 (Lagos time), and Admin → Ads spot switches still apply. Links are site paths, so they stay on the visitor's domain.
// Pictures: public/ads/davido34/ (wide 2400 × 1256, billboard 1600 × 900, squares 1080 × 1080).
import { AD_PLACEMENTS, type AdCreative, type AdPlacement } from "./ads";

const START = "2026-11-21T00:00:00+01:00";
const END = "2026-12-21T23:59:59+01:00";
const PIC = (f: string) => `/ads/davido34/${f}`;
const base = { provider: "notesapp" as const, weight: 10, active: true, startsAt: START, endsAt: END };

// Every wide spot, Notes Life's billboards and the Arcade (its banners and Naija Run's billboards). Never the weekly digest
// (its click link reads adCreatives/{id}), and the Arcade's square spots get their own designs below.
const WIDE: AdPlacement[] = (Object.keys(AD_PLACEMENTS) as AdPlacement[]).filter((p) => p !== "digest" && p !== "arcadesq");

// Ludo's yards by index (LudoGame COLOURS): 0 green, 1 red, 2 yellow, 3 blue; each design is in its yard's colour.
const YARDS = ["green", "red", "yellow", "blue"];

export const HOUSE_ADS: AdCreative[] = [
  {
    ...base, id: "house-davido34-wide", title: "Happy 34th birthday, Davido",
    text: "₦82.72M+ in NotesApp birthday initiatives. Code DAVIDO-at-34.",
    image: PIC("wide.jpg"), billboard: PIC("billboard.jpg"), href: "/offers/DAVIDO-at-34", placements: WIDE,
  },
  ...YARDS.map((colour, n): AdCreative => ({
    ...base, id: `house-davido34-yard-${n}`, title: "Davido @34 tournament", text: `Notes Arcade Ludo, the ${colour} yard.`,
    square: PIC(`yard-${n}.jpg`), href: "/arcade/tournament", placements: ["arcadesq"], pin: `ludo-yard-${n}`,
  })),
  { ...base, id: "house-davido34-centre", title: "Davido @34 tournament", square: PIC("centre.jpg"), href: "/arcade/tournament", placements: ["arcadesq"], pin: "ludo-centre" },
  { ...base, id: "house-davido34-landlord", title: "Davido @34 tournament", square: PIC("tile.jpg"), href: "/arcade/tournament", placements: ["arcadesq"], pin: "landlord-tile" },
];

export const HOUSE_ADS_END = END;

// The house adverts whose window is open at `now`.
export const openHouseAds = (now = Date.now()) =>
  HOUSE_ADS.filter((a) => a.active && (!a.startsAt || new Date(a.startsAt).getTime() <= now) && (!a.endsAt || new Date(a.endsAt).getTime() >= now));
