import { getAdminDb } from "./firebase-admin";
import { ttlCache } from "./ttl-cache";
import type { AdCreative } from "./ads";

// Active house creatives, one Firestore read per instance per 5 minutes.
export const loadActiveAds = ttlCache(5 * 60_000, async () => {
  const snap = await getAdminDb().collection("adCreatives").where("active", "==", true).get();
  return snap.docs.map((d) => ({ provider: "notesapp", ...d.data(), id: d.id }) as AdCreative);
});

export const lagosDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).replace(/-/g, ""); // YYYYMMDD
