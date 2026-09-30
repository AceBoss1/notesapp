// Bump when the Terms or Privacy Policy change materially — everyone
// then has to accept again before their next payment.
export const LEGAL_VERSION = "2026-09-30";
export const LEGAL_CONTACT = "hello@notesapp.name.ng";

export type Consent = { version: string; acceptedAt: string };
