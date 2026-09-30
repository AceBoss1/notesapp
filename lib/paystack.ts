import { createHmac, timingSafeEqual, randomBytes } from "crypto";

// Server-only. Paystack secret key never reaches the browser.
const API = "https://api.paystack.co";

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
  plan?: string;
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
      ...(params.plan ? { plan: params.plan } : {}),
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
}

export type PaystackTx = {
  status: string;
  amount: number;
  currency: string;
  reference: string;
};

export function verifyTransaction(reference: string) {
  return paystack<PaystackTx>(
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

// One lock doc per (publisher, date, slot). Bookings themselves are
// keyed by payment reference so cancelled ones keep their history;
// deleting the lock is what frees the slot again.
export function slotLockId(username: string, date: string, slot: string): string {
  return `${username}_${date}_${slot.replace(/[^0-9]/g, "")}`;
}

export function createPlan(params: { name: string; amountKobo: number; interval?: "monthly" | "annually" }) {
  return paystack<{ plan_code: string }>("/plan", {
    method: "POST",
    body: JSON.stringify({ name: params.name, amount: params.amountKobo, interval: params.interval || "monthly", currency: "NGN" }),
  });
}

export function disableSubscription(code: string, token: string) {
  return paystack<unknown>("/subscription/disable", { method: "POST", body: JSON.stringify({ code, token }) });
}

export function listBanks() {
  return paystack<{ name: string; code: string }[]>("/bank?country=nigeria&perPage=200");
}

export function resolveAccount(accountNumber: string, bankCode: string) {
  return paystack<{ account_name: string; account_number: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  );
}

export function createTransferRecipient(params: { name: string; accountNumber: string; bankCode: string }) {
  return paystack<{ recipient_code: string; details: { bank_name: string } }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });
}

export function initiateTransfer(params: { amountKobo: number; recipient: string; reference: string; reason: string }) {
  return paystack<{ transfer_code: string; status: string }>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipient,
      reference: params.reference,
      reason: params.reason,
    }),
  });
}

// amountKobo omitted = full refund.
export function refundTransaction(reference: string, amountKobo?: number) {
  return paystack<{ status: string }>("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: reference, ...(amountKobo ? { amount: amountKobo } : {}) }),
  });
}
