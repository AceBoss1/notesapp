// The sign-up forms' check (lib/email-blocklist.ts): the built-in domains plus those added in Admin → Throwaway emails
// (settings/emailBlocklist is publicly readable). If it can't be read, the built-in list still applies and firestore.rules
// refuse the profile anyway.
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isBlockedEmail } from "@/lib/email-blocklist";

export async function emailIsBlocked(email: string | null | undefined): Promise<boolean> {
  let extra: string[] = [];
  try {
    const v = (await getDoc(doc(db, "settings", "emailBlocklist"))).data()?.domains;
    if (Array.isArray(v)) extra = v.filter((d): d is string => typeof d === "string");
  } catch { /* the built-in list still applies */ }
  return isBlockedEmail(email, extra);
}
