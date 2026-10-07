import type { Firestore } from "firebase-admin/firestore";
import { cleanOverrides, limitFor, limitTable, type LimitKey, type LimitOverrides, type LimitTable } from "./limits";
import type { AccountTier } from "./users";

// Server side of the plan limits: the admin's saved numbers live in serverConfig/limits (server-only, see firestore.rules) and are
// read through a short cache so enforcing a limit costs at most one read a half-minute per server instance. A change an admin saves
// is therefore live everywhere within about 30 seconds.
const TTL_MS = 30_000;
let cache: { at: number; data: LimitOverrides } | null = null;

export async function getLimitOverrides(db: Firestore, now = Date.now()): Promise<LimitOverrides> {
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const data = cleanOverrides((await db.doc("serverConfig/limits").get()).data()?.overrides);
  cache = { at: now, data };
  return data;
}

export async function limit(db: Firestore, key: LimitKey, tier: AccountTier): Promise<number> {
  return limitFor(key, tier, await getLimitOverrides(db));
}

export async function getLimitTable(db: Firestore): Promise<LimitTable> {
  return limitTable(await getLimitOverrides(db));
}

export async function saveLimitOverrides(db: Firestore, input: unknown, adminUid: string, now = new Date()): Promise<LimitTable> {
  const overrides = cleanOverrides(input);
  await db.doc("serverConfig/limits").set({ overrides, updatedAt: now.toISOString(), updatedBy: adminUid });
  cache = { at: now.getTime(), data: overrides };
  return limitTable(overrides);
}

export function resetLimitCache() { cache = null; }
