// Signing in with Google and LinkedIn: the pure rules (lib/social-auth.ts) and LinkedIn's ID token checks (lib/social-oidc.ts) with a
// stand-in JWKS. No emulator. Prints "ALL OK".
import assert from "node:assert/strict";
import { canRemove, isInAppBrowser, linkId, linkedinEndpoints, linkedinRedirectUrls, maskEmail, methodCount, safePath, type Methods } from "../../lib/social-auth";
import { linkedinAuthorizeUrl, verifyIdToken } from "../../lib/social-oidc";
import { MAIN_HOST } from "../../lib/host";
import { KID, jwks, rogue, sign } from "./fake-idp";

const now = 1_800_000_000;
const base = { iss: "https://www.linkedin.com/oauth", aud: "client-1", sub: "li-abc", iat: now - 5, exp: now + 3600, nonce: "n-1", email: "Ada@X.test", email_verified: "true", name: "Ada Lovelace", picture: "https://media.licdn.com/a.jpg" };
let fetched = 0;
const opts = (o: Partial<Parameters<typeof verifyIdToken>[1]> = {}) => ({
  issuer: "https://www.linkedin.com/oauth", audience: "client-1", nonce: "n-1", nowSec: now,
  getKeys: async (refresh: boolean) => { fetched++; return refresh ? jwks() : jwks(KID); }, ...o,
});
const rejects = async (t: string, why: string, o: Partial<Parameters<typeof verifyIdToken>[1]> = {}) =>
  assert.rejects(verifyIdToken(t, opts(o)), (e: { code?: string; status?: number }) => e.code === why && e.status === 401, why);

(async () => {
  // A good token: the identity comes out, email lower-cased, "true" as a string counts.
  const id = await verifyIdToken(sign(base), opts());
  assert.deepEqual(id, { sub: "li-abc", email: "ada@x.test", emailVerified: true, name: "Ada Lovelace", picture: "https://media.licdn.com/a.jpg" });
  assert.equal((await verifyIdToken(sign({ ...base, email_verified: false }), opts())).emailVerified, false);
  assert.equal((await verifyIdToken(sign({ ...base, aud: ["other", "client-1"] }), opts())).sub, "li-abc");
  // Every check.
  await rejects(sign({ ...base, iss: "https://evil.test" }), "iss");
  await rejects(sign({ ...base, aud: "someone-else" }), "aud");
  await rejects(sign({ ...base, exp: now - 600 }), "exp");
  await rejects(sign({ ...base, iat: now + 600 }), "iat");
  await rejects(sign({ ...base, nonce: "replayed" }), "nonce");
  await rejects(sign({ ...base, nonce: "replayed" }), "nonce", { nonceOptional: true }); // a wrong nonce never passes
  const { nonce: _n, ...noNonce } = base;
  await rejects(sign(noNonce), "nonce");
  assert.equal((await verifyIdToken(sign(noNonce), opts({ nonceOptional: true }))).sub, "li-abc"); // LinkedIn may leave it out
  await rejects(sign(base, { key: rogue.privateKey }), "signature"); // signed by a key LinkedIn doesn't publish
  await rejects(sign(base, { alg: "HS256" }), "alg");
  await rejects(sign(base, { alg: "none" }), "alg");
  await rejects("not.a.token", "malformed");
  await rejects("a.b", "malformed");
  const [h, , s] = sign(base).split(".");
  await rejects(`${h}.${Buffer.from(JSON.stringify({ ...base, sub: "li-other" })).toString("base64url")}.${s}`, "signature"); // claims swapped
  await rejects(sign({ ...base, sub: "" }), "sub");
  // Key rotation: an unknown kid fetches the keys again once; still unknown → refused.
  fetched = 0;
  assert.equal((await verifyIdToken(sign(base, { kid: "rotated" }), opts({ getKeys: async (r) => { fetched++; return r ? jwks("rotated") : jwks(); } }))).sub, "li-abc");
  assert.equal(fetched, 2);
  await rejects(sign(base, { kid: "nobody" }), "kid");

  // The authorisation link: our client, the callback, state, nonce and the OpenID scopes.
  const u = new URL(linkedinAuthorizeUrl({ clientId: "client-1", redirectUri: "https://www.naapp.tech/api/auth/linkedin/callback", state: "st", nonce: "nn" }));
  assert.equal(u.origin + u.pathname, "https://www.linkedin.com/oauth/v2/authorization");
  assert.equal(u.searchParams.get("scope"), "openid profile email");
  assert.equal(u.searchParams.get("state"), "st");
  assert.equal(u.searchParams.get("nonce"), "nn");
  assert.equal(u.searchParams.get("redirect_uri"), "https://www.naapp.tech/api/auth/linkedin/callback");

  // Only paths on the same address come back (no open redirects).
  assert.equal(safePath("/login?next=/academy"), "/login?next=/academy");
  assert.equal(safePath("/signup#x"), "/signup");
  for (const bad of ["//evil.test/x", "https://evil.test", "/\\evil.test", "javascript:alert(1)", "/a b", "/x\n", "", null, 42, "/" + "a".repeat(700)]) assert.equal(safePath(bad), "/login", String(bad));

  // Where LinkedIn sends people back: the main site of the family being viewed; localhost for development; never other sites.
  assert.deepEqual(linkedinEndpoints("app.naapp.tech"), { origin: "https://app.naapp.tech", redirectUri: "https://www.naapp.tech/api/auth/linkedin/callback" });
  assert.deepEqual(linkedinEndpoints("prep.naapp.tech"), { origin: "https://prep.naapp.tech", redirectUri: "https://www.naapp.tech/api/auth/linkedin/callback" });
  assert.deepEqual(linkedinEndpoints("life.notesapp.name.ng"), { origin: "https://life.notesapp.name.ng", redirectUri: "https://www.notesapp.name.ng/api/auth/linkedin/callback" });
  assert.deepEqual(linkedinEndpoints("www.notesapp.name.ng"), { origin: "https://www.notesapp.name.ng", redirectUri: "https://www.notesapp.name.ng/api/auth/linkedin/callback" });
  assert.equal(linkedinEndpoints("notesapp.ng")?.redirectUri, `https://${MAIN_HOST}/api/auth/linkedin/callback`);
  assert.deepEqual(linkedinEndpoints("localhost:3000"), { origin: "http://localhost:3000", redirectUri: "http://localhost:3000/api/auth/linkedin/callback" });
  for (const bad of ["evil.test", "notes.brand.com", "naapp.tech.evil.test", "", null, "www.naapp.tech/x"]) assert.equal(linkedinEndpoints(bad), null, String(bad));
  assert.deepEqual(linkedinRedirectUrls(["notesapp.name.ng", "naapp.tech", "naapp.tech"]), ["https://www.notesapp.name.ng/api/auth/linkedin/callback", "https://www.naapp.tech/api/auth/linkedin/callback"]);

  // Never the last way in.
  const m = (o: Partial<Methods>): Methods => ({ password: false, google: false, linkedin: false, passkeys: 0, ...o });
  assert.equal(canRemove(m({ google: true }), "google"), false);
  assert.equal(canRemove(m({ google: true, password: true }), "google"), true);
  assert.equal(canRemove(m({ linkedin: true, passkeys: 1 }), "linkedin"), true);
  assert.equal(canRemove(m({ linkedin: true, passkeys: 1 }), "passkey"), true);
  assert.equal(canRemove(m({ passkeys: 1 }), "passkey"), false);
  assert.equal(canRemove(m({ passkeys: 2 }), "passkey"), true);
  assert.equal(canRemove(m({ password: true }), "linkedin"), false); // nothing to unlink
  assert.equal(methodCount(m({ password: true, google: true, linkedin: true, passkeys: 2 })), 5);

  assert.equal(maskEmail("ada.lovelace@gmail.com"), "ad•••@gmail.com");
  assert.equal(maskEmail("a@x.test"), "a•••@x.test");
  assert.equal(maskEmail("nope"), "");
  assert.equal(linkId("linkedin", "Ab-_9"), "linkedin_Ab-_9");
  assert.equal(linkId("google", "a/b"), "google_a%2fb");
  assert.ok(isInAppBrowser("Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/400]"));
  assert.ok(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) Instagram 300"));
  assert.ok(!isInAppBrowser("Mozilla/5.0 (Macintosh) Safari/605.1.15"));
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
