import type { BadgeLevel, GoldBadgeKind } from "./badges";
import { badgeLevel, isTeamMember, type UserProfile } from "./users";
import { VERIFIED_USERNAMES } from "./journals-directory";

// The badges shown right after a person's name, before their @username, everywhere a name appears beside a picture
// (components/PersonName.tsx): the ✔ (maroon, or gold: identity-checked or endorsed) and the #NotesApp team mark. Only badges
// the account has earned and still holds: none for a suspended account, an organisation's ✔ only once its registration is
// confirmed (lib/users.ts hasVerifiedBadge).
// The campus programme (lib/campus.ts): a country's campus coordinator wears the maroon team mark; campus ambassadors and Campus Leads
// wear its inverse, white with a maroon shadow (`campus`).
export type NameBadges = { level: BadgeLevel; goldKind?: GoldBadgeKind; team: boolean; campus?: "ambassador" | "lead" };
export const NO_BADGES: NameBadges = { level: null, team: false };

export function badgesOf(p: UserProfile | null | undefined): NameBadges {
  if (!p || p.suspended === true) return NO_BADGES;
  const level = badgeLevel(p);
  const official = VERIFIED_USERNAMES.includes(p.username);
  const team = isTeamMember(p) || official || p.campusBadge === "coordinator";
  const campus = !team && (p.campusBadge === "ambassador" || p.campusBadge === "lead") ? p.campusBadge : undefined;
  return { level: level ?? (official ? "verified" : null), ...(level === "gold" && p.goldBadge?.kind ? { goldKind: p.goldBadge.kind } : {}), team, ...(campus ? { campus } : {}) };
}
// The official channels have no account of their own: always ✔ and the team mark.
export const officialBadges = (username: string): NameBadges | null => (VERIFIED_USERNAMES.includes(username) ? { level: "verified", team: true } : null);
