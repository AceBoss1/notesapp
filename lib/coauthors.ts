import { heldPercent, type InviteAccess, type InviteAgreementFields } from "./invite-terms";

// Co-authoring. The lead author invites other members to a DRAFT post and
// proposes each person's share of that post's earnings (percentages, lead keeps
// the rest) and their access to the draft (lib/invite-terms.ts: "view" reads it,
// "edit" also edits its title and text through /api/coauthors/draft). A co-author
// must accept (and agree to the terms) before they're listed. Once the post is
// published nothing can change (invites/accepts only work on drafts, and
// firestore.rules stops clients writing coAuthors/coAuthorUids).
//
// The agreed split lives in private coAuthorInvites/{noteId}_{inviteeUid}
// (accepted ones) — not on the public note. Ad-share and per-post gift payouts
// will read it when they are built; today gifts on a post still go to the lead.
export const MAX_CO_AUTHORS = 4;
export const MIN_CO_PERCENT = 5; // each contributing (edit) co-author's minimum share
export const MIN_VIEW_PERCENT = 0; // a view-only reviewer may be credited without a share
export const minPercentFor = (access: InviteAccess) => (access === "view" ? MIN_VIEW_PERCENT : MIN_CO_PERCENT);
export const MIN_LEAD_PERCENT = 10; // the lead always keeps at least this

export type InviteStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export type CoAuthorInvite = InviteAgreementFields & {
  noteId: string;
  noteTitle: string;
  leadUid: string;
  leadName: string;
  leadUsername: string;
  inviteeUid: string;
  inviteeUsername: string;
  inviteeName: string;
  percent: number; // the invitee's share of the post's earnings
  status: InviteStatus;
  createdAt: string;
  respondedAt?: string;
};

export const inviteId = (noteId: string, inviteeUid: string) => `${noteId}_${inviteeUid}`;

// Lead's remaining share given the live (pending + accepted) invites (a proposed change counts at the larger share).
export function leadPercent(invites: (Pick<CoAuthorInvite, "percent" | "status"> & Pick<InviteAgreementFields, "change">)[]): number {
  return 100 - invites.filter((i) => i.status === "pending" || i.status === "accepted").reduce((s, i) => s + heldPercent(i), 0);
}

// Who may LEAD a co-authored post (invite co-authors, set the split): Pro,
// Business and Enterprise publishers, and admins.
export function canLeadCoAuthors(p: { accountTier?: string; role?: string } | null | undefined): boolean {
  return !!p && (p.role === "admin" || p.accountTier === "pro" || p.accountTier === "business" || p.accountTier === "enterprise");
}

// Anyone can be INVITED, but accepting needs a publishing account (Free Basic
// or above, or staff/volunteer) because the share is paid out to a publisher.
export function canAcceptCoAuthor(p: { accountTier?: string; role?: string } | null | undefined): boolean {
  return !!p && (p.role !== "reader" || p.accountTier !== "standard");
}
