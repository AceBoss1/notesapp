import { ADMIN_PROFILES } from "./admin";
import type { AccountTier, UserProfile } from "./users";

// The two founder accounts. They are always treated as Business publishers, whatever the
// stored `accountTier` says (older documents still read "basic"); `scripts/set-founder-tier.mjs`
// also fixes the stored value. Kept apart from lib/users.ts (which loads the browser's Firebase) so
// pure code and its tests can use it.
export const FOUNDER_USERNAMES: string[] = Object.values(ADMIN_PROFILES).map((p) => p.username);
export function effectiveTier(p: Pick<UserProfile, "username" | "role" | "accountTier">): AccountTier {
  return p.role === "admin" || FOUNDER_USERNAMES.includes(p.username) ? "business" : p.accountTier;
}
