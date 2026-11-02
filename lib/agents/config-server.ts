import type { Firestore } from "firebase-admin/firestore";
import { agentSettings, cleanAgentOverrides, type AgentSettings } from "./config";
import { getLimitOverrides } from "@/lib/limits-server";
import { limitFor, type LimitKey } from "@/lib/limits";
import { memberTier } from "@/lib/nana-meter";
import type { AccountTier } from "@/lib/users";

// The admin's saved agent settings (serverConfig/agents, server-only), through a 30-second cache like the plan limits.
const TTL_MS = 30_000;
let cache: { at: number; data: AgentSettings } | null = null;

export async function getAgentSettings(db: Firestore, now = Date.now()): Promise<AgentSettings> {
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const data = agentSettings(cleanAgentOverrides((await db.doc("serverConfig/agents").get()).data()?.overrides));
  cache = { at: now, data };
  return data;
}
export async function saveAgentSettings(db: Firestore, input: unknown, adminUid: string, now = new Date()): Promise<AgentSettings> {
  const overrides = cleanAgentOverrides(input);
  await db.doc("serverConfig/agents").set({ overrides, updatedAt: now.toISOString(), updatedBy: adminUid });
  cache = { at: now.getTime(), data: agentSettings(overrides) };
  return cache.data;
}
export const resetAgentSettingsCache = () => { cache = null; };

// A plan limit for a member (nanaOperator, nanaJobsPerDay, agentConnect).
export async function planLimit(db: Firestore, uid: string, key: LimitKey, tier?: AccountTier): Promise<number> {
  return limitFor(key, tier ?? (await memberTier(db, uid)), await getLimitOverrides(db));
}
