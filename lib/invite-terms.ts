// What an invited co-author (journal) or co-tutor (course) may do, in plain words, and the terms they agree to when they accept.
// Shared by the server (lib/coauthors-server.ts, lib/courses-server.ts), the accept screen (/invites/<kind>/<id>), the lead's panels
// and the help articles, so the rules are written down once.
//
// Two access levels, chosen by the lead when inviting (contributing always includes seeing, so "both" is simply the higher level):
//   "view": Can view. A read-only preview of the unpublished journal or course, to review it and send comments to the lead.
//   "edit": Can view and edit. Journals: edit the draft's title and text. Courses: edit the course's details, About, modules and lessons.
// The lead always keeps publishing, the price, the split, the invitations and deleting. A legacy invite with no access field keeps the
// behaviour it had when it was sent: a journal co-author was credited and paid but never saw the draft ("credit"); a co-tutor could
// already edit the course's content ("edit").
export type InviteKind = "journal" | "course";
export type InviteAccess = "view" | "edit";
export type EffectiveAccess = InviteAccess | "credit";
export const INVITE_ACCESS: InviteAccess[] = ["view", "edit"];
// Bump when the wording of the terms changes: every agreement records the version the member saw.
export const INVITE_TERMS_VERSION = "2026-11-01.1";

export const isInviteAccess = (v: unknown): v is InviteAccess => v === "view" || v === "edit";
export const accessOf = (kind: InviteKind, inv: { access?: unknown }): EffectiveAccess =>
  isInviteAccess(inv.access) ? inv.access : kind === "journal" ? "credit" : "edit";
export const accessRank = (a: EffectiveAccess) => (a === "edit" ? 2 : a === "view" ? 1 : 0);

// A change the lead proposed to an accepted invite (more access, or a different share) that waits for the member to agree.
// Until they do, the terms they already agreed to stay in force.
export type PendingChange = { access: InviteAccess; percent: number; proposedAt: string };
// What the member agreed to, snapshotted on the invite when they accept (and again when they agree to a change).
export type AgreedTerms = {
  kind: InviteKind; title: string; leadName: string; access: EffectiveAccess; percent: number; termsVersion: string;
};
// Fields every invite may carry on top of its own (both kinds are written by the server only).
export type InviteAgreementFields = {
  access?: InviteAccess; change?: PendingChange | null; agreedAt?: string; agreedTerms?: AgreedTerms;
};

const ROLE = { journal: "co-author", course: "co-tutor" } as const;
export const roleOf = (kind: InviteKind) => ROLE[kind];
export const accessLabel = (a: EffectiveAccess) => (a === "edit" ? "Can view and edit" : a === "view" ? "Can view" : "Credit only");

// What the access lets the member do, and not do, in plain words.
export function accessTerms(kind: InviteKind, a: EffectiveAccess): { label: string; summary: string; can: string[]; cannot: string[] } {
  const thing = kind === "journal" ? "journal" : "course";
  const label = accessLabel(a);
  if (kind === "journal") {
    const can = a === "edit"
      ? ["Read the draft before it's published", "Edit the draft's title and text; your changes save straight into it"]
      : a === "view" ? ["Read the draft before it's published (read-only), to review it and send the lead your comments"] : [];
    const cannot = [
      ...(a === "edit" ? [] : a === "view" ? ["Edit the draft"] : ["See or edit the draft before it's published"]),
      "Publish it, delete it or change its address", "Change the earnings split or invite other co-authors",
      "Change anything once it's published (the post and its split are then locked)",
    ];
    return { label, summary: a === "edit" ? "You can read and edit the draft." : a === "view" ? "You can read the draft, but not edit it." : `You're credited and paid, but don't see the ${thing} before it's published.`, can, cannot };
  }
  const can = a === "edit"
    ? ["See the course and every lesson, draft or published", "Edit the course's details, About and modules", "Add, edit, reorder and delete lessons and quizzes"]
    : ["See the course and every lesson, draft or published (read-only), to review it and send the lead your comments"];
  const cannot = [
    ...(a === "edit" ? [] : ["Edit the course or its lessons"]),
    "Publish, unpublish or delete the course", "Set the price or the certificate", "Change the shares or invite other co-tutors",
  ];
  return { label, summary: a === "edit" ? "You can see and edit the course and its lessons." : "You can see the course and its lessons, but not edit them.", can, cannot };
}

// How the share is paid, in plain words.
export function shareTerms(kind: InviteKind, percent: number): string {
  if (!percent) return kind === "journal" ? "No share of the earnings: you're credited as a co-author." : "No share of the sales: you're credited as a co-tutor.";
  return kind === "journal"
    ? `${percent}% of what the post earns: gifts on the post today, and the ad share once ad-share payouts launch. Each portion is paid to your publishing account like any gift, less your own plan's commission.`
    : `${percent}% of each sale of the course, paid to your bank 7 days after the sale like the lead's share, less your own plan's commission. A refunded sale is refunded from every share.`;
}

// The terms in a few lines: shown above Accept and agree ("By accepting you agree to these terms: …") and kept with the agreement.
export function termsLines(kind: InviteKind, t: { title: string; leadName: string; access: EffectiveAccess; percent: number }): string[] {
  const role = roleOf(kind);
  return [
    `You join "${t.title}" as a ${role}, invited by ${t.leadName}.`,
    `Access: ${accessLabel(t.access)}. ${accessTerms(kind, t.access).summary}`,
    `Share: ${shareTerms(kind, t.percent)}`,
    kind === "journal"
      ? "Credit: you're listed as a co-author on the post and your profile once it's published."
      : "Credit: you're listed as a co-tutor on the course page while you're on the course.",
    kind === "journal"
      ? `${t.leadName} keeps publishing control, the split and the invitations. The split locks when the post is published.`
      : `${t.leadName} keeps publishing control, the price, the shares and the invitations.`,
    kind === "journal"
      ? "You can leave any time before the post is published: the lead's panel and your invites page both show it, and leaving removes your credit and share."
      : "You can leave any time with Leave on the course's Tutors section; your credit and share of later sales end then.",
  ];
}

export const helpHref = (kind: InviteKind) => (kind === "journal" ? "/help/co-authoring" : "/help/co-teaching");
export const invitePath = (kind: InviteKind, id: string) => `/invites/${kind}/${id}`;
// The percent an invite holds against the lead's share: the larger of what's agreed and what's proposed, so a change can't push the
// lead under their minimum whichever way the member answers.
export const heldPercent = (i: { percent: number; change?: PendingChange | null }) => Math.max(i.percent, i.change?.percent ?? 0);
