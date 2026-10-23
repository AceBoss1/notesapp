// Schools on Naija Exam Prep (lib/prep-schools-server.ts), against the Firestore and Auth emulators. Run: npm run test:prep-schools-server.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { addTeacher, applySchool, classView, createClass, decideSchool, joinClass, leaveClass, myClasses, mySchools, setAgreement, signAgreement } from "../../lib/prep-schools-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: Error) => re.test(e.message));
const mails: { to: string; subject: string }[] = [];
const send = async (m: { to: string; subject: string; text: string }) => { mails.push(m); return true; };

(async () => {
  await getAuth().createUser({ uid: "u_head", email: "head@greenfield.test", emailVerified: true });
  await getAuth().createUser({ uid: "u_bello", email: "bello@greenfield.test", emailVerified: true });
  for (const [u, n] of [["u_bello", "Musa Bello"], ["u_tobi", "Tobi Adeyemi"], ["u_chi", "Chioma Eze"], ["u_out", "Outsider"]]) await db.doc(`users/${u}`).set({ uid: u, displayName: n });
  const head = { uid: "u_head", email: "head@greenfield.test", emailVerified: true };
  const form = { name: "Greenfield College", state: "FCT", leadName: "Grace Okonkwo", leadRole: "Principal", students: 120 };
  await rejects(applySchool(db, { ...head, emailVerified: false }, form), /Confirm your email/);
  const { id } = await applySchool(db, head, form);
  await rejects(applySchool(db, head, form), /already applied/);
  await rejects(signAgreement(db, head, id, { name: "Grace Okonkwo", agree: true }, new Date(), send), /once we've approved/);
  await decideSchool(db, "u_admin", id, "approve", new Date(), send);
  assert.match(mails[0].subject, /approved/);
  await rejects(signAgreement(db, head, id, { name: "Grace Okonkwo", agree: true }, new Date(), send), /being finalised/);
  await rejects(setAgreement(db, "u_admin", { version: "v1", text: "too short" }), /full text/);
  await setAgreement(db, "u_admin", { version: "2026-11-01", text: "Agreement. ".repeat(40) });
  await rejects(createClass(db, head, id, { name: "SS3 Gold", exam: "jamb" }), /Sign the data agreement first/);
  await rejects(signAgreement(db, head, id, { name: "Grace Okonkwo" }, new Date(), send), /tick that you agree/);
  await signAgreement(db, head, id, { name: "Grace Okonkwo", agree: true }, new Date(), send);
  assert.match(mails.at(-1)!.subject, /Your copy/);

  await addTeacher(db, head, id, "bello@greenfield.test");
  await rejects(addTeacher(db, head, id, "nobody@nowhere.test"), /No NotesApp account/);
  await rejects(addTeacher(db, { ...head, uid: "u_bello" }, id, "x@y.test"), /Only the school's lead/);
  const gold = await createClass(db, head, id, { name: "SS3 Gold", exam: "jamb", subjects: ["maths"], teacherUid: "u_bello" });
  const blue = await createClass(db, head, id, { name: "SS3 Blue", exam: "waec" });
  assert.match(gold.code, /^GC[A-Z]-SS3G-/); assert.notEqual(gold.code, blue.code);

  await rejects(joinClass(db, "u_tobi", "ZZZ-ZZZ-ZZZ"), /wasn't found/);
  await joinClass(db, "u_tobi", gold.code.toLowerCase().replace(/-/g, " "));
  await joinClass(db, "u_chi", gold.code);
  assert.deepEqual((await myClasses(db, "u_tobi")).map((c) => c.name), ["SS3 Gold"]);
  await db.doc("prepProgress/u_tobi").set({ byQuestion: { a: { ok: true, at: new Date().toISOString(), t: "jamb/maths/indices" }, b: { ok: false, at: new Date().toISOString(), t: "jamb/maths/indices" } } });
  await db.doc("prepBoard/u_tobi").set({ joined: true, nickname: "StarMath" });

  const v = await classView(db, "u_bello", gold.id);
  assert.deepEqual(v.students.map((s) => [s.name, s.answered]), [["Tobi A.", 2], ["Chioma E.", 0]], "first name and initial");
  assert.deepEqual(v.board, [{ rank: 1, nickname: "StarMath", answered: 2 }]);
  await classView(db, "u_head", gold.id); // the lead sees every class
  await rejects(classView(db, "u_bello", blue.id), /another teacher's class/);
  await rejects(classView(db, "u_out", gold.id), /wasn't found/);
  assert.equal((await mySchools(db, "u_bello")).classes.length, 1, "a teacher sees their own classes");
  await leaveClass(db, "u_tobi", gold.id);
  assert.equal((await myClasses(db, "u_tobi")).length, 0);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
