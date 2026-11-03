import { createHash, createHmac, timingSafeEqual } from "crypto";

// Server-only. How our app and the room recorder (services/room-recorder) trust each other, with one shared secret (RECORDER_SECRET):
// - Every request either way carries X-Recorder-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<sha256 hex of the body>")>.
//   The body is hashed first so a binary chunk is signed the same way as JSON. A signature older than five minutes is refused.
// - The recorder page (/rooms/record/[id]) gets a short-lived token for one room: receive-only, readable only by our server, signed with
//   a key derived from the same secret (so a page token can never be used as a request signature, nor the other way round).
// services/room-recorder/sign.mjs does the same in plain JavaScript; tests/live-recording/recording.test.ts checks they agree.

export const SIGNATURE_HEADER = "x-recorder-signature";
export const SIGNATURE_TOLERANCE_S = 300;
const sha256 = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");
const hmac = (key: string | Buffer, s: string) => createHmac("sha256", key).update(s).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function signBody(secret: string, body: string | Uint8Array, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${hmac(secret, `${t}.${sha256(body)}`)}`;
}
export function verifySignature(secret: string, header: string | null | undefined, body: string | Uint8Array, now = Date.now()): boolean {
  if (!secret || !header) return false;
  const m = /^t=(\d{9,12}),v1=([0-9a-f]{64})$/.exec(header.trim());
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(now / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;
  return same(m[2], hmac(secret, `${t}.${sha256(body)}`));
}

// ── The recorder page's token: one room, receive-only, minutes long ──
export type RecorderToken = { rid: string; roomId: string; scope: "receive"; exp: number };
const pageKey = (secret: string) => createHmac("sha256", secret).update("room-recorder page token v1").digest();
const b64 = (s: string) => Buffer.from(s).toString("base64url");
export function recorderToken(secret: string, o: { rid: string; roomId: string }, now = Date.now(), ttlSeconds = 15 * 60): string {
  const payload = b64(JSON.stringify({ rid: o.rid, roomId: o.roomId, scope: "receive", exp: Math.floor(now / 1000) + ttlSeconds } satisfies RecorderToken));
  return `${payload}.${hmac(pageKey(secret), payload)}`;
}
export function readRecorderToken(secret: string, token: unknown, now = Date.now()): RecorderToken | null {
  if (!secret || typeof token !== "string" || token.length > 2000) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || !same(sig, hmac(pageKey(secret), payload))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as RecorderToken;
    if (p.scope !== "receive" || typeof p.rid !== "string" || typeof p.roomId !== "string" || !(p.exp * 1000 > now)) return null;
    return p;
  } catch {
    return null;
  }
}
