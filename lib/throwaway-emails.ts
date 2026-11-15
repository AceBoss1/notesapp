// Throwaway (temporary) email addresses (owner, 15 Nov 2026, the new admin design: Admin → People & Trust → Throwaway emails). Nobody can
// join with an address at a blocked domain or any of its subdomains. Pure rules; the server side is lib/throwaway-emails-server.ts.
//
// The list is the built-in domains below plus the ones admins add. The whole list is kept in the public settings/emailBlocklist document,
// which the sign-up forms read before an account is made and firestore.rules reads when the profile is created (users/{uid} create), so
// a domain added here is refused straight away. Ordinary providers (Gmail, Yahoo, Outlook…) can never be added.

// Known temporary-inbox services. Admins add more on the page; these can't be removed there.
export const BUILT_IN_DOMAINS = [
  "petchi.uk", "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "grr.la", "10minutemail.com",
  "temp-mail.org", "tempmail.com", "tempmail.net", "tempmailo.com", "yopmail.com", "yopmail.net", "trashmail.com", "getnada.com",
  "dispostable.com", "maildrop.cc", "mailnesia.com", "throwawaymail.com", "fakeinbox.com", "mohmal.com", "emailondeck.com",
  "mintemail.com", "spamgourmet.com", "mailcatch.com", "moakt.com", "tempr.email", "discard.email", "burnermail.io", "1secmail.com",
] as const;

// Ordinary email providers members really use: never blockable, so a typo can't lock out half the country.
export const ORDINARY_PROVIDERS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "zoho.com", "zohomail.com", "gmx.com", "gmx.net",
  "mail.com", "yandex.com", "hey.com", "fastmail.com", "notesapp.name.ng", "naapp.tech",
];

// What suspended members see (suspensions/{uid}.reason). The design quotes its start.
export const THROWAWAY_REASON =
  "This account uses a temporary (throwaway) email address, which NotesApp doesn't allow. Contact support to move the account to your own email address.";

// What a sign-up form says when the address is refused.
export const THROWAWAY_SIGNUP_ERROR = "Temporary (throwaway) email addresses can't join NotesApp. Please use your own email address.";

export const MAX_ADDED = 500; // how many domains admins can add (the rules read the whole list on every sign-up)

// A domain as typed: lower case, no spaces, no "@" or "http://", no trailing dot. null when it isn't a domain.
export function cleanDomain(raw: string): string | null {
  let d = String(raw ?? "").trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^.*@/, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (d.length < 3 || d.length > 120) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) return null;
  return d;
}

// The domain of an email address (lower case), or null.
export function domainOf(email: string | null | undefined): string | null {
  const m = /^[^@\s]+@([^@\s]+)$/.exec(String(email ?? "").trim());
  return m ? cleanDomain(m[1]) : null;
}

// The blocked domain an address falls under (itself or a parent: mail.petchi.uk → petchi.uk), or null.
export function blockedBy(email: string | null | undefined, list: readonly string[]): string | null {
  const d = domainOf(email);
  if (!d) return null;
  const set = new Set(list);
  const parts = d.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const s = parts.slice(i).join(".");
    if (set.has(s)) return s;
  }
  return null;
}

// Is this an ordinary provider (or a subdomain of one)?
export const isOrdinary = (d: string) => ORDINARY_PROVIDERS.some((o) => d === o || d.endsWith(`.${o}`));

// Parse the "Add domains" box: one per line or separated by commas. Returns the domains to add and what was refused, with why.
export function parseDomains(text: string, existing: readonly string[] = []): { add: string[]; refused: { input: string; why: string }[] } {
  const add: string[] = [];
  const refused: { input: string; why: string }[] = [];
  const have = new Set(existing);
  for (const raw of String(text ?? "").split(/[\n,;\s]+/)) {
    const input = raw.trim();
    if (!input) continue;
    const d = cleanDomain(input);
    if (!d) refused.push({ input, why: "isn't a domain" });
    else if (isOrdinary(d)) refused.push({ input, why: "is an ordinary email provider" });
    else if (have.has(d) || add.includes(d)) continue;
    else add.push(d);
  }
  return { add, refused };
}

// The full list the forms and the rules check: built in, then the added ones, without repeats.
export const fullList = (added: readonly string[]) => Array.from(new Set([...BUILT_IN_DOMAINS, ...added]));
