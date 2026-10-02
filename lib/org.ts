// Organisation accounts: a company, NGO, church, school or other body that
// publishes a #channel. Same journal pages as a person, plus a registration
// number we check, a free Business trial, and a team (phase 2).
//
// users/{uid}: accountKind "organisation", org { rcNumber, rcStatus … },
// trialUntil / trialTier. All of these are SERVER-written (firestore.rules
// lets an owner edit only name, bio, logo and links).
export type AccountKind = "personal" | "organisation";
export type RcStatus = "unverified" | "verified" | "rejected";

export type OrgInfo = {
  rcNumber: string; // normalised, e.g. "RC1234567"
  rcStatus: RcStatus;
  rcSubmittedAt: string;
  rcVerifiedAt?: string;
  rcNote?: string; // reason shown when rejected
};

export const ORG_TRIAL_DAYS = 30;
export const ORG_TRIAL_TIER = "business" as const;
// Seats = the owner plus team members. Enterprise is agreed per account.
export const ORG_SEATS: Record<string, number | null> = { business: 4, enterprise: null };

// Nigerian registrations: RC (companies), BN (business names), IT (incorporated trustees), LP/LLP.
export function normalizeRc(raw: unknown): string | null {
  const s = String(raw ?? "").toUpperCase().replace(/[\s\-\/]/g, "");
  const m = s.match(/^(RC|BN|IT|LP|LLP)?(\d{3,9})$/);
  if (!m) return null;
  return `${m[1] || "RC"}${m[2]}`;
}

type OrgLike = { accountKind?: string; org?: { rcStatus?: string } | null } | null | undefined;
export const isOrganisation = (p: OrgLike) => !!p && p.accountKind === "organisation";
export const orgVerified = (p: OrgLike) => isOrganisation(p) && p?.org?.rcStatus === "verified";

export const CAC_SEARCH_URL = "https://search.cac.gov.ng/";

// Shown on an organisation's profile and under each of its posts until we confirm the registration.
export const UNVERIFIED_ORG_NOTICE =
  "This organisation hasn't been verified yet — #NotesApp has not confirmed its registration (CAC) details.";

// ---- Team (phase 2) ----
// orgMembers/{orgUid}_{memberUid}: an ACTIVE member (the owner is the organisation
// account itself and has no row). orgInvites/{id}: pending/closed invitations.
// Both are server-written (/api/org/team). Team publishing needs Business/Enterprise.
export type OrgRole = "owner" | "admin" | "writer";
export type OrgMember = { orgUid: string; memberUid: string; memberUsername: string; memberName: string; role: "admin" | "writer"; joinedAt: string };
export type OrgInvite = {
  id: string;
  orgUid: string;
  orgUsername: string;
  orgName: string;
  inviteeUid: string;
  inviteeUsername: string;
  role: "admin" | "writer";
  status: "pending" | "accepted" | "declined" | "revoked";
  invitedByUid: string;
  createdAt: string;
};
export const TEAM_TIERS = ["business", "enterprise"];
export const canHaveTeam = (tier?: string) => !!tier && TEAM_TIERS.includes(tier);
// null = no fixed limit (Enterprise, agreed per account)
export const seatLimit = (tier?: string): number | null => (tier === "enterprise" ? null : tier === "business" ? ORG_SEATS.business : 1);
