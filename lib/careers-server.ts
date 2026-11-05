import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { notifyBell } from "./email";
import { gemModel, realDeps, runAi, type NanaDeps } from "./nana-server";
import { canManageTeam, isSuper, type Access } from "./admin-access";
import {
  APP_STATUS_LABEL, CareersError, KEEP_DAYS, SEED_ROLES, cleanApplication, cleanRole, isAppStatus, nextStatusAllowed,
  type Application, type CareerRole, type RoleStatus,
} from "./careers";
import { cleanTerms, draftsFor } from "./hr-drafts";

// Careers and hiring on the server (lib/careers.ts has the rules). Collections, all server-only (firestore.rules):
//   careerRoles/{id}            the roles (seed-<key> for the seeded vacancies)
//   careerApplications/{roleId}_{uid}   one application per person per role; TTL on purgeAt (6 months after the role closes)
//   hrDrafts/{id}               Nana-HR's onboarding drafts (offer, option grant, announcement) for the people who manage hiring
export type Staff = { uid: string; email: string; access: Access; owner: boolean };
const ROLES = "careerRoles", APPS = "careerApplications", DRAFTS = "hrDrafts";
const need = (ok: boolean, msg = "Only super admins and the Chief of Staff manage hiring.", status = 403) => { if (!ok) throw new CareersError(msg, status); };
const toRole = (id: string, d: FirebaseFirestore.DocumentData) => ({ ...(d as Omit<CareerRole, "id">), id }) as CareerRole;
const toApp = (id: string, d: FirebaseFirestore.DocumentData) => { const { purgeAt: _p, ...rest } = d; return { ...(rest as Omit<Application, "id">), id } as Application; };

// The seeded vacancies, written once (fixed ids, so it never duplicates). Called by the public page and the team hub.
export async function seedRoles(db: Firestore, now = new Date()): Promise<number> {
  const marker = db.doc("staffMeta/careersSeed");
  const m = await marker.get();
  if (m.exists) {
    // Marketing split from Sales & partnerships: the seeded CMO and UA lead vacancies move to Marketing, once, unless someone
    // already changed their department.
    if (!m.data()?.marketingSplit) {
      for (const key of ["cmo", "ua-lead"]) {
        const ref = db.doc(`${ROLES}/seed-${key}`);
        if ((await ref.get()).data()?.dept === "growth") await ref.update({ dept: "marketing", updatedAt: now.toISOString() });
      }
      await marker.set({ marketingSplit: now.toISOString() }, { merge: true });
    }
    // A vacancy added to the seed later (the Community Strategist, 5 Nov 2026) opens once on a site seeded before; one listed in the
    // marker was seeded already, so a role someone deleted never comes back.
    const seeded = new Set<string>(Array.isArray(m.data()?.roles) ? m.data()!.roles : []);
    let added = 0;
    for (const r of SEED_ROLES.filter((r) => !seeded.has(r.seedKey))) {
      const ref = db.doc(`${ROLES}/seed-${r.seedKey}`);
      if (!(await ref.get()).exists) {
        await ref.set({ ...r, status: "open", openedAt: now.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(), createdByUid: "seed" });
        added++;
      }
      seeded.add(r.seedKey);
    }
    if (added || seeded.size !== (m.data()?.roles?.length ?? 0)) await marker.set({ roles: Array.from(seeded) }, { merge: true });
    return added;
  }
  let n = 0;
  for (const r of SEED_ROLES) {
    const ref = db.doc(`${ROLES}/seed-${r.seedKey}`);
    if ((await ref.get()).exists) continue;
    await ref.set({ ...r, status: "open", openedAt: now.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(), createdByUid: "seed" });
    n++;
  }
  await marker.set({ at: now.toISOString(), roles: SEED_ROLES.map((r) => r.seedKey) });
  return n;
}

// ── Public ────────────────────────────────────────────────────────────────────────────────────────────────

export async function openRoles(db: Firestore): Promise<CareerRole[]> {
  await seedRoles(db).catch(() => {});
  const s = await db.collection(ROLES).where("status", "==", "open").get();
  return s.docs.map((d) => toRole(d.id, d.data())).sort((a, b) => (a.openedAt || "").localeCompare(b.openedAt || "") || a.title.localeCompare(b.title));
}

export async function openRole(db: Firestore, id: string): Promise<CareerRole | null> {
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) return null;
  const d = await db.doc(`${ROLES}/${id}`).get();
  const r = d.exists ? toRole(d.id, d.data()!) : null;
  return r && r.status === "open" ? r : null;
}

export async function apply(db: Firestore, me: { uid: string; email: string }, roleId: unknown, body: Record<string, unknown>, now = new Date()): Promise<{ id: string }> {
  const role = await openRole(db, String(roleId ?? ""));
  if (!role) throw new CareersError("That role isn't open any more.", 404);
  const clean = cleanApplication(body);
  const id = `${role.id}_${me.uid}`;
  const ref = db.doc(`${APPS}/${id}`);
  const prev = await ref.get();
  if (prev.exists && prev.data()?.status !== "withdrawn") throw new CareersError("You've already applied for this role. We'll be in touch.", 409);
  const user = await getAuth(getAdminApp()).getUser(me.uid);
  const profile = (await db.doc(`users/${me.uid}`).get()).data();
  const name = String(profile?.displayName || user.displayName || me.email.split("@")[0]).slice(0, 100);
  await ref.set({
    roleId: role.id, roleTitle: role.title, uid: me.uid, name, email: user.email || me.email, ...clean,
    consentAt: now.toISOString(), status: "new", createdAt: now.toISOString(), updatedAt: now.toISOString(),
  });
  await notifyBell({ uid: me.uid, type: "team", linkHref: "/careers", message: `Thanks for applying for ${role.title} at #NotesApp. A person reads every application, and we'll tell you either way.` }).catch(() => {});
  return { id };
}

// ── Team hub ──────────────────────────────────────────────────────────────────────────────────────────────

export async function hiringBoard(db: Firestore, me: Staff) {
  need(canManageTeam(me.access));
  await seedRoles(db).catch(() => {});
  const [roles, apps] = await Promise.all([db.collection(ROLES).get(), db.collection(APPS).get()]);
  return {
    roles: roles.docs.map((d) => toRole(d.id, d.data())).sort((a, b) => a.status.localeCompare(b.status) || a.title.localeCompare(b.title)),
    applications: apps.docs.map((d) => toApp(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    canOpen: isSuper(me.access),
  };
}

export async function saveRole(db: Firestore, me: Staff, id: unknown, body: Record<string, unknown>, now = new Date()): Promise<CareerRole> {
  need(canManageTeam(me.access));
  const clean = cleanRole(body);
  if (typeof id === "string" && id) {
    const ref = db.doc(`${ROLES}/${id}`);
    const cur = await ref.get();
    if (!cur.exists) throw new CareersError("That role isn't there any more.", 404);
    await ref.update({ ...clean, updatedAt: now.toISOString() });
    return toRole(id, { ...cur.data(), ...clean });
  }
  const ref = db.collection(ROLES).doc();
  const doc = { ...clean, status: "draft" as RoleStatus, createdAt: now.toISOString(), updatedAt: now.toISOString(), createdByUid: me.uid };
  await ref.set(doc);
  return toRole(ref.id, doc);
}

// A super admin opens (approves) or closes a role; closing it starts the 6-month clock on its applications.
export async function setRoleStatus(db: Firestore, me: Staff, id: unknown, to: unknown, now = new Date()): Promise<void> {
  need(isSuper(me.access), "Only a super admin can open or close a role.");
  if (to !== "open" && to !== "closed" && to !== "draft") throw new CareersError("Choose open, closed or draft.");
  const ref = db.doc(`${ROLES}/${String(id)}`);
  const cur = (await ref.get()).data();
  if (!cur) throw new CareersError("That role isn't there any more.", 404);
  if (!nextStatusAllowed(cur.status, to)) throw new CareersError("That role is already there.");
  await ref.update({ status: to, updatedAt: now.toISOString(), ...(to === "open" ? { openedAt: now.toISOString() } : to === "closed" ? { closedAt: now.toISOString() } : {}) });
  if (to === "closed") {
    const purgeAt = new Date(now.getTime() + KEEP_DAYS * 86_400_000);
    const apps = await db.collection(APPS).where("roleId", "==", String(id)).get();
    for (const a of apps.docs) if (!a.data().futureRoles) await a.ref.update({ purgeAt });
  }
}

const TELL: Partial<Record<keyof typeof APP_STATUS_LABEL, (role: string) => string>> = {
  interview: (r) => `Good news: we'd like to talk to you about ${r} at #NotesApp. We'll message you on NotesApp to agree a time.`,
  offer: (r) => `We'd like to offer you ${r} at #NotesApp. We'll be in touch with the details.`,
  declined: (r) => `Thank you for applying for ${r} at #NotesApp. We won't be taking your application forward this time. We read every application, and we're grateful you applied.`,
};

// A person moves an application on. The applicant hears at the steps that matter to them.
export async function setApplicationStatus(db: Firestore, me: Staff, id: unknown, status: unknown, notes: unknown, now = new Date()): Promise<void> {
  need(canManageTeam(me.access));
  if (!isAppStatus(status)) throw new CareersError("Choose a status.");
  const ref = db.doc(`${APPS}/${String(id)}`);
  const cur = (await ref.get()).data();
  if (!cur) throw new CareersError("That application isn't there any more.", 404);
  await ref.update({ status, updatedAt: now.toISOString(), decidedBy: me.uid, ...(typeof notes === "string" ? { notes: notes.trim().slice(0, 2000) } : {}) });
  const tell = cur.status !== status ? TELL[status] : undefined;
  if (tell) await notifyBell({ uid: String(cur.uid), type: "team", linkHref: "/careers", message: tell(String(cur.roleTitle)) }).catch(() => {});
}

// Nana-HR's screening summary: each stated requirement met, not met or unclear, with the applicant's own words as evidence. No ranking,
// no score, no recommendation, and nothing about protected characteristics (they aren't given to her).
export const SCREEN_SYSTEM = `You are Nana-HR, the hiring helper inside the #NotesApp team hub. You write a short screening summary of ONE job application for the person who will decide. Rules you never break:
- For each requirement listed, write one line: the requirement, then "Met", "Not met" or "Unclear", then the evidence quoted from the application in quotation marks (or "nothing in the application" if there is none).
- Then at most three lines headed "Worth asking at interview".
- Never rank, score, compare with other applicants, recommend hiring or rejecting, or guess. Use only what is in the application.
- Never mention or infer ethnic group, state of origin, religion, sex, age, disability, marital status, family or appearance.
- Plain British English, short lines, no preamble.`;

export async function summarise(db: Firestore, me: Staff, id: unknown, deps: NanaDeps = realDeps(), now = new Date()): Promise<string> {
  need(canManageTeam(me.access));
  const ref = db.doc(`${APPS}/${String(id)}`);
  const a = (await ref.get()).data();
  if (!a) throw new CareersError("That application isn't there any more.", 404);
  const role = (await db.doc(`${ROLES}/${a.roleId}`).get()).data();
  if (!role) throw new CareersError("That role isn't there any more.", 404);
  const user = `ROLE: ${role.title}\nREQUIREMENTS:\n${(role.requirements as string[]).map((r) => `- ${r}`).join("\n")}\n\nAPPLICATION (from the applicant, as written):\nCity: ${a.city || "not given"}\nLinks: ${(a.links as string[]).join(", ") || "none"}\nWhy this role and what they'd bring:\n${a.coverNote}`;
  const ran = await runAi(db, deps, now, me.uid, { system: [{ type: "text", text: SCREEN_SYSTEM }], messages: [{ role: "user", content: user }], maxTokens: 900, model: gemModel("pearl") }, 200);
  if (!ran.completion || ran.completion.refused || !ran.completion.text) throw new CareersError("Nana-HR couldn't write a summary just now. Try again later.", 503);
  const text = ran.completion.text.trim().slice(0, 4000);
  await ref.update({ summary: { text, at: now.toISOString() }, updatedAt: now.toISOString() });
  return text;
}

// Onboarding drafts from the templates (lib/hr-drafts.ts): an offer letter, an option grant and the announcement, as the arrangement needs.
export async function makeDrafts(db: Firestore, me: Staff, body: Record<string, unknown>, now = new Date()) {
  need(canManageTeam(me.access));
  const terms = cleanTerms(body);
  if (!terms.name || !terms.title) throw new CareersError("Give the new hire's name and role.");
  const drafts = draftsFor(terms);
  const ref = db.collection(DRAFTS).doc();
  await ref.set({ applicationId: typeof body.applicationId === "string" ? body.applicationId.slice(0, 120) : null, terms, drafts, createdAt: now.toISOString(), createdByUid: me.uid });
  return { id: ref.id, drafts };
}

export async function listDrafts(db: Firestore, me: Staff) {
  need(canManageTeam(me.access));
  const s = await db.collection(DRAFTS).orderBy("createdAt", "desc").limit(30).get();
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as { applicationId: string | null; drafts: { kind: string; title: string; markdown: string }[]; createdAt: string }) }));
}
