// Email domains #NotesApp won't open an account for: throwaway (disposable) inboxes used for fake and spam accounts. A domain here
// also blocks every subdomain of it (x.petchi.uk).
//
// Two lists, used together:
//   BUILT_IN_BLOCKED_DOMAINS  always blocked (in code and in firestore.rules `blockedEmail()`; keep the two in step).
//   settings/emailBlocklist   { domains, regex }: the ones added in Admin → Throwaway emails (lib/email-blocklist-server.ts writes
//                             both fields; firestore.rules reads `regex`, so a domain added there is refused at once, no deploy).
// Both sign-up forms check the combined list before an account is made; firestore.rules refuses the profile either way.
// Added by the owner, 15 Nov 2026: petchi.uk (a kuku.lu throwaway domain).
export const BUILT_IN_BLOCKED_DOMAINS = ["petchi.uk"] as const;
/** @deprecated use BUILT_IN_BLOCKED_DOMAINS */
export const BLOCKED_EMAIL_DOMAINS = BUILT_IN_BLOCKED_DOMAINS;
export const MAX_BLOCKED_DOMAINS = 500;

export function emailDomain(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return at < 0 ? "" : e.slice(at + 1).replace(/\.+$/, "");
}

// "Mail.Petchi.UK." / "@petchi.uk" / "https://petchi.uk/" → "petchi.uk"; "" when it isn't a domain.
export function cleanDomain(raw: unknown): string {
  const d = String(raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^.*@/, "").replace(/\/.*$/, "").replace(/\.+$/, "");
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : "";
}

export function isBlockedIn(email: string | null | undefined, domains: readonly string[]): boolean {
  const d = emailDomain(email ?? "");
  return !!d && domains.some((b) => d === b || d.endsWith(`.${b}`));
}

export function isBlockedEmail(email: string | null | undefined, extra: readonly string[] = []): boolean {
  return isBlockedIn(email, [...BUILT_IN_BLOCKED_DOMAINS, ...extra]);
}

// The regex firestore.rules matches the token's (lowercased) email against: the domain or any subdomain, with an optional trailing dot.
export function blocklistRegex(domains: readonly string[]): string {
  const alt = domains.map((d) => d.split(".").map((p) => p.replace(/[^a-z0-9-]/g, "")).join("[.]")).filter(Boolean);
  return alt.length ? `.*@([a-z0-9-]+[.])*(${alt.join("|")})[.]?$` : "^$";
}

export const BLOCKED_EMAIL_MESSAGE = "Please use your own email address. Temporary (throwaway) email addresses can't be used on #NotesApp.";
