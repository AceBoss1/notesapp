import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { hasAnyDept, type Access } from "./admin-access";
import { REVEALS, isRevealKind, maskEmail, revealReason, type RevealKind, type ViewLogEntry } from "./pii";

// The server side of masking (lib/pii.ts): reads one real value from an allowed source, and logs who looked at it and why.
// adminViewLog is server-only (firestore.rules); Admin → View log reads it through /api/admin/reveal.

export class RevealError extends Error { constructor(readonly status: number, message: string) { super(message); } }

type Reader = (db: Firestore, subject: string) => Promise<string>;
const field = (path: (s: string) => string, pick: (d: Record<string, unknown>) => unknown): Reader =>
  async (db, subject) => String(pick((await db.doc(path(subject)).get()).data() ?? {}) ?? "");
const READERS: Record<RevealKind, Reader> = {
  "member-email": async (_db, uid) => (await getAuth(getAdminApp()).getUser(uid).catch(() => null))?.email ?? "",
  "payment-email": field((s) => `payments/${s}`, (d) => d.email),
  "order-email": field((s) => `merchOrders/${s}`, (d) => d.email),
  "order-phone": field((s) => `merchOrders/${s}`, (d) => (d.address as { phone?: unknown } | undefined)?.phone),
  "lead-email": field((s) => `leads/${s}`, (d) => d.email),
};

export type Viewer = { uid: string; name: string; access: Access };
export type RevealInput = { kind?: unknown; subject?: unknown; reason?: unknown; note?: unknown; page?: unknown };

export async function reveal(db: Firestore, who: Viewer, input: RevealInput, now = new Date()): Promise<{ value: string }> {
  const { kind, subject } = input;
  if (!isRevealKind(kind)) throw new RevealError(400, "Unknown detail.");
  if (typeof subject !== "string" || !/^[\w.:@-]{1,128}$/.test(subject)) throw new RevealError(400, "Whose detail?");
  if (!hasAnyDept(who.access, REVEALS[kind].depts)) throw new RevealError(403, "Your role doesn't include this detail.");
  const reason = revealReason(input.reason, input.note);
  if (!reason) throw new RevealError(400, "Say why you need it (for Other, add a few words).");
  const value = await READERS[kind](db, subject);
  if (!value) throw new RevealError(404, "There's nothing on record to show.");
  await db.collection("adminViewLog").add({
    at: Timestamp.fromDate(now), adminUid: who.uid, adminName: who.name, kind, subject, reason,
    page: typeof input.page === "string" ? input.page.slice(0, 80) : "",
  });
  return { value };
}

// Newest first; by one member (subject) or one staff member (adminUid) when asked.
export async function viewLog(db: Firestore, opts: { subject?: string; adminUid?: string; limit?: number } = {}): Promise<ViewLogEntry[]> {
  let q = db.collection("adminViewLog").orderBy("at", "desc");
  if (opts.subject) q = db.collection("adminViewLog").where("subject", "==", opts.subject).orderBy("at", "desc");
  else if (opts.adminUid) q = db.collection("adminViewLog").where("adminUid", "==", opts.adminUid).orderBy("at", "desc");
  const s = await q.limit(Math.min(opts.limit ?? 200, 500)).get();
  return s.docs.map((d) => {
    const v = d.data();
    const kind = isRevealKind(v.kind) ? v.kind : "member-email";
    return { id: d.id, at: (v.at as Timestamp).toDate().toISOString(), adminUid: String(v.adminUid ?? ""), adminName: String(v.adminName ?? ""), kind, label: REVEALS[kind].label, subject: String(v.subject ?? ""), reason: String(v.reason ?? ""), page: String(v.page ?? "") };
  });
}

// For lists: every email masked, so the real ones never reach the browser.
export const maskEmails = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, maskEmail(v)]));
