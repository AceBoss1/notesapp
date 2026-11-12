import Anthropic from "@anthropic-ai/sdk";
import type { Firestore } from "firebase-admin/firestore";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { NanaError } from "./nana";
import { AI_PROVIDERS, OPENAI_BASE, PROVIDER_INFO, ProviderError, checkProviderKey, isAiProvider, type Account, type AiProvider } from "./ai-providers";
import { checkWebhookUrl } from "./webhooks";

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

// ---- More providers (Nana Jobs, v0.162.0) ----
// Gemini, Groq and any OpenAI-compatible API join the Anthropic key above. Nana and the writing help keep using only the Anthropic key
// (aiStatus, ownKey: unchanged); Nana Jobs can use any of them (lib/nana-jobs-server.ts). The others live in the server-only
// `aiProviderKeys/{uid}_{provider}`, encrypted the same way, with only the last four characters ever shown. Each key is checked with a free
// call that lists models (lib/ai-providers.ts) before it's saved. An OpenAI-compatible base URL must be a public https address.
const KEYS = "aiProviderKeys";
export type ProviderStatus = { provider: AiProvider; connected: boolean; last4?: string; connectedAt?: string; baseUrl?: string; model?: string; free: boolean };
export type ProviderDeps = { check?: (provider: AiProvider, key: string, baseUrl?: string) => Promise<void>; checkUrl?: (url: string) => Promise<string | null> };

export async function providersStatus(db: Firestore, uid: string): Promise<{ providers: ProviderStatus[]; canConnect: boolean }> {
  const [anth, ...rest] = await Promise.all([db.collection(COL).doc(uid).get(), ...AI_PROVIDERS.filter((p) => p !== "anthropic").map((p) => db.collection(KEYS).doc(`${uid}_${p}`).get())]);
  const others = new Map(rest.map((s) => [String(s.data()?.provider ?? ""), s.data()]));
  const providers = AI_PROVIDERS.map((p): ProviderStatus => {
    const d = p === "anthropic" ? anth.data() : others.get(p);
    return { provider: p, connected: !!d, free: PROVIDER_INFO[p].free, ...(d ? { last4: d.last4, connectedAt: d.createdAt, ...(d.baseUrl ? { baseUrl: d.baseUrl } : {}), ...(d.model ? { model: d.model } : {}) } : {}) };
  });
  return { providers, canConnect: accountCryptoConfigured() };
}

// The account to call for this provider (key decrypted), or null when it isn't connected or can't be read.
export async function providerAccount(db: Firestore, uid: string, provider: AiProvider): Promise<Account | null> {
  if (provider === "anthropic") { const k = await ownKey(db, uid); return k ? { provider, apiKey: k } : null; }
  const d = (await db.collection(KEYS).doc(`${uid}_${provider}`).get()).data();
  if (!d?.secret) return null;
  try { return { provider, apiKey: decryptSecret(String(d.secret)), ...(d.baseUrl ? { baseUrl: String(d.baseUrl) } : {}), ...(d.model ? { model: String(d.model) } : {}) }; } catch { return null; }
}

const cleanModel = (m: unknown) => String(m ?? "").trim().slice(0, 120);
export async function connectProvider(db: Firestore, uid: string, provider: unknown, b: { key?: unknown; baseUrl?: unknown; model?: unknown }, now = new Date(), deps: ProviderDeps = {}): Promise<ProviderStatus[]> {
  if (!isAiProvider(provider)) throw new NanaError("Choose Gemini, Groq, Claude or an OpenAI-compatible API.", 400);
  if (provider === "anthropic") {
    await connectKey(db, uid, b.key, now, deps.check ? (k) => deps.check!("anthropic", k) : checkKey);
    return (await providersStatus(db, uid)).providers;
  }
  if (!accountCryptoConfigured()) throw new NanaError("Connecting an AI account isn't set up yet. Please contact us.", 503);
  const info = PROVIDER_INFO[provider];
  const key = String(b.key ?? "").trim();
  if (!info.format.test(key)) throw new NanaError(`That doesn't look like a ${info.label} key. It's one long line${provider === "groq" ? " starting with gsk_" : ""}.`, 400);
  let baseUrl = "", model = "";
  if (provider === "openai") {
    baseUrl = String(b.baseUrl ?? "").trim().replace(/\/+$/, "") || OPENAI_BASE;
    const bad = await (deps.checkUrl ?? checkWebhookUrl)(baseUrl);
    if (bad) throw new NanaError(bad.replace("Webhook URLs", "The address"), 400);
    model = cleanModel(b.model);
    if (!model && baseUrl !== OPENAI_BASE) throw new NanaError("Add the model's name, as your provider writes it.", 400);
  }
  try { await (deps.check ?? ((p, k, u) => checkProviderKey(p, k, { baseUrl: u })))(provider, key, baseUrl || undefined); }
  catch (e) { throw new NanaError(e instanceof Error ? e.message : "I couldn't check the key just now.", e instanceof ProviderError && e.status ? e.status : 400); }
  await db.collection(KEYS).doc(`${uid}_${provider}`).set({ uid, provider, secret: encryptSecret(key), last4: key.slice(-4), createdAt: now.toISOString(), ...(baseUrl ? { baseUrl } : {}), ...(model ? { model } : {}) });
  return (await providersStatus(db, uid)).providers;
}

export async function disconnectProvider(db: Firestore, uid: string, provider: unknown): Promise<ProviderStatus[]> {
  if (!isAiProvider(provider)) throw new NanaError("Choose which AI to remove.", 400);
  if (provider === "anthropic") await disconnectKey(db, uid);
  else await db.collection(KEYS).doc(`${uid}_${provider}`).delete();
  return (await providersStatus(db, uid)).providers;
}
