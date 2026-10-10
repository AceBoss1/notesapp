// Store categories and the "ships from" line. Pure and client-safe: the seller's form, the storefront filters and the Firestore rules all use these.
export const STORE_CATEGORIES = [
  "Fashion & clothing",
  "Shoes & bags",
  "Beauty & care",
  "Jewellery & accessories",
  "Home & living",
  "Food & drinks",
  "Electronics",
  "Books & courses",
  "Art & crafts",
  "Other",
] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];
export const isStoreCategory = (v: unknown): v is StoreCategory => typeof v === "string" && (STORE_CATEGORIES as readonly string[]).includes(v);

// Where a physical item is sent from, in the seller's words ("Lekki, Lagos"). Buyers see it before they pay.
export const SHIPS_FROM_MIN = 2;
export const SHIPS_FROM_MAX = 60;
export const cleanShipsFrom = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, SHIPS_FROM_MAX);
export const shipsFromOk = (v: unknown): boolean => cleanShipsFrom(v).length >= SHIPS_FROM_MIN;

// The category a card is filed under (older items have none).
export const categoryOf = (i: { category?: string; kind?: string }): StoreCategory => (isStoreCategory(i.category) ? i.category : i.kind === "digital" ? "Books & courses" : "Other");
