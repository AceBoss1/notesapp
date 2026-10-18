import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getUserEmail } from "./firebase-admin";
import { notifyBell } from "./email";
import { isSuper, type Access } from "./admin-access";
import { walletDoc, walletOf } from "./wallet-server";
import { nairaOf, type WalletTx } from "./wallet";

// Admin → Credits (app/(main)/admin/credits): adding Nana credit (lib/nana-meter.ts) or NotesApp Credit (the wallet, lib/wallet-server.ts)
// to a member's account by hand: a goodwill gesture, a refund that can't go back to the card, or an emergency. Only the owner can, and
// the super admins the owner switches on here (platformSettings/creditTopups.uids); everyone else with super access sees the page and
// the log but can't add. Every top-up needs a reason, rings the member's bell, and is logged in creditTopups for good.

export const CREDIT_KINDS = ["nana", "wallet"] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];
export const CREDIT_LABEL: Record<CreditKind, string> = { nana: "Nana credit", wallet: "NotesApp Credit (wallet)" };
export const TOPUP_MAX = 500_000 * 100; // ₦500,000 at a time: a typo guard
export const REASON_MIN = 5;

export class CreditError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export type Admin = { uid: string; email: string; access: Access; owner: boolean };

const grantsDoc = (db: Firestore) => db.doc("platformSettings/creditTopups");
export async function topUpAdmins(db: Firestore): Promise<string[]> {
  const d = (await grantsDoc(db).get()).data();
  return Array.isArray(d?.uids) ? d!.uids.filter((u: unknown): u is string => typeof u === "string") : [];
}
export async function canTopUp(db: Firestore, a: Admin): Promise<boolean> {
  return a.owner || (isSuper(a.access) && (await topUpAdmins(db)).includes(a.uid));
}

// The owner only: who else may add credit. They must be super admins; anyone else is refused.
export async function setTopUpAdmins(db: Firestore, a: Admin, uids: unknown, supers: { uid: string }[], now = new Date()): Promise<string[]> {
  if (!a.owner) throw new CreditError(403, "Only the owner can choose who adds credit.");
  if (!Array.isArray(uids) || uids.some((u) => typeof u !== "string")) throw new CreditError(400, "Choose people from the list.");
  const allowed = new Set(supers.map((s) => s.uid));
  const list = Array.from(new Set(uids as string[])).filter((u) => u !== a.uid);
  if (list.some((u) => !allowed.has(u))) throw new CreditError(400, "Only super admins can be allowed to add credit.");
  await grantsDoc(db).set({ uids: list, updatedAt: now.toISOString(), updatedBy: a.email });
  return list;
}

export type Member = { uid: string; username: string; displayName: string; avatar: string; email: string; nanaKobo: number; walletKobo: number };
async function memberOf(db: Firestore, uid: string, email = ""): Promise<Member | null> {
  const [u, n, w] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`nanaAccounts/${uid}`).get(), walletDoc(db, uid).get()]);
  if (!u.exists) return null;
  const d = u.data()!;
  return {
    uid, username: String(d.username ?? ""), displayName: String(d.displayName ?? ""), avatar: String(d.avatar ?? d.photoURL ?? ""), email,
    nanaKobo: Math.max(0, Number(n.data()?.creditKobo) || 0), walletKobo: walletOf(w.data()).creditKobo,
  };
}

// By email (exact), username (exact, with or without @) or display name (starts with, as typed). Up to 10.
export async function searchMembers(db: Firestore, raw: string): Promise<Member[]> {
  const q = raw.trim().replace(/^@/, "");
  if (q.length < 2) return [];
  const found = new Map<string, string>(); // uid → email
  if (q.includes("@")) {
    const u = await getAuth(getAdminApp()).getUserByEmail(q.toLowerCase()).catch(() => null);
    if (u) found.set(u.uid, u.email ?? "");
  } else {
    const byName = await db.doc(`usernames/${q.toLowerCase()}`).get();
    if (byName.exists && byName.data()?.uid) found.set(String(byName.data()!.uid), "");
    const prefix = await db.collection("users").where("displayName", ">=", q).where("displayName", "<", `${q}`).limit(10).get();
    prefix.docs.forEach((d) => { if (!found.has(d.id)) found.set(d.id, ""); });
  }
  const emails = found.size ? await getAuth(getAdminApp()).getUsers(Array.from(found.keys()).map((uid) => ({ uid }))).catch(() => null) : null;
  emails?.users.forEach((u) => found.set(u.uid, u.email ?? ""));
  const out = await Promise.all(Array.from(found).slice(0, 10).map(([uid, email]) => memberOf(db, uid, email)));
  return out.filter((m): m is Member => !!m);
}

export type TopUpInput = { uid?: unknown; kind?: unknown; naira?: unknown; reason?: unknown };
export type TopUpLog = { id: string; uid: string; member: string; kind: CreditKind; kobo: number; reason: string; byEmail: string; at: string };

export async function topUp(db: Firestore, a: Admin, input: TopUpInput, now = new Date(), notify = notifyBell): Promise<{ member: Member; log: TopUpLog }> {
  if (!(await canTopUp(db, a))) throw new CreditError(403, "Only the owner, and the super admins they allow, can add credit.");
  const kind = input.kind;
  if (kind !== "nana" && kind !== "wallet") throw new CreditError(400, "Choose Nana credit or the wallet.");
  const kobo = Math.round(Number(input.naira) * 100);
  if (!Number.isFinite(kobo) || kobo < 100 || kobo > TOPUP_MAX) throw new CreditError(400, `Enter an amount from ₦1 to ${nairaOf(TOPUP_MAX)}.`);
  const reason = String(input.reason ?? "").trim().slice(0, 300);
  if (reason.length < REASON_MIN) throw new CreditError(400, "Say why, in a few words: it goes in the log.");
  const uid = typeof input.uid === "string" ? input.uid : "";
  const who = uid ? await memberOf(db, uid) : null;
  if (!who) throw new CreditError(404, "That member wasn't found.");

  const log = db.collection("creditTopups").doc();
  const at = now.toISOString();
  await db.runTransaction(async (t) => {
    if (kind === "nana") {
      t.set(db.doc(`nanaAccounts/${uid}`), { creditKobo: FieldValue.increment(kobo), updatedAt: at, lastTopUp: { reference: log.id, kobo, at, byAdmin: true } }, { merge: true });
    } else {
      const ref = walletDoc(db, uid);
      const w = walletOf((await t.get(ref)).data());
      t.set(ref, { creditKobo: w.creditKobo + kobo, updatedAt: at }, { merge: true });
      t.set(db.doc(`walletTx/${log.id}_admin`), { uid, type: "topup", creditKobo: kobo, bonusKobo: 0, label: "Added by #NotesApp", reference: log.id, kind: "admin_credit", at } satisfies WalletTx);
    }
    t.set(log, { uid, member: who.username ? `@${who.username}` : who.displayName, kind, kobo, reason, by: a.uid, byEmail: a.email, at });
  });
  await notify({
    uid, type: "plan", linkHref: kind === "nana" ? "/nana#credit" : "/profile/wallet",
    message: `#NotesApp added ${nairaOf(kobo)} of ${kind === "nana" ? "Nana credit" : "NotesApp Credit to your wallet"}.`,
  });
  return { member: (await memberOf(db, uid, (await getUserEmail(uid)) ?? ""))!, log: { id: log.id, uid, member: who.username ? `@${who.username}` : who.displayName, kind, kobo, reason, byEmail: a.email, at } };
}

export async function recentTopUps(db: Firestore, limit = 50): Promise<TopUpLog[]> {
  const s = await db.collection("creditTopups").orderBy("at", "desc").limit(limit).get();
  return s.docs.map((d) => {
    const x = d.data();
    return { id: d.id, uid: String(x.uid), member: String(x.member ?? ""), kind: x.kind === "wallet" ? "wallet" : "nana", kobo: Number(x.kobo) || 0, reason: String(x.reason ?? ""), byEmail: String(x.byEmail ?? ""), at: String(x.at ?? "") };
  });
}
