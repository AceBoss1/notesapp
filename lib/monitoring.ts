import { createHash } from "crypto";
import { getAdminDb } from "./firebase-admin";
import { sendEmail } from "./email";

// Built-in error monitoring (no third-party account needed). Unexpected server errors and browser
// errors are grouped by a fingerprint into `errorLogs/{fingerprint}` (server-only, expires after
// 30 days — add a Firestore TTL policy on `expireAt`; it is declared in firestore.indexes.json),
// shown on /admin/errors, and the FIRST sighting of each new error emails SUPPORT_EMAIL.
// Never store personal data here: emails, tokens and long ids are scrubbed from every message.
export type ErrorContext = { source: "server" | "client"; route?: string; url?: string };

const KEEP_DAYS = 30;
const MAX_ALERTS_PER_HOUR = 10;
let alertWindow = { start: 0, count: 0 };

// Deliberate, user-facing messages ("Sign in first", "Missing details") are not faults. Real faults
// are JS runtime errors, SDK/network errors and backend status codes.
const FAULT_NAMES = ["TypeError", "ReferenceError", "RangeError", "SyntaxError", "EvalError", "URIError"];
const FAULT_MESSAGE = /ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|PERMISSION_DENIED|UNAVAILABLE|DEADLINE_EXCEEDED|INTERNAL|UNKNOWN: |Cannot read|is not a function|is not defined|undefined|Unexpected token|invalid_grant|Request failed with status|Paystack|Transfer|R2 is not|S3|ServiceUnavailable/i;
const EXPECTED_CAPACITY = /RESOURCE_EXHAUSTED|quota/i; // Firestore free-tier limits are reported on /status, not as bugs

export function isUnexpected(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  if (EXPECTED_CAPACITY.test(msg)) return false;
  if (err instanceof Error && FAULT_NAMES.includes(err.name)) return true;
  if (typeof (err as { code?: unknown })?.code === "string" && /^(\d+|[A-Z_]{4,}|ECONN\w*)$/.test((err as { code: string }).code)) return true;
  return FAULT_MESSAGE.test(msg);
}

export function scrub(text: string, max: number): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(?:sk|pk)_(?:live|test)_\w+/g, "[key]")
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer [token]")
    .replace(/[A-Za-z0-9_-]{28,}/g, "[id]")
    .slice(0, max);
}

// Same error, same fingerprint: digits and ids are normalised so "order 123 failed" groups with "order 456 failed".
export function fingerprint(message: string, stackTop: string, route: string): string {
  const norm = message.replace(/\d+/g, "N").replace(/\[id\]/g, "ID").slice(0, 160);
  return createHash("sha1").update(`${route}|${norm}|${stackTop.replace(/:\d+:\d+/g, "")}`).digest("hex").slice(0, 20);
}

export async function reportError(err: unknown, ctx: ErrorContext): Promise<void> {
  try {
    const raw = err instanceof Error ? err : new Error(String(err));
    const message = scrub(raw.message || raw.name || "Unknown error", 300);
    const stack = scrub(String(raw.stack || ""), 800);
    const stackTop = (stack.split("\n").find((l) => /\bat\b|@/.test(l)) || "").trim().slice(0, 200);
    const route = scrub(ctx.route || "", 120);
    const id = fingerprint(message, stackTop, route);
    const ref = getAdminDb().doc(`errorLogs/${id}`);
    const now = new Date().toISOString();
    const expireAt = new Date(Date.now() + KEEP_DAYS * 86_400_000);
    const snap = await ref.get();
    if (snap.exists) {
      const { FieldValue } = await import("firebase-admin/firestore");
      await ref.update({ count: FieldValue.increment(1), lastSeenAt: now, expireAt, ...(ctx.url ? { lastUrl: scrub(ctx.url, 200) } : {}) });
      return;
    }
    await ref.set({ message, stackTop, stack, route, source: ctx.source, count: 1, firstSeenAt: now, lastSeenAt: now, ...(ctx.url ? { lastUrl: scrub(ctx.url, 200) } : {}), expireAt });
    // One email per new error, capped so a failure storm can't flood the inbox.
    const t = Date.now();
    if (t - alertWindow.start > 3_600_000) alertWindow = { start: t, count: 0 };
    if (alertWindow.count++ < MAX_ALERTS_PER_HOUR) {
      await sendEmail({
        to: process.env.SUPPORT_EMAIL || "hello@notesapp.name.ng",
        subject: `New ${ctx.source} error on #NotesApp: ${message.slice(0, 80)}`,
        text: `A new error was seen (${ctx.source}${route ? `, ${route}` : ""}).\n\n${message}\n${stackTop}\n\nDetails and counts: /admin/errors`,
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[monitoring] couldn't record an error", e);
  }
}
