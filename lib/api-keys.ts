import { getTierConfig } from "./tiers";
import { effectiveTier } from "./users";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "./firebase-admin";
import { rateLimit } from "./rate-limit";

// API keys for Enterprise server-to-server access. A key looks like `nak_<id>.<secret>`; only a SHA-256 of
// the secret is stored (`apiKeys/{id}`, server-only), so a leaked database can't be replayed. The secret is
// shown once at creation. Access also needs `users/{uid}.apiAccess === true`, switched on per account by an admin.
export const API_SCOPES = ["read:posts", "write:posts", "read:bookings", "read:orders", "read:earnings"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export type ApiKeyDoc = { uid: string; name: string; prefix: string; hash: string; scopes: ApiScope[]; createdAt: string; lastUsedAt?: string; revokedAt?: string };

export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function parseToken(token: string): { id: string; secret: string } | null {
  const m = /^nak_([a-f0-9]{12})\.([A-Za-z0-9_-]{32,64})$/.exec(token.trim());
  return m ? { id: m[1], secret: m[2] } : null;
}

export async function createApiKey(uid: string, name: string, scopes: ApiScope[]): Promise<{ id: string; token: string }> {
  const id = randomBytes(6).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const doc: ApiKeyDoc = { uid, name: name.slice(0, 60), prefix: `nak_${id}`, hash: hashSecret(secret), scopes, createdAt: new Date().toISOString() };
  await getAdminDb().doc(`apiKeys/${id}`).set(doc);
  return { id, token: `nak_${id}.${secret}` };
}

export type ApiError = { status: number; code: string; message: string };
export const apiError = (e: ApiError) =>
  NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status, headers: e.status === 401 ? { "WWW-Authenticate": "Bearer" } : undefined });

export type ApiAuth = { uid: string; keyId: string; user: Record<string, any> };

// Checks the bearer key, the owner's API access flag, the scope and a per-key rate limit.
export async function authenticateApiKey(req: NextRequest, scope: ApiScope | "any"): Promise<{ auth: ApiAuth } | { fail: NextResponse }> {
  const fail = (e: ApiError) => ({ fail: apiError(e) });
  const header = req.headers.get("authorization") || "";
  const parsed = /^Bearer\s+(.+)$/i.test(header) ? parseToken(header.replace(/^Bearer\s+/i, "")) : null;
  if (!parsed) return fail({ status: 401, code: "invalid_key", message: "Send your key as `Authorization: Bearer nak_…`." });
  const db = getAdminDb();
  const snap = await db.doc(`apiKeys/${parsed.id}`).get();
  const key = snap.data() as ApiKeyDoc | undefined;
  const given = Buffer.from(hashSecret(parsed.secret));
  const stored = Buffer.from(key?.hash ?? "0".repeat(64));
  if (!key || key.revokedAt || given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return fail({ status: 401, code: "invalid_key", message: "That API key isn't valid or has been revoked." });
  }
  const limited = rateLimit(req, "api-key", parsed.id, 120, 60);
  if (limited) return { fail: NextResponse.json({ error: { code: "rate_limited", message: "Too many requests — slow down." } }, { status: 429, headers: { "Retry-After": limited.headers.get("Retry-After") || "30" } }) };
  const user = (await db.doc(`users/${key.uid}`).get()).data();
  if (!user || user.suspended) return fail({ status: 403, code: "account_unavailable", message: "This account can't use the API right now." });
  if (user.apiAccess !== true || !getTierConfig(effectiveTier(user as never)).apiAccess) return fail({ status: 403, code: "api_not_enabled", message: "API access isn't enabled for this account. Request it at https://www.notesapp.name.ng/contact?topic=api." });
  if (scope !== "any" && !key.scopes.includes(scope)) return fail({ status: 403, code: "missing_scope", message: `This key doesn't have the \`${scope}\` scope.` });
  if (!key.lastUsedAt || Date.now() - new Date(key.lastUsedAt).getTime() > 60_000) {
    snap.ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {});
  }
  return { auth: { uid: key.uid, keyId: parsed.id, user } };
}
