// The Google sign-in gate (lib/google-gate.ts) against the Auth emulator, with the browser SDK: a sign-in our check refuses never
// reaches an onAuthStateChanged listener; one it accepts does, once; the gate only checks while armed. Run by test:social-signin.
import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider, connectAuthEmulator, getAuth, onAuthStateChanged, signInWithCredential, signInAnonymously, signOut, type User,
} from "firebase/auth";
import { gateApplies, installGoogleGate, type GoogleCheck } from "../../lib/google-gate";

const app = initializeApp({ apiKey: "fake-key", projectId: "demo-notesapp", authDomain: "demo-notesapp.firebaseapp.com" }, "gate-test");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`, { disableWarnings: true });

// The Auth emulator takes an unsigned Google ID token: a JSON object of claims.
const google = (sub: string, email: string) => GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true, name: "Test" }));

let answer: GoogleCheck | Error = { status: "ok", needsProfile: true };
let checks = 0;
const gate = installGoogleGate(auth, async () => { checks++; if (answer instanceof Error) throw answer; return answer; }, () => false);

const seen: (string | null)[] = [];
onAuthStateChanged(auth, (u: User | null) => { seen.push(u ? u.uid : null); });
const current = (): User | null => auth.currentUser; // read fresh (an assert would narrow the property)
const settle = () => new Promise((r) => setTimeout(r, 50));

async function main() {
  // Pure rule.
  const g = { uid: "a", providerData: [{ providerId: "google.com" }] } as never;
  assert.equal(gateApplies({ armed: true, redirectSignin: false, user: g, currentUid: null }), true);
  assert.equal(gateApplies({ armed: false, redirectSignin: false, user: g, currentUid: null }), false, "not armed: no check");
  assert.equal(gateApplies({ armed: false, redirectSignin: true, user: g, currentUid: null }), true, "back from a sign-in redirect");
  assert.equal(gateApplies({ armed: true, redirectSignin: false, user: g, currentUid: "a" }), false, "same account (refresh, link)");
  assert.equal(gateApplies({ armed: true, redirectSignin: false, user: { uid: "b", providerData: [{ providerId: "password" }] } as never, currentUid: null }), false);
  assert.equal(gateApplies({ armed: true, redirectSignin: false, user: null, currentUid: null }), false);

  await settle();
  seen.length = 0;

  // 1. Our check says link-required: the sign-in is blocked, no listener ever sees the account, the outcome is kept for the UI.
  answer = { status: "link-required", email: "ez•••@gmail.com", hasOtherWay: true };
  gate.arm();
  await assert.rejects(signInWithCredential(auth, google("g-1", "held@example.com")));
  gate.disarm();
  await settle();
  assert.equal(current(), null, "nobody signed in");
  assert.deepEqual(seen.filter(Boolean), [], "no listener saw the held account");
  assert.deepEqual(gate.blocked(), { result: answer });
  assert.equal(gate.blocked(), null, "told once");
  assert.equal(checks, 1);

  // 2. The check fails (network): blocked too, and the error is kept.
  answer = new Error("offline");
  gate.arm();
  await assert.rejects(signInWithCredential(auth, google("g-2", "err@example.com")));
  gate.disarm();
  await settle();
  assert.equal(current(), null);
  const b = gate.blocked();
  assert.ok(b && "error" in b && (b.error as Error).message === "offline");

  // 3. The check says ok: signed in, listeners see it, and the result is handed over once (no second server call).
  answer = { status: "ok", needsProfile: true };
  gate.arm();
  const cred = await signInWithCredential(auth, google("g-3", "new@example.com"));
  gate.disarm();
  await settle();
  assert.equal(current()?.uid, cred.user.uid);
  assert.deepEqual(seen.filter(Boolean), [cred.user.uid]);
  assert.deepEqual(gate.take(cred.user.uid), answer);
  assert.equal(gate.take(cred.user.uid), null, "handed over once");
  assert.equal(checks, 3);
  await signOut(auth);

  // 4. Not armed (any other sign-in, e.g. a Google sign-in started elsewhere or a password one): no check at all.
  answer = { status: "link-required", email: "x", hasOtherWay: true };
  await signInWithCredential(auth, google("g-4", "free@example.com"));
  assert.equal(checks, 3, "not checked while not armed");
  await signOut(auth);
  gate.arm();
  await signInAnonymously(auth); // armed, but not a Google user
  gate.disarm();
  assert.equal(checks, 3, "only Google users are checked");
  await signOut(auth);

  console.log("GOOGLE GATE OK");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
