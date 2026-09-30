// Badge levels:
//   verified — the maroon ✔: an internal role, Business/Enterprise, or the
//              paid ₦999/month add-on (account in good standing; NOT an
//              identity check).
//   gold     — the gold ✔: identity checked by #NotesApp, or endorsed by
//              #NotesApp. COMING SOON: the data model, admin grant and
//              rendering are built, but nothing gold shows publicly (and
//              public copy says "coming soon") until this flag is true.
//              Flip it when the application/review flow is ready.
export const GOLD_BADGE_LIVE = false;

export type BadgeLevel = "gold" | "verified" | null;

export type GoldBadgeKind = "identity" | "endorsement";
export const GOLD_KIND_LABEL: Record<GoldBadgeKind, string> = {
  identity: "Identity checked",
  endorsement: "Endorsed by #NotesApp",
};
