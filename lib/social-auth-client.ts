import {
  GoogleAuthProvider, getRedirectResult, linkWithCredential, linkWithPopup, linkWithRedirect, signInWithCustomToken, signInWithPopup,
  signInWithRedirect, signOut, type OAuthCredential, type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { getUserByUid } from "./users";
import { KID_PREFIX } from "./kids";
import { isInAppBrowser, type MethodsSummary, type SocialProvider } from "./social-auth";
import { installGoogleGate, type GoogleCheck, type GoogleGate } from "./google-gate";

// Browser side of signing in with Google and LinkedIn (lib/social-auth.ts has the rules, lib/social-auth-server.ts the checks).

export type SocialOutcome =
  | { kind: "signed-in"; user: User; needsProfile: boolean; provider: SocialProvider }
  | { kind: "link-required"; provider: SocialProvider; email: string; canLinkAfterPassword?: boolean; hasOtherWay?: boolean }
  | { kind: "linked"; provider: SocialProvider }
  | { kind: "redirecting" };

// While a Google or LinkedIn sign-in is being checked, pages that redirect on any sign-in (the app's welcome screen) wait.
// Back from a Google redirect, the page counts as busy from its first moment until the result is checked (googleRedirectResult).
let busy = 0;
const REDIRECT_FLAG = "na_google_redirect";
const store = () => { try { return window.sessionStorage; } catch { return null; } };
// The flag says which Google redirect is coming back: "signin" (checked by the gate before the app sees the user) or "link".
const redirectMode = typeof window !== "undefined" ? store()?.getItem(REDIRECT_FLAG) ?? null : null; // as the page loaded
let redirectPending = !!redirectMode;
if (redirectPending) setTimeout(() => { redirectPending = false; }, 20_000); // never stuck
export const socialSignInBusy = () => busy > 0 || redirectPending;
const redirecting = (mode: "signin" | "link") => store()?.setItem(REDIRECT_FLAG, mode);
async function hold<T>(f: () => Promise<T>): Promise<T> { busy++; try { return await f(); } finally { busy--; } }

// Google said the email has an account already: kept here so it can be linked right after the person signs in with their password.
let pendingGoogle: OAuthCredential | null = null;
export const hasPendingGoogle = () => pendingGoogle !== null;

async function call<T>(url: string, init: RequestInit & { token?: string; json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}), ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) };
  const r = await fetch(url, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), headers, body: init.json !== undefined ? JSON.stringify(init.json) : undefined, cache: "no-store", credentials: "same-origin" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j as T;
}

const googleProvider = () => { const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" }); return p; };
const codeOf = (e: unknown) => (e as { code?: string })?.code || "";
const needsRedirect = (e: unknown) => ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(codeOf(e));

function friendly(e: unknown): Error {
  const c = codeOf(e);
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request" || c === "auth/user-cancelled") return new Error("Cancelled. Try again when you're ready.");
  if (c === "auth/credential-already-in-use") return new Error("That Google account is linked to another NotesApp account.");
  if (c === "auth/provider-already-linked") return new Error("Google is already linked to your account.");
  if (c === "auth/unauthorized-domain") return new Error("Google sign-in isn't switched on for this address yet.");
  if (c === "auth/network-request-failed") return new Error("Network problem. Check your connection and try again.");
  if (c === "auth/user-disabled") return new Error("This account can't sign in.");
  return e instanceof Error ? e : new Error("Something went wrong. Try again.");
}

function existsError(e: unknown): SocialOutcome | null {
  if (codeOf(e) !== "auth/account-exists-with-different-credential") return null;
  pendingGoogle = GoogleAuthProvider.credentialFromError(e as never);
  const email = String((e as { customData?: { email?: string } }).customData?.email || "");
  return { kind: "link-required", provider: "google", email, canLinkAfterPassword: pendingGoogle !== null, hasOtherWay: true };
}

async function confirmGoogle(user: User, mode: "signin" | "link") {
  return call<GoogleCheck>("/api/auth/google", { token: await user.getIdToken(true), json: { mode } });
}

// Our server checks a Google sign-in before the app hears about it (lib/google-gate.ts). Installed once, in the browser.
const gate: GoogleGate | null = typeof window === "undefined" ? null
  : installGoogleGate(auth, (u) => confirmGoogle(u, "signin"), () => redirectPending && redirectMode === "signin"); // only the redirect this page load came back from
const heldOutcome = (): SocialOutcome | null => {
  const b = gate?.blocked();
  if (!b) return null;
  if ("error" in b) throw friendly(b.error);
  return { kind: "link-required", provider: "google", email: b.result.email, hasOtherWay: b.result.hasOtherWay };
};

async function afterGoogle(user: User): Promise<SocialOutcome> {
  let r = gate?.take(user.uid) ?? null; // already checked by the gate (the usual case)
  if (!r) {
    try { r = await confirmGoogle(user, "signin"); }
    catch (e) { await signOut(auth).catch(() => {}); throw e; }
  }
  if (r.status === "link-required") {
    await signOut(auth).catch(() => {});
    return { kind: "link-required", provider: "google", email: r.email, hasOtherWay: r.hasOtherWay };
  }
  return { kind: "signed-in", user, needsProfile: r.needsProfile, provider: "google" };
}

// "Continue with Google": a pop-up, or a redirect in in-app browsers and wherever the pop-up can't open.
export function continueWithGoogle(): Promise<SocialOutcome> {
  return hold(async () => {
    if (isInAppBrowser(navigator.userAgent)) { redirecting("signin"); await signInWithRedirect(auth, googleProvider()); return { kind: "redirecting" }; }
    let cred;
    gate?.arm();
    try { cred = await signInWithPopup(auth, googleProvider()); }
    catch (e) {
      const held = heldOutcome();
      if (held) return held;
      const exists = existsError(e);
      if (exists) return exists;
      if (needsRedirect(e)) { redirecting("signin"); await signInWithRedirect(auth, googleProvider()); return { kind: "redirecting" }; }
      throw friendly(e);
    }
    finally { gate?.disarm(); }
    return afterGoogle(cred.user);
  });
}

// Back from a Google redirect (sign-in or link). null when this page load isn't one.
export function googleRedirectResult(): Promise<SocialOutcome | null> {
  return hold(async () => {
    let cred;
    try { cred = await getRedirectResult(auth); }
    catch (e) { const held = heldOutcome(); if (held) return held; const exists = existsError(e); if (exists) return exists; throw friendly(e); }
    finally { redirectPending = false; store()?.removeItem(REDIRECT_FLAG); }
    if (!cred) return null;
    if (cred.operationType === "link") { await confirmGoogle(cred.user, "link"); return { kind: "linked", provider: "google" }; }
    return afterGoogle(cred.user);
  });
}

// After a password (or passkey) sign-in that Google asked for: link the Google account it remembered. True if linked.
export async function linkPendingGoogle(user: User): Promise<boolean> {
  const cred = pendingGoogle;
  pendingGoogle = null;
  if (!cred) return false;
  try { await linkWithCredential(user, cred); await confirmGoogle(user, "link"); return true; }
  catch (e) { throw friendly(e); }
}

export async function linkGoogle(user: User): Promise<SocialOutcome> {
  try { await linkWithPopup(user, googleProvider()); }
  catch (e) {
    if (needsRedirect(e)) { redirecting("link"); await linkWithRedirect(user, googleProvider()); return { kind: "redirecting" }; }
    throw friendly(e);
  }
  await confirmGoogle(user, "link");
  return { kind: "linked", provider: "google" };
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────────────────────────────────────

const here = () => `${window.location.pathname}${window.location.search}`;

export async function startLinkedIn(mode: "signin" | "link", user?: User | null): Promise<void> {
  const token = mode === "link" && user ? await user.getIdToken(true) : undefined;
  const { url } = await call<{ url: string }>("/api/auth/linkedin/start", { token, json: { mode, returnPath: here() } });
  window.location.assign(url);
}

const LI_ERRORS: Record<string, string> = {
  cancelled: "LinkedIn sign-in was cancelled.",
  expired: "That LinkedIn sign-in took too long. Try again.",
  address: "Start the LinkedIn sign-in again from this page.",
  refused: "LinkedIn didn't accept the sign-in. Try again.",
  check: "LinkedIn's answer couldn't be checked. Try again.",
  unavailable: "LinkedIn sign-in isn't set up yet.",
  failed: "Something went wrong with LinkedIn. Try again.",
};

// Back from LinkedIn: the address ends in #li=<ticket> (or #li_error=<reason>). Redeems the ticket once and clears the address.
// null when this page load isn't one.
export function linkedinReturn(user?: User | null): Promise<SocialOutcome | null> {
  const m = /^#li(_error)?=([A-Za-z0-9_-]{1,64})$/.exec(window.location.hash);
  if (!m) return Promise.resolve(null);
  window.history.replaceState(null, "", here());
  if (m[1]) return Promise.reject(new Error(LI_ERRORS[m[2]] ?? LI_ERRORS.failed));
  return hold(async () => {
    const token = user ? await user.getIdToken() : undefined;
    const r = await call<{ status: "signin"; token: string; needsProfile: boolean } | { status: "linked" } | { status: "link-required"; email: string }>("/api/auth/linkedin/finish", { token, json: { ticket: m[2] } });
    if (r.status === "linked") return { kind: "linked", provider: "linkedin" };
    if (r.status === "link-required") return { kind: "link-required", provider: "linkedin", email: r.email, hasOtherWay: true };
    const signed = await signInWithCustomToken(auth, r.token);
    return { kind: "signed-in", user: signed.user, needsProfile: r.needsProfile, provider: "linkedin" };
  });
}

// ── The account's sign-in methods ──────────────────────────────────────────────────────────────────────────────

let available: Promise<boolean> | null = null;
export function linkedinAvailable(): Promise<boolean> {
  available ??= call<{ linkedinAvailable: boolean }>("/api/auth/methods").then((j) => j.linkedinAvailable === true).catch(() => false);
  return available;
}
export async function myMethods(user: User): Promise<MethodsSummary> {
  return call<MethodsSummary>("/api/auth/methods", { token: await user.getIdToken() });
}
export async function unlinkMethod(user: User, provider: SocialProvider): Promise<MethodsSummary> {
  const m = await call<MethodsSummary>("/api/auth/methods", { method: "DELETE", token: await user.getIdToken(), json: { provider } });
  await user.reload().catch(() => {});
  return m;
}

// Signed in with Google or LinkedIn but the new-account steps (username, terms, profile) aren't done yet. Accounts with a password
// always made their profile at sign-up, so they never count.
// Only accounts made by Google (google.com provider) or by LinkedIn (no provider, an email we set) count; kids' sessions
// (custom tokens without an email) and everything else never do.
export function socialAccount(user: User | null | undefined): boolean {
  if (!user || user.uid.startsWith(KID_PREFIX)) return false;
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes("password")) return false;
  return ids.includes("google.com") || (ids.length === 0 && !!user.email);
}
export async function needsCompletion(user: User | null | undefined): Promise<boolean> {
  if (!user || !socialAccount(user)) return false;
  return (await getUserByUid(user.uid).catch(() => undefined)) === null;
}
