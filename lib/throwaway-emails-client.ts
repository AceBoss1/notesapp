"use client";
// The sign-up forms' check (lib/throwaway-emails.ts): refuses an address at a blocked domain before any account is made. The built-in
// list always applies; the domains admins added come from the public settings/emailBlocklist document. The database rules check the
// same list when the profile is made, so this is the friendly message, not the only guard.
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { BUILT_IN_DOMAINS, THROWAWAY_SIGNUP_ERROR, blockedBy } from "./throwaway-emails";

export async function throwawayError(email: string | null | undefined): Promise<string | null> {
  let list: string[] = [...BUILT_IN_DOMAINS];
  try {
    const d = (await getDoc(doc(db, "settings/emailBlocklist"))).data();
    if (Array.isArray(d?.domains)) list = [...list, ...d.domains.filter((x: unknown): x is string => typeof x === "string")];
  } catch { /* offline: the built-in list and the rules still apply */ }
  return blockedBy(email, list) ? THROWAWAY_SIGNUP_ERROR : null;
}
