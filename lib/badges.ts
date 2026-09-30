// Badge levels:
//   verified — the maroon ✔: an internal role, Business/Enterprise, or the
//              paid ₦999/month add-on (account in good standing; NOT an
//              identity check).
//   gold     — the gold ✔: identity checked by #NotesApp, or endorsed by
//              #NotesApp. COMING SOON: the data model, admin grant and
//              rendering are built, but nothing gold shows publicly (and
//              public copy says "coming soon") until this flag is true.
//              Flip it when the application/review flow is ready.
//
// Launch plan: endorsement is LIVE (manual admin review, no ID documents held
// by us). Identity checks stay "coming soon" until a KYC vendor is added
// once review volume justifies it.
export const GOLD_BADGE_LIVE = true; // any gold badge can render at all
export const GOLD_KIND_LIVE: Record<"identity" | "endorsement", boolean> = {
  endorsement: true,
  identity: false,
};

export type BadgeLevel = "gold" | "verified" | null;

export type GoldBadgeKind = "identity" | "endorsement";
export const GOLD_KIND_LABEL: Record<GoldBadgeKind, string> = {
  identity: "Identity checked",
  endorsement: "Endorsed by #NotesApp",
};
