import { timingSafeEqual } from "crypto";
import { setting } from "@/lib/config";

// Server-only. Flutterwave for NotesApp Technologies Ltd: readers paying in African currencies other than the naira (lib/currency.ts),
// and publishers paid in them. API v3. The secret key never reaches the browser.
const API = "https://api.flutterwave.com/v3";

function secret(): string {
  const key = setting("FLUTTERWAVE_SECRET_KEY");
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not set. See docs/ENVIRONMENT.md.");
  return key;
}
export const flutterwaveConfigured = () => !!setting("FLUTTERWAVE_SECRET_KEY");

async function flw<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status !== "success") throw new Error(json.message || `Flutterwave request failed (${res.status})`);
  return json.data as T;
}

// Flutterwave amounts are in major units (KES 650.00 is 650).
export function createPayment(p: { reference: string; email: string; name: string; currency: string; amountMajor: number; redirectUrl: string; title: string }) {
  return flw<{ link: string }>("/payments", {
    tx_ref: p.reference,
    amount: p.amountMajor,
    currency: p.currency,
    redirect_url: p.redirectUrl,
    customer: { email: p.email, name: p.name },
    customizations: { title: "#NotesApp", description: p.title },
    meta: { reference: p.reference },
  });
}

export type FlwTx = { id: number; tx_ref: string; status: string; amount: number; charged_amount: number; currency: string };
export const verifyByReference = (reference: string) => flw<FlwTx>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);

// A publisher's payout in their currency: a bank account, or mobile money (account_bank is the network's code, e.g. MPS for M-Pesa).
export function createTransfer(p: { reference: string; currency: string; amountMajor: number; accountBank: string; accountNumber: string; beneficiaryName: string; narration: string }) {
  return flw<{ id: number; status: string }>("/transfers", {
    account_bank: p.accountBank,
    account_number: p.accountNumber,
    amount: p.amountMajor,
    currency: p.currency,
    beneficiary_name: p.beneficiaryName,
    narration: p.narration.slice(0, 80),
    reference: p.reference,
    debit_currency: p.currency,
  });
}

export function refundTransaction(id: number) {
  return flw<{ status: string }>(`/transactions/${id}/refund`, {});
}

// Flutterwave sends the secret hash we set on its dashboard in the verif-hash header.
export function isValidFlutterwaveHash(header: string | null, expected = setting("FLUTTERWAVE_WEBHOOK_HASH")): boolean {
  if (!header || !expected) return false;
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
