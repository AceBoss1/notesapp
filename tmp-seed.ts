// Temporary (scratchpad): an admin, a member, and a Campus Ambassador applicant at Offer, for the menus and drafting screenshots.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { LEGAL_VERSION } from "./lib/legal";
import { seedRoles } from "./lib/careers-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const now = new Date();
const consent = { version: LEGAL_VERSION, acceptedAt: now.toISOString() };
async function person(uid: string, name: string, extra: Record<string, unknown> = {}) {
  await getAuth().createUser({ uid, email: `${uid}@notesapp.test`, password: "password123", emailVerified: true, displayName: name }).catch(() => {});
  await db.doc(`usernames/${uid}`).set({ uid });
  await db.doc(`users/${uid}`).set({ uid, username: uid, displayName: name, email: `${uid}@notesapp.test`, role: "publisher", accountTier: "basic", avatar: "", bio: "", social: {}, createdAt: now.toISOString(), consent, suspended: false, ...extra });
}
(async () => {
  await person("boss", "Emeka Boss");
  await getAuth().setCustomUserClaims("boss", { admin: true, adminRole: "super" });
  await person("ada", "Ada Obi");
  await seedRoles(db, now);
  const roles = await db.collection("careerRoles").get();
  const amb = roles.docs.find((d) => d.data().seedKey === "campus-ambassador")!;
  await db.collection("careerApplications").doc("app-ada").set({ roleId: amb.id, roleTitle: amb.data().title, uid: "ada", name: "Ada Obi", email: "ada@notesapp.test", phone: "", city: "Nsukka", coverNote: "I run the computer science students' association's group chats and organise our tutorial sessions every weekend.", links: [], consentAt: now.toISOString(), futureRoles: false, status: "offer", createdAt: now.toISOString(), updatedAt: now.toISOString() });
  console.log("seeded", amb.id);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
