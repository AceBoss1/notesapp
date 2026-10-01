// Co-authoring. The lead author invites other members to a DRAFT post and
// proposes each person's share of that post's earnings (percentages, lead keeps
// the rest). A co-author must accept before they're listed. Once the post is
// published nothing can change (invites/accepts only work on drafts, and
// firestore.rules stops clients writing coAuthors/coAuthorUids).
//
// The agreed split lives in private coAuthorInvites/{noteId}_{inviteeUid}
// (accepted ones) — not on the public note. Ad-share and per-post gift payouts
// will read it when they are built; today gifts on a post still go to the lead.
export const MAX_CO_AUTHORS = 4;
export const MIN_CO_PERCENT = 5; // each co-author's minimum share
export const MIN_LEAD_PERCENT = 10; // the lead always keeps at least this

export type InviteStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export type CoAuthorInvite = {
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

// Lead's remaining share given the live (pending + accepted) invites.
export function leadPercent(invites: Pick<CoAuthorInvite, "percent" | "status">[]): number {
  return 100 - invites.filter((i) => i.status === "pending" || i.status === "accepted").reduce((s, i) => s + i.percent, 0);
}
