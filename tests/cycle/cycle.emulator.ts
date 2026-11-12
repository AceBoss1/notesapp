// My Cycle on the server (lib/cycle-server.ts) against the Firestore and Auth emulators: who may use it, the private first answer
// (never on users/{uid}), encryption at rest, the unlock cookie and the passkey check with user verification, the teen version with
// no fertility or pill mode, check-ins with Nana's advice (her own AI, or our fixed tips when there's none), the daily note, the
// monthly report, the private chat, the bells, Download my data, Delete everything and closing the account.
// Run: npm run test:cycle → "ALL OK".
import assert from "node:assert/strict";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
process.env.ACCOUNT_DATA_KEY = randomBytes(32).toString("base64");
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";
import { PasskeyError } from "../../lib/passkeys";
import { registrationOptions, verifyRegistration, verifyUser, verifyUserOptions } from "../../lib/passkeys-server";
import { CycleError, REMINDER_TEXT } from "../../lib/cycle";
import { encryptSecret } from "../../lib/account-crypto";
import {
  UNLOCK_IDLE_MS, UNLOCK_MAX_MS, answer, changePeriod, chatTurn, checkUnlock, cycleBells, cycleStatus, cycleView, dailyNote, eraseCycle,
  exportCycle, issueUnlock, monthlyReport, saveLog, saveSettings, unlocked,
} from "../../lib/cycle-server";
import { eraseAccount } from "../../lib/account-server";
import type { CompleteArgs, NanaDeps } from "../../lib/nana-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const RP = "localhost", ORIGIN = "http://localhost:3000";
const TODAY = "2026-11-12";
const NOW = new Date("2026-11-12T10:00:00Z");
const b64 = (b: Uint8Array | Buffer) => isoBase64URL.fromBuffer(new Uint8Array(b));
const sha = (b: Uint8Array | Buffer | string) => createHash("sha256").update(b).digest();
const refused = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => (e instanceof CycleError || e instanceof PasskeyError) && e.status === status); };

// A software authenticator (as in tests/passkeys/passkeys.emulator.ts). `uv` false sends user presence only.
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
const credId = randomBytes(16);
let signCount = 0;
const cose = isoCBOR.encode(new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, isoBase64URL.toBuffer(jwk.x)], [-3, isoBase64URL.toBuffer(jwk.y)]]) as never);
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
function attest(challenge: string) {
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge, origin: ORIGIN }));
  const len = Buffer.alloc(2); len.writeUInt16BE(credId.length);
  const authData = Buffer.concat([sha(RP), Buffer.from([0x45]), u32(0), Buffer.alloc(16), len, credId, Buffer.from(cose)]);
  const attestationObject = isoCBOR.encode(new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", new Uint8Array(authData)]]) as never);
  return { id: b64(credId), rawId: b64(credId), type: "public-key", response: { clientDataJSON: b64(clientDataJSON), attestationObject: b64(attestationObject), transports: ["internal"] }, clientExtensionResults: {} };
}
function assertion(challenge: string, uid: string, uv = true) {
  signCount += 1;
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: ORIGIN }));
  const authData = Buffer.concat([sha(RP), Buffer.from([uv ? 0x05 : 0x01]), u32(signCount)]);
  const s = createSign("SHA256"); s.update(Buffer.concat([authData, sha(clientDataJSON)]));
  return { id: b64(credId), rawId: b64(credId), type: "public-key", response: { clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authData), signature: b64(s.sign(privateKey)), userHandle: b64(Buffer.from(uid)) }, clientExtensionResults: {} };
}

// A stand-in for the AI: records what it was sent.
const sent: CompleteArgs[] = [];
const aiDeps: NanaDeps = { now: () => NOW, complete: async (a) => { sent.push(a); return { text: `Nana says hello (${sent.length}).`, refused: false }; } };
const noAi: NanaDeps = { now: () => NOW, complete: async () => { throw new Error("should not be called"); } };

(async () => {
  const auth = getAuth();
  for (const [uid, name] of [["u_ada", "Ada Obi"], ["u_tia", "Tia"], ["u_bob", "Bob"], ["u_org", "Org"]]) await auth.createUser({ uid, email: `${uid}@x.test`, displayName: name }).catch(() => {});
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada Obi", role: "reader", accountTier: "standard" });
  await db.doc("users/u_tia").set({ username: "tia", displayName: "Tia", role: "reader", teen: true });
  await db.doc("users/u_bob").set({ username: "bob", displayName: "Bob", role: "reader" });
  await db.doc("users/u_org").set({ username: "acme", displayName: "Acme", accountKind: "organisation" });
  await db.doc("users/kid_k1").set({ username: "kid1", displayName: "Kid", teen: true, kid: true });

  // Who may use it: not a child profile, not an organisation.
  assert.equal((await cycleStatus(db, "kid_k1")).eligible, false);
  assert.equal((await cycleStatus(db, "u_org")).eligible, false);
  assert.equal((await cycleStatus(db, "u_org")).menu, false);
  await refused(answer(db, "kid_k1", { answer: "female", consent: true }, TODAY), 403);
  const s0 = await cycleStatus(db, "u_ada");
  assert.deepEqual([s0.eligible, s0.answer, s0.menu, s0.teen], [true, null, true, false]);
  assert.equal((await cycleStatus(db, "u_tia")).teen, true);

  // "Not for me" hides the menu item; Settings → Privacy undoes it. It never touches users/{uid}.
  assert.equal((await answer(db, "u_bob", { answer: "no" }, TODAY)).menu, false);
  assert.equal((await cycleStatus(db, "u_bob")).answer, "no");
  assert.equal((await answer(db, "u_bob", { answer: "undo" }, TODAY)).answer, null);
  assert.equal((await cycleStatus(db, "u_bob")).menu, true);

  // "I'm female": needs the consent line; stored server-only and encrypted; once only.
  await refused(answer(db, "u_ada", { answer: "female", lastPeriod: "2026-10-26", cycleLength: 28 }, TODAY), 400);
  await refused(answer(db, "u_ada", { answer: "female", consent: true, lastPeriod: "2026-12-01" }, TODAY), 400);
  await refused(answer(db, "u_ada", { answer: "female", consent: true, cycleLength: 60 }, TODAY), 400);
  assert.equal((await answer(db, "u_ada", { answer: "female", consent: true, lastPeriod: "2026-10-26", cycleLength: 28 }, TODAY)).answer, "female");
  await refused(answer(db, "u_ada", { answer: "female", consent: true }, TODAY), 409);
  await refused(answer(db, "u_ada", { answer: "no" }, TODAY), 409);
  const user = (await db.doc("users/u_ada").get()).data()!;
  assert.deepEqual(Object.keys(user).sort(), ["accountTier", "displayName", "role", "username"]);
  const raw = (await db.doc("cycleProfiles/u_ada").get()).data()!;
  assert.equal(raw.answer, "female");
  assert.ok(raw.consentAt);
  assert.doesNotMatch(String(raw.data), /2026-10-26|cycleLength/); // encrypted at rest

  // The unlock token: bound to her uid, 2 minutes, renewed, never past 30 minutes from the passkey check.
  await refused(unlocked(db, "u_ada", undefined, NOW), 423);
  const tok = issueUnlock("u_ada", NOW);
  assert.equal(checkUnlock(tok, "u_ada", NOW), NOW.getTime());
  assert.throws(() => checkUnlock(tok, "u_bob", NOW), CycleError);
  assert.throws(() => checkUnlock(tok.slice(0, -2) + "xx", "u_ada", NOW), CycleError);
  assert.throws(() => checkUnlock(tok, "u_ada", new Date(NOW.getTime() + UNLOCK_IDLE_MS + 1000)), CycleError);
  const renewed = issueUnlock("u_ada", new Date(NOW.getTime() + 60_000), NOW.getTime());
  assert.equal(checkUnlock(renewed, "u_ada", new Date(NOW.getTime() + 150_000)), NOW.getTime());
  const nearEnd = issueUnlock("u_ada", new Date(NOW.getTime() + UNLOCK_MAX_MS - 10_000), NOW.getTime());
  assert.throws(() => checkUnlock(nearEnd, "u_ada", new Date(NOW.getTime() + UNLOCK_MAX_MS + 1000)), CycleError);
  // Someone who hasn't set it up can't get in even with a token.
  await refused(unlocked(db, "u_bob", issueUnlock("u_bob", NOW), NOW), 409);
  const ada = await unlocked(db, "u_ada", tok, NOW);
  assert.equal(ada.teen, false);

  // The passkey check: her own passkeys only, user verification required, every time.
  await refused(verifyUserOptions(db, "u_ada", RP), 409); // no passkey yet: the page helps her add one
  const reg = await registrationOptions(db, { uid: "u_ada", email: "u_ada@x.test" }, RP);
  await verifyRegistration(db, { uid: "u_ada" }, { challengeId: reg.challengeId, response: attest(reg.options.challenge) }, ORIGIN, "Phone");
  const o1 = await verifyUserOptions(db, "u_ada", RP);
  assert.equal(o1.options.userVerification, "required");
  assert.deepEqual(o1.options.allowCredentials?.map((c) => c.id), [b64(credId)]);
  await refused(verifyUser(db, "u_ada", { challengeId: o1.challengeId, response: assertion(o1.options.challenge, "u_ada", false) }, ORIGIN), 401); // a tap without fingerprint/face
  const o2 = await verifyUserOptions(db, "u_ada", RP);
  await refused(verifyUser(db, "u_bob", { challengeId: o2.challengeId, response: assertion(o2.options.challenge, "u_ada") }, ORIGIN), 403);
  const o3 = await verifyUserOptions(db, "u_ada", RP);
  await verifyUser(db, "u_ada", { challengeId: o3.challengeId, response: assertion(o3.options.challenge, "u_ada") }, ORIGIN);
  // Ada's passkey can't unlock Bob's (Bob has none, and it isn't his).
  await db.doc("cycleProfiles/u_bob").set({ uid: "u_bob", answer: "female" });
  await refused(verifyUserOptions(db, "u_bob", RP), 409);
  await db.doc("cycleProfiles/u_bob").delete();

  // Periods and the view: adults see ovulation and the fertile window.
  await changePeriod(db, "u_ada", { op: "start", day: "2026-09-28" }, TODAY);
  await changePeriod(db, "u_ada", { op: "start", day: "2026-08-31" }, TODAY);
  let v = await cycleView(db, "u_ada", ada, TODAY);
  assert.equal(v.today.day, 18);
  assert.equal(v.today.phase, "luteal");
  assert.equal(v.today.earlyGuess, false);
  assert.equal((v.today as { ovulation?: string }).ovulation, "2026-11-09");
  assert.equal(v.calendar["2026-11-09"], "ovulation");
  await saveSettings(db, "u_ada", ada, { pill: true, pillStart: "2026-11-01", remindCheckIn: true });
  v = await cycleView(db, "u_ada", ada, TODAY);
  assert.equal(v.today.phase, "active");
  assert.equal(v.settings.remindCheckIn, true);
  await saveSettings(db, "u_ada", ada, { pill: false });
  await refused(saveSettings(db, "u_ada", ada, { cycleLength: 50 }), 400);

  // A check-in with no AI anywhere: saved encrypted, and Nana's advice falls back to our own phase tips.
  const r1 = await saveLog(db, "u_ada", ada, { day: TODAY, moods: ["tired"], symptoms: ["Bloating"], sleep: 6, pain: 2, water: 5, energy: "ok", note: "busy day", ask: true }, TODAY, noAi);
  assert.equal(r1.advice?.ai, false);
  assert.match(r1.advice!.text, /Energy often dips/);
  const rawLog = (await db.doc(`cycleLogs/u_ada_${TODAY}`).get()).data()!;
  assert.doesNotMatch(JSON.stringify(rawLog), /Bloating|busy day|tired/);
  const note0 = await dailyNote(db, "u_ada", ada, TODAY, noAi);
  assert.equal(note0.ai, false);

  // With her own AI account connected: it is used, and Nana gets only her phase and logs, never her name.
  await db.doc("aiConnections/u_ada").set({ uid: "u_ada", secret: encryptSecret("test-own-key-000000000000000000"), last4: "0000" });
  const n1 = await dailyNote(db, "u_ada", ada, TODAY, aiDeps);
  assert.equal(n1.ai, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].apiKey, "test-own-key-000000000000000000");
  const sys = sent[0].system.map((s) => s.text).join("\n");
  assert.match(sys, /Cycle day 18 of about 28/);
  assert.match(sys, /bloating/i);
  assert.doesNotMatch(sys, /Ada|ada@|u_ada/);
  assert.match(sys, /doctor or clinic/);
  // Made once a day.
  assert.equal((await dailyNote(db, "u_ada", ada, TODAY, aiDeps)).text, n1.text);
  assert.equal(sent.length, 1);
  assert.equal((await cycleView(db, "u_ada", ada, TODAY)).note?.text, n1.text);
  const rep = await monthlyReport(db, "u_ada", ada, TODAY, false, aiDeps);
  assert.equal(rep.ai, true);
  assert.match(sent[1].system.map((s) => s.text).join("\n"), /Top symptoms: bloating \(1\)/);
  const c1 = await chatTurn(db, "u_ada", ada, { message: "Why do I get pimples before my period?" }, TODAY, aiDeps);
  assert.equal(c1.chat.length, 2);
  assert.equal(c1.ai, true);
  assert.doesNotMatch(JSON.stringify((await db.doc("cycleChats/u_ada").get()).data()), /pimples/); // encrypted
  assert.equal((await db.collection("nanaChats").where("uid", "==", "u_ada").get()).size, 0); // kept apart from other Nana chats
  await refused(chatTurn(db, "u_ada", ada, { message: "" }, TODAY, aiDeps), 400);

  // The teen version: periods only, from the server.
  await answer(db, "u_tia", { answer: "female", consent: true, lastPeriod: "2026-10-26" }, TODAY);
  const tia = await unlocked(db, "u_tia", issueUnlock("u_tia", NOW), NOW);
  assert.equal(tia.teen, true);
  await refused(saveSettings(db, "u_tia", tia, { pill: true }), 403);
  const tv = await cycleView(db, "u_tia", tia, TODAY);
  assert.equal("ovulation" in tv.today, false);
  assert.equal("fertileStart" in tv.today, false);
  assert.equal(tv.today.pill, false);
  assert.ok(Object.values(tv.calendar).every((k) => k === "period" || k === "predicted"));
  assert.ok(tv.today.ring.every((r) => r.phase !== "fertile" && r.phase !== "ovulation"));
  await db.doc("aiConnections/u_tia").set({ uid: "u_tia", secret: encryptSecret("test-own-key-111111111111111111"), last4: "1111" });
  await chatTurn(db, "u_tia", tia, { message: "Is it normal to have cramps?" }, TODAY, aiDeps);
  const tsys = sent[sent.length - 1].system.map((s) => s.text).join("\n");
  assert.match(tsys, /13 TO 17/);
  assert.match(tsys, /trusted adult/);
  assert.doesNotMatch(tsys, /Tia/);
  const tex = await exportCycle(db, "u_tia", tia, TODAY);
  assert.equal("pill" in tex.settings, false);
  assert.equal("ovulation" in tex.today, false);

  // Download my data.
  const ex = await exportCycle(db, "u_ada", ada, TODAY);
  assert.equal(ex.checkIns.length, 1);
  assert.equal(ex.checkIns[0].note, "busy day");
  assert.equal(ex.periods.length, 3);
  assert.equal(ex.nanaChat.length, 2);

  // Bells: never say what they're about; once a day after 7 PM Lagos, only without a check-in; "late" once per period.
  const bells: { uid?: string | null; message: string; type: string }[] = [];
  const notify = async (n: { uid?: string | null; message: string; type: string }) => { bells.push(n); };
  await saveSettings(db, "u_tia", tia, { remindLate: true, remindCheckIn: true });
  assert.equal(await cycleBells(db, new Date("2026-11-12T12:00:00Z"), notify), 0); // 1 PM: too early; Tia isn't late
  assert.equal(await cycleBells(db, new Date("2026-11-12T18:30:00Z"), notify), 1); // Tia hasn't checked in; Ada has
  assert.equal(bells[0].uid, "u_tia");
  assert.equal(bells[0].message, REMINDER_TEXT);
  assert.equal(await cycleBells(db, new Date("2026-11-12T19:30:00Z"), notify), 0);
  const lateDay = new Date("2026-11-30T09:00:00Z"); // 7 days past the expected 23 Nov
  assert.equal(await cycleBells(db, lateDay, notify), 1);
  assert.equal(await cycleBells(db, lateDay, notify), 0);
  assert.ok(bells.every((b) => b.message === REMINDER_TEXT && b.type === "reminder"));
  assert.ok(bells.every((b) => !/period|cycle day|late/i.test(b.message)));

  // Delete everything: all of it, and the first screen comes back. Closing the account does the same.
  await eraseCycle(db, "u_ada");
  for (const p of ["cycleProfiles/u_ada", "cycleNotes/u_ada", "cycleChats/u_ada", `cycleLogs/u_ada_${TODAY}`]) assert.equal((await db.doc(p).get()).exists, false, p);
  assert.equal((await cycleStatus(db, "u_ada")).answer, null);
  await eraseAccount(db, "u_tia");
  assert.equal((await db.doc("cycleProfiles/u_tia").get()).exists, false);
  assert.equal((await db.collection("cycleLogs").where("uid", "==", "u_tia").get()).size, 0);
  assert.equal((await db.doc("cycleChats/u_tia").get()).exists, false);

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
