import type { Firestore } from "firebase-admin/firestore";
import { isTeamMember, type UserProfile } from "./users";
import { STAFF_PASS_OFF, cleanPassInput, describePass, passActive, passApplies, roomPassActive, type StaffPass } from "./staff-pass";

// Server side of the staff test pass (lib/staff-pass.ts). serverConfig/staffPass holds it (server-only in firestore.rules), read through a
// 30-second cache like the other settings; staffPassLog keeps who changed it and when (server-only, never edited).

export class StaffPassError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const DOC = "serverConfig/staffPass";
const TTL_MS = 30_000;
let cache: { at: number; data: StaffPass } | null = null;
export const resetStaffPassCache = () => { cache = null; };

const asPass = (x: unknown): StaffPass => {
  const d = (x ?? {}) as Partial<StaffPass>;
  return d.on === true && typeof d.until === "string"
    ? { on: true, until: d.until, ...(d.byUid ? { byUid: d.byUid } : {}), ...(d.byEmail ? { byEmail: d.byEmail } : {}), ...(d.at ? { at: d.at } : {}) }
    : { ...STAFF_PASS_OFF, ...(d.byUid ? { byUid: d.byUid } : {}), ...(d.byEmail ? { byEmail: d.byEmail } : {}), ...(d.at ? { at: d.at } : {}) };
};

export async function getStaffPass(db: Firestore, now = Date.now()): Promise<StaffPass> {
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const data = asPass((await db.doc(DOC).get()).data());
  cache = { at: now, data };
  return data;
}

// Whether this account skips the live limits now: the pass is on and they're on the #NotesApp team (lib/users.ts isTeamMember).
// Never throws: any trouble reading means no pass.
export async function hasStaffPass(db: Firestore, uid: string, now = new Date(), profile?: Partial<UserProfile> | null): Promise<boolean> {
  try {
    const p = await getStaffPass(db, now.getTime());
    if (!passActive(p, now.getTime())) return false;
    const u = profile ?? ((await db.doc(`users/${uid}`).get()).data() as Partial<UserProfile> | undefined);
    return passApplies(p, !!u && isTeamMember(u as UserProfile), now.getTime());
  } catch {
    return false;
  }
}
// A room (or recording) opened under the pass, while the pass is still on.
export async function roomOnPass(db: Firestore, r: { staffPass?: boolean } | null | undefined, now = new Date()): Promise<boolean> {
  if (r?.staffPass !== true) return false;
  return roomPassActive(r, await getStaffPass(db, now.getTime()).catch(() => STAFF_PASS_OFF), now.getTime());
}

export type StaffPassCaller = { uid: string; email: string; super: boolean };
export type StaffPassLogRow = { id: string; at: string; byUid: string; byEmail: string; before: string; after: string };

// Super admins only. Every change is saved and logged (who, when, before and after).
export async function saveStaffPass(db: Firestore, c: StaffPassCaller, input: unknown, now = new Date()): Promise<StaffPass> {
  if (!c.super) throw new StaffPassError(403, "Only super admins can change the staff test pass.");
  const clean = cleanPassInput(input, now.getTime());
  if (!clean.ok) throw new StaffPassError(400, clean.error);
  const before = asPass((await db.doc(DOC).get()).data());
  const at = now.toISOString();
  const next: StaffPass = { ...clean.pass, byUid: c.uid, byEmail: c.email, at };
  await db.doc(DOC).set(next);
  await db.collection("staffPassLog").add({ at, byUid: c.uid, byEmail: c.email, before: passActive(before, now.getTime()) ? describePass(before) : "off", after: describePass(next) });
  cache = { at: now.getTime(), data: next };
  return next;
}

export async function staffPassLog(db: Firestore, limit = 20): Promise<StaffPassLogRow[]> {
  const snap = await db.collection("staffPassLog").orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffPassLogRow, "id">) }));
}
