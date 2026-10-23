import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { sendEmail } from "./email";
import { isKidUid } from "./kids";
import { SchoolError, cleanClass, cleanSchool, classCode, isCode, normaliseCode, studentLabel, studentWeek, type School, type SchoolClass } from "./prep-schools";

// Server side of schools on Naija Exam Prep (lib/prep-schools.ts has the rules). Collections, server-only (prep* are closed in
// firestore.rules): prepSchools/{id}, prepClasses/{id}, prepClassCodes/{code} → the class, prepClassMembers/{classId_uid},
// prepConfig/schoolAgreement (Legal's text and its version).
const SCHOOLS = "prepSchools", CLASSES = "prepClasses", CODES = "prepClassCodes", MEMBERS = "prepClassMembers", AGREEMENT = "prepConfig/schoolAgreement";
const toSchool = (id: string, d: FirebaseFirestore.DocumentData) => ({ ...(d as Omit<School, "id">), id }) as School;
const toClass = (id: string, d: FirebaseFirestore.DocumentData) => ({ ...(d as Omit<SchoolClass, "id">), id }) as SchoolClass;
type Me = { uid: string; email: string; emailVerified: boolean };

export async function agreement(db: Firestore): Promise<{ version: string; text: string } | null> {
  const d = (await db.doc(AGREEMENT).get()).data();
  return d?.version && d?.text ? { version: String(d.version), text: String(d.text) } : null;
}
export async function setAgreement(db: Firestore, adminUid: string, b: Record<string, unknown>, now = new Date()) {
  const version = String(b.version ?? "").trim().slice(0, 40), text = String(b.text ?? "").trim().slice(0, 20_000);
  if (!version || text.length < 200) throw new SchoolError("Give the agreement a version and its full text.");
  await db.doc(AGREEMENT).set({ version, text, updatedAt: now.toISOString(), by: adminUid });
  return { version };
}

export async function applySchool(db: Firestore, me: Me, b: Record<string, unknown>, now = new Date()) {
  if (isKidUid(me.uid)) throw new SchoolError("Sign in with your own account.", 403);
  if (!me.emailVerified) throw new SchoolError("Confirm your email address first: we'll write to you there.", 403);
  const mine = await db.collection(SCHOOLS).where("leadUid", "==", me.uid).get();
  if (mine.docs.some((d) => d.data().status !== "declined")) throw new SchoolError("You've already applied for a school.", 409);
  const s = cleanSchool(b);
  const ref = await db.collection(SCHOOLS).add({ ...s, leadUid: me.uid, leadEmail: me.email, staff: { [me.uid]: "lead" }, staffUids: [me.uid], status: "pending", createdAt: now.toISOString() });
  return { id: ref.id };
}

// The schools and classes this person runs or teaches, and the agreement to sign.
export async function mySchools(db: Firestore, uid: string) {
  const s = await db.collection(SCHOOLS).where("staffUids", "array-contains", uid).get();
  const schools = s.docs.map((d) => toSchool(d.id, d.data()));
  const classes: SchoolClass[] = [];
  for (const sc of schools) {
    const c = await db.collection(CLASSES).where("schoolId", "==", sc.id).get();
    classes.push(...c.docs.map((d) => toClass(d.id, d.data())).filter((x) => sc.staff[uid] === "lead" || x.teacherUid === uid));
  }
  return { schools, classes, agreement: await agreement(db) };
}

async function staffOf(db: Firestore, uid: string, schoolId: unknown, lead = false) {
  const ref = db.doc(`${SCHOOLS}/${String(schoolId ?? "x").replace(/\//g, "")}`);
  const d = (await ref.get()).data();
  if (!d || !d.staff?.[uid] || (lead && d.staff[uid] !== "lead")) throw new SchoolError(lead ? "Only the school's lead can do that." : "That school wasn't found.", lead ? 403 : 404);
  return { ref, school: toSchool(ref.id, d) };
}

export async function signAgreement(db: Firestore, me: Me, schoolId: unknown, b: Record<string, unknown>, now = new Date(), send = sendEmail) {
  const { ref, school } = await staffOf(db, me.uid, schoolId, true);
  if (school.status !== "approved") throw new SchoolError("We'll ask you to sign once we've approved the school.", 409);
  const a = await agreement(db);
  if (!a) throw new SchoolError("The agreement is being finalised. We'll email you when it's ready to sign.", 409);
  const name = String(b.name ?? "").trim().slice(0, 80);
  if (b.agree !== true || name.length < 3) throw new SchoolError("Type your full name and tick that you agree, on the school's behalf.");
  const signature = { version: a.version, name, role: school.leadRole, uid: me.uid, at: now.toISOString() };
  await ref.update({ signature });
  await send({ to: me.email, subject: `Your copy: ${school.name}'s Naija Exam Prep data agreement (${a.version})`, text: `Signed by ${name} (${school.leadRole}) for ${school.name} on ${now.toISOString().slice(0, 10)}.\n\n${a.text}` }).catch(() => false);
  return { signature };
}

export async function addTeacher(db: Firestore, me: Me, schoolId: unknown, email: unknown) {
  const { ref } = await staffOf(db, me.uid, schoolId, true);
  const e = String(email ?? "").trim().toLowerCase();
  const u = await getAuth(getAdminApp()).getUserByEmail(e).catch(() => null);
  if (!u) throw new SchoolError("No NotesApp account has that email. Ask them to sign up first, then add them.", 404);
  await ref.update({ [`staff.${u.uid}`]: "teacher", staffUids: FieldValue.arrayUnion(u.uid) });
  return { uid: u.uid };
}

export async function createClass(db: Firestore, me: Me, schoolId: unknown, b: Record<string, unknown>, now = new Date(), rand: () => number = Math.random) {
  const { school } = await staffOf(db, me.uid, schoolId, true);
  if (!school.signature) throw new SchoolError("Sign the data agreement first.", 409);
  const c = cleanClass(b);
  const teacherUid = typeof b.teacherUid === "string" && school.staff[b.teacherUid] ? b.teacherUid : me.uid;
  const teacherName = String((await db.doc(`users/${teacherUid}`).get()).data()?.displayName ?? "");
  const ref = db.collection(CLASSES).doc();
  for (let i = 0; i < 8; i++) {
    const code = classCode(school.name, c.name, rand);
    const ok = await db.runTransaction(async (t) => {
      const cr = db.doc(`${CODES}/${code}`);
      if ((await t.get(cr)).exists) return false;
      t.set(cr, { classId: ref.id, schoolId: school.id });
      t.set(ref, { ...c, schoolId: school.id, teacherUid, teacherName, code, createdAt: now.toISOString() });
      return true;
    });
    if (ok) return { id: ref.id, code };
  }
  throw new SchoolError("Couldn't make a code just now. Try again.", 503);
}

// A student joins with the code their teacher gives them.
export async function joinClass(db: Firestore, uid: string, code: unknown, now = new Date()) {
  const c = normaliseCode(code);
  if (!isCode(c)) throw new SchoolError("Check the class code: it looks like GFC-SS3G-7KQ.");
  const map = (await db.doc(`${CODES}/${c}`).get()).data();
  if (!map) throw new SchoolError("That class code wasn't found. Check it with your teacher.", 404);
  const cls = toClass(map.classId, (await db.doc(`${CLASSES}/${map.classId}`).get()).data()!);
  const school = (await db.doc(`${SCHOOLS}/${cls.schoolId}`).get()).data();
  if (!school?.signature) throw new SchoolError("That class isn't open yet.", 409);
  await db.doc(`${MEMBERS}/${cls.id}_${uid}`).set({ classId: cls.id, schoolId: cls.schoolId, uid, joinedAt: now.toISOString() });
  return { className: cls.name, school: String(school.name) };
}
export async function myClasses(db: Firestore, uid: string) {
  const s = await db.collection(MEMBERS).where("uid", "==", uid).get();
  const out: { id: string; name: string; school: string }[] = [];
  for (const m of s.docs) {
    const cls = (await db.doc(`${CLASSES}/${m.data().classId}`).get()).data();
    const school = cls ? (await db.doc(`${SCHOOLS}/${cls.schoolId}`).get()).data() : null;
    if (cls && school) out.push({ id: m.data().classId, name: String(cls.name), school: String(school.name) });
  }
  return out;
}
export async function leaveClass(db: Firestore, uid: string, classId: unknown) {
  await db.doc(`${MEMBERS}/${String(classId ?? "x").replace(/\//g, "")}_${uid}`).delete();
}

// The teacher's view: each student by first name and initial, this week's questions, score and weakest topic, and the board.
export async function classView(db: Firestore, uid: string, classId: unknown, now = new Date()) {
  const ref = db.doc(`${CLASSES}/${String(classId ?? "x").replace(/\//g, "")}`);
  const d = (await ref.get()).data();
  if (!d) throw new SchoolError("That class wasn't found.", 404);
  const cls = toClass(ref.id, d);
  const { school } = await staffOf(db, uid, cls.schoolId);
  if (school.staff[uid] !== "lead" && cls.teacherUid !== uid) throw new SchoolError("That's another teacher's class.", 403);
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const members = (await db.collection(MEMBERS).where("classId", "==", cls.id).get()).docs.map((m) => String(m.data().uid));
  const [users, progress, boards] = await Promise.all(["users", "prepProgress", "prepBoard"].map((c) => (members.length ? db.getAll(...members.map((u) => db.doc(`${c}/${u}`))) : Promise.resolve([]))));
  const students = members.map((u, i) => {
    const w = studentWeek(progress[i]?.data()?.byQuestion ?? {}, since, cls.subjects);
    return { uid: u, name: studentLabel(String(users[i]?.data()?.displayName ?? "")), nickname: boards[i]?.data()?.joined ? String(boards[i]!.data()!.nickname) : "", ...w };
  }).sort((a, b) => b.answered - a.answered);
  const board = students.filter((s) => s.nickname && s.answered).slice(0, 10).map((s, i) => ({ rank: i + 1, nickname: s.nickname, answered: s.answered }));
  return { cls, school: { id: school.id, name: school.name }, students, board };
}

// ── NotesApp's side (Admin → Naija Exam Prep → Schools) ─────────────────────────────────────────────────────────────────────
export async function adminSchools(db: Firestore) {
  const s = await db.collection(SCHOOLS).orderBy("createdAt", "desc").limit(200).get();
  return { schools: s.docs.map((d) => ({ ...toSchool(d.id, d.data()), leadEmail: String(d.data().leadEmail ?? "") })), agreement: await agreement(db) };
}
export async function decideSchool(db: Firestore, adminUid: string, id: unknown, decision: unknown, now = new Date(), send = sendEmail) {
  const ref = db.doc(`${SCHOOLS}/${String(id ?? "x").replace(/\//g, "")}`);
  const d = (await ref.get()).data();
  if (!d) throw new SchoolError("That school wasn't found.", 404);
  if (decision !== "approve" && decision !== "decline") throw new SchoolError("Approve or decline it.");
  const status = decision === "approve" ? "approved" : "declined";
  await ref.update({ status, decidedAt: now.toISOString(), decidedBy: adminUid });
  if (d.leadEmail) await send({ to: String(d.leadEmail), subject: status === "approved" ? `${d.name} is approved for Naija Exam Prep` : `About ${d.name}'s application`, text: status === "approved" ? `Hello ${d.leadName},\n\n${d.name} is approved for the Naija Exam Prep schools pilot, free while it runs. Next: sign the onboarding data agreement on behalf of the school, then make your classes and their access codes.\n\nNaija Exam Prep by NotesApp` : `Hello ${d.leadName},\n\nWe couldn't approve ${d.name} for the schools pilot this time. Reply to this email and we'll tell you why and what would help.\n\nNaija Exam Prep by NotesApp` }).catch(() => false);
  return { status };
}
