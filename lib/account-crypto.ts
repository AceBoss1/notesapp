import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Server-only. Field-level encryption for the full bank account number we keep so a payout can be sent through Paylony (which
// needs it on every payout). AES-256-GCM with ACCOUNT_DATA_KEY: a base64 string of 32 random bytes, made once with
//   openssl rand -base64 32
// and kept only in Vercel's environment variables. Losing the key means losing the numbers (publishers would re-enter them);
// changing it later needs the numbers re-encrypted. The ciphertext lives in payoutSecrets/{uid}, which no client can read.
const key = (): Buffer | null => {
  const raw = process.env.ACCOUNT_DATA_KEY;
  if (!raw) return null;
  const k = Buffer.from(raw, "base64");
  return k.length === 32 ? k : null;
};
export const accountCryptoConfigured = () => key() !== null;

export function encryptAccountNumber(plain: string): string {
  const k = key();
  if (!k) throw new Error("ACCOUNT_DATA_KEY is not set (or isn't 32 bytes of base64).");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptAccountNumber(blob: string): string {
  const k = key();
  if (!k) throw new Error("ACCOUNT_DATA_KEY is not set (or isn't 32 bytes of base64).");
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
