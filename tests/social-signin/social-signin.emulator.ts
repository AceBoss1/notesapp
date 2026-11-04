// Signing in with Google and LinkedIn end to end against the Firestore and Auth emulators, with a stand-in LinkedIn (token endpoint
// and JWKS): a new LinkedIn account, signing in again (staff claims kept), an email that already has an account (no takeover),
// linking from settings (one browser, one account, emailed and logged), Google's first sign-in, Google landing on an existing
// account (taken off again), linking Google, unlinking (never the last way in), and erasing the account. Prints "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

process.env.LINKEDIN_LOGIN_CLIENT_ID = "client-1";
process.env.LINKEDIN_LOGIN_CLIENT_SECRET = "secret-1";

import { SocialAuthError, linkId } from "../../lib/social-auth";
import { LINKEDIN_JWKS, LINKEDIN_TOKEN } from "../../lib/social-auth";
import {
  assertCanRemove, confirmGoogle, eraseAuthLinks, finishLinkedIn, linkedinCallback, methodsOf, resetJwksCache, startLinkedIn, unlinkMethod, type Deps,
} from "../../lib/social-auth-server";
import { jwks, rogue, sign } from "./fake-idp";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const auth = getAuth();
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST!;
const HOST = "localhost:3000", ORIGIN = "http://localhost:3000";

// The stand-in LinkedIn: whatever the next ID token should say.
let next: { claims?: Record<string, unknown>; rogue?: boolean; fail?: boolean } = {};
let clock = Date.now();
const mails: { to: string; subject: string }[] = [];
const deps: Deps = {
  now: () => new Date(clock),
  auth: () => auth,
  notify: async (to, subject) => { mails.push({ to, subject }); },
  fetch: (async (url: string, init?: RequestInit) => {
    if (url === LINKEDIN_JWKS) return new Response(JSON.stringify({ keys: jwks() }), { status: 200 });
    if (url === LINKEDIN_TOKEN) {
      const b = new URLSearchParams(String(init?.body));
      assert.equal(b.get("client_id"), "client-1");
      assert.equal(b.get("client_secret"), "secret-1");
      assert.equal(b.get("redirect_uri"), `${ORIGIN}/api/auth/linkedin/callback`);
      if (next.fail) return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      return new Response(JSON.stringify({ access_token: "at", id_token: sign(next.claims!, next.rogue ? { key: rogue.privateKey } : {}) }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch,
};
const claims = (sub: string, email: string, nonce: string, extra: Record<string, unknown> = {}) => ({
  iss: "https://www.linkedin.com/oauth", aud: "client-1", sub, email, email_verified: true, name: "Test Person", nonce,
  iat: Math.floor(clock / 1000), exp: Math.floor(clock / 1000) + 3600, ...extra,
});

// One whole LinkedIn round trip up to the ticket: start → (LinkedIn) → callback. Returns the ticket, the browser's bind cookie and
// where the browser was sent.
async function roundTrip(o: { mode: "signin" | "link"; uid?: string; sub: string; email: string; returnPath?: string; extra?: Record<string, unknown>; mutate?: (c: Record<string, unknown>) => void }) {
  const { url, bind } = await startLinkedIn(db, { host: HOST, mode: o.mode, uid: o.uid, returnPath: o.returnPath ?? "/login?next=/academy" }, deps);
  const u = new URL(url);
  const c = claims(o.sub, o.email, u.searchParams.get("nonce")!, o.extra);
  o.mutate?.(c);
  next = { claims: c };
  const to = await linkedinCallback(db, { code: "code-1", state: u.searchParams.get("state"), callbackHost: HOST }, deps);
  const m = /#li=([0-9a-f-]{36})$/.exec(to);
  return { to, ticket: m?.[1] ?? "", bind, state: u.searchParams.get("state")! };
}
const refused = async (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof SocialAuthError && e.status === status);

// A real ID token from the Auth emulator: through a custom token (like a passkey or LinkedIn) or Google (signInWithIdp, unsigned).
async function idTokenFor(uid: string): Promise<DecodedIdToken> {
  const ct = await auth.createCustomToken(uid);
  const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
  const j = await r.json() as { idToken: string };
  return auth.verifyIdToken(j.idToken);
}
async function googleSignIn(sub: string, email: string): Promise<{ token: DecodedIdToken; raw: Record<string, unknown> }> {
  const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestUri: "http://localhost", returnSecureToken: true, returnIdpCredential: true, postBody: `id_token=${encodeURIComponent(JSON.stringify({ sub, email, email_verified: true, name: "G Person" }))}&providerId=google.com` }),
  });
  const j = await r.json() as Record<string, unknown>;
  if (!j.idToken) return { token: null as unknown as DecodedIdToken, raw: j };
  return { token: await auth.verifyIdToken(String(j.idToken)), raw: j };
}
const claimsOf = async (customToken: string) => {
  const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const j = await r.json() as { idToken: string };
  return JSON.parse(Buffer.from(j.idToken.split(".")[1], "base64url").toString());
};

(async () => {
  resetJwksCache();
  // ── LinkedIn: a brand-new account ──
  const a = await roundTrip({ mode: "signin", sub: "li-new", email: "New.Person@x.test" });
  assert.match(a.to, /^http:\/\/localhost:3000\/login\?next=\/academy#li=/);
  // The state works once only.
  assert.match(await linkedinCallback(db, { code: "code-1", state: a.state, callbackHost: HOST }, deps), /#li_error=expired$/);
  // Another browser (no cookie, wrong cookie) or another address can't redeem it… and a refused try doesn't use it up for the
  // attacker either: the ticket is spent on the first attempt, so the person starts again.
  const a2 = await roundTrip({ mode: "signin", sub: "li-new", email: "new.person@x.test" });
  await refused(finishLinkedIn(db, { ticket: a2.ticket, bindCookie: "stolen", host: HOST }, deps), 403);
  await refused(finishLinkedIn(db, { ticket: a2.ticket, bindCookie: a2.bind, host: HOST }, deps), 400); // spent
  const a3 = await roundTrip({ mode: "signin", sub: "li-new", email: "new.person@x.test" });
  await refused(finishLinkedIn(db, { ticket: a3.ticket, bindCookie: a3.bind, host: "127.0.0.1:3000" }, deps), 403);
  const r1 = await finishLinkedIn(db, { ticket: a.ticket, bindCookie: a.bind, host: HOST, ip: "1.2.3.4" }, deps);
  assert.equal(r1.status, "signin");
  assert.ok(r1.status === "signin" && r1.needsProfile && r1.token.length > 20);
  await refused(finishLinkedIn(db, { ticket: a.ticket, bindCookie: a.bind, host: HOST }, deps), 400); // ticket once only
  const newbie = await auth.getUserByEmail("new.person@x.test");
  assert.equal(newbie.emailVerified, true); // LinkedIn confirmed it
  assert.equal((await db.doc(`authLinks/${linkId("linkedin", "li-new")}`).get()).data()?.uid, newbie.uid);
  assert.ok((await db.collection("authAudit").where("uid", "==", newbie.uid).get()).docs.some((d) => d.data().action === "signin-new"));

  // Signing in again: the same account; staff claims stay on it; no profile yet → still asked to finish.
  await auth.setCustomUserClaims(newbie.uid, { admin: true, adminRole: "support", depts: ["support"] });
  const b = await roundTrip({ mode: "signin", sub: "li-new", email: "new.person@x.test" });
  const r2 = await finishLinkedIn(db, { ticket: b.ticket, bindCookie: b.bind, host: HOST }, deps);
  assert.ok(r2.status === "signin" && r2.needsProfile);
  const signedIn = await claimsOf(r2.status === "signin" ? r2.token : "");
  assert.equal(signedIn.user_id, newbie.uid);
  assert.equal(signedIn.adminRole, "support");
  await db.doc(`users/${newbie.uid}`).set({ uid: newbie.uid, username: "newperson" });
  const c = await roundTrip({ mode: "signin", sub: "li-new", email: "new.person@x.test" });
  const r3 = await finishLinkedIn(db, { ticket: c.ticket, bindCookie: c.bind, host: HOST }, deps);
  assert.ok(r3.status === "signin" && !r3.needsProfile);
  // A disabled account can't.
  await auth.updateUser(newbie.uid, { disabled: true });
  const d0 = await roundTrip({ mode: "signin", sub: "li-new", email: "new.person@x.test" });
  await refused(finishLinkedIn(db, { ticket: d0.ticket, bindCookie: d0.bind, host: HOST }, deps), 403);
  await auth.updateUser(newbie.uid, { disabled: false });

  // ── LinkedIn: the email already has an account → no takeover ──
  const ada = await auth.createUser({ email: "ada@x.test", password: "secret-ada", emailVerified: true });
  await db.doc(`users/${ada.uid}`).set({ uid: ada.uid, username: "ada" });
  const e = await roundTrip({ mode: "signin", sub: "li-ada", email: "ADA@x.test" });
  const r4 = await finishLinkedIn(db, { ticket: e.ticket, bindCookie: e.bind, host: HOST }, deps);
  assert.deepEqual(r4, { status: "link-required", email: "ad•••@x.test" });
  assert.equal((await db.doc(`authLinks/${linkId("linkedin", "li-ada")}`).get()).exists, false);
  // An unconfirmed LinkedIn email can't make an account.
  const f = await roundTrip({ mode: "signin", sub: "li-unverified", email: "someone@x.test", extra: { email_verified: false } });
  await refused(finishLinkedIn(db, { ticket: f.ticket, bindCookie: f.bind, host: HOST }, deps), 400);
  assert.equal(await auth.getUserByEmail("someone@x.test").then(() => true).catch(() => false), false);

  // ── LinkedIn's answer is checked ──
  const bad = async (o: Parameters<typeof roundTrip>[0], why: string) => { const r = await roundTrip(o); assert.match(r.to, new RegExp(`#li_error=${why}$`)); };
  await bad({ mode: "signin", sub: "x", email: "x@x.test", mutate: (c) => { c.nonce = "someone-elses"; } }, "check");
  await bad({ mode: "signin", sub: "x", email: "x@x.test", mutate: (c) => { c.aud = "other-app"; } }, "check");
  await bad({ mode: "signin", sub: "x", email: "x@x.test", mutate: (c) => { c.iss = "https://evil.test"; } }, "check");
  {
    const { url } = await startLinkedIn(db, { host: HOST, mode: "signin", returnPath: "/login" }, deps);
    const st = new URL(url).searchParams;
    next = { claims: claims("x", "x@x.test", st.get("nonce")!), rogue: true };
    assert.match(await linkedinCallback(db, { code: "c", state: st.get("state"), callbackHost: HOST }, deps), /#li_error=check$/);
  }
  {
    const { url } = await startLinkedIn(db, { host: HOST, mode: "signin", returnPath: "/login" }, deps);
    assert.match(await linkedinCallback(db, { error: "user_cancelled_login", state: new URL(url).searchParams.get("state"), callbackHost: HOST }, deps), /^http:\/\/localhost:3000\/login#li_error=cancelled$/);
  }
  {
    const { url } = await startLinkedIn(db, { host: HOST, mode: "signin", returnPath: "/login" }, deps);
    next = { fail: true };
    assert.match(await linkedinCallback(db, { code: "c", state: new URL(url).searchParams.get("state"), callbackHost: HOST }, deps), /#li_error=refused$/);
  }
  {
    // Arriving at another address than the one LinkedIn was told; too late; an open redirect in the return path.
    const s1 = await startLinkedIn(db, { host: HOST, mode: "signin", returnPath: "//evil.test/x" }, deps);
    assert.match(await linkedinCallback(db, { code: "c", state: new URL(s1.url).searchParams.get("state"), callbackHost: "www.naapp.tech" }, deps), /^http:\/\/localhost:3000\/login#li_error=address$/);
    const s2 = await startLinkedIn(db, { host: HOST, mode: "signin", returnPath: "/login" }, deps);
    clock += 11 * 60_000;
    assert.match(await linkedinCallback(db, { code: "c", state: new URL(s2.url).searchParams.get("state"), callbackHost: HOST }, deps), /#li_error=expired$/);
    clock = Date.now();
    assert.match(await linkedinCallback(db, { code: "c", state: "made-up-state-made-up-state", callbackHost: HOST }, deps), /\/login#li_error=expired$/);
  }
  await refused(startLinkedIn(db, { host: "evil.test", mode: "signin", returnPath: "/login" }, deps), 400);

  // ── LinkedIn: linking from Account settings ──
  const adaTok = await idTokenFor(ada.uid);
  const g = await roundTrip({ mode: "link", uid: ada.uid, sub: "li-ada", email: "ada@x.test", returnPath: "/profile/account" });
  assert.match(g.to, /^http:\/\/localhost:3000\/profile\/account#li=/);
  // Only Ada, signed in, in her browser, finishes it.
  const bob = await auth.createUser({ email: "bob@x.test", password: "secret-bob" });
  await refused(finishLinkedIn(db, { ticket: g.ticket, bindCookie: g.bind, host: HOST, token: await idTokenFor(bob.uid) }, deps), 403);
  const g2 = await roundTrip({ mode: "link", uid: ada.uid, sub: "li-ada", email: "ada@x.test", returnPath: "/profile/account" });
  mails.length = 0;
  assert.deepEqual(await finishLinkedIn(db, { ticket: g2.ticket, bindCookie: g2.bind, host: HOST, token: adaTok }, deps), { status: "linked" });
  assert.equal((await db.doc(`authLinks/${linkId("linkedin", "li-ada")}`).get()).data()?.uid, ada.uid);
  assert.deepEqual(mails.map((m) => m.to), ["ada@x.test"]);
  assert.match(mails[0].subject, /LinkedIn was linked/);
  assert.ok((await db.collection("authAudit").where("uid", "==", ada.uid).get()).docs.some((d) => d.data().action === "link" && d.data().provider === "linkedin"));
  // Now LinkedIn signs Ada in.
  const h = await roundTrip({ mode: "signin", sub: "li-ada", email: "ada@x.test" });
  const r5 = await finishLinkedIn(db, { ticket: h.ticket, bindCookie: h.bind, host: HOST }, deps);
  assert.ok(r5.status === "signin" && (await claimsOf(r5.token)).user_id === ada.uid);
  // Someone else's LinkedIn (linked to the new account) can't be linked to Ada; nor a second LinkedIn.
  const i = await roundTrip({ mode: "link", uid: ada.uid, sub: "li-new", email: "new.person@x.test", returnPath: "/profile/account" });
  await refused(finishLinkedIn(db, { ticket: i.ticket, bindCookie: i.bind, host: HOST, token: adaTok }, deps), 409);
  const j = await roundTrip({ mode: "link", uid: ada.uid, sub: "li-ada-2", email: "ada2@x.test", returnPath: "/profile/account" });
  await refused(finishLinkedIn(db, { ticket: j.ticket, bindCookie: j.bind, host: HOST, token: adaTok }, deps), 409);

  // ── Google ──
  // A first Google sign-in: recorded, asked to finish the profile.
  const gNew = await googleSignIn("g-new", "gina@gmail.test");
  assert.ok(gNew.token, JSON.stringify(gNew.raw));
  assert.equal((gNew.token.firebase as { sign_in_provider?: string }).sign_in_provider, "google.com");
  assert.deepEqual(await confirmGoogle(db, gNew.token, "signin", deps), { status: "ok", needsProfile: true });
  assert.equal((await db.doc(`authLinks/${linkId("google", "g-new")}`).get()).data()?.uid, gNew.token.uid);
  assert.deepEqual(await confirmGoogle(db, gNew.token, "signin", deps), { status: "ok", needsProfile: true }); // again: same answer
  // "link" mode on the account's own Google: nothing new to record, no email.
  mails.length = 0;
  assert.deepEqual(await confirmGoogle(db, gNew.token, "link", deps), { status: "ok", needsProfile: true });
  assert.equal(mails.length, 0);

  // Google lands on an account that already existed (Firebase links a verified Google email by itself): taken off again.
  const carol = await auth.createUser({ email: "carol@x.test", password: "secret-carol", emailVerified: true });
  await db.doc(`users/${carol.uid}`).set({ uid: carol.uid, username: "carol" });
  await auth.updateUser(carol.uid, { providerToLink: { providerId: "google.com", uid: "g-carol", email: "carol@x.test" } });
  const asGoogle = { ...(await idTokenFor(carol.uid)), firebase: { sign_in_provider: "google.com", identities: {} } } as DecodedIdToken;
  const merged = await confirmGoogle(db, asGoogle, "signin", deps);
  assert.deepEqual(merged, { status: "link-required", email: "ca•••@x.test", hasOtherWay: true });
  assert.deepEqual((await auth.getUser(carol.uid)).providerData.map((p) => p.providerId), ["password"]);
  assert.equal((await db.doc(`authLinks/${linkId("google", "g-carol")}`).get()).exists, false);

  // Carol signs in with her password and links Google herself: recorded, emailed, logged.
  await auth.updateUser(carol.uid, { providerToLink: { providerId: "google.com", uid: "g-carol", email: "carol@x.test" } });
  const carolTok = await idTokenFor(carol.uid); // a custom-token session stands in for her password session
  mails.length = 0;
  assert.deepEqual(await confirmGoogle(db, carolTok, "link", deps), { status: "ok", needsProfile: false });
  assert.equal((await db.doc(`authLinks/${linkId("google", "g-carol")}`).get()).data()?.uid, carol.uid);
  assert.deepEqual(mails.map((m) => m.to), ["carol@x.test"]);
  // Now Google signs Carol in without being taken off.
  assert.deepEqual(await confirmGoogle(db, asGoogle, "signin", deps), { status: "ok", needsProfile: false });
  // Linking needs a fresh token.
  clock += 10 * 60_000;
  await refused(confirmGoogle(db, carolTok, "link", deps), 401);
  clock = Date.now();

  // ── Sign-in methods and unlinking ──
  const mc = await methodsOf(db, carol.uid, deps);
  assert.deepEqual({ ...mc, linkedinAvailable: undefined }, { password: true, google: true, linkedin: false, passkeys: 0, googleEmail: "ca•••@x.test", linkedinName: "", linkedinAvailable: undefined });
  await unlinkMethod(db, carol.uid, "google", deps);
  assert.deepEqual((await auth.getUser(carol.uid)).providerData.map((p) => p.providerId), ["password"]);
  assert.equal((await db.doc(`authLinks/${linkId("google", "g-carol")}`).get()).exists, false);
  await refused(unlinkMethod(db, carol.uid, "google", deps), 400); // nothing to unlink
  // Gina signs in only with Google: she can't unlink it… until she adds a passkey; then the passkey is her last way in.
  await refused(unlinkMethod(db, gNew.token.uid, "google", deps), 400);
  await db.doc("passkeys/cred-gina").set({ uid: gNew.token.uid, publicKey: "x", counter: 0, rpID: "localhost" });
  await unlinkMethod(db, gNew.token.uid, "google", deps);
  await refused(assertCanRemove(db, gNew.token.uid, "passkey", deps), 400);
  // The new LinkedIn account: LinkedIn is its only way in.
  await refused(unlinkMethod(db, newbie.uid, "linkedin", deps), 400);
  // Ada (password + LinkedIn) can unlink LinkedIn; it's logged.
  await unlinkMethod(db, ada.uid, "linkedin", deps, "5.6.7.8");
  assert.equal((await db.doc(`authLinks/${linkId("linkedin", "li-ada")}`).get()).exists, false);
  assert.ok((await db.collection("authAudit").where("uid", "==", ada.uid).get()).docs.some((d) => d.data().action === "unlink" && d.data().ip === "5.6.7.8"));

  // ── Erasing an account removes its links and log ──
  assert.equal(await eraseAuthLinks(db, newbie.uid), 1);
  assert.equal((await db.collection("authLinks").where("uid", "==", newbie.uid).get()).size, 0);
  assert.equal((await db.collection("authAudit").where("uid", "==", newbie.uid).get()).size, 0);

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
