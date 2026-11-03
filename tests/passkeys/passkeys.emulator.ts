// Passkeys end to end against the Firestore and Auth emulators, with a software authenticator (P-256, "none" attestation):
// add a passkey, sign in with it (a custom token for the right account), the counter moves, a challenge works once only, a wrong
// origin is refused, nobody removes someone else's passkey, and erasing the account removes its passkeys.
import assert from "node:assert/strict";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";
import { PasskeyError } from "../../lib/passkeys";
import { authenticationOptions, listPasskeys, registrationOptions, removePasskey, verifyAuthentication, verifyRegistration } from "../../lib/passkeys-server";
import { eraseAccount } from "../../lib/account-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const RP = "localhost", ORIGIN = "http://localhost:3000";
const b64 = (b: Uint8Array | Buffer) => isoBase64URL.fromBuffer(new Uint8Array(b));
const sha = (b: Uint8Array | Buffer | string) => createHash("sha256").update(b).digest();
const refused = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => e instanceof PasskeyError && e.status === status); };

// A software authenticator: one P-256 key, one credential id, a sign counter.
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
const credId = randomBytes(16);
let signCount = 0;
const cose = isoCBOR.encode(new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, isoBase64URL.toBuffer(jwk.x)], [-3, isoBase64URL.toBuffer(jwk.y)]]) as never);
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

function attest(challenge: string, origin = ORIGIN) {
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge, origin }));
  const len = Buffer.alloc(2); len.writeUInt16BE(credId.length);
  const authData = Buffer.concat([sha(RP), Buffer.from([0x45]), u32(0), Buffer.alloc(16), len, credId, Buffer.from(cose)]); // UP | UV | AT
  const attestationObject = isoCBOR.encode(new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", new Uint8Array(authData)]]) as never);
  return { id: b64(credId), rawId: b64(credId), type: "public-key", response: { clientDataJSON: b64(clientDataJSON), attestationObject: b64(attestationObject), transports: ["internal"] }, clientExtensionResults: {} };
}
function assertion(challenge: string, uid: string, origin = ORIGIN) {
  signCount += 1;
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin }));
  const authData = Buffer.concat([sha(RP), Buffer.from([0x05]), u32(signCount)]); // UP | UV
  const s = createSign("SHA256"); s.update(Buffer.concat([authData, sha(clientDataJSON)]));
  const signature = s.sign(privateKey);
  return { id: b64(credId), rawId: b64(credId), type: "public-key", response: { clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authData), signature: b64(signature), userHandle: b64(Buffer.from(uid)) }, clientExtensionResults: {} };
}

(async () => {
  const auth = getAuth();
  await auth.createUser({ uid: "u_ada", email: "ada@x.test", displayName: "Ada" }).catch(() => {});
  await auth.setCustomUserClaims("u_ada", { admin: true, adminRole: "admin", depts: ["support"] });
  const me = { uid: "u_ada", email: "ada@x.test" };

  // Add a passkey.
  const reg = await registrationOptions(db, me, RP);
  assert.equal(reg.options.rp.id, RP);
  assert.equal(reg.options.authenticatorSelection?.residentKey, "required");
  // From the wrong origin: refused (and the challenge is spent).
  await refused(verifyRegistration(db, me, { challengeId: reg.challengeId, response: attest(reg.options.challenge, "https://evil.test") }, "https://evil.test", "Mac"), 400);
  const reg2 = await registrationOptions(db, me, RP);
  // For someone else's challenge: refused.
  await refused(verifyRegistration(db, { uid: "u_bob" }, { challengeId: reg2.challengeId, response: attest(reg2.options.challenge) }, ORIGIN, "Mac"), 403);
  const reg3 = await registrationOptions(db, me, RP);
  const row = await verifyRegistration(db, me, { challengeId: reg3.challengeId, response: attest(reg3.options.challenge), name: "Work laptop" }, ORIGIN, "Mac");
  assert.equal(row.name, "Work laptop");
  assert.equal(row.rpID, RP);
  // The same challenge twice: refused.
  await refused(verifyRegistration(db, me, { challengeId: reg3.challengeId, response: attest(reg3.options.challenge) }, ORIGIN, "Mac"), 400);
  // The device can't add itself twice.
  const again = await registrationOptions(db, me, RP);
  assert.deepEqual(again.options.excludeCredentials?.map((c) => c.id), [b64(credId)]);
  assert.deepEqual((await listPasskeys(db, "u_ada")).map((p) => p.name), ["Work laptop"]);

  // Sign in with it: a custom token for Ada; the counter moves; staff claims stay on the account.
  const login = await authenticationOptions(db, RP);
  const { uid, token } = await verifyAuthentication(db, { challengeId: login.challengeId, response: assertion(login.options.challenge, "u_ada") }, ORIGIN);
  assert.equal(uid, "u_ada");
  assert.ok(token.length > 20);
  assert.equal((await db.doc(`passkeys/${b64(credId)}`).get()).data()?.counter, 1);
  assert.ok((await listPasskeys(db, "u_ada"))[0].lastUsedAt);
  assert.equal((await auth.getUser("u_ada")).customClaims?.adminRole, "admin");
  // A challenge works once; a wrong origin and an unknown passkey are refused.
  await refused(verifyAuthentication(db, { challengeId: login.challengeId, response: assertion(login.options.challenge, "u_ada") }, ORIGIN), 400);
  const l2 = await authenticationOptions(db, RP);
  await refused(verifyAuthentication(db, { challengeId: l2.challengeId, response: assertion(l2.options.challenge, "u_ada", "https://evil.test") }, "https://evil.test"), 400);
  const l3 = await authenticationOptions(db, RP);
  await refused(verifyAuthentication(db, { challengeId: l3.challengeId, response: { ...assertion(l3.options.challenge, "u_ada"), id: "unknown" } }, ORIGIN), 401);
  // A disabled account can't sign in.
  await auth.updateUser("u_ada", { disabled: true });
  const l4 = await authenticationOptions(db, RP);
  await refused(verifyAuthentication(db, { challengeId: l4.challengeId, response: assertion(l4.options.challenge, "u_ada") }, ORIGIN), 403);
  await auth.updateUser("u_ada", { disabled: false });

  // Nobody removes someone else's passkey; erasing the account removes them.
  await refused(removePasskey(db, "u_bob", b64(credId)), 404);
  await eraseAccount(db, "u_ada");
  assert.equal((await listPasskeys(db, "u_ada")).length, 0);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
