import { createHmac, timingSafeEqual } from "crypto";
import { setting } from "@/lib/config";

// Server-only. Stripe for NotesApp Inc: readers paying in USD, GBP, EUR or CAD (lib/currency.ts). Plain fetch against the Stripe API
// (form-encoded), so no SDK. The secret key never reaches the browser.
const API = "https://api.stripe.com/v1";

function secret(): string {
  const key = setting("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set. See docs/ENVIRONMENT.md.");
  return key;
}
export const stripeConfigured = () => !!setting("STRIPE_SECRET_KEY");

// Stripe's form encoding: nested objects as a[b][c]=v.
export function formEncode(o: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") parts.push(formEncode(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

async function stripe<T>(path: string, init?: { method?: string; form?: Record<string, unknown>; idempotencyKey?: string }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? (init?.form ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${secret()}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init?.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    ...(init?.form ? { body: formEncode(init.form) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Stripe request failed (${res.status})`);
  return json as T;
}

export type StripeSession = { id: string; url: string | null; payment_status: "paid" | "unpaid" | "no_payment_required"; amount_total: number | null; currency: string | null; client_reference_id: string | null; payment_intent: string | null };

// One month's subscription, paid once (the reader renews; lib/global-pay.ts). Stripe's currency codes are lower case.
export function createCheckoutSession(p: { reference: string; email: string; currency: string; amountMinor: number; name: string; successUrl: string; cancelUrl: string }) {
  return stripe<StripeSession>("/checkout/sessions", {
    idempotencyKey: p.reference,
    form: {
      mode: "payment",
      client_reference_id: p.reference,
      customer_email: p.email,
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
      line_items: { 0: { quantity: 1, price_data: { currency: p.currency.toLowerCase(), unit_amount: p.amountMinor, product_data: { name: p.name } } } },
      metadata: { reference: p.reference },
      payment_intent_data: { metadata: { reference: p.reference } },
    },
  });
}

export const getCheckoutSession = (id: string) => stripe<StripeSession>(`/checkout/sessions/${encodeURIComponent(id)}`);

export function refundPaymentIntent(paymentIntent: string, reference: string) {
  return stripe<{ id: string; status: string }>("/refunds", { idempotencyKey: `refund_${reference}`, form: { payment_intent: paymentIntent } });
}

// Stripe-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">. Refused when more than 5 minutes old.
export function isValidStripeSignature(rawBody: string, header: string | null, secretKey = setting("STRIPE_WEBHOOK_SECRET"), now = Date.now()): boolean {
  if (!header || !secretKey) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) return false;
  const expected = Buffer.from(createHmac("sha256", secretKey).update(`${t}.${rawBody}`).digest("hex"));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === expected.length && timingSafeEqual(b, expected); });
}
