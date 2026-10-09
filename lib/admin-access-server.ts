import { getAuth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminApp, isOwnerEmail } from "./firebase-admin";
import { notifyBell } from "./email";
import { ADMIN_PROFILES } from "./admin";
import { DEPT_LABEL, accessFromClaims, isDept, type Access, type Dept } from "./admin-access";

// Appointing and removing staff. Rules:
//   - Only a super admin can change anyone's access.
//   - Only the owner (OWNER_EMAIL) can appoint or remove a super admin; other super admins appoint and remove admins and choose their departments.
//   - Nobody can change the owner's access, and nobody can change their own.
//   - The person must already have a #NotesApp account (they sign up first, then are appointed by their email).
// The role lives in the account's custom claims (see lib/admin-access.ts), so the API routes and the Firestore rules can both read it.

export class AccessChangeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type StaffPerson = { uid: string; email: string; name: string; role: "super" | "admin"; depts: Dept[]; owner: boolean };

// Everyone with staff access, read from the accounts themselves. Cached for a minute (a scan reads every account), and cleared on any change.
let cache: { at: number; rows: { uid: string; email: string; access: Access }[] } | null = null;
export const clearStaffCache = () => { cache = null; };
export async function staffAccounts(): Promise<{ uid: string; email: string; access: Access }[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.rows;
  const auth = getAuth(getAdminApp());
  const rows: { uid: string; email: string; access: Access }[] = [];
  let token: string | undefined;
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) {
      const access = accessFromClaims(u.customClaims as Record<string, unknown> | undefined);
      if (access) rows.push({ uid: u.uid, email: u.email || "", access });
    }
    token = page.pageToken;
  } while (token);
  cache = { at: Date.now(), rows };
  return rows;
}

export async function listStaff(db: Firestore): Promise<StaffPerson[]> {
  const rows = await staffAccounts();
  const docs = rows.length ? await db.getAll(...rows.map((r) => db.doc(`users/${r.uid}`))) : [];
  return rows
    .map((r, i) => {
      const d = docs[i].data();
      const name = d?.displayName || ADMIN_PROFILES[r.email]?.displayName || d?.username || r.email.split("@")[0] || r.uid;
      return { uid: r.uid, email: r.email, name: String(name), role: r.access.role, depts: r.access.depts, owner: isOwnerEmail(r.email) };
    })
    .sort((a, b) => Number(b.owner) - Number(a.owner) || (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "super" ? -1 : 1));
}

export type Caller = { uid: string; email: string; access: Access; owner: boolean };
export type Change = { email: unknown; role: unknown; depts?: unknown };

const describe = (role: "super" | "admin" | "none", depts: Dept[]) => (role === "none" ? "no access" : role === "super" ? "super admin" : `admin (${depts.map((d) => DEPT_LABEL[d]).join(", ")})`);

export async function changeAccess(db: Firestore, caller: Caller, input: Change, now = new Date(), notify = notifyBell): Promise<{ summary: string }> {
  if (caller.access.role !== "super") throw new AccessChangeError(403, "Only a super admin can change who has access.");
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AccessChangeError(400, "Enter the person's email address.");
  const role = input.role;
  if (role !== "super" && role !== "admin" && role !== "none") throw new AccessChangeError(400, "Choose Super admin, Admin or No access.");
  const depts = role === "admin" ? Array.from(new Set((Array.isArray(input.depts) ? input.depts : []).filter(isDept))) : [];
  if (role === "admin" && !depts.length) throw new AccessChangeError(400, "Choose at least one department for an admin.");

  const auth = getAuth(getAdminApp());
  const target = await auth.getUserByEmail(email).catch(() => null);
  if (!target) throw new AccessChangeError(404, "No #NotesApp account has that email. Ask them to sign up first, then add them.");
  if (isOwnerEmail(target.email)) throw new AccessChangeError(403, "The owner's access can't be changed.");
  if (target.uid === caller.uid) throw new AccessChangeError(403, "You can't change your own access.");
  const current = accessFromClaims(target.customClaims as Record<string, unknown> | undefined);
  // Anything that adds, removes or edits a super admin is the owner's alone.
  if ((role === "super" || current?.role === "super") && !caller.owner) throw new AccessChangeError(403, "Only the owner can appoint or remove super admins.");
  if (!current && role === "none") throw new AccessChangeError(400, "They have no access to remove.");

  const claims = { ...(target.customClaims || {}) } as Record<string, unknown>;
  if (role === "none") { delete claims.admin; delete claims.adminRole; delete claims.depts; }
  else if (role === "super") { claims.admin = true; claims.adminRole = "super"; delete claims.depts; }
  else { claims.admin = true; claims.adminRole = "admin"; claims.depts = depts; }
  await auth.setCustomUserClaims(target.uid, claims);
  // Taking access away (or narrowing it) ends their sessions, so it applies on the next request instead of when their token runs out.
  const narrowed = role === "none" || (current?.role === "super" && role === "admin") || (current?.role === "admin" && role === "admin" && current.depts.some((d) => !depts.includes(d)));
  if (narrowed) await auth.revokeRefreshTokens(target.uid).catch(() => {});
  if (role !== "none") await db.doc(`users/${target.uid}`).set({ accountTier: "business" }, { merge: true }).catch(() => {}); // staff can publish
  clearStaffCache();

  const before = current ? describe(current.role, current.depts) : "no access", after = describe(role, depts);
  await db.collection("adminAccessLog").add({ at: now.toISOString(), byUid: caller.uid, byEmail: caller.email, targetUid: target.uid, targetEmail: email, before, after });
  await notify({
    uid: target.uid, type: "team", linkHref: role === "none" ? "/" : "/admin",
    message: role === "none" ? "Your #NotesApp admin access was removed." : `Your #NotesApp admin access is now: ${after}. Sign out and back in if the Admin menu doesn't show it yet.`,
  }).catch(() => {});
  return { summary: `${target.displayName || email}: ${before} → ${after}` };
}

export async function accessLog(db: Firestore, limit = 30) {
  const snap = await db.collection("adminAccessLog").orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as { at: string; byEmail: string; targetEmail: string; before: string; after: string }) }));
}
