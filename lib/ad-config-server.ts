import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { ttlCache } from "./ttl-cache";
import { cleanAdConfig, type AdConfig } from "./ad-config";

// Server-only. Admin → Ads saves the advert and boost numbers in adConfig/main (no browser access); everything else reads
// them through here, one read a minute per server instance. Missing or unreadable → the defaults in lib/ad-config.ts.
export async function readAdConfig(db: Firestore): Promise<AdConfig> {
  return cleanAdConfig((await db.doc("adConfig/main").get()).data());
}
const cached = ttlCache(60_000, () => readAdConfig(getAdminDb()));
export async function adConfig(): Promise<AdConfig> {
  try {
    return await cached();
  } catch {
    return cleanAdConfig(null);
  }
}
export async function saveAdConfig(db: Firestore, input: unknown, byUid: string): Promise<AdConfig> {
  const c = cleanAdConfig(input);
  await db.doc("adConfig/main").set({ ...c, byUid, at: new Date().toISOString() });
  cached.invalidate();
  return c;
}
