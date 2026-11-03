// The same signing as lib/recorder-sign.ts in the app (kept in step by tests/live-recording/recording.test.ts):
// X-Recorder-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(RECORDER_SECRET, "<t>.<sha256 hex of the body>")>, refused after 5 minutes.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-recorder-signature";
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const hmac = (key, s) => createHmac("sha256", key).update(s).digest("hex");

export function signBody(secret, body, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${hmac(secret, `${t}.${sha256(body)}`)}`;
}
export function verifySignature(secret, header, body, now = Date.now()) {
  if (!secret || !header) return false;
  const m = /^t=(\d{9,12}),v1=([0-9a-f]{64})$/.exec(String(header).trim());
  if (!m) return false;
  if (Math.abs(now / 1000 - Number(m[1])) > 300) return false;
  const want = hmac(secret, `${m[1]}.${sha256(body)}`);
  return want.length === m[2].length && timingSafeEqual(Buffer.from(want), Buffer.from(m[2]));
}
