import { familyHost, isLocalHost, isMainHost, MAIN_HOST, ourRoot } from "./host";

// Signing in with Google and LinkedIn (owner, 4 Nov 2026). Pure rules here, shared by the server (lib/social-auth-server.ts), the
// routes and the tests.
//
// Google is Firebase's own provider (GoogleAuthProvider: a popup, or a redirect where popups can't work). LinkedIn has no Firebase
// provider without Identity Platform, so it is our own OpenID Connect flow ("Sign In with LinkedIn using OpenID Connect"):
//   /api/auth/linkedin/start → LinkedIn → /api/auth/linkedin/callback (on the main site of the family being viewed) → back to the
//   page that started it with a one-time ticket in the address fragment → /api/auth/linkedin/finish on that page's own address,
//   which checks the ticket belongs to this browser (a cookie set by start) and then signs in, creates the account or links it.
// Either way a sign-in method is linked to one account only, and an email that already has an account is never taken over: the
// person signs in to that account first and links the new method from Account settings → Sign-in methods.

export const SOCIAL_PROVIDERS = ["google", "linkedin"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export const SOCIAL_LABEL: Record<SocialProvider, string> = { google: "Google", linkedin: "LinkedIn" };
export const isSocialProvider = (p: unknown): p is SocialProvider => SOCIAL_PROVIDERS.includes(p as SocialProvider);

export const STATE_TTL_MS = 10 * 60_000; // LinkedIn must send the person back within 10 minutes
export const TICKET_TTL_MS = 2 * 60_000; // and the page must redeem the ticket within 2
export const FRESH_TOKEN_MS = 5 * 60_000; // linking needs an ID token issued in the last 5 minutes
export const BIND_COOKIE = "na_social_bind";

export const LINKEDIN_ISSUER = "https://www.linkedin.com/oauth";
export const LINKEDIN_AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_JWKS = "https://www.linkedin.com/oauth/openid/jwks";
export const LINKEDIN_SCOPES = "openid profile email";

export class SocialAuthError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

// The link document for a provider's account id: authLinks/{provider}_{sub} → { uid }. Server only.
export const linkId = (provider: SocialProvider, sub: string) => `${provider}_${sub.replace(/[^A-Za-z0-9_-]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`;

const bare = (host: string) => host.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");

// The page to come back to after LinkedIn: a path on the same address only ("/login?next=/academy"), never another site.
export function safePath(v: unknown, fallback = "/login"): string {
  if (typeof v !== "string" || v.length > 600) return fallback;
  const p = v.split("#")[0];
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\") || /[\u0000-\u001f\s]/.test(p)) return fallback;
  if (!/^\/[A-Za-z0-9\-._~/%?=&+:@,;!*'()]*$/.test(p)) return fallback;
  return p;
}

// Where a page on `host` starts and ends a LinkedIn sign-in. null = not on this address (a member's own domain, an unknown host).
// The callback is always the main site of the visitor's own domain family (www.naapp.tech for app.naapp.tech, life.naapp.tech and
// prep.naapp.tech), so LinkedIn needs one registered address per domain family, plus localhost for development.
export function linkedinEndpoints(hostHeader: string | null | undefined): { origin: string; redirectUri: string } | null {
  const raw = (hostHeader || "").trim().toLowerCase().replace(/\.$/, "");
  const h = bare(raw);
  if (!h || !/^[a-z0-9.:-]+$/.test(raw)) return null;
  if (h === "localhost" || h === "127.0.0.1") {
    const origin = `http://${raw}`;
    return { origin, redirectUri: `${origin}/api/auth/linkedin/callback` };
  }
  if (isLocalHost(h)) return { origin: `https://${h}`, redirectUri: `https://${h}/api/auth/linkedin/callback` }; // *.vercel.app previews
  if (!isMainHost(h) || !ourRoot(h)) return null;
  return { origin: `https://${h}`, redirectUri: `https://${familyHost(h, "main")}/api/auth/linkedin/callback` };
}

// Every LinkedIn redirect URL to register: one per domain family we serve (the primary first).
export function linkedinRedirectUrls(roots: string[]): string[] {
  return Array.from(new Set(roots.map((r) => `https://www.${r}/api/auth/linkedin/callback`)));
}
export const PRIMARY_LINKEDIN_REDIRECT = `https://${MAIN_HOST}/api/auth/linkedin/callback`;

// In-app browsers (Facebook, Instagram, LinkedIn, X, TikTok, Android WebView) block or lose pop-ups: Google goes by redirect there.
export function isInAppBrowser(ua: string | null | undefined): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|TikTok|BytedanceWebview|Line\/|Snapchat|; wv\)|WebView/i.test(ua || "");
}

// ── Sign-in methods on an account ────────────────────────────────────────────────────────────────────────────

export type Methods = { password: boolean; google: boolean; linkedin: boolean; passkeys: number };
export type Removable = "google" | "linkedin" | "passkey";

export const methodCount = (m: Methods) => (m.password ? 1 : 0) + (m.google ? 1 : 0) + (m.linkedin ? 1 : 0) + m.passkeys;

// Never leave an account with no way in: removing `what` must leave at least one method.
export function canRemove(m: Methods, what: Removable): boolean {
  if (what === "google" && !m.google) return false;
  if (what === "linkedin" && !m.linkedin) return false;
  if (what === "passkey" && m.passkeys < 1) return false;
  return methodCount(m) > 1;
}

// "ada.lovelace@gmail.com" → "ad•••@gmail.com", to say which account without spelling out the address.
export function maskEmail(email: string | null | undefined): string {
  const e = (email || "").trim();
  const at = e.lastIndexOf("@");
  if (at < 1) return "";
  return `${e.slice(0, Math.min(2, at))}•••${e.slice(at)}`;
}

// What Account settings → Sign-in methods shows (GET /api/auth/methods).
export type MethodsSummary = Methods & { googleEmail: string; linkedinName: string; linkedinAvailable: boolean };
