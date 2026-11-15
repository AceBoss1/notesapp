// Email domains #NotesApp won't open an account for: throwaway (disposable) inboxes used for fake and spam accounts. A domain here
// also blocks every subdomain of it (x.petchi.uk). The same list is enforced in firestore.rules (`blockedEmail()` on users/{uid}
// create), so a sign-up that skips this check still gets no profile; keep the two in step. Existing accounts: scripts/blocked-emails.mjs.
// Added by the owner, 15 Nov 2026: petchi.uk (a kuku.lu throwaway domain).
export const BLOCKED_EMAIL_DOMAINS = ["petchi.uk"] as const;

export function emailDomain(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  return at < 0 ? "" : email.trim().toLowerCase().slice(at + 1).replace(/\.+$/, "");
}

export function isBlockedEmail(email: string | null | undefined): boolean {
  const d = emailDomain(email ?? "");
  return !!d && BLOCKED_EMAIL_DOMAINS.some((b) => d === b || d.endsWith(`.${b}`));
}

export const BLOCKED_EMAIL_MESSAGE = "Please use your own email address. Temporary (throwaway) email addresses can't be used on #NotesApp.";
