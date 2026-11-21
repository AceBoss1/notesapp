// The guest pass for watching a live without an account (docs/GUEST_LIVES.md). Server only (it signs with the server's key).
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { GUEST_PASS_MS } from "./live-guests";

// ── The pass ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// "g_<id>.<expires in ms>.<signature>". Signed with a key the server derives from its own secret (never the secret itself).
const sign = (key: Buffer, body: string) => createHmac("sha256", key).update(body).digest("base64url");
export function issueGuestPass(key: Buffer, now: number, id = `g_${randomBytes(9).toString("base64url")}`): { id: string; pass: string } {
  const body = `${id}.${now + GUEST_PASS_MS}`;
  return { id, pass: `${body}.${sign(key, body)}` };
}
// The guest id in a pass, if it is genuine and hasn't run out.
export function checkGuestPass(key: Buffer, pass: unknown, now: number): string | null {
  if (typeof pass !== "string" || pass.length > 120) return null;
  const m = /^(g_[A-Za-z0-9_-]{8,20})\.(\d{10,15})\.([A-Za-z0-9_-]{20,64})$/.exec(pass);
  if (!m) return null;
  const want = Buffer.from(sign(key, `${m[1]}.${m[2]}`)), got = Buffer.from(m[3]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return Number(m[2]) > now ? m[1] : null;
}
