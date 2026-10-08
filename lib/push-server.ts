import type { Firestore } from "firebase-admin/firestore";
import { createHash } from "crypto";
import webpush from "web-push";

// Web push to a member's browsers and phones (Android Chrome and installed web apps; iPhone once the site is added to the home
// screen). Needs three env vars (generate with `npx web-push generate-vapid-keys`): NEXT_PUBLIC_VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: address). Without them nothing is offered and nothing is sent.
// A push never carries message text: only who it's from, so a lock screen shows nothing private.
// The keys are checked, not just present: the browser refuses a public key that isn't the 65-byte one `web-push` prints ("applicationServerKey
// is not valid"), usually because of a pasted space, quote or line break, or the private key in the public key's place. Stray quotes and
// whitespace are ignored here, so a slightly messy paste still works.
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
const decode = (k: string) => (/^[A-Za-z0-9_-]+$/.test(k) ? Buffer.from(k, "base64url") : null);
export function vapidPublicKey(): string | null {
  const k = clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const b = decode(k);
  return b && b.length === 65 && b[0] === 4 ? k : null;
}
export function vapidPrivateKey(): string | null {
  const k = clean(process.env.VAPID_PRIVATE_KEY);
  return decode(k)?.length === 32 ? k : null;
}
const vapidSubject = () => clean(process.env.VAPID_SUBJECT).replace(/^mailto:\s*/i, "mailto:");
const subjectOk = () => /^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/.test(vapidSubject());
export const pushConfigured = () => !!(vapidPublicKey() && vapidPrivateKey() && subjectOk());

// What is wrong with the settings, in plain words, for /status: null when they are fine (or none are set).
export function pushProblem(): string | null {
  const any = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PRIVATE_KEY || process.env.VAPID_SUBJECT;
  if (!any || pushConfigured()) return null;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing";
  if (!vapidPublicKey()) return "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not valid: it must be the Public Key from web-push (87 characters, nothing else)";
  if (!process.env.VAPID_PRIVATE_KEY) return "VAPID_PRIVATE_KEY is missing";
  if (!vapidPrivateKey()) return "VAPID_PRIVATE_KEY is not valid: it must be the Private Key from web-push (43 characters)";
  return "VAPID_SUBJECT must be a mailto: address, for example mailto:hello@notesapp.name.ng";
}

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };
export const subscriptionId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export function validSubscription(s: unknown): s is PushSubscriptionInput {
  const x = s as PushSubscriptionInput | null;
  return !!x && typeof x.endpoint === "string" && /^https:\/\//.test(x.endpoint) && x.endpoint.length < 1000 &&
    typeof x.keys?.p256dh === "string" && typeof x.keys?.auth === "string";
}

export async function saveSubscription(db: Firestore, uid: string, s: PushSubscriptionInput, userAgent: string, now = new Date()): Promise<void> {
  await db.doc(`pushSubscriptions/${subscriptionId(s.endpoint)}`).set({ uid, endpoint: s.endpoint, keys: s.keys, userAgent: userAgent.slice(0, 200), createdAt: now.toISOString() });
}

export async function removeSubscription(db: Firestore, uid: string, endpoint: string): Promise<void> {
  const ref = db.doc(`pushSubscriptions/${subscriptionId(endpoint)}`);
  if ((await ref.get()).data()?.uid === uid) await ref.delete();
}

export type PushPayload = { title: string; body: string; url: string };
export type Sender = (sub: PushSubscriptionInput, payload: string) => Promise<void>;

const realSender: Sender = async (sub, payload) => {
  webpush.setVapidDetails(vapidSubject(), vapidPublicKey()!, vapidPrivateKey()!);
  await webpush.sendNotification(sub, payload, { TTL: 24 * 3600 });
};

// Sends to every device the member turned notifications on for. A device that has gone away (404 or 410) is forgotten.
export async function sendPush(db: Firestore, uid: string, payload: PushPayload, send: Sender = realSender): Promise<number> {
  if (send === realSender && !pushConfigured()) return 0;
  const subs = await db.collection("pushSubscriptions").where("uid", "==", uid).limit(10).get();
  let sent = 0;
  for (const d of subs.docs) {
    const s = d.data() as PushSubscriptionInput;
    try { await send({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload)); sent++; }
    catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await d.ref.delete().catch(() => {});
    }
  }
  return sent;
}
