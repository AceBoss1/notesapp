// Signed tokens and signed bodies between #NotesApp's server and the live-rooms worker (workers/live-rooms, v0.126.0). Pure: only
// WebCrypto (crypto.subtle), TextEncoder and btoa/atob, which Node 20+, browsers and Cloudflare Workers all have, so the worker imports
// this same file into its build. Never import Node-only modules here.
//
// - A token (browser → worker): base64url(JSON claims) + "." + base64url(HMAC-SHA256(secret, that first part)). Minted by our server for
//   someone allowed in the room (lib/live-rooms-server.ts), checked by the room's Durable Object when the socket opens. It lives
//   LIVE_TOKEN_TTL_S; what someone may do later (stage up or down, a ban) is pushed by our server, never taken from the browser.
// - A signed body (server ↔ worker, both ways): header x-live-sig "t=<ms>,s=<hex HMAC-SHA256(secret, t + "." + body)>", accepted within
//   LIVE_SIG_SKEW_MS of the receiver's clock.
export type LiveRole = "host" | "speaker" | "listener";
export type LiveClaims = {
  r: string; // room id
  u: string; // uid
  role: LiveRole;
  n: string; // name
  a: string; // picture
  mod: boolean; // a moderator (or up) of the community: may remove messages, mute and ban in the room
  exp: number; // seconds since 1970
};
export const LIVE_TOKEN_TTL_S = 600;
export const LIVE_SIG_SKEW_MS = 5 * 60_000;
export const LIVE_SIG_HEADER = "x-live-sig";

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch { return null; }
};
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s: string): Uint8Array | null => (/^(?:[0-9a-f]{2})+$/.test(s) ? Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16)) : null);

const keys = new Map<string, Promise<CryptoKey>>();
function key(secret: string): Promise<CryptoKey> {
  let k = keys.get(secret);
  if (!k) { k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); keys.set(secret, k); }
  return k;
}
const mac = async (secret: string, data: string) => new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(data)));
// crypto.subtle.verify compares in constant time.
const macOk = async (secret: string, data: string, sig: Uint8Array) => crypto.subtle.verify("HMAC", await key(secret), new Uint8Array(sig), enc.encode(data));

const ROLES: LiveRole[] = ["host", "speaker", "listener"];
function cleanClaims(x: unknown): LiveClaims | null {
  if (!x || typeof x !== "object") return null;
  const c = x as Record<string, unknown>;
  if (typeof c.r !== "string" || !c.r || typeof c.u !== "string" || !c.u || !ROLES.includes(c.role as LiveRole) || typeof c.exp !== "number") return null;
  return { r: c.r, u: c.u, role: c.role as LiveRole, n: String(c.n ?? "").slice(0, 80), a: String(c.a ?? "").slice(0, 500), mod: c.mod === true, exp: c.exp };
}

export async function signLiveToken(secret: string, claims: LiveClaims): Promise<string> {
  if (!secret) throw new Error("LIVE_ROOMS_SECRET is not set");
  const body = b64url(enc.encode(JSON.stringify(claims)));
  return `${body}.${b64url(await mac(secret, body))}`;
}
// The claims when the token is ours and still in date; null otherwise (never throws).
export async function verifyLiveToken(secret: string, token: unknown, nowMs = Date.now()): Promise<LiveClaims | null> {
  if (!secret || typeof token !== "string" || token.length > 4096) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const s = unb64url(sig), b = unb64url(body);
  if (!s || !b || !(await macOk(secret, body, s))) return null;
  let claims: LiveClaims | null;
  try { claims = cleanClaims(JSON.parse(new TextDecoder().decode(b))); } catch { return null; }
  return claims && claims.exp * 1000 > nowMs ? claims : null;
}

export async function signBody(secret: string, body: string, nowMs = Date.now()): Promise<string> {
  if (!secret) throw new Error("LIVE_ROOMS_SECRET is not set");
  return `t=${nowMs},s=${hex(await mac(secret, `${nowMs}.${body}`))}`;
}
export async function verifyBody(secret: string, body: string, header: string | null | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!secret || !header) return false;
  const m = /^t=(\d{1,16}),s=([0-9a-f]{64})$/.exec(header.trim());
  if (!m || Math.abs(nowMs - Number(m[1])) > LIVE_SIG_SKEW_MS) return false;
  const s = unhex(m[2]);
  return !!s && macOk(secret, `${m[1]}.${body}`, s);
}
