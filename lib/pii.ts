import type { Dept } from "./admin-access";

// Members' contact details in admin pages (v0.91.0). Staff see a masked email or phone; "Show" asks why, the server returns the
// real value (/api/admin/reveal, lib/pii-server.ts) and logs the view in adminViewLog: who, when, whose, what and why. Admin →
// View log lists them. Shared by the browser (the Show form) and the server (which decides).

// a•••i@gmail.com: the first and last letter before the @, and the whole domain (which says gmail or a company, not who).
export function maskEmail(email: unknown): string {
  const e = String(email ?? "").trim();
  if (!e) return "";
  const at = e.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = e.slice(0, at);
  return `${local[0]}•••${local.length > 2 ? local[local.length - 1] : ""}@${e.slice(at + 1)}`;
}

// ••• ••• 4567: the last four digits only.
export function maskPhone(phone: unknown): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 4 ? "••••" : `••• ••• ${digits.slice(-4)}`;
}

// A record on its way to an admin page: every email and phone in it (fields named email/…Email, phone/…Phone, at any depth)
// masked, so the real ones never reach the browser.
export function maskContacts<T>(v: T): T {
  if (Array.isArray(v)) return v.map(maskContacts) as T;
  if (!v || typeof v !== "object" || Object.getPrototypeOf(v) !== Object.prototype) return v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k,
    typeof x === "string" && /^(email|.+Email)$/.test(k) ? maskEmail(x)
      : typeof x === "string" && /^(phone|.+Phone)$/.test(k) ? maskPhone(x)
        : maskContacts(x)])) as T;
}

// What can be revealed, where it's read from, and which departments may ask (a super admin always can).
export const REVEALS = {
  "member-email": { label: "member's email", depts: ["support", "moderation", "finance", "legal"] },
  "payment-email": { label: "payer's email", depts: ["finance"] },
  "order-email": { label: "buyer's email", depts: ["finance", "support"] },
  "order-phone": { label: "buyer's phone", depts: ["finance", "support"] },
  "lead-email": { label: "sender's email", depts: ["support", "growth"] },
} as const satisfies Record<string, { label: string; depts: readonly Dept[] }>;
export type RevealKind = keyof typeof REVEALS;
export const isRevealKind = (k: unknown): k is RevealKind => typeof k === "string" && Object.prototype.hasOwnProperty.call(REVEALS, k);

export const REVEAL_REASONS = ["Replying to them", "Payment or refund", "Delivering an order", "Safety or abuse report", "Legal or data request", "Other"] as const;
export type RevealReason = (typeof REVEAL_REASONS)[number];

// The reason as logged: one of the list, with a note (needed for "Other", 5 to 200 characters).
export function revealReason(reason: unknown, note: unknown): string | null {
  if (typeof reason !== "string" || !(REVEAL_REASONS as readonly string[]).includes(reason)) return null;
  const n = typeof note === "string" ? note.trim().slice(0, 200) : "";
  if (reason === "Other" && n.length < 5) return null;
  return n ? `${reason}: ${n}` : reason;
}

export type ViewLogEntry = { id: string; at: string; adminUid: string; adminName: string; kind: RevealKind; label: string; subject: string; reason: string; page: string };
