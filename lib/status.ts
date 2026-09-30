import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { getAdminDb } from "./firebase-admin";
import { getR2Client, R2_BUCKET } from "./r2";
import { GOLD_KIND_LIVE } from "./badges";

// Server-only service health checks behind /status. Reports only
// up/slow/down + latency — never error details or config.
export type ServiceState = "operational" | "degraded" | "down" | "not_configured";
export type ServiceStatus = { id: string; name: string; description: string; state: ServiceState; latencyMs?: number };

const SLOW_MS = 2500;
const TIMEOUT_MS = 5000;

async function timed(fn: (signal: AbortSignal) => Promise<boolean>): Promise<{ ok: boolean; ms: number }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const ok = await fn(ctl.signal);
    return { ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function toStatus(id: string, name: string, description: string, r: { ok: boolean; ms: number }): ServiceStatus {
  return { id, name, description, state: !r.ok ? "down" : r.ms > SLOW_MS ? "degraded" : "operational", latencyMs: r.ms };
}

const notConfigured = (id: string, name: string, description: string): ServiceStatus => ({ id, name, description, state: "not_configured" });

// Any HTTP response (even 4xx) proves the service is reachable; only 5xx / network failure is "down".
const reachable = (url: string, init?: RequestInit) => async (signal: AbortSignal) => {
  const res = await fetch(url, { ...init, signal, cache: "no-store" });
  return res.status < 500;
};

export async function checkServices(): Promise<ServiceStatus[]> {
  const checks: Promise<ServiceStatus>[] = [];

  checks.push(Promise.resolve({ id: "web", name: "Website & API", description: "Pages, sign-in and API routes", state: "operational" as ServiceState, latencyMs: 0 }));

  checks.push(
    timed(async () => {
      await getAdminDb().collection("settings").limit(1).get();
      return true;
    }).then((r) => toStatus("database", "Database", "Journals, profiles, bookings (Firestore)", r))
  );

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  checks.push(
    apiKey
      ? timed(reachable(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).then((r) =>
          toStatus("auth", "Authentication", "Sign-in, password reset, email verification", r)
        )
      : Promise.resolve(notConfigured("auth", "Authentication", "Sign-in, password reset, email verification"))
  );

  checks.push(
    (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID
      ? timed(async (signal) => {
          await getR2Client().send(new HeadBucketCommand({ Bucket: R2_BUCKET }), { abortSignal: signal });
          return true;
        })
      : Promise.resolve(null)
    ).then((r) => (r ? toStatus("storage", "Media uploads", "Image and avatar uploads (Cloudflare R2)", r) : notConfigured("storage", "Media uploads", "Image and avatar uploads (Cloudflare R2)")))
  );

  const media = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  checks.push(
    media
      ? timed(reachable(media, { method: "HEAD" })).then((r) => toStatus("media", "Media delivery", "Serving uploaded images (media domain)", r))
      : Promise.resolve(notConfigured("media", "Media delivery", "Serving uploaded images (media domain)"))
  );

  const paystack = process.env.PAYSTACK_SECRET_KEY;
  checks.push(
    paystack
      ? timed(async (signal) => {
          const res = await fetch("https://api.paystack.co/bank?perPage=1", { headers: { Authorization: `Bearer ${paystack}` }, signal, cache: "no-store" });
          return res.ok;
        }).then((r) => toStatus("payments", "Payments & payouts", "Paystack checkout, refunds and transfers", r))
      : Promise.resolve(notConfigured("payments", "Payments & payouts", "Paystack checkout, refunds and transfers"))
  );

  const resend = process.env.RESEND_API_KEY;
  checks.push(
    resend
      ? timed(async (signal) => {
          const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${resend}` }, signal, cache: "no-store" });
          return res.status < 500; // a restricted send-only key returns 401 but proves the API is up
        }).then((r) => toStatus("email", "Email", "Booking confirmations and reminders (Resend)", r))
      : Promise.resolve(notConfigured("email", "Email", "Booking confirmations and reminders (Resend)"))
  );

  // Identity checks for the gold badge (Dojah hosted widget) — only once enabled.
  checks.push(
    GOLD_KIND_LIVE.identity
      ? timed(reachable("https://identity.dojah.io", { method: "HEAD" })).then((r) =>
          toStatus("identity", "Identity verification", "Gold badge identity checks (Dojah)", r)
        )
      : Promise.resolve(notConfigured("identity", "Identity verification", "Gold badge identity checks (Dojah)"))
  );

  return Promise.all(checks);
}
