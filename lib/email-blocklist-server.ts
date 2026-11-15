// Admin → Throwaway emails (lib/email-blocklist.ts): the added domains, and finding or suspending existing accounts at a blocked domain.
// settings/emailBlocklist is written only here (firestore.rules refuse browsers that document), with the regex firestore.rules reads.
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { BUILT_IN_BLOCKED_DOMAINS, MAX_BLOCKED_DOMAINS, blocklistRegex, cleanDomain, emailDomain, isBlockedIn } from "./email-blocklist";

const DOC = "settings/emailBlocklist";
export class BlocklistError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function addedDomains(db: Firestore): Promise<string[]> {
  const v = (await db.doc(DOC).get()).data()?.domains;
  return Array.isArray(v) ? v.filter((d): d is string => typeof d === "string") : [];
}
export async function allBlockedDomains(db: Firestore): Promise<string[]> {
  return [...new Set([...BUILT_IN_BLOCKED_DOMAINS, ...(await addedDomains(db))])];
}

async function save(db: Firestore, domains: string[], by: string): Promise<string[]> {
  const list = [...new Set(domains)].filter((d) => !(BUILT_IN_BLOCKED_DOMAINS as readonly string[]).includes(d)).sort();
  if (list.length > MAX_BLOCKED_DOMAINS) throw new BlocklistError(400, `The list holds up to ${MAX_BLOCKED_DOMAINS} domains.`);
  await db.doc(DOC).set({ domains: list, regex: blocklistRegex([...BUILT_IN_BLOCKED_DOMAINS, ...list]), updatedBy: by, updatedAt: new Date().toISOString() });
  return list;
}

// Adds one or more domains (one per line, or separated by commas or spaces).
export async function addDomains(db: Firestore, raw: unknown, by: string): Promise<string[]> {
  const parts = String(raw ?? "").split(/[\s,;]+/).filter(Boolean);
  const good = parts.map(cleanDomain).filter(Boolean);
  if (!parts.length || good.length !== parts.length) throw new BlocklistError(400, "Enter domains like temp-mail.example (one per line).");
  const common = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "aol.com", "ymail.com"];
  const bad = good.find((d) => common.includes(d));
  if (bad) throw new BlocklistError(400, `${bad} is an ordinary email provider, not a throwaway one.`);
  return save(db, [...(await addedDomains(db)), ...good], by);
}
export async function removeDomain(db: Firestore, raw: unknown, by: string): Promise<string[]> {
  const d = cleanDomain(raw);
  if ((BUILT_IN_BLOCKED_DOMAINS as readonly string[]).includes(d)) throw new BlocklistError(400, `${d} is built in and can't be removed here.`);
  return save(db, (await addedDomains(db)).filter((x) => x !== d), by);
}

export type BlockedAccount = { uid: string; username: string | null; domain: string; suspended: boolean };
// Every account whose sign-in email is at a blocked domain (pages through Firebase Authentication).
export async function findBlockedAccounts(db: Firestore, auth: Auth): Promise<BlockedAccount[]> {
  const domains = await allBlockedDomains(db);
  const hits: { uid: string; email: string }[] = [];
  let token: string | undefined;
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) if (u.email && isBlockedIn(u.email, domains)) hits.push({ uid: u.uid, email: u.email });
    token = page.pageToken;
  } while (token);
  const out: BlockedAccount[] = [];
  for (const h of hits) {
    const p = (await db.doc(`users/${h.uid}`).get()).data();
    out.push({ uid: h.uid, username: typeof p?.username === "string" ? p.username : null, domain: emailDomain(h.email), suspended: p?.suspended === true });
  }
  return out;
}

export const BLOCKED_SUSPENSION_REASON = "This account uses a temporary (throwaway) email address, which #NotesApp doesn't allow. Contact support to move it to your own email address.";
// Suspends every account found that has a profile and isn't suspended yet. Returns how many.
export async function suspendBlockedAccounts(db: Firestore, auth: Auth, by: string, notify?: (uid: string) => Promise<void>): Promise<number> {
  const found = (await findBlockedAccounts(db, auth)).filter((a) => a.username && !a.suspended);
  for (const a of found) {
    await db.doc(`suspensions/${a.uid}`).set({ reason: BLOCKED_SUSPENSION_REASON, suspendedAt: new Date().toISOString(), suspendedByUid: by, appealStatus: "none" });
    await db.doc(`users/${a.uid}`).update({ suspended: true });
    if (notify) await notify(a.uid).catch(() => {});
  }
  return found.length;
}
