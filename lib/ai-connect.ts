import Anthropic from "@anthropic-ai/sdk";
import type { Firestore } from "firebase-admin/firestore";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { NanaError } from "./nana";

// A member's own AI account. They paste an Anthropic API key; we check it works, keep it encrypted (AES-256-GCM, the same ACCOUNT_DATA_KEY
// that protects other saved secrets) in the server-only collection `aiConnections`, and use it only when they use Nana, the writing help in
// drafts, sharing and messages, or the team hub, so the AI cost lands on their account. The key is never sent back to a browser; only
// its last four characters are shown. Removing it deletes it. Anthropic is the first provider; the document records `provider` for more.
const COL = "aiConnections";
const FORMAT = /^sk-ant-[A-Za-z0-9_\-]{20,300}$/;

export type AiStatus = { connected: boolean; last4?: string; connectedAt?: string; canConnect: boolean };

export async function aiStatus(db: Firestore, uid: string): Promise<AiStatus> {
  const d = (await db.collection(COL).doc(uid).get()).data();
  return { connected: !!d, last4: d?.last4, connectedAt: d?.createdAt, canConnect: accountCryptoConfigured() };
}

// The decrypted key for this member, or null (not connected, or it can't be read).
export async function ownKey(db: Firestore, uid: string): Promise<string | null> {
  const d = (await db.collection(COL).doc(uid).get()).data();
  if (!d?.secret) return null;
  try { return decryptSecret(String(d.secret)); } catch { return null; }
}

// Is this key one Anthropic accepts? A free call that only lists models.
export async function checkKey(apiKey: string): Promise<void> {
  try {
    await new Anthropic({ apiKey, maxRetries: 0, timeout: 15_000 }).models.list({ limit: 1 });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new NanaError("Anthropic didn't accept that key. Check you copied all of it, and that it hasn't been deleted.", 400);
    throw new NanaError("I couldn't check the key just now. Please try again in a moment.", 502);
  }
}

export async function connectKey(db: Firestore, uid: string, raw: unknown, now = new Date(), check: (k: string) => Promise<void> = checkKey): Promise<AiStatus> {
  if (!accountCryptoConfigured()) throw new NanaError("Connecting an AI account isn't set up yet. Please contact us.", 503);
  const key = String(raw ?? "").trim();
  if (!FORMAT.test(key)) throw new NanaError("That doesn't look like an Anthropic API key. It starts with sk-ant- and is one long line.", 400);
  await check(key);
  await db.collection(COL).doc(uid).set({ uid, provider: "anthropic", secret: encryptSecret(key), last4: key.slice(-4), createdAt: now.toISOString() });
  return aiStatus(db, uid);
}

export async function disconnectKey(db: Firestore, uid: string): Promise<void> {
  await db.collection(COL).doc(uid).delete();
}
