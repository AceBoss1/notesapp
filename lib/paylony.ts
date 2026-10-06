import { timingSafeEqual } from "crypto";

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

// Paylony sends the webhook key as the Bearer token on every webhook.
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
