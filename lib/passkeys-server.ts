import { randomUUID } from "crypto";
import { getAuth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { getAdminApp } from "./firebase-admin";
import { CHALLENGE_TTL_MS, MAX_PASSKEYS, PasskeyError, RP_NAME, cleanName, originAllowed, type PasskeyRow } from "./passkeys";

// Passkeys on the server (lib/passkeys.ts has the rules). Collections, both server-only (firestore.rules):
//   passkeys/{credentialId}            { uid, publicKey (base64url), counter, transports, rpID, name, deviceType, backedUp, createdAt, lastUsedAt }
//   passkeyChallenges/{id}             { kind: "register" | "login" | "verify", challenge, rpID, uid? , expireAt }  (TTL on expireAt; deleted on use)
// Signing in with a passkey ends in a Firebase custom token for the passkey's account, so the account's custom claims (staff access,
// teen mode) apply exactly as with a password.

type Ceremony = { kind: "register" | "login" | "verify"; challenge: string; rpID: string; uid?: string; expireAt: Date };

async function saveChallenge(db: Firestore, c: Omit<Ceremony, "expireAt">, now: Date): Promise<string> {
  const id = randomUUID();
  await db.doc(`passkeyChallenges/${id}`).set({ ...c, expireAt: new Date(now.getTime() + CHALLENGE_TTL_MS) });
  return id;
}

// Reads and deletes a challenge in one transaction, so it can be used once only.
async function takeChallenge(db: Firestore, id: unknown, kind: Ceremony["kind"], now: Date): Promise<Ceremony> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new PasskeyError(400, "That request has expired. Try again.");
  const ref = db.doc(`passkeyChallenges/${id}`);
  const c = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data() as Omit<Ceremony, "expireAt"> & { expireAt?: unknown };
  });
  if (!c || c.kind !== kind) throw new PasskeyError(400, "That request has expired. Try again.");
  const raw = c.expireAt as { toDate?: () => Date } | Date | undefined;
  const exp = raw instanceof Date ? raw : raw?.toDate?.() ?? new Date(0);
  if (exp.getTime() < now.getTime()) throw new PasskeyError(400, "That took too long. Try again.");
  return { ...c, expireAt: exp };
}

const rowOf = (id: string, d: Record<string, unknown>): PasskeyRow => ({
  id,
  name: String(d.name || "Passkey"),
  createdAt: String(d.createdAt || ""),
  lastUsedAt: d.lastUsedAt ? String(d.lastUsedAt) : null,
  rpID: String(d.rpID || ""),
  backedUp: d.backedUp === true,
});

export async function listPasskeys(db: Firestore, uid: string): Promise<PasskeyRow[]> {
  const snap = await db.collection("passkeys").where("uid", "==", uid).get();
  return snap.docs.map((d) => rowOf(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removePasskey(db: Firestore, uid: string, id: unknown): Promise<void> {
  if (typeof id !== "string" || !id || id.length > 1024) throw new PasskeyError(400, "Choose a passkey.");
  const ref = db.doc(`passkeys/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.uid !== uid) throw new PasskeyError(404, "That passkey isn't on your account.");
  await ref.delete();
}

export async function renamePasskey(db: Firestore, uid: string, id: unknown, name: unknown): Promise<void> {
  if (typeof id !== "string" || !id || id.length > 1024) throw new PasskeyError(400, "Choose a passkey.");
  const ref = db.doc(`passkeys/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.uid !== uid) throw new PasskeyError(404, "That passkey isn't on your account.");
  await ref.update({ name: cleanName(name) });
}

// ── Adding a passkey (signed in) ──────────────────────────────────────────────────────────────────────────

export async function registrationOptions(db: Firestore, me: { uid: string; email: string }, rpID: string, now = new Date()) {
  const mine = await db.collection("passkeys").where("uid", "==", me.uid).get();
  if (mine.size >= MAX_PASSKEYS) throw new PasskeyError(400, `You can keep up to ${MAX_PASSKEYS} passkeys. Remove one first.`);
  const user = await getAuth(getAdminApp()).getUser(me.uid);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: isoUint8Array.fromUTF8String(me.uid),
    userName: me.email || user.email || me.uid,
    userDisplayName: user.displayName || me.email || "NotesApp member",
    attestationType: "none",
    // Passkeys that can sign in without typing an email first (the member picks their account on the device).
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    excludeCredentials: mine.docs
      .filter((d) => d.data().rpID === rpID)
      .map((d) => ({ id: d.id, transports: Array.isArray(d.data().transports) ? d.data().transports : undefined })),
  });
  const challengeId = await saveChallenge(db, { kind: "register", challenge: options.challenge, rpID, uid: me.uid }, now);
  return { options, challengeId };
}

export async function verifyRegistration(
  db: Firestore,
  me: { uid: string },
  body: { challengeId?: unknown; response?: unknown; name?: unknown },
  origin: string | null,
  fallbackName: string,
  now = new Date(),
): Promise<PasskeyRow> {
  const c = await takeChallenge(db, body.challengeId, "register", now);
  if (c.uid !== me.uid) throw new PasskeyError(403, "That request was for another account.");
  if (!origin || !originAllowed(origin, c.rpID)) throw new PasskeyError(400, "Passkeys can't be added from this address.");
  if (!body.response || typeof body.response !== "object") throw new PasskeyError(400, "Your device didn't send a passkey. Try again.");
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: c.rpID,
      requireUserVerification: false,
    });
  } catch {
    throw new PasskeyError(400, "We couldn't check that passkey. Try again.");
  }
  if (!verification.verified) throw new PasskeyError(400, "We couldn't check that passkey. Try again.");
  const info = verification.registrationInfo;
  const ref = db.doc(`passkeys/${info.credential.id}`);
  if ((await ref.get()).exists) throw new PasskeyError(409, "That passkey is already on an account.");
  const doc = {
    uid: me.uid,
    publicKey: isoBase64URL.fromBuffer(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports ?? [],
    rpID: c.rpID,
    name: cleanName(body.name, fallbackName),
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    createdAt: now.toISOString(),
    lastUsedAt: null,
  };
  await ref.set(doc);
  return rowOf(ref.id, doc);
}

// ── Signing in with a passkey (signed out) ─────────────────────────────────────────────────────────────────

export async function authenticationOptions(db: Firestore, rpID: string, now = new Date()) {
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
  const challengeId = await saveChallenge(db, { kind: "login", challenge: options.challenge, rpID }, now);
  return { options, challengeId };
}

export async function verifyAuthentication(
  db: Firestore,
  body: { challengeId?: unknown; response?: unknown },
  origin: string | null,
  now = new Date(),
): Promise<{ token: string; uid: string }> {
  const c = await takeChallenge(db, body.challengeId, "login", now);
  if (!origin || !originAllowed(origin, c.rpID)) throw new PasskeyError(400, "Passkeys can't be used from this address.");
  const response = body.response as { id?: unknown } | undefined;
  if (!response || typeof response !== "object" || typeof response.id !== "string" || response.id.length > 1024) {
    throw new PasskeyError(400, "Your device didn't send a passkey. Try again.");
  }
  const ref = db.doc(`passkeys/${response.id}`);
  const snap = await ref.get();
  const pk = snap.data();
  if (!snap.exists || !pk || pk.rpID !== c.rpID) throw new PasskeyError(401, "That passkey isn't on a NotesApp account for this address.");
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: c.rpID,
      credential: {
        id: snap.id,
        publicKey: isoBase64URL.toBuffer(String(pk.publicKey)),
        counter: Number(pk.counter) || 0,
        transports: Array.isArray(pk.transports) ? pk.transports : undefined,
      },
      requireUserVerification: false,
    });
  } catch {
    throw new PasskeyError(401, "We couldn't check that passkey. Try again.");
  }
  if (!verification.verified) throw new PasskeyError(401, "We couldn't check that passkey. Try again.");
  const auth = getAuth(getAdminApp());
  const user = await auth.getUser(String(pk.uid)).catch(() => null);
  if (!user || user.disabled) throw new PasskeyError(403, "This account can't sign in.");
  await ref.update({ counter: verification.authenticationInfo.newCounter, lastUsedAt: now.toISOString() });
  return { token: await auth.createCustomToken(user.uid), uid: user.uid };
}

// ── Checking it's still her (signed in) ──────────────────────────────────────────────────────────────────────────────────────────
// A fresh passkey check for a member who is already signed in, used to unlock private areas (My Cycle, lib/cycle-server.ts). Only
// her own passkeys for this address are offered, and user verification is required: the device must ask for her fingerprint, face or
// screen lock, not just a tap. Throws 409 when she has no passkey for this address, so the page can help her add one first.
export async function hasPasskeyFor(db: Firestore, uid: string, rpID: string): Promise<boolean> {
  const mine = await db.collection("passkeys").where("uid", "==", uid).get();
  return mine.docs.some((d) => d.data().rpID === rpID);
}

export async function verifyUserOptions(db: Firestore, uid: string, rpID: string, now = new Date()) {
  const mine = (await db.collection("passkeys").where("uid", "==", uid).get()).docs.filter((d) => d.data().rpID === rpID);
  if (!mine.length) throw new PasskeyError(409, "Add a passkey on this device first.");
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: mine.map((d) => ({ id: d.id, transports: Array.isArray(d.data().transports) ? d.data().transports : undefined })),
  });
  const challengeId = await saveChallenge(db, { kind: "verify", challenge: options.challenge, rpID, uid }, now);
  return { options, challengeId };
}

export async function verifyUser(
  db: Firestore,
  uid: string,
  body: { challengeId?: unknown; response?: unknown },
  origin: string | null,
  now = new Date(),
): Promise<void> {
  const c = await takeChallenge(db, body.challengeId, "verify", now);
  if (c.uid !== uid) throw new PasskeyError(403, "That request was for another account.");
  if (!origin || !originAllowed(origin, c.rpID)) throw new PasskeyError(400, "Passkeys can't be used from this address.");
  const response = body.response as { id?: unknown } | undefined;
  if (!response || typeof response !== "object" || typeof response.id !== "string" || response.id.length > 1024) {
    throw new PasskeyError(400, "Your device didn't send a passkey. Try again.");
  }
  const ref = db.doc(`passkeys/${response.id}`);
  const snap = await ref.get();
  const pk = snap.data();
  // Only one of her own passkeys will do.
  if (!snap.exists || !pk || pk.uid !== uid || pk.rpID !== c.rpID) throw new PasskeyError(401, "That passkey isn't one of yours.");
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: c.rpID,
      credential: {
        id: snap.id,
        publicKey: isoBase64URL.toBuffer(String(pk.publicKey)),
        counter: Number(pk.counter) || 0,
        transports: Array.isArray(pk.transports) ? pk.transports : undefined,
      },
      requireUserVerification: true,
    });
  } catch {
    throw new PasskeyError(401, "We couldn't check that passkey. Try again.");
  }
  if (!verification.verified) throw new PasskeyError(401, "We couldn't check that passkey. Try again.");
  await ref.update({ counter: verification.authenticationInfo.newCounter, lastUsedAt: now.toISOString() });
}
