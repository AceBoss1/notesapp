import { CONTACT_EMAIL } from "@/lib/host";
// Bump when the Terms or Privacy Policy change materially — everyone
// then has to accept again before their next payment.
export const LEGAL_VERSION = "2026-10-09.1";
export const LEGAL_CONTACT = CONTACT_EMAIL;

export type Consent = { version: string; acceptedAt: string };
