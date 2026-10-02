import { createHmac, timingSafeEqual } from "crypto";

// Dojah webhooks (kyc_widget). Dojah POSTs each event to /api/dojah/webhook and signs it:
//   x-dojah-signature     = HMAC-SHA256(raw body, DOJAH_WEBHOOK_SECRET) as hex  ← we verify this
// (DOJAH_WEBHOOK_SECRET is the per-subscription secret from Dojah's Developers → Webhooks,
//  NOT the API secret key.) We keep only pass/fail summaries — never ID numbers, images or PDFs.

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifyDojahSignature(rawBody: string, header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(header.trim().toLowerCase(), expected);
}

export type DojahVerificationStatus = "Ongoing" | "Pending" | "Completed" | "Failed" | "Abandoned";
export type DojahSummary = {
  verificationStatus: string; // as sent by Dojah
  overall: boolean | null; // top-level `status`
  steps: Record<string, boolean>; // one pass/fail per step the user went through
  unscored: string[]; // steps Dojah sent without a true/false status — shown to the admin, not counted
  missing: string[]; // required parts of this track's check that weren't scored true (so it can't read as passed)
  passed: boolean; // Completed + overall true + every step true — "Completed" alone only means the session finished
  terminal: boolean; // Completed / Failed / Abandoned — Ongoing and Pending mean another event is coming
  receivedAt: string;
};

// The event fields are top-level (no wrapper): reference_id, verification_status, status,
// data{ <step>: { status, message, data } }, metadata.
// What a check must contain before we call it passed. A session where only the email step ran,
// or where the business steps weren't scored, must NOT read as passed — it goes to the admin.
// (Step names seen from Dojah: email, government_data, selfie; the business steps' names are matched loosely.)
const REQUIRED: Record<"personal" | "corporate", string[]> = {
  personal: ["government", "selfie"],
  corporate: ["business", "government", "selfie"],
};

export function summarizeDojahEvent(event: any, track: "personal" | "corporate" = "personal"): DojahSummary {
  const verificationStatus = String(event?.verification_status ?? "");
  const overall = typeof event?.status === "boolean" ? event.status : null;
  const steps: Record<string, boolean> = {};
  const unscored: string[] = [];
  const data = event?.data;
  if (data && typeof data === "object") {
    for (const [name, step] of Object.entries<any>(data)) {
      if (step && typeof step.status === "boolean") steps[name.slice(0, 40)] = step.status;
      else unscored.push(name.slice(0, 40));
    }
  }
  const stepsOk = Object.values(steps).every(Boolean);
  const names = Object.keys(steps).map((n) => n.toLowerCase());
  const missing = REQUIRED[track].filter((part) => !names.some((n) => n.includes(part) && steps[Object.keys(steps).find((k) => k.toLowerCase() === n)!]));
  return {
    verificationStatus,
    overall,
    steps,
    unscored: unscored.slice(0, 20),
    missing,
    passed: verificationStatus === "Completed" && overall === true && stepsOk && missing.length === 0,
    terminal: ["Completed", "Failed", "Abandoned"].includes(verificationStatus),
    receivedAt: new Date().toISOString(),
  };
}

// Sandbox keys talk to Dojah's sandbox host; set DOJAH_API_BASE accordingly (default: production).
export const dojahApiBase = () => (process.env.DOJAH_API_BASE || "https://api.dojah.io").replace(/\/$/, "");
