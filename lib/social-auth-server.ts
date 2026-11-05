import { createHash, randomBytes, randomUUID } from "crypto";
import { getAuth, type Auth, type DecodedIdToken, type UserRecord } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { getAdminApp } from "./firebase-admin";
import { SITE_URL } from "./host";
import {
  FRESH_TOKEN_MS, LINKEDIN_ISSUER, LINKEDIN_JWKS, LINKEDIN_TOKEN, SOCIAL_LABEL, STATE_TTL_MS, TICKET_TTL_MS,
  SocialAuthError, canRemove, linkId, linkedinEndpoints, maskEmail, safePath,
  type MethodsSummary, type Removable, type SocialProvider,
} from "./social-auth";
import { linkedinAuthorizeUrl, verifyIdToken, type Jwk, type VerifiedIdentity } from "./social-oidc";

// Signing in with Google and LinkedIn on the server (the rules: lib/social-auth.ts). Collections, all server-only (firestore.rules):
//   authLinks/{provider}_{sub}   { uid, provider, sub, email, name, linkedAt, via: "signup" | "link" }  which account a Google or
//                                LinkedIn identity signs in to (one account per identity, one identity per provider per account)
//   authStates/{state}           a LinkedIn sign-in in progress: { mode, uid?, nonce, bind (sha256 of this browser's cookie), origin,
//                                redirectUri, returnPath, expireAt }  (10 minutes, TTL on expireAt, deleted on use)
//   authTickets/{id}             LinkedIn has answered and the identity is checked; waiting for the page to redeem it (2 minutes)
//   authAudit/{auto}             { uid, action: link | unlink | signin-new | blocked-existing-email | google-unlinked-auto, provider, at, ip }
// A LinkedIn sign-in ends in a Firebase custom token for the linked account, like a passkey, so the account's custom claims (staff
// access, teen mode) apply exactly as with a password.

export type Deps = { fetch: typeof fetch; now: () => Date; auth: () => Auth; notify: (to: string, subject: string, text: string, url: string) => Promise<unknown> };
export const realDeps = (): Deps => ({
  fetch: (...a) => fetch(...a),
  now: () => new Date(),
  auth: () => getAuth(getAdminApp()),
  notify: async (to, subject, text, url) => {
    const { sendEmail } = await import("./email");
    return sendEmail({ to, subject, text, action: { label: "Review sign-in methods", url } });
  },
});

const env = (k: "LINKEDIN_LOGIN_CLIENT_ID" | "LINKEDIN_LOGIN_CLIENT_SECRET" | "LINKEDIN_CLIENT_ID" | "LINKEDIN_CLIENT_SECRET") => (setting(k) ?? "").trim();
// The LinkedIn app: its own login app when LINKEDIN_LOGIN_CLIENT_ID/SECRET are set, otherwise the publishing app (it already carries
// the "Sign In with LinkedIn using OpenID Connect" product).
export function linkedinApp(): { id: string; secret: string } | null {
  const own = { id: env("LINKEDIN_LOGIN_CLIENT_ID"), secret: env("LINKEDIN_LOGIN_CLIENT_SECRET") };
  if (own.id && own.secret) return own;
  const pub = { id: env("LINKEDIN_CLIENT_ID"), secret: env("LINKEDIN_CLIENT_SECRET") };
  return pub.id && pub.secret ? pub : null;
}
export const linkedinConfigured = () => linkedinApp() !== null;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const toDate = (v: unknown) => (v instanceof Date ? v : (v as { toDate?: () => Date })?.toDate?.() ?? new Date(0));

// ── Checking who is asking ──────────────────────────────────────────────────────────────────────────────────

export async function verifyToken(deps: Deps, token: string | undefined): Promise<DecodedIdToken> {
  if (!token) throw new SocialAuthError(401, "Sign in again to continue.");
  try { return await deps.auth().verifyIdToken(token, true); }
  catch { throw new SocialAuthError(401, "Sign in again to continue."); }
}
// Linking needs a token minted in the last few minutes (the page asks for a new one), so an old stolen token can't add a way in.
export function requireFresh(t: DecodedIdToken, deps: Deps) {
  if (deps.now().getTime() - t.iat * 1000 > FRESH_TOKEN_MS) throw new SocialAuthError(401, "For your security, sign in again and then link it.", "stale");
}

// ── Audit log and emails ────────────────────────────────────────────────────────────────────────────────────

export async function audit(db: Firestore, e: { uid: string; action: string; provider: SocialProvider; ip?: string; detail?: string }, deps: Deps) {
  await db.collection("authAudit").add({ ...e, ip: e.ip ?? "", at: deps.now().toISOString() }).catch((err) => console.error("[social-auth] audit failed", err));
}

async function tellOwner(db: Firestore, uid: string, provider: SocialProvider, label: string, deps: Deps) {
  const user = await deps.auth().getUser(uid).catch(() => null);
  if (!user?.email) return;
  const when = deps.now().toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
  const text = `${SOCIAL_LABEL[provider]} (${label || "your account"}) was linked to your #NotesApp account on ${when} (Lagos time). You can now sign in with it.\n\nIf this wasn't you, open Account settings → Sign-in methods, unlink it and change your password.`;
  await deps.notify(user.email, `${SOCIAL_LABEL[provider]} was linked to your #NotesApp account`, text, `${SITE_URL}/profile/account#sign-in-methods`).catch(() => {});
}

// ── The account's sign-in methods ────────────────────────────────────────────────────────────────────────────

export type MethodsView = MethodsSummary;

async function linksOf(db: Firestore, uid: string, provider: SocialProvider) {
  return (await db.collection("authLinks").where("uid", "==", uid).get()).docs.filter((d) => d.data().provider === provider);
}

export async function methodsOf(db: Firestore, uid: string, deps: Deps, user?: UserRecord): Promise<MethodsView> {
  const u = user ?? (await deps.auth().getUser(uid));
  const g = u.providerData.find((p) => p.providerId === "google.com");
  const li = await linksOf(db, uid, "linkedin");
  const passkeys = (await db.collection("passkeys").where("uid", "==", uid).get()).size;
  return {
    password: u.providerData.some((p) => p.providerId === "password"),
    google: !!g,
    linkedin: li.length > 0,
    passkeys,
    googleEmail: g?.email ? maskEmail(g.email) : "",
    linkedinName: li[0] ? String(li[0].data().name || "") : "",
    linkedinAvailable: linkedinConfigured(),
  };
}

// Throws unless removing `what` leaves the account another way in.
export async function assertCanRemove(db: Firestore, uid: string, what: Removable, deps: Deps) {
  const m = await methodsOf(db, uid, deps);
  if (!canRemove(m, what)) {
    throw new SocialAuthError(400, what === "passkey"
      ? "This is your only way to sign in. Link Google or LinkedIn, or set a password, before removing it."
      : "That's your only way to sign in. Add a password, a passkey or another account before unlinking it.");
  }
}

export async function unlinkMethod(db: Firestore, uid: string, provider: SocialProvider, deps: Deps, ip = "") {
  await assertCanRemove(db, uid, provider, deps);
  if (provider === "google") {
    const u = await deps.auth().getUser(uid);
    const g = u.providerData.find((p) => p.providerId === "google.com");
    await deps.auth().updateUser(uid, { providersToUnlink: ["google.com"] });
    if (g) await db.doc(`authLinks/${linkId("google", g.uid)}`).delete();
  }
  for (const d of await linksOf(db, uid, provider)) await d.ref.delete();
  await audit(db, { uid, action: "unlink", provider, ip }, deps);
}

// ── Google ───────────────────────────────────────────────────────────────────────────────────────────────────
// The browser signs in (or links) with Firebase's GoogleAuthProvider, then tells us with its new ID token:
//   mode "signin": right after "Continue with Google". A new account is recorded and goes on to finish its profile. If Google was
//                  attached to an account that already existed (Firebase links a verified Google email to the matching account on
//                  its own), Google is taken off again and the person is asked to sign in the usual way and link it themselves.
//   mode "link":   after linking from Account settings (or after signing in with a password when Google said the email had an
//                  account). Recorded, logged and emailed.
export type GoogleResult = { status: "ok"; needsProfile: boolean } | { status: "link-required"; email: string; hasOtherWay: boolean };

export async function confirmGoogle(db: Firestore, t: DecodedIdToken, mode: "signin" | "link", deps: Deps, ip = ""): Promise<GoogleResult> {
  const user = await deps.auth().getUser(t.uid);
  const g = user.providerData.find((p) => p.providerId === "google.com");
  if (!g) throw new SocialAuthError(400, "Google isn't linked to this account.");
  const ref = db.doc(`authLinks/${linkId("google", g.uid)}`);
  const existing = (await ref.get()).data();
  const via = (t.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  const hasProfile = (await db.doc(`users/${t.uid}`).get()).exists;

  if (mode === "link") {
    // (No check on how this session signed in: right after linkWithPopup the token may name google.com. Someone who could call
    // this after Firebase merged their Google account controls that email anyway; the sign-in path below is what keeps the UI honest.)
    requireFresh(t, deps);
    if (existing && existing.uid !== t.uid) throw new SocialAuthError(409, "That Google account is linked to another NotesApp account.");
    if (!existing) {
      await ref.set({ uid: t.uid, provider: "google", sub: g.uid, email: g.email ?? "", name: g.displayName ?? "", linkedAt: deps.now().toISOString(), via: "link" });
      await audit(db, { uid: t.uid, action: "link", provider: "google", ip }, deps);
      await tellOwner(db, t.uid, "google", g.email ?? "", deps);
    }
    return { status: "ok", needsProfile: !hasProfile };
  }

  if (via !== "google.com") throw new SocialAuthError(400, "Continue with Google first.");
  if (existing) {
    if (existing.uid !== t.uid) throw new SocialAuthError(409, "That Google account is linked to another NotesApp account.");
    return { status: "ok", needsProfile: !hasProfile };
  }
  // Not recorded yet: a brand-new account made by this sign-in, or Google landed on an account that existed before.
  const others = user.providerData.filter((p) => p.providerId !== "google.com").length;
  const m = await methodsOf(db, t.uid, deps, user);
  const brandNew = !hasProfile && others === 0 && !m.linkedin && m.passkeys === 0;
  if (brandNew) {
    await ref.set({ uid: t.uid, provider: "google", sub: g.uid, email: g.email ?? "", name: g.displayName ?? "", linkedAt: deps.now().toISOString(), via: "signup" });
    await audit(db, { uid: t.uid, action: "signin-new", provider: "google", ip }, deps);
    return { status: "ok", needsProfile: true };
  }
  // No silent merge: take Google off this account and end the session; the person signs in as before and links Google themselves.
  await deps.auth().updateUser(t.uid, { providersToUnlink: ["google.com"] });
  await deps.auth().revokeRefreshTokens(t.uid);
  await audit(db, { uid: t.uid, action: "google-unlinked-auto", provider: "google", ip }, deps);
  return { status: "link-required", email: maskEmail(user.email), hasOtherWay: others > 0 || m.linkedin || m.passkeys > 0 };
}

// ── LinkedIn ─────────────────────────────────────────────────────────────────────────────────────────────────

export async function startLinkedIn(
  db: Firestore,
  p: { host: string | null; mode: "signin" | "link"; uid?: string; returnPath: unknown },
  deps: Deps,
): Promise<{ url: string; bind: string }> {
  const app = linkedinApp();
  if (!app) throw new SocialAuthError(503, "LinkedIn sign-in isn't set up yet.");
  const ends = linkedinEndpoints(p.host);
  if (!ends) throw new SocialAuthError(400, "LinkedIn sign-in works on the NotesApp site and app, not on this address.");
  if (p.mode === "link" && !p.uid) throw new SocialAuthError(401, "Sign in again to continue.");
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const bind = randomBytes(24).toString("base64url");
  await db.doc(`authStates/${state}`).set({
    provider: "linkedin", mode: p.mode, uid: p.uid ?? null, nonce, bind: sha(bind), origin: ends.origin,
    redirectUri: ends.redirectUri, returnPath: safePath(p.returnPath, p.mode === "link" ? "/profile/account" : "/login"),
    expireAt: new Date(deps.now().getTime() + STATE_TTL_MS),
  });
  return { url: linkedinAuthorizeUrl({ clientId: app.id, redirectUri: ends.redirectUri, state, nonce }), bind };
}

let jwksCache: { at: number; keys: Jwk[] } | null = null;
async function linkedinKeys(deps: Deps, refresh: boolean): Promise<Jwk[]> {
  if (!refresh && jwksCache && deps.now().getTime() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await deps.fetch(LINKEDIN_JWKS, { headers: { Accept: "application/json" } });
  const j = (await res.json().catch(() => ({}))) as { keys?: Jwk[] };
  if (!res.ok || !Array.isArray(j.keys)) throw new SocialAuthError(502, "Couldn't reach LinkedIn. Try again.");
  jwksCache = { at: deps.now().getTime(), keys: j.keys };
  return j.keys;
}
export const resetJwksCache = () => { jwksCache = null; };

// Takes a document and deletes it in one transaction, so it can be used once only.
async function takeOnce(db: Firestore, path: string): Promise<Record<string, unknown> | null> {
  const ref = db.doc(path);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data() as Record<string, unknown>;
  });
}

// LinkedIn sends the browser back with ?code&state (or ?error). Returns where to send it: the page that started, with
// #li=<ticket> (or #li_error=<reason>) on the end. The fragment never reaches a server or a Referer header.
export async function linkedinCallback(
  db: Firestore,
  q: { code?: string | null; state?: string | null; error?: string | null; callbackHost: string | null },
  deps: Deps,
): Promise<string> {
  const fallback = `${SITE_URL}/login`;
  const stateId = typeof q.state === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(q.state) ? q.state : "";
  const st = stateId ? await takeOnce(db, `authStates/${stateId}`) : null;
  if (!st || st.provider !== "linkedin") return `${fallback}#li_error=expired`;
  const back = (frag: string) => `${st.origin}${st.returnPath}#${frag}`;
  if (toDate(st.expireAt).getTime() < deps.now().getTime()) return back("li_error=expired");
  // The callback must arrive at the address it was sent to (the code is bound to that redirect URI).
  const cb = linkedinEndpoints(q.callbackHost);
  if (!cb || new URL(String(st.redirectUri)).host !== new URL(cb.origin).host) return back("li_error=address");
  if (q.error || !q.code) return back("li_error=cancelled");
  const app = linkedinApp();
  if (!app) return back("li_error=unavailable");
  let identity: VerifiedIdentity;
  try {
    const res = await deps.fetch(LINKEDIN_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: q.code, redirect_uri: String(st.redirectUri), client_id: app.id, client_secret: app.secret }).toString(),
    });
    const tok = (await res.json().catch(() => ({}))) as { id_token?: string };
    if (!res.ok || !tok.id_token) return back("li_error=refused");
    identity = await verifyIdToken(tok.id_token, {
      issuer: LINKEDIN_ISSUER, audience: app.id, nonce: String(st.nonce), nowSec: Math.floor(deps.now().getTime() / 1000),
      getKeys: (refresh) => linkedinKeys(deps, refresh), nonceOptional: true,
    });
  } catch (err) {
    console.error("[social-auth] linkedin callback", err instanceof SocialAuthError ? err.code : err);
    return back("li_error=check");
  }
  const ticket = randomUUID();
  await db.doc(`authTickets/${ticket}`).set({
    provider: "linkedin", mode: st.mode, uid: st.uid ?? null, bind: st.bind, origin: st.origin, identity,
    expireAt: new Date(deps.now().getTime() + TICKET_TTL_MS),
  });
  return back(`li=${ticket}`);
}

export type FinishResult =
  | { status: "signin"; token: string; needsProfile: boolean }
  | { status: "linked" }
  | { status: "link-required"; email: string };

// The page that started the sign-in redeems its ticket. Only the same browser (the bind cookie) on the same address can.
export async function finishLinkedIn(
  db: Firestore,
  p: { ticket: unknown; bindCookie: string | undefined; host: string | null; token?: DecodedIdToken | null; ip?: string },
  deps: Deps,
): Promise<FinishResult> {
  const expired = new SocialAuthError(400, "That LinkedIn sign-in has expired. Try again.");
  if (typeof p.ticket !== "string" || !/^[0-9a-f-]{36}$/.test(p.ticket)) throw expired;
  const t = await takeOnce(db, `authTickets/${p.ticket}`);
  if (!t || t.provider !== "linkedin") throw expired;
  if (toDate(t.expireAt).getTime() < deps.now().getTime()) throw expired;
  if (!p.bindCookie || sha(p.bindCookie) !== t.bind) throw new SocialAuthError(403, "Finish signing in on the device and browser you started on.");
  const here = linkedinEndpoints(p.host);
  if (!here || here.origin !== t.origin) throw new SocialAuthError(403, "Finish signing in on the address you started on.");
  const id = t.identity as VerifiedIdentity;
  const ref = db.doc(`authLinks/${linkId("linkedin", id.sub)}`);
  const auth = deps.auth();

  if (t.mode === "link") {
    if (!p.token || p.token.uid !== t.uid) throw new SocialAuthError(403, "Sign in to the account you're linking first.");
    const link = (await ref.get()).data();
    if (link && link.uid !== t.uid) throw new SocialAuthError(409, "That LinkedIn account is linked to another NotesApp account.");
    if (!link) {
      if ((await linksOf(db, String(t.uid), "linkedin")).length) throw new SocialAuthError(409, "A different LinkedIn account is linked already. Unlink it first.");
      await ref.set({ uid: t.uid, provider: "linkedin", sub: id.sub, email: id.email, name: id.name, linkedAt: deps.now().toISOString(), via: "link" });
      await audit(db, { uid: String(t.uid), action: "link", provider: "linkedin", ip: p.ip }, deps);
      await tellOwner(db, String(t.uid), "linkedin", id.name, deps);
    }
    return { status: "linked" };
  }

  // Signing in: an account linked to this LinkedIn identity?
  const link = (await ref.get()).data();
  if (link) {
    const user = await auth.getUser(String(link.uid)).catch(() => null);
    if (!user || user.disabled) throw new SocialAuthError(403, "This account can't sign in.");
    const hasProfile = (await db.doc(`users/${user.uid}`).get()).exists;
    return { status: "signin", token: await auth.createCustomToken(user.uid), needsProfile: !hasProfile };
  }
  if (!id.email || !id.emailVerified) throw new SocialAuthError(400, "Your LinkedIn account has no confirmed email address. Confirm one on LinkedIn, or sign up with your email.");
  // The email already has an account: no takeover. Sign in to it first, then link LinkedIn.
  const owner = await auth.getUserByEmail(id.email).catch(() => null);
  if (owner) {
    await audit(db, { uid: owner.uid, action: "blocked-existing-email", provider: "linkedin", ip: p.ip }, deps);
    return { status: "link-required", email: maskEmail(id.email) };
  }
  // New: the account is made now (email confirmed by LinkedIn) and goes on to finish its profile, like a new email sign-up.
  const created = await auth.createUser({ email: id.email, emailVerified: true, displayName: id.name || undefined });
  try {
    await ref.create({ uid: created.uid, provider: "linkedin", sub: id.sub, email: id.email, name: id.name, linkedAt: deps.now().toISOString(), via: "signup" });
  } catch {
    // Two windows finished at once: keep the first account, drop this one.
    await auth.deleteUser(created.uid).catch(() => {});
    const again = (await ref.get()).data();
    if (!again) throw new SocialAuthError(409, "Try signing in with LinkedIn again.");
    return { status: "signin", token: await auth.createCustomToken(String(again.uid)), needsProfile: !(await db.doc(`users/${again.uid}`).get()).exists };
  }
  await audit(db, { uid: created.uid, action: "signin-new", provider: "linkedin", ip: p.ip }, deps);
  return { status: "signin", token: await auth.createCustomToken(created.uid), needsProfile: true };
}

// Erasing an account (lib/account-server.ts): its links and its sign-in log go with it.
export async function eraseAuthLinks(db: Firestore, uid: string): Promise<number> {
  const links = await db.collection("authLinks").where("uid", "==", uid).get();
  const log = await db.collection("authAudit").where("uid", "==", uid).get();
  const all = [...links.docs, ...log.docs];
  for (let i = 0; i < all.length; i += 400) {
    const batch = db.batch();
    all.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return links.size;
}
