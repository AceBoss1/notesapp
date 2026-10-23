import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { getAdminApp, getUserEmail } from "./firebase-admin";
import { sendEmail } from "./email";
import { lagosDate } from "./team";
import { YoungError } from "./young";
import { DEFAULT_PLAY, MAX_KIDS, PIN_TRIES, cleanKid, cleanPin, isKidUid, kidUid, playAdd, playLeft, weekReport, type KidProfile } from "./kids";

// Server side of kids mode (lib/kids.ts has the rules). Collections, server-only in firestore.rules:
//   kidProfiles/{kidId}       the child's profile: the parent who owns it, nickname, birth month and year, what they may use, the PIN
//                             (scrypt, salted), the play time, and the PIN attempts
//   kidPlay/{kidUid_YYYY-MM-DD} Notes Life play time used today
//   kidReports/{week_kidId}    the weekly email to the parent, sent once
// The child's own `users/kid_<id>` document holds only the nickname, with teen: true (hidden from search and the directory, the
// teen rules everywhere) and kid: true. Never the parent, never a username.
const KIDS = "kidProfiles", PLAY = "kidPlay", REPORTS = "kidReports";
const auth = () => getAuth(getAdminApp());
const hashPin = (pin: string, salt: string) => scryptSync(pin, salt, 32).toString("hex");
const view = (id: string, d: FirebaseFirestore.DocumentData): KidProfile => ({ id, parentUid: d.parentUid, nickname: d.nickname, birth: d.birth, allow: d.allow, playMinutes: d.playMinutes ?? DEFAULT_PLAY, createdAt: d.createdAt, consentAt: d.consentAt });

async function own(db: Firestore, parentUid: string, id: unknown): Promise<{ ref: FirebaseFirestore.DocumentReference; d: FirebaseFirestore.DocumentData }> {
  const ref = db.doc(`${KIDS}/${String(id ?? "x").replace(/[^A-Za-z0-9]/g, "")}`);
  const d = (await ref.get()).data();
  if (!d || d.parentUid !== parentUid) throw new YoungError("That child profile wasn't found.", 404);
  return { ref, d };
}

export async function listKids(db: Firestore, parentUid: string): Promise<KidProfile[]> {
  if (isKidUid(parentUid)) throw new YoungError("Open the parent's account first.", 403);
  const s = await db.collection(KIDS).where("parentUid", "==", parentUid).get();
  return s.docs.map((d) => view(d.id, d.data())).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addKid(db: Firestore, parent: { uid: string; emailVerified: boolean }, b: Record<string, unknown>, now = new Date()) {
  if (isKidUid(parent.uid)) throw new YoungError("Open the parent's account first.", 403);
  if (!parent.emailVerified) throw new YoungError("Confirm your email address first: it's where we send their weekly progress.", 403);
  if ((await listKids(db, parent.uid)).length >= MAX_KIDS) throw new YoungError(`Up to ${MAX_KIDS} child profiles on one account.`);
  const k = cleanKid(b, lagosDate(now));
  const id = randomBytes(9).toString("hex");
  const salt = randomBytes(12).toString("hex");
  const at = now.toISOString();
  const uid = kidUid(id);
  await db.doc(`${KIDS}/${id}`).set({ parentUid: parent.uid, nickname: k.nickname, birth: k.birth, allow: k.allow, playMinutes: k.playMinutes, pinSalt: salt, pinHash: hashPin(k.pin!, salt), pinTries: 0, createdAt: at, consentAt: at });
  await auth().createUser({ uid, displayName: k.nickname });
  await auth().setCustomUserClaims(uid, { kid: true, kidId: id, parentUid: parent.uid });
  await db.doc(`users/${uid}`).set({ uid, displayName: k.nickname, avatar: "", kid: true, teen: true, createdAt: at });
  return view(id, (await db.doc(`${KIDS}/${id}`).get()).data()!);
}

export async function updateKid(db: Firestore, parentUid: string, id: unknown, b: Record<string, unknown>, now = new Date()) {
  const { ref, d } = await own(db, parentUid, id);
  const k = cleanKid(b, lagosDate(now), true);
  const patch: Record<string, unknown> = { updatedAt: now.toISOString() };
  if (k.nickname) patch.nickname = k.nickname;
  if (k.birth) patch.birth = k.birth;
  if (k.allow) patch.allow = k.allow;
  if (k.playMinutes) patch.playMinutes = k.playMinutes;
  if (k.pin) { patch.pinHash = hashPin(k.pin, d.pinSalt); patch.pinTries = 0; patch.pinLockedUntil = 0; }
  await ref.update(patch);
  if (k.nickname) {
    await db.doc(`users/${kidUid(ref.id)}`).set({ displayName: k.nickname }, { merge: true });
    await auth().updateUser(kidUid(ref.id), { displayName: k.nickname }).catch(() => {});
  }
  return view(ref.id, (await ref.get()).data()!);
}

// Deleting a child profile deletes everything in it: the profile, the sign-in, their practice and their Notes Life player.
export async function removeKid(db: Firestore, parentUid: string, id: unknown) {
  const { ref } = await own(db, parentUid, id);
  const uid = kidUid(ref.id);
  const batch = db.batch();
  for (const p of [`users/${uid}`, `prepProgress/${uid}`, `prepBoard/${uid}`, `lifePlayers/${uid}`]) batch.delete(db.doc(p));
  batch.delete(ref);
  await batch.commit();
  const days = await db.collection("prepAttempts").where(FieldPath.documentId(), ">=", `${uid}_`).where(FieldPath.documentId(), "<", `${uid}_~`).get().catch(() => null);
  await Promise.all((days?.docs ?? []).map((x) => x.ref.delete()));
  await auth().deleteUser(uid).catch(() => {});
}

// The parent opens a child's profile: a sign-in token for the child's identity, minted only for the parent who owns it.
export async function enterKid(db: Firestore, parentUid: string, id: unknown) {
  if (isKidUid(parentUid)) throw new YoungError("Open the parent's account first.", 403);
  const { ref, d } = await own(db, parentUid, id);
  const token = await auth().createCustomToken(kidUid(ref.id), { kid: true, kidId: ref.id, parentUid });
  return { token, nickname: String(d.nickname) };
}

// Back to the parent: the PIN, five tries then a 15-minute wait. Right, a sign-in token for the parent's own account.
export async function exitKid(db: Firestore, uid: string, pin: unknown, now = Date.now()) {
  if (!isKidUid(uid)) throw new YoungError("This isn't a child profile.", 400);
  const ref = db.doc(`${KIDS}/${uid.slice(4)}`);
  const d = (await ref.get()).data();
  if (!d) throw new YoungError("That child profile wasn't found.", 404);
  if ((d.pinLockedUntil ?? 0) > now) throw new YoungError("Too many wrong PINs. Wait a few minutes and try again.", 429);
  let p: string;
  try { p = cleanPin(pin); } catch { p = "0000"; }
  const ok = timingSafeEqual(Buffer.from(hashPin(p, d.pinSalt), "hex"), Buffer.from(String(d.pinHash), "hex"));
  if (!ok) {
    const tries = (d.pinTries ?? 0) + 1;
    await ref.update({ pinTries: tries >= PIN_TRIES ? 0 : tries, ...(tries >= PIN_TRIES ? { pinLockedUntil: now + 15 * 60_000 } : {}) });
    throw new YoungError(tries >= PIN_TRIES ? "Too many wrong PINs. Wait 15 minutes and try again." : "That PIN isn't right.", 403);
  }
  await ref.update({ pinTries: 0 });
  return { token: await auth().createCustomToken(String(d.parentUid)) };
}

// The child's own view of their profile (what they may open, and the play time left today).
export async function kidMe(db: Firestore, uid: string, now = new Date()) {
  if (!isKidUid(uid)) throw new YoungError("This isn't a child profile.", 400);
  const d = (await db.doc(`${KIDS}/${uid.slice(4)}`).get()).data();
  if (!d) throw new YoungError("That child profile wasn't found.", 404);
  const p = (await db.doc(`${PLAY}/${uid}_${lagosDate(now)}`).get()).data() ?? {};
  const used = (p.usedMs ?? 0) + playAdd(p.lastAt, now.getTime());
  return { nickname: String(d.nickname), allow: d.allow, playMinutes: d.playMinutes ?? DEFAULT_PLAY, playLeftMs: playLeft(used, d.playMinutes ?? DEFAULT_PLAY) };
}

// Notes Life for a child: only if the parent allowed it, and only within today's play time. Counts the time as it goes.
export async function lifeGate(db: Firestore, uid: string, now = Date.now()): Promise<void> {
  if (!isKidUid(uid)) return;
  const d = (await db.doc(`${KIDS}/${uid.slice(4)}`).get()).data();
  if (!d?.allow?.life) throw new YoungError("Notes Life isn't switched on for this profile. Ask your parent.", 403);
  const ref = db.doc(`${PLAY}/${uid}_${lagosDate(new Date(now))}`);
  await db.runTransaction(async (t) => {
    const p = (await t.get(ref)).data() ?? {};
    const used = (p.usedMs ?? 0) + playAdd(p.lastAt, now);
    if (playLeft(used, d.playMinutes ?? DEFAULT_PLAY) <= 0) throw new YoungError("That's today's play time. Notesville will be here tomorrow!", 429);
    t.set(ref, { usedMs: used, lastAt: now });
  });
}

// Sundays from 5 pm Lagos, once a week per child: what they practised, to the parent.
export async function sendKidReports(db: Firestore, now = new Date(), send = sendEmail, emailOf = getUserEmail): Promise<number> {
  const day = lagosDate(now);
  if (new Date(`${day}T12:00:00Z`).getUTCDay() !== 0 || new Date(now.getTime() + 3_600_000).getUTCHours() < 17) return 0;
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const kids = await db.collection(KIDS).get();
  let n = 0;
  for (const k of kids.docs) {
    const ref = db.doc(`${REPORTS}/${day}_${k.id}`);
    const claimed = await db.runTransaction(async (t) => { if ((await t.get(ref)).exists) return false; t.set(ref, { at: now.toISOString() }); return true; });
    if (!claimed) continue;
    const prog = (await db.doc(`prepProgress/${kidUid(k.id)}`).get()).data();
    const r = weekReport({ byQuestion: prog?.byQuestion ?? {}, mocks: prog?.mocks ?? [] }, since);
    const to = await emailOf(String(k.data().parentUid));
    if (!to) continue;
    const name = String(k.data().nickname);
    const lines = r.answered
      ? [`${name} answered ${r.answered} question${r.answered === 1 ? "" : "s"} this week and got ${r.right} right (${Math.round((r.right / r.answered) * 100)}%).`, "", "By topic:", ...r.topics.map((t) => `- ${t.topic}: ${t.right} of ${t.answered}`), ...(r.mocks.length ? ["", "Mock exams:", ...r.mocks.map((m) => `- ${m.subject}: ${m.score} of ${m.total}`)] : [])]
      : [`${name} didn't practise on Naija Exam Prep this week.`];
    await send({ to, subject: `${name}'s week on NotesApp`, text: `Hello,\n\n${lines.join("\n")}\n\nYou can change what ${name} can use, or delete their profile and everything in it, from My account → Family.\n\nNotesApp` }).catch(() => false);
    n++;
  }
  return n;
}
