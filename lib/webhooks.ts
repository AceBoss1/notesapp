import { createHmac, randomBytes } from "crypto";
import { lookup } from "dns/promises";
import { getAdminDb } from "./firebase-admin";

// Outbound webhooks for Enterprise API accounts. Endpoints live in `webhookEndpoints` (server-only, the signing
// secret included) and every attempt is logged in `webhookDeliveries` (30-day TTL on `expireAt`).
// Each POST is signed: header `NotesApp-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`.
export const WEBHOOK_EVENTS = ["booking.created", "order.paid", "digital.sold", "payout.released", "post.published"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookEndpoint = { uid: string; url: string; events: WebhookEvent[]; secret: string; active: boolean; createdAt: string };

export const newWebhookSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;

export function signPayload(secret: string, body: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip.startsWith("::ffff:127.") || ip === "::";
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

// Webhook targets must be public HTTPS addresses, so a customer can't aim our servers at internal services.
export async function checkWebhookUrl(raw: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return "Enter a full URL, like https://example.com/hooks/notesapp."; }
  if (u.protocol !== "https:") return "Webhook URLs must start with https://.";
  if (u.username || u.password) return "Don't put credentials in the URL.";
  if (u.port && u.port !== "443") return "Only the standard HTTPS port is allowed.";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":")) return "Use a public domain name, not an IP address or local host.";
  try {
    const addrs = await lookup(h, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return "That address isn't publicly reachable.";
  } catch {
    return "We couldn't resolve that domain.";
  }
  return null;
}

export async function deliverWebhook(endpointId: string, ep: WebhookEndpoint, event: WebhookEvent | "test", data: unknown): Promise<{ ok: boolean; status: number | null }> {
  const db = getAdminDb();
  const body = JSON.stringify({ id: `evt_${randomBytes(8).toString("hex")}`, type: event, created: Math.floor(Date.now() / 1000), data });
  const started = Date.now();
  let status: number | null = null;
  let error = "";
  const blocked = await checkWebhookUrl(ep.url);
  if (blocked) error = blocked;
  else {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    try {
      const res = await fetch(ep.url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "NotesApp-Webhooks/1", "NotesApp-Signature": signPayload(ep.secret, body) }, body, signal: ctl.signal, redirect: "manual" });
      status = res.status;
    } catch (e) {
      error = e instanceof Error && e.name === "AbortError" ? "Timed out after 5 s" : "Couldn't connect";
    } finally {
      clearTimeout(timer);
    }
  }
  const ok = status !== null && status >= 200 && status < 300;
  await db.collection("webhookDeliveries").add({
    uid: ep.uid, endpointId, url: ep.url, event, ok, status, error: ok ? "" : error || `HTTP ${status}`, durationMs: Date.now() - started,
    body, at: new Date().toISOString(), expireAt: new Date(Date.now() + 30 * 86_400_000),
  }).catch((e) => console.error("webhook log failed", e));
  return { ok, status };
}

// Fire-and-forget fan-out to the account's endpoints that subscribe to this event.
export async function emitWebhook(uid: string | undefined, event: WebhookEvent, data: unknown): Promise<void> {
  if (!uid) return;
  try {
    const snap = await getAdminDb().collection("webhookEndpoints").where("uid", "==", uid).get();
    await Promise.all(
      snap.docs
        .filter((d) => (d.data() as WebhookEndpoint).active && (d.data() as WebhookEndpoint).events.includes(event))
        .map((d) => deliverWebhook(d.id, d.data() as WebhookEndpoint, event, data))
    );
  } catch (err) {
    console.error("emitWebhook failed", event, err);
  }
}
