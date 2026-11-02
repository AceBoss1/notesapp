import { createHash, randomBytes, timingSafeEqual } from "crypto";

// Codes and tokens for connecting an agent. Server-side helpers without a database, so they are tested on their own.
//   Pairing code: 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), shown as K7QM-4F2D. One per connect request,
//   valid for minutes (lib/agents/config.ts linkCodeMinutes), used once. The Connect screen shows it so the member can check it is the
//   same code their assistant shows; someone with only a code types it at /link.
//   Access token: naa_<12 hex>.<secret>; only a SHA-256 of the secret is stored (agentGrants/{id}), like API keys (lib/api-keys.ts).

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

export function newPairingCode(bytes: Buffer = randomBytes(CODE_LENGTH)): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s;
}
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4, 8)}`;
// What someone typed ("k7qm 4f2d", "K7QM-4F2D") → "K7QM4F2D", or null when it can't be a code.
export function normalizeCode(input: unknown): string | null {
  const s = String(input ?? "").toUpperCase().replace(/[\s\-_.]/g, "");
  return s.length === CODE_LENGTH && [...s].every((c) => CODE_ALPHABET.includes(c)) ? s : null;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newSecret = () => randomBytes(32).toString("base64url");
export const newId = (bytes = 6) => randomBytes(bytes).toString("hex");

export function parseAgentToken(token: string): { id: string; secret: string } | null {
  const m = /^naa_([a-f0-9]{12})\.([A-Za-z0-9_-]{32,64})$/.exec(token.trim());
  return m ? { id: m[1], secret: m[2] } : null;
}
export function secretMatches(secret: string, storedHash: string | undefined): boolean {
  const a = Buffer.from(sha256(secret));
  const b = Buffer.from(storedHash ?? "0".repeat(64));
  return a.length === b.length && timingSafeEqual(a, b);
}

// PKCE (RFC 7636), S256 only: the agent sends sha256(verifier) as the challenge when it asks, and the verifier when it collects the token.
export function pkceMatches(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const got = createHash("sha256").update(verifier).digest("base64url");
  return got.length === challenge.length && timingSafeEqual(Buffer.from(got), Buffer.from(challenge));
}

// A redirect address an agent may register: https anywhere, or http only on this machine (desktop assistants listen on localhost).
export function okRedirect(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > 500) return false;
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
  } catch { return false; }
}
