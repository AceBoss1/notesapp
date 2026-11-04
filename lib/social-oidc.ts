import { createPublicKey, verify as verifySignature, type JsonWebKey } from "crypto";
import { LINKEDIN_AUTHORIZE, LINKEDIN_SCOPES, SocialAuthError } from "./social-auth";

// OpenID Connect checks for "Sign In with LinkedIn" (server only: uses Node's crypto). The rest of the rules: lib/social-auth.ts.

// ── OpenID Connect: LinkedIn's ID token ───────────────────────────────────────────────────────────────────────

export type Jwk = JsonWebKey & { kid?: string; kty?: string; alg?: string; use?: string };
export type IdClaims = {
  iss: string; aud: string | string[]; sub: string; exp: number; iat: number; nonce?: string;
  email?: string; email_verified?: boolean | string; name?: string; given_name?: string; family_name?: string; picture?: string;
};
export type VerifiedIdentity = { sub: string; email: string; emailVerified: boolean; name: string; picture: string };

const b64json = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

// Checks an ID token the way OpenID Connect asks: RS256 signature by a key in the provider's JWKS, issuer, audience (our client id),
// not expired, not issued in the future, and the nonce we sent. `getKeys(refresh)` returns the JWKS (refresh = the key id wasn't
// in the cached set). A missing nonce is accepted only when `nonceOptional` (LinkedIn's documentation doesn't promise to echo it;
// the token came straight from LinkedIn's token endpoint over TLS with our secret, so it can't have been swapped in transit).
export async function verifyIdToken(
  token: string,
  opts: { issuer: string; audience: string; nonce: string; nowSec: number; getKeys: (refresh: boolean) => Promise<Jwk[]>; skewSec?: number; nonceOptional?: boolean },
): Promise<VerifiedIdentity> {
  const bad = (why: string) => new SocialAuthError(401, "LinkedIn's answer couldn't be checked. Try again.", why);
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) throw bad("malformed");
  let header: { alg?: string; kid?: string; typ?: string }, claims: IdClaims;
  try { header = b64json(parts[0]); claims = b64json(parts[1]); } catch { throw bad("malformed"); }
  if (header.alg !== "RS256") throw bad("alg");
  let keys = await opts.getKeys(false);
  let jwk = keys.find((k) => k.kid === header.kid && (k.kty === "RSA"));
  if (!jwk) { keys = await opts.getKeys(true); jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA"); }
  if (!jwk) throw bad("kid");
  let ok = false;
  try {
    const key = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
    ok = verifySignature("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
  } catch { ok = false; }
  if (!ok) throw bad("signature");
  const skew = opts.skewSec ?? 120;
  if (claims.iss !== opts.issuer) throw bad("iss");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(opts.audience)) throw bad("aud");
  if (typeof claims.exp !== "number" || claims.exp + skew < opts.nowSec) throw bad("exp");
  if (typeof claims.iat === "number" && claims.iat - skew > opts.nowSec) throw bad("iat");
  if (claims.nonce !== undefined || !opts.nonceOptional) { if (claims.nonce !== opts.nonce) throw bad("nonce"); }
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 256) throw bad("sub");
  const name = [claims.name, [claims.given_name, claims.family_name].filter(Boolean).join(" ")].find((s) => typeof s === "string" && s.trim()) || "";
  return {
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "",
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: String(name).trim().slice(0, 80),
    picture: typeof claims.picture === "string" && /^https:\/\//.test(claims.picture) ? claims.picture : "",
  };
}

export function linkedinAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; nonce: string }): string {
  // LinkedIn's web flow takes state and nonce; it doesn't offer PKCE to apps with a client secret, so none is sent.
  const q = new URLSearchParams({ response_type: "code", client_id: p.clientId, redirect_uri: p.redirectUri, state: p.state, nonce: p.nonce, scope: LINKEDIN_SCOPES });
  return `${LINKEDIN_AUTHORIZE}?${q}`;
}
