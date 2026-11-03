import { isLocalHost, ourRoot } from "./host";

// Passkeys (WebAuthn) for every account: sign in with a fingerprint, face, screen lock or security key instead of a password, on
// the main site, the app address, Notes Life, Naija Exam Prep and the team hub's Staff login (owner, 3 Nov 2026). Pure rules here,
// shared by the server (lib/passkeys-server.ts) and the tests.
//
// A passkey belongs to one domain family (its "RP ID"): one made on www.naapp.tech works on app.naapp.tech, life.naapp.tech and
// prep.naapp.tech, but not on notesapp.name.ng, and the other way round. Members' own domains don't offer passkeys: sign-in there
// already passes through the main site.

export const RP_NAME = "#NotesApp";
export const CHALLENGE_TTL_MS = 5 * 60_000; // a ceremony must finish within 5 minutes
export const MAX_PASSKEYS = 10; // per account
export const NAME_MAX = 40;

export class PasskeyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const bare = (host: string) => host.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");

// The RP ID for a page served on `host`: the root of one of our domain families, or the host itself on localhost and previews.
// null = passkeys aren't offered here (a member's own domain, or an unknown host).
export function rpIdFor(host: string | null | undefined): string | null {
  const h = bare(host || "");
  if (!h) return null;
  if (isLocalHost(h)) return h;
  const fam = ourRoot(h);
  return fam ? fam.root : null;
}

// The origin a browser reported is acceptable for an RP ID: https on the RP ID or one of its subdomains (http only on localhost).
export function originAllowed(origin: string | null | undefined, rpID: string): boolean {
  if (!origin) return false;
  let u: URL;
  try { u = new URL(origin); } catch { return false; }
  const h = bare(u.host);
  const local = h === "localhost" || h === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return false;
  return h === rpID || h.endsWith(`.${rpID}`);
}

// A passkey's label in the list ("iPhone", "Office laptop"); a default from the browser when none is given.
export function cleanName(v: unknown, fallback = "Passkey"): string {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";
  return s || fallback;
}

// A rough device label from the browser's user agent, used when the member doesn't name the passkey.
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua || "";
  if (/iPhone/i.test(s)) return "iPhone";
  if (/iPad/i.test(s)) return "iPad";
  if (/Android/i.test(s)) return "Android phone";
  if (/Mac OS X|Macintosh/i.test(s)) return "Mac";
  if (/Windows/i.test(s)) return "Windows computer";
  if (/CrOS/i.test(s)) return "Chromebook";
  if (/Linux/i.test(s)) return "Linux computer";
  return "Passkey";
}

export type PasskeyRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null; rpID: string; backedUp: boolean };
