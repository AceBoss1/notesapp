// Throwaway emails on the server (lib/throwaway-emails.ts has the rules). Admin → People & Trust → Throwaway emails:
//   blocklist        the built-in and added domains (settings/emailBlocklist, public: the sign-up forms and firestore.rules read it)
//   addDomains       adds domains from the "Add domains" box (ordinary providers refused)
//   removeDomain     takes an added domain off (built-in ones stay)
//   findAccounts     looks through every account's sign-in email (Firebase Authentication) for blocked domains
//   suspendAccounts  suspends those accounts with THROWAWAY_REASON (the same records the Users page writes), admins never
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { BUILT_IN_DOMAINS, MAX_ADDED, THROWAWAY_REASON, blockedBy, cleanDomain, fullList, parseDomains } from "./throwaway-emails";

export class ThrowawayError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const DOC = "settings/emailBlocklist";

export type Blocklist = { builtIn: string[]; added: string[]; domains: string[]; updatedAt?: string; updatedBy?: string };

export async function blocklist(db: Firestore): Promise<Blocklist> {
  const d = (await db.doc(DOC).get()).data() ?? {};
  const added = Array.isArray(d.added) ? (d.added as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const domains = fullList(added);
  // Keep the public list whole: when the built-in list changes in a release, the rules see it on the next read here.
  if (!Array.isArray(d.domains) || d.domains.length !== domains.length || domains.some((x, i) => d.domains[i] !== x)) {
    await db.doc(DOC).set({ added, domains }, { merge: true });
  }
  return { builtIn: [...BUILT_IN_DOMAINS], added, domains, updatedAt: d.updatedAt, updatedBy: d.updatedBy };
}

async function save(db: Firestore, added: string[], by: string, now: Date) {
  await db.doc(DOC).set({ added, domains: fullList(added), updatedAt: now.toISOString(), updatedBy: by });
}

export async function addDomains(db: Firestore, text: unknown, by: string, now = new Date()) {
  const cur = await blocklist(db);
  const { add, refused } = parseDomains(String(text ?? ""), cur.domains);
  if (!add.length && refused.length) throw new ThrowawayError(`Nothing added: ${refused.map((r) => `${r.input} ${r.why}`).join("; ")}.`);
  if (cur.added.length + add.length > MAX_ADDED) throw new ThrowawayError(`The list can hold ${MAX_ADDED} added domains. Remove some first.`);
  const added = [...cur.added, ...add];
  if (add.length) await save(db, added, by, now);
  return { ...(await blocklist(db)), addedNow: add, refused };
}

export async function removeDomain(db: Firestore, domain: unknown, by: string, now = new Date()) {
  const d = cleanDomain(String(domain ?? ""));
  if (!d) throw new ThrowawayError("That isn't a domain.");
  if ((BUILT_IN_DOMAINS as readonly string[]).includes(d)) throw new ThrowawayError("Built-in domains stay on the list.");
  const cur = await blocklist(db);
  if (!cur.added.includes(d)) throw new ThrowawayError("That domain isn't on the list.", 404);
  await save(db, cur.added.filter((x) => x !== d), by, now);
  return blocklist(db);
}

export type ThrowawayAccount = { uid: string; username: string | null; domain: string; blockedBy: string; status: "active" | "suspended"; admin: boolean };

// Every account whose sign-in email is at a blocked domain. Only the domain is returned, never the address.
export async function findAccounts(db: Firestore, auth: Pick<Auth, "listUsers">, max = 5000): Promise<ThrowawayAccount[]> {
  const { domains } = await blocklist(db);
  const hits: { uid: string; domain: string; by: string }[] = [];
  let token: string | undefined;
  let seen = 0;
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) {
      const by = blockedBy(u.email, domains);
      if (by) hits.push({ uid: u.uid, domain: String(u.email).split("@")[1].toLowerCase(), by });
    }
    seen += page.users.length;
    token = page.pageToken;
  } while (token && seen < max * 20);
  const out: ThrowawayAccount[] = [];
  for (let i = 0; i < hits.length && out.length < max; i += 100) {
    const refs = hits.slice(i, i + 100).map((h) => db.doc(`users/${h.uid}`));
    const docs = refs.length ? await db.getAll(...refs) : [];
    docs.forEach((d, j) => {
      const h = hits[i + j];
      const u = d.data();
      out.push({ uid: h.uid, username: u?.username ?? null, domain: h.domain, blockedBy: h.by, status: u?.suspended === true ? "suspended" : "active", admin: u?.role === "admin" });
    });
  }
  return out;
}

// Suspends the given accounts, but only ones really at a blocked domain right now (checked again here), never an admin, never twice.
export async function suspendAccounts(db: Firestore, auth: Pick<Auth, "listUsers">, uids: unknown, by: string, now = new Date()): Promise<{ suspended: string[]; skipped: number }> {
  if (!Array.isArray(uids) || !uids.length || uids.length > 1000 || !uids.every((u) => typeof u === "string")) throw new ThrowawayError("Choose the accounts to suspend.");
  const want = new Set(uids as string[]);
  const found = (await findAccounts(db, auth)).filter((a) => want.has(a.uid));
  const suspended: string[] = [];
  for (const a of found) {
    if (a.admin || a.status === "suspended" || !a.username) continue;
    const at = now.toISOString();
    const batch = db.batch();
    batch.set(db.doc(`suspensions/${a.uid}`), { reason: THROWAWAY_REASON, suspendedAt: at, suspendedByUid: by, appealStatus: "none", throwaway: true });
    batch.update(db.doc(`users/${a.uid}`), { suspended: true });
    batch.create(db.collection("notifications").doc(), { recipientUid: a.uid, type: "suspended", message: `Your account was suspended until lifted: ${THROWAWAY_REASON}`, linkHref: `/u/${a.username}`, read: false, createdAt: at });
    await batch.commit();
    suspended.push(a.uid);
  }
  return { suspended, skipped: uids.length - suspended.length };
}
