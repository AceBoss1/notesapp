import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { LedgerEntry } from "./payments";

// Server-only. Paystack's "Transfers OTP" (owner, 1 Nov 2026: "Can payments release in admin dashboard have a place for this otp to be
// filled without logging into paystack"). With it on, POST /transfer answers status "otp" and Paystack emails the business a code;
// lib/payouts.ts then marks the ledger entry awaitingOtp (status stays "transferring"). An admin with Finance types the code on
// /admin/payments → POST /api/admin/payouts/otp → finalizePayoutOtp below → POST /transfer/finalize_transfer { transfer_code, otp }.
// From there it is the normal path: transfer.success / transfer.failed / transfer.reversed on /api/paystack/webhook settle it.
//
// The OTP itself is never stored or logged anywhere: not in the ledger, not in payoutOtpLog, not in error messages.
// Tries are capped per OTP (a wrong code counts before Paystack is asked, so parallel guesses can't get round it), and resends per transfer.

export const PAYSTACK_OTP_MINUTES = 30; // what Paystack's email says: "It will expire in 30 minutes"
export const OTP_MAX_TRIES = 5; // per OTP; Resend OTP starts a fresh count
export const OTP_MAX_RESENDS = 5; // per transfer

export class PayoutOtpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type OtpDeps = {
  finalize: (transferCode: string, otp: string) => Promise<{ status: string; transfer_code?: string }>;
  resend: (transferCode: string) => Promise<unknown>;
  emit?: (uid: string, event: "payout.released", data: unknown) => Promise<void>;
};
export type OtpAdmin = { uid: string; name: string };

// Paystack's transfer OTPs are 6 digits. Spaces and dashes typed or pasted with it are dropped.
export function cleanOtp(v: unknown): string {
  const s = String(v ?? "").replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(s)) throw new PayoutOtpError(400, "Type the 6-digit OTP from Paystack's email.");
  return s;
}

export const otpExpiresAt = (sentAt: string) => new Date(new Date(sentAt).getTime() + PAYSTACK_OTP_MINUTES * 60_000).toISOString();

// Paystack's own words, made safe to show: a wrong or expired code reads as such; anything else is passed on, never with the code in it.
export function otpFailureMessage(err: unknown, otp: string): string {
  const raw = (err instanceof Error ? err.message : String(err ?? "")).split(otp).join("******").slice(0, 200);
  if (/expire/i.test(raw)) return "That OTP has expired. Tap Resend OTP and use the code in the new email.";
  if (/otp|invalid|incorrect|wrong/i.test(raw)) return `Paystack didn't accept that OTP${raw ? ` (“${raw}”)` : ""}. Check the newest email from Paystack and try again.`;
  return raw || "Paystack couldn't finalize the transfer. Try again in a minute.";
}

async function audit(db: Firestore, admin: OtpAdmin, e: { reference: string; transferCode: string; action: "finalize" | "resend"; result: string; message?: string }, now: Date) {
  await db.collection("payoutOtpLog").add({ ...e, adminUid: admin.uid, adminName: admin.name, at: now.toISOString() }).catch(() => {});
}

async function waiting(db: Firestore, reference: string): Promise<LedgerEntry> {
  if (typeof reference !== "string" || !reference || reference.includes("/")) throw new PayoutOtpError(400, "Missing reference.");
  const l = (await db.doc(`ledger/${reference}`).get()).data() as LedgerEntry | undefined;
  if (!l) throw new PayoutOtpError(404, "No payout entry for this payment.");
  if (l.status !== "transferring" || l.awaitingOtp !== true || !l.transferCode) throw new PayoutOtpError(409, "This payout isn't waiting for an OTP.");
  return l;
}

export async function finalizePayoutOtp(db: Firestore, admin: OtpAdmin, reference: string, otpRaw: unknown, deps: OtpDeps, now = new Date()): Promise<{ status: string; ledgerStatus: LedgerEntry["status"] }> {
  const otp = cleanOtp(otpRaw);
  const l = await waiting(db, reference);
  const ref = db.doc(`ledger/${reference}`);
  // Count the try first, in a transaction, so two tabs (or a script) can't get more than OTP_MAX_TRIES guesses at one code.
  await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as LedgerEntry;
    if (cur.status !== "transferring" || cur.awaitingOtp !== true) throw new PayoutOtpError(409, "This payout isn't waiting for an OTP.");
    if ((cur.otpTries ?? 0) >= OTP_MAX_TRIES) throw new PayoutOtpError(429, `That's ${OTP_MAX_TRIES} codes tried. Tap Resend OTP for a new one.`);
    t.update(ref, { otpTries: FieldValue.increment(1) });
  });
  let res: { status: string };
  try {
    res = await deps.finalize(l.transferCode!, otp);
  } catch (err) {
    const message = otpFailureMessage(err, otp);
    await audit(db, admin, { reference, transferCode: l.transferCode!, action: "finalize", result: "rejected", message }, now);
    throw new PayoutOtpError(400, message);
  }
  const status = String(res?.status || "pending");
  const confirmed = { otpConfirmedBy: { uid: admin.uid, name: admin.name, at: now.toISOString() }, awaitingOtp: false, otpTries: 0 };
  // Usually "success" (Paystack: "Transfer has been queued"); the webhook confirms it either way, and repeats these same updates.
  const ledgerStatus: LedgerEntry["status"] = status === "success" ? "paid_out" : status === "failed" || status === "reversed" ? "held" : "transferring";
  await ref.update({ ...confirmed, status: ledgerStatus, ...(ledgerStatus === "held" ? { failureReason: `Transfer ${status} after the OTP: see Paystack` } : { failureReason: "" }) });
  await audit(db, admin, { reference, transferCode: l.transferCode!, action: "finalize", result: status }, now);
  if (ledgerStatus !== "held" && deps.emit) await deps.emit(l.publisherUid, "payout.released", { id: reference, kind: l.kind, net_kobo: l.netKobo, transfer_status: status }).catch(() => {});
  return { status, ledgerStatus };
}

export async function resendPayoutOtp(db: Firestore, admin: OtpAdmin, reference: string, deps: OtpDeps, now = new Date()): Promise<{ otpSentAt: string; expiresAt: string }> {
  const l = await waiting(db, reference);
  if ((l.otpResends ?? 0) >= OTP_MAX_RESENDS) throw new PayoutOtpError(429, `Paystack has sent ${OTP_MAX_RESENDS} new codes for this payout already. Finish it in the Paystack dashboard, or wait for the next one.`);
  try {
    await deps.resend(l.transferCode!);
  } catch (err) {
    const message = (err instanceof Error ? err.message : "Paystack couldn't resend the OTP.").slice(0, 200);
    await audit(db, admin, { reference, transferCode: l.transferCode!, action: "resend", result: "failed", message }, now);
    throw new PayoutOtpError(502, message);
  }
  const otpSentAt = now.toISOString();
  await db.doc(`ledger/${reference}`).update({ otpSentAt, otpTries: 0, otpResends: FieldValue.increment(1) });
  await audit(db, admin, { reference, transferCode: l.transferCode!, action: "resend", result: "sent" }, now);
  return { otpSentAt, expiresAt: otpExpiresAt(otpSentAt) };
}

// The whole request, with the admin check passed in (verifyAdminRequest with Finance in the route; a stub in tests).
export async function handlePayoutOtp(
  db: Firestore,
  req: { token: string | undefined; body: unknown },
  deps: OtpDeps & { verify: (token: string | undefined) => Promise<OtpAdmin> },
  now = new Date()
): Promise<{ status: number; json: Record<string, unknown> }> {
  let admin: OtpAdmin;
  try { admin = await deps.verify(req.token); } catch { return { status: 403, json: { error: "Finance only." } }; }
  const b = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  try {
    if (b.action === "finalize") return { status: 200, json: { ok: true, ...(await finalizePayoutOtp(db, admin, String(b.reference ?? ""), b.otp, deps, now)) } };
    if (b.action === "resend") return { status: 200, json: { ok: true, ...(await resendPayoutOtp(db, admin, String(b.reference ?? ""), deps, now)) } };
    return { status: 400, json: { error: "Unknown action." } };
  } catch (err) {
    if (err instanceof PayoutOtpError) return { status: err.status, json: { error: err.message } };
    throw err;
  }
}
