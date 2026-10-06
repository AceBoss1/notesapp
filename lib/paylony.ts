import { createHmac, timingSafeEqual } from "crypto";

// Server-only. Paylony (api.paylony.com): virtual accounts and bank payouts are being added behind this client; Paystack stays
// the main provider for everything else. Keys (never in code):
//   PAYLONY_SECRET_KEY      sk_test_… or sk_live_… — Bearer token for every request (dashboard → API credentials)
//   PAYLONY_WEBHOOK_KEY     the key Paylony sends as the Bearer token on its webhooks to us
//   PAYLONY_ENCRYPTION_KEY  signs payout requests (HMAC-512 over the alphabetically arranged parameters, sent as `Signature`)
// Built from the public API pages we have; the payout and reserved-account endpoints are not in here yet.
export const PAYLONY_API = "https://api.paylony.com/api/v1";
export const paylonyConfigured = () => !!process.env.PAYLONY_SECRET_KEY;
export const paylonyMode = (): "test" | "live" | "unset" => {
  const k = process.env.PAYLONY_SECRET_KEY || "";
  return k.startsWith("sk_live_") ? "live" : k.startsWith("sk_test_") ? "test" : "unset";
};

// Paylony's status codes (the `status` field of responses and webhooks). "00" is success.
export const PAYLONY_CODES: Record<string, string> = {
  "00": "success", "01": "Account Not Found", "02": "Receiving Account Not Found", "03": "Unable to process transaction",
  "04": "Reference Not Found", "05": "Transaction Not Found", "06": "Webhook URL Not Set", "07": "Incomplete request",
  "09": "Transaction already exist", "10": "Insufficient Business Wallet Balance", "11": "Out of Service", "12": "Not Found",
  "13": "Bank Transfer Access Denied", "14": "Collection Access Denied", "15": "Default Pin can't be used",
  "16": "Incorrect Transaction Pin", "17": "Only available in live environment", "18": "Unauthorized Access",
  "19": "Invalid Merchant Authorization", "20": "Your Business is blocked", "21": "Your business is not active",
  "22": "Invalid Signature", "23": "Business Wallet not found", "24": "Invalid Amount value",
  "25": "Amount Exceed Transfer Limit allowed per Transaction", "96": "refunded", "98": "unknown",
  "99": "Possible Duplicate Transaction", "100": "An error Occurred",
};
export const paylonyCodeText = (code: unknown) => PAYLONY_CODES[String(code)] ?? `code ${String(code)}`;

export type PaylonyReply = { ok: boolean; httpStatus: number; body: unknown };

async function call(path: string, init?: RequestInit): Promise<PaylonyReply> {
  const key = process.env.PAYLONY_SECRET_KEY;
  if (!key) throw new Error("PAYLONY_SECRET_KEY is not set.");
  const res = await fetch(`${PAYLONY_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* not JSON: keep the text */ }
  return { ok: res.ok, httpStatus: res.status, body };
}

// GET /wallet_balance — the business wallet that payouts are paid from.
export const walletBalance = () => call("/wallet_balance");

// GET /fetch_transfer_details/{reference} — the status of a payout we sent.
export const fetchTransfer = (reference: string) => call(`/fetch_transfer_details/${encodeURIComponent(reference)}`);

// GET /bank_list — Paylony's own bank codes (six digits, e.g. 000013), which are not Paystack's.
export const bankList = () => call("/bank_list");

// POST /account_name { bank_code, account_number } — the account holder's name.
export const accountName = (bankCode: string, accountNumber: string) => call("/account_name", { method: "POST", body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber }) });

// POST /create_checkout_account — a one-time virtual account for one payment of a set amount, valid once and until it expires.
export type CheckoutAccountInput = { name: string; email: string; amount: string; reference: string; phone: string; title?: string; description?: string };
export const createCheckoutAccount = (i: CheckoutAccountInput) => call("/create_checkout_account", { method: "POST", body: JSON.stringify({ currency: "NGN", ...i }) });

// GET /transaction_verify/{trx} — confirm a collection before crediting anything for it.
export const verifyTransaction = (trx: string) => call(`/transaction_verify/${encodeURIComponent(trx)}`);

// ---- Payouts (POST /bank_transfer) ----
// Every payout is signed: the payload parameters arranged alphabetically, then HMAC-SHA512 with PAYLONY_ENCRYPTION_KEY, sent in
// the `Signature` header. Paylony's page doesn't say how the arranged parameters are joined before hashing, so there are a few
// candidate formats and the admin "Signature test" finds the one Paylony accepts (with a test key, where no money moves) and saves it.
export type SignFormat = "values" | "query" | "json" | "pairs";
export const SIGN_FORMATS: SignFormat[] = ["values", "query", "json", "pairs"];
export type PayoutPayload = { account_number: string; amount: string; bank_code: string; narration: string; reference: string; sender_name: string };

export function signingText(payload: Record<string, string>, format: SignFormat): string {
  const keys = Object.keys(payload).sort();
  if (format === "values") return keys.map((k) => payload[k]).join("");
  if (format === "query") return keys.map((k) => `${k}=${payload[k]}`).join("&");
  if (format === "pairs") return keys.map((k) => `${k}${payload[k]}`).join("");
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, payload[k]])));
}

export function signPayout(payload: Record<string, string>, format: SignFormat): string {
  const key = process.env.PAYLONY_ENCRYPTION_KEY;
  if (!key) throw new Error("PAYLONY_ENCRYPTION_KEY is not set.");
  return createHmac("sha512", key).update(signingText(payload, format)).digest("hex");
}

export const bankTransfer = (payload: PayoutPayload, format: SignFormat) =>
  call("/bank_transfer", { method: "POST", body: JSON.stringify(payload), headers: { Signature: signPayout(payload, format) } });

// The status code inside a reply ("00" success, "22" invalid signature …), when it has one.
export function replyCode(r: PaylonyReply): string {
  const b = r.body as { status?: unknown } | null;
  return b && typeof b === "object" && b.status !== undefined ? String(b.status) : "";
}

// Paylony's webhook key is sent as the Bearer token on every webhook.
export function webhookAuthorised(authorization: string | null): boolean {
  const key = process.env.PAYLONY_WEBHOOK_KEY;
  if (!key || !authorization) return false;
  const given = Buffer.from(authorization.replace(/^Bearer\s+/i, "").trim());
  const want = Buffer.from(key);
  return given.length === want.length && timingSafeEqual(given, want);
}

export type PaylonyWebhook = {
  status?: string;
  event?: string; // "collection" (money in to a reserved account) or "payout" (a transfer we sent changed state)
  currency?: string;
  amount?: string | number;
  fee?: string | number;
  trx?: string;
  reference?: string;
  [k: string]: unknown;
};

// What the admin page shows about the connection. Never includes a key.
export async function paylonyDiagnostics() {
  const out = {
    configured: paylonyConfigured(), mode: paylonyMode(), webhookKeySet: !!process.env.PAYLONY_WEBHOOK_KEY,
    encryptionKeySet: !!process.env.PAYLONY_ENCRYPTION_KEY, ok: false, httpStatus: 0, summary: "", body: "",
  };
  if (!out.configured) {
    out.summary = "PAYLONY_SECRET_KEY isn't set on the server.";
    return out;
  }
  try {
    const r = await walletBalance();
    out.ok = r.ok;
    out.httpStatus = r.httpStatus;
    const b = r.body as { status?: unknown; message?: unknown } | string;
    out.body = (typeof b === "string" ? b : JSON.stringify(b, null, 2)).slice(0, 1200);
    out.summary = r.ok ? "Connected: the wallet balance request worked." : typeof b === "object" && b && "status" in b ? paylonyCodeText(b.status) : "Paylony refused the request.";
  } catch (e) {
    out.summary = e instanceof Error ? e.message : "The request failed.";
  }
  return out;
}
