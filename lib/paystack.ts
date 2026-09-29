import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { getAdminDb } from "./firebase-admin";

// Server-only. Paystack secret key never reaches the browser.
const API = "https://api.paystack.co";

// Amounts are decided HERE, never taken from the client — a browser
// could otherwise send any price it likes.
export const SESSION_PRICE_KOBO = 15_000 * 100; // ₦15,000, 45 min
export const BOOKING_SLOTS = ["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM"];

function secret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set. See README.");
  return key;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json.data as T;
}

export function newReference(): string {
  return `na_${Date.now()}_${randomBytes(6).toString("hex")}`;
}

export function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  return paystack<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      currency: "NGN",
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
}

export function verifyTransaction(reference: string) {
  return paystack<{ status: string; amount: number; currency: string; reference: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
}

export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secret()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bookingId(username: string, date: string, slot: string): string {
  return `${username}_${date}_${slot.replace(/[^0-9A-Za-z]/g, "")}`;
}

export type PaymentRecord = {
  reference: string;
  kind: "booking";
  uid: string;
  email: string;
  amountKobo: number;
  status: "pending" | "paid" | "paid_slot_conflict";
  booking: { username: string; date: string; slot: string };
  createdAt: string;
  paidAt?: string;
};

// Idempotent — called by both the redirect-verify route and the
// webhook, in whichever order they land. Confirms with Paystack
// itself (never trusts the caller), checks the amount matches what we
// recorded server-side, then creates the booking in a transaction.
export async function fulfillPayment(reference: string): Promise<PaymentRecord> {
  const db = getAdminDb();
  const payRef = db.doc(`payments/${reference}`);
  const snap = await payRef.get();
  if (!snap.exists) throw new Error("Unknown payment reference");
  const payment = snap.data() as PaymentRecord;
  if (payment.status !== "pending") return payment;

  const tx = await verifyTransaction(reference);
  if (tx.status !== "success") throw new Error(`Payment not successful (${tx.status})`);
  if (tx.amount !== payment.amountKobo || tx.currency !== "NGN") {
    throw new Error("Paid amount does not match the booking price");
  }

  const { username, date, slot } = payment.booking;
  const bRef = db.doc(`bookings/${bookingId(username, date, slot)}`);
  const now = new Date().toISOString();

  return db.runTransaction(async (t) => {
    const [freshPay, existing] = await Promise.all([t.get(payRef), t.get(bRef)]);
    const current = freshPay.data() as PaymentRecord;
    if (current.status !== "pending") return current;

    if (existing.exists && existing.data()?.reference !== reference) {
      // Someone else's payment claimed this slot first. Money is
      // taken, so flag it for a manual refund rather than lose it.
      const updated = { ...current, status: "paid_slot_conflict" as const, paidAt: now };
      t.update(payRef, { status: updated.status, paidAt: now });
      return updated;
    }
    t.set(bRef, {
      username,
      date,
      slot,
      clientUid: current.uid,
      clientEmail: current.email,
      reference,
      amountKobo: current.amountKobo,
      status: "confirmed",
      createdAt: now,
    });
    const updated = { ...current, status: "paid" as const, paidAt: now };
    t.update(payRef, { status: updated.status, paidAt: now });
    return updated;
  });
}
