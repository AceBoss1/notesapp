import type { Firestore } from "firebase-admin/firestore";
import { createHash, randomBytes } from "crypto";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { MAIN_HOST, isMainHost } from "./host";
import { postOgImage } from "./og";
import { LINKEDIN_LIMIT, X_LIMIT, clipWords, escapeLinkedIn, linkedinText, plainText, xText, xWeight, type PostSource } from "./social-text";

// Publishing a journal post to a member's own LinkedIn or X account: they connect once (OAuth), then "Publish" posts an excerpt of the post with
// a link back to the full journal on #NotesApp, after showing them the text and letting them edit it. Tokens are kept encrypted in a server-only
// collection and never leave the server. A provider appears only when its app settings exist:
//   LinkedIn: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET (product "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect"),
//             optional LINKEDIN_API_VERSION (the YYYYMM version of the Posts API; default below)
//   X:        X_CLIENT_ID, X_CLIENT_SECRET (OAuth 2.0 app with "Read and write"), both with the redirect URI https://www.notesapp.name.ng/api/social/callback/<provider>

export const PROVIDERS = ["linkedin", "x"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const PROVIDER_LABEL: Record<Provider, string> = { linkedin: "LinkedIn", x: "X" };
export const isProvider = (p: unknown): p is Provider => PROVIDERS.includes(p as Provider);

export class SocialError extends Error {
  constructor(public status: number, message: string, public code?: "reconnect" | "already") { super(message); }
}

export type Deps = { fetch: typeof fetch; now: () => Date };
const realDeps = (): Deps => ({ fetch: (...a) => fetch(...a), now: () => new Date() });

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || `https://${MAIN_HOST}`).replace(/\/$/, "");
const env = (k: string) => (process.env[k] ?? "").trim();
const cfg = (p: Provider) => p === "linkedin"
  ? { id: env("LINKEDIN_CLIENT_ID"), secret: env("LINKEDIN_CLIENT_SECRET") }
  : { id: env("X_CLIENT_ID"), secret: env("X_CLIENT_SECRET") };
// The address LinkedIn and X send the member back to. It must match what is registered in each app exactly, so it is fixed to the main
// site (https://www.notesapp.name.ng/api/social/callback/linkedin and .../x) and does not depend on any setting; only a local test
// server (localhost) is allowed to differ.
export const redirectUri = (p: Provider) => `${/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(site()) ? site() : `https://${MAIN_HOST}`}/api/social/callback/${p}`;
export const providerConfigured = (p: Provider) => !!(cfg(p).id && cfg(p).secret) && accountCryptoConfigured();
const LINKEDIN_VERSION = () => env("LINKEDIN_API_VERSION") || "202606";

const b64url = (b: Buffer) => b.toString("base64url");
const STATE_TTL_MS = 10 * 60_000;

// ---- Connecting -----------------------------------------------------------------------------------------------------------------------------
// Where to send the member afterwards: a path on one of our own hosts only (never anywhere else).
export function safeReturn(host: unknown, path: unknown): string {
  const h = typeof host === "string" && isMainHost(host) && !/^localhost|127\.0\.0\.1/.test(host) ? host.toLowerCase() : MAIN_HOST;
  const p = typeof path === "string" && /^\/[A-Za-z0-9\-._~/%?=&]*$/.test(path) && !path.startsWith("//") ? path : "/journals";
  return `https://${h}${p}`;
}

export async function startConnect(db: Firestore, uid: string, provider: Provider, returnTo: string, deps: Deps = realDeps()): Promise<{ url: string }> {
  if (!providerConfigured(provider)) throw new SocialError(503, `${PROVIDER_LABEL[provider]} isn't set up yet.`);
  const state = randomBytes(24).toString("hex");
  const verifier = b64url(randomBytes(32));
  await db.doc(`socialStates/${state}`).set({ uid, provider, verifier, returnTo, createdAt: deps.now().toISOString() });
  const q = new URLSearchParams({ response_type: "code", client_id: cfg(provider).id, redirect_uri: redirectUri(provider), state });
  if (provider === "linkedin") {
    q.set("scope", "openid profile w_member_social");
    return { url: `https://www.linkedin.com/oauth/v2/authorization?${q}` };
  }
  q.set("scope", "tweet.read tweet.write users.read offline.access");
  q.set("code_challenge", b64url(createHash("sha256").update(verifier).digest()));
  q.set("code_challenge_method", "S256");
  return { url: `https://x.com/i/oauth2/authorize?${q}` };
}

type Tokens = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };

async function tokenRequest(provider: Provider, body: Record<string, string>, deps: Deps): Promise<Tokens> {
  const c = cfg(provider);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (provider === "x") headers.Authorization = `Basic ${Buffer.from(`${c.id}:${c.secret}`).toString("base64")}`;
  else { body.client_id = c.id; body.client_secret = c.secret; }
  if (provider === "x") body.client_id = c.id;
  const res = await deps.fetch(provider === "linkedin" ? "https://www.linkedin.com/oauth/v2/accessToken" : "https://api.x.com/2/oauth2/token", { method: "POST", headers, body: new URLSearchParams(body).toString() });
  const j = (await res.json().catch(() => ({}))) as Tokens;
  if (!res.ok || !j.access_token) throw new SocialError(res.status === 400 || res.status === 401 ? 401 : 502, `${PROVIDER_LABEL[provider]} didn't accept the sign-in. Try connecting again.`, "reconnect");
  return j;
}

const connRef = (db: Firestore, uid: string, provider: Provider) => db.doc(`socialConnections/${uid}_${provider}`);

// The member comes back from the provider with a code. Returns where to send them and whether it worked.
export async function finishConnect(db: Firestore, provider: Provider, p: { code?: string; state?: string; error?: string }, deps: Deps = realDeps()): Promise<{ ok: boolean; returnTo: string; message?: string }> {
  const fallback = safeReturn(undefined, undefined);
  const stateRef = db.doc(`socialStates/${String(p.state ?? "-")}`);
  const st = (await stateRef.get()).data();
  if (!st || st.provider !== provider) return { ok: false, returnTo: fallback, message: "That sign-in link has expired. Try again." };
  await stateRef.delete().catch(() => {}); // single use
  const returnTo = String(st.returnTo || fallback);
  if (deps.now().getTime() - new Date(st.createdAt).getTime() > STATE_TTL_MS) return { ok: false, returnTo, message: "That sign-in took too long. Try again." };
  if (p.error || !p.code) return { ok: false, returnTo, message: `${PROVIDER_LABEL[provider]} wasn't connected.` };
  try {
    const tokens = await tokenRequest(provider, { grant_type: "authorization_code", code: p.code, redirect_uri: redirectUri(provider), ...(provider === "x" ? { code_verifier: String(st.verifier) } : {}) }, deps);
    const profile = await fetchProfile(provider, tokens.access_token, deps);
    await connRef(db, st.uid, provider).set({
      uid: st.uid, provider, externalId: profile.id, name: profile.name, handle: profile.handle,
      accessToken: encryptSecret(tokens.access_token), refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : "",
      expiresAt: new Date(deps.now().getTime() + (tokens.expires_in ?? 3600) * 1000).toISOString(), scope: tokens.scope ?? "", connectedAt: deps.now().toISOString(),
    });
    return { ok: true, returnTo };
  } catch (err) {
    return { ok: false, returnTo, message: err instanceof SocialError ? err.message : `${PROVIDER_LABEL[provider]} wasn't connected.` };
  }
}

async function fetchProfile(provider: Provider, token: string, deps: Deps): Promise<{ id: string; name: string; handle: string }> {
  const res = await deps.fetch(provider === "linkedin" ? "https://api.linkedin.com/v2/userinfo" : "https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${token}` } });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & { data?: { id?: string; name?: string; username?: string } };
  if (!res.ok) throw new SocialError(502, `Couldn't read your ${PROVIDER_LABEL[provider]} profile.`);
  if (provider === "linkedin") return { id: String(j.sub ?? ""), name: String(j.name ?? "Your LinkedIn account"), handle: "" };
  return { id: String(j.data?.id ?? ""), name: String(j.data?.name ?? j.data?.username ?? "Your X account"), handle: String(j.data?.username ?? "") };
}

export type ConnectionRow = { provider: Provider; label: string; configured: boolean; connected: boolean; name?: string; handle?: string; expiresAt?: string; needsReconnect?: boolean };

export async function listConnections(db: Firestore, uid: string, deps: Deps = realDeps()): Promise<ConnectionRow[]> {
  const docs = await db.getAll(...PROVIDERS.map((p) => connRef(db, uid, p)));
  return PROVIDERS.map((provider, i) => {
    const c = docs[i].data();
    const row: ConnectionRow = { provider, label: PROVIDER_LABEL[provider], configured: providerConfigured(provider), connected: !!c };
    if (c) {
      row.name = c.name; row.handle = c.handle || undefined; row.expiresAt = c.expiresAt;
      // LinkedIn tokens last about 60 days and can't be renewed; X tokens renew themselves while a refresh token is held.
      row.needsReconnect = new Date(c.expiresAt).getTime() <= deps.now().getTime() && !c.refreshToken;
    }
    return row;
  });
}

export async function disconnect(db: Firestore, uid: string, provider: Provider) {
  await connRef(db, uid, provider).delete();
}

// ---- Publishing -----------------------------------------------------------------------------------------------------------------------------
async function freshToken(db: Firestore, uid: string, provider: Provider, deps: Deps): Promise<{ token: string; handle: string; externalId: string }> {
  const ref = connRef(db, uid, provider);
  const c = (await ref.get()).data();
  if (!c) throw new SocialError(400, `Connect your ${PROVIDER_LABEL[provider]} account first.`, "reconnect");
  const expired = new Date(c.expiresAt).getTime() - 60_000 <= deps.now().getTime();
  if (!expired) return { token: decryptSecret(c.accessToken), handle: c.handle || "", externalId: c.externalId };
  if (!c.refreshToken) throw new SocialError(401, `Your ${PROVIDER_LABEL[provider]} connection has expired. Connect it again.`, "reconnect");
  const t = await tokenRequest(provider, { grant_type: "refresh_token", refresh_token: decryptSecret(c.refreshToken) }, deps);
  await ref.update({
    accessToken: encryptSecret(t.access_token), refreshToken: t.refresh_token ? encryptSecret(t.refresh_token) : c.refreshToken,
    expiresAt: new Date(deps.now().getTime() + (t.expires_in ?? 3600) * 1000).toISOString(),
  });
  return { token: t.access_token, handle: c.handle || "", externalId: c.externalId };
}

type NoteDoc = { id: string; slug: string; title: string; content: string; status?: string; authorUid?: string; coAuthorUids?: string[]; featured_image?: string; videoPoster?: string };

async function loadNote(db: Firestore, uid: string, noteId: string): Promise<NoteDoc> {
  const d = await db.doc(`notes/${noteId}`).get();
  const n = d.data();
  if (!n) throw new SocialError(404, "That post wasn't found.");
  if (n.authorUid !== uid && !(n.coAuthorUids as string[] | undefined)?.includes(uid)) throw new SocialError(403, "You can only share your own posts.");
  if (n.status !== "published") throw new SocialError(400, "Publish the post first, then share it.");
  return { id: d.id, slug: n.slug, title: String(n.title ?? ""), content: String(n.content ?? ""), status: n.status, authorUid: n.authorUid, coAuthorUids: n.coAuthorUids, featured_image: n.featured_image, videoPoster: n.videoPoster };
}

export const postUrl = (slug: string) => `${site()}/journals/${slug}`;
const sourceOf = (n: NoteDoc): PostSource => ({ title: n.title, excerpt: clipWords(plainText(n.content), 600), url: postUrl(n.slug) });

// What would be posted, for the member to read and edit before anything goes out.
export async function previewPost(db: Firestore, uid: string, noteId: string) {
  const n = await loadNote(db, uid, noteId);
  const s = sourceOf(n);
  return { title: n.title, url: s.url, texts: { linkedin: linkedinText(s), x: xText(s) } as Record<Provider, string>, limits: { linkedin: LINKEDIN_LIMIT, x: 280 } };
}

export type PublishResult = { provider: Provider; ok: boolean; url?: string; error?: string; code?: "reconnect" | "already" };

function failure(provider: Provider, status: number, body: string): SocialError {
  const label = PROVIDER_LABEL[provider];
  if (status === 401) return new SocialError(401, `${label} says your connection has expired. Connect it again.`, "reconnect");
  if (status === 403) return new SocialError(403, `${label} didn't allow that post. Connect your account again and accept every permission, or check that your ${label} app can post.`, "reconnect");
  if (status === 429) return new SocialError(429, `${label}'s posting limit has been reached for now. Try again later.`);
  if (status === 422 || status === 400) return new SocialError(400, `${label} couldn't accept that post${/duplicate/i.test(body) ? " (it looks like a duplicate of a recent post)" : ""}.`);
  return new SocialError(502, `${label} couldn't be reached. Try again in a moment.`);
}

async function postToX(token: string, handle: string, text: string, deps: Deps): Promise<string> {
  const res = await deps.fetch("https://api.x.com/2/tweets", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  const body = await res.text();
  if (!res.ok) throw failure("x", res.status, body);
  const id = (JSON.parse(body) as { data?: { id?: string } }).data?.id;
  return `https://x.com/${handle || "i"}/status/${id}`;
}

// A link post: the card carries the title, a short description and (when it can be uploaded) the post's picture.
async function uploadLinkedInImage(token: string, owner: string, imageUrl: string, deps: Deps): Promise<string | null> {
  try {
    const abs = imageUrl.startsWith("http") ? imageUrl : `${site()}${imageUrl}`;
    const img = await deps.fetch(abs);
    if (!img.ok) return null;
    const bytes = Buffer.from(await img.arrayBuffer());
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return null;
    const headers = { Authorization: `Bearer ${token}`, "LinkedIn-Version": LINKEDIN_VERSION(), "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" };
    const init = await deps.fetch("https://api.linkedin.com/rest/images?action=initializeUpload", { method: "POST", headers, body: JSON.stringify({ initializeUploadRequest: { owner } }) });
    if (!init.ok) return null;
    const { value } = (await init.json()) as { value?: { uploadUrl?: string; image?: string } };
    if (!value?.uploadUrl || !value.image) return null;
    const put = await deps.fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: bytes });
    return put.ok ? value.image : null;
  } catch {
    return null;
  }
}

async function postToLinkedIn(token: string, externalId: string, text: string, note: NoteDoc, deps: Deps): Promise<string> {
  const owner = `urn:li:person:${externalId}`;
  const thumbnail = await uploadLinkedInImage(token, owner, postOgImage(note), deps);
  const s = sourceOf(note);
  const res = await deps.fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": LINKEDIN_VERSION(), "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" },
    body: JSON.stringify({
      author: owner, commentary: escapeLinkedIn(text), visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { article: { source: s.url, title: s.title.slice(0, 200), description: clipWords(s.excerpt, 250), ...(thumbnail ? { thumbnail } : {}) } },
      lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw failure("linkedin", res.status, body);
  const urn = res.headers.get("x-restli-id");
  return urn ? `https://www.linkedin.com/feed/update/${urn}` : "https://www.linkedin.com/feed/";
}

// Posts to each chosen network. A text the member edited is used as written (X's link is added if they removed it; the limits are checked).
export async function publishPost(
  db: Firestore, uid: string, input: { noteId: string; targets: unknown; texts?: Partial<Record<Provider, unknown>>; force?: boolean }, deps: Deps = realDeps(),
): Promise<PublishResult[]> {
  const targets = Array.from(new Set((Array.isArray(input.targets) ? input.targets : []).filter(isProvider)));
  if (!targets.length) throw new SocialError(400, "Choose where to post.");
  const note = await loadNote(db, uid, input.noteId);
  const s = sourceOf(note);
  const out: PublishResult[] = [];
  for (const provider of targets) {
    try {
      if (!providerConfigured(provider)) throw new SocialError(503, `${PROVIDER_LABEL[provider]} isn't set up yet.`);
      const doneRef = db.doc(`socialPosts/${note.id}_${provider}`);
      const prior = (await doneRef.get()).data();
      if (prior && !input.force) throw new SocialError(409, `Already posted to ${PROVIDER_LABEL[provider]} on ${new Date(prior.at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}.`, "already");
      let text = typeof input.texts?.[provider] === "string" ? String(input.texts[provider]).trim() : provider === "x" ? xText(s) : linkedinText(s);
      if (provider === "x" && !text.includes(s.url)) text = `${text}\n\n${s.url}`;
      if (!text) throw new SocialError(400, "Write something to post.");
      if (provider === "x" && xWeight(text) > X_LIMIT) throw new SocialError(400, `That is too long for X (${xWeight(text)} of ${X_LIMIT}).`);
      if (provider === "linkedin" && text.length > LINKEDIN_LIMIT) throw new SocialError(400, `That is too long for LinkedIn (${text.length} of ${LINKEDIN_LIMIT}).`);
      const { token, handle, externalId } = await freshToken(db, uid, provider, deps);
      const url = provider === "x" ? await postToX(token, handle, text, deps) : await postToLinkedIn(token, externalId, text, note, deps);
      await doneRef.set({ noteId: note.id, provider, uid, postUrl: url, at: deps.now().toISOString() });
      out.push({ provider, ok: true, url });
    } catch (err) {
      const e = err instanceof SocialError ? err : new SocialError(502, `${PROVIDER_LABEL[provider]} couldn't be reached.`);
      out.push({ provider, ok: false, error: e.message, ...(e.code ? { code: e.code } : {}) });
    }
  }
  return out;
}
