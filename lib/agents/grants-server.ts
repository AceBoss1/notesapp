import type { Firestore } from "firebase-admin/firestore";
import { getAgentSettings, planLimit } from "./config-server";
import { cleanGrant, defaultGrant, type GrantPolicy } from "./scopes";
import { formatCode, newId, newPairingCode, newSecret, normalizeCode, okRedirect, parseAgentToken, pkceMatches, secretMatches, sha256 } from "./pairing";
import { dayKey } from "./time";
import { effectiveTier } from "@/lib/users";

// Connecting outside AI assistants to a member's account, OAuth-style (the MCP authorization spec: OAuth 2.1 with PKCE, dynamic client
// registration, and the device flow for assistants that can't open a browser). All server-only collections (firestore.rules):
//   agentClients/{clientId}       an assistant that registered itself: name, where it's from, its redirect addresses
//   agentAuthRequests/{id}        one "connect" request, open for minutes: its pairing code, PKCE challenge or device code, then the
//                                 member's answer and the grant it made
//   agentCodes/{CODE}             the pairing code → request (so a code is unique while it lasts and can be typed at /link)
//   agentGrants/{grantId}         what the member allowed: scopes, ask-first rules, limits, expiry, paused or revoked; the token's hash
//   agentUsage/{grantId}_{day}    actions today (resets at midnight Lagos)
// The token an assistant sends is naa_<grantId>.<secret> (lib/agents/pairing.ts); only its hash is kept.

export class AgentAuthError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "invalid_request") { super(message); }
}

export type GrantStatus = "active" | "paused" | "revoked";
export type GrantDoc = {
  uid: string; clientId: string; agentName: string; maker: string; fromHost: string; via: "oauth" | "code";
  policy: GrantPolicy; status: GrantStatus; createdAt: string; expiresAt: string; hash?: string;
  lastActiveAt?: string; pausedAt?: string; revokedAt?: string; issuedAt?: string;
};
export type AuthRequest = {
  kind: "oauth" | "device"; code: string; clientId: string; agentName: string; maker: string; fromHost: string;
  redirectUri?: string; codeChallenge?: string; state?: string; deviceHash?: string;
  status: "pending" | "approved" | "denied" | "used"; createdAt: string; expiresAt: string;
  uid?: string; grantId?: string; authCodeHash?: string;
};

// Who makes the well-known assistants, for the line under the name ("Claude is an AI assistant made by Anthropic").
const MAKERS: [RegExp, string][] = [[/claude/i, "Anthropic"], [/chatgpt|openai|gpt/i, "OpenAI"], [/gemini|google/i, "Google"], [/copilot/i, "Microsoft"], [/perplexity/i, "Perplexity"], [/cursor/i, "Anysphere"]];
export const makerOf = (name: string) => MAKERS.find(([re]) => re.test(name))?.[1] ?? "";
const cleanName = (v: unknown, fallback = "An AI assistant") => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40) || fallback;
const hostOf = (uri?: string) => { try { return uri ? new URL(uri).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };

// ---- dynamic client registration (RFC 7591), public clients only (PKCE, no secret)
export async function registerClient(db: Firestore, body: Record<string, unknown>, now = new Date()) {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter(okRedirect).slice(0, 10) : [];
  if (!uris.length) throw new AgentAuthError("Give at least one redirect_uris entry (https, or http on localhost).", 400, "invalid_redirect_uri");
  const clientId = `nac_${newId(10)}`;
  const name = cleanName(body.client_name);
  const clientUri = typeof body.client_uri === "string" && /^https:\/\//.test(body.client_uri) ? body.client_uri.slice(0, 200) : "";
  await db.doc(`agentClients/${clientId}`).set({ name, redirectUris: uris, clientUri, createdAt: now.toISOString() });
  return { client_id: clientId, client_name: name, redirect_uris: uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "urn:ietf:params:oauth:grant-type:device_code"], response_types: ["code"], client_id_issued_at: Math.floor(now.getTime() / 1000) };
}

async function newRequest(db: Firestore, r: Omit<AuthRequest, "code" | "status" | "createdAt" | "expiresAt">, now: Date): Promise<{ id: string; code: string; expiresAt: string }> {
  const s = await getAgentSettings(db);
  const expiresAt = new Date(now.getTime() + s.linkCodeMinutes * 60_000).toISOString();
  const id = newId(12);
  for (let tries = 0; tries < 5; tries++) {
    const code = newPairingCode();
    const ref = db.doc(`agentCodes/${code}`);
    const ok = await db.runTransaction(async (t) => {
      const c = await t.get(ref);
      if (c.exists && String(c.data()?.expiresAt) > now.toISOString()) return false; // still in use
      t.set(ref, { requestId: id, expiresAt });
      t.set(db.doc(`agentAuthRequests/${id}`), { ...r, code, status: "pending", createdAt: now.toISOString(), expiresAt } satisfies AuthRequest);
      return true;
    });
    if (ok) return { id, code, expiresAt };
  }
  throw new AgentAuthError("Couldn't make a code just now. Try again.", 503, "temporarily_unavailable");
}

// ---- the authorization request (the Connect screen opens with these parameters)
export async function startOAuth(db: Firestore, p: Record<string, unknown>, now = new Date()) {
  const clientId = String(p.client_id ?? "");
  const client = /^nac_[a-f0-9]{20}$/.test(clientId) ? (await db.doc(`agentClients/${clientId}`).get()).data() : undefined;
  if (!client) throw new AgentAuthError("This assistant isn't registered. Ask it to connect again.", 400, "invalid_client");
  const redirectUri = String(p.redirect_uri ?? "");
  if (!(client.redirectUris as string[]).includes(redirectUri)) throw new AgentAuthError("That return address isn't one this assistant registered.", 400, "invalid_redirect_uri");
  if (p.response_type !== "code") throw new AgentAuthError("Only response_type=code is supported.", 400, "unsupported_response_type");
  const challenge = String(p.code_challenge ?? "");
  if (p.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new AgentAuthError("PKCE with S256 is required.", 400, "invalid_request");
  const state = typeof p.state === "string" ? p.state.slice(0, 500) : undefined;
  const name = String(client.name);
  return newRequest(db, { kind: "oauth", clientId, agentName: name, maker: makerOf(name), fromHost: hostOf(String(client.clientUri || redirectUri)), redirectUri, codeChallenge: challenge, ...(state ? { state } : {}) }, now);
}

// ---- the device flow (RFC 8628) and the MCP tool connect_account: the assistant shows the code; the member types it at /link.
export async function startDevice(db: Firestore, p: { clientId?: unknown; agentName?: unknown; fromHost?: unknown }, now = new Date()) {
  const clientId = typeof p.clientId === "string" && /^nac_[a-f0-9]{20}$/.test(p.clientId) ? p.clientId : "";
  const client = clientId ? (await db.doc(`agentClients/${clientId}`).get()).data() : undefined;
  const name = cleanName(client?.name ?? p.agentName);
  const deviceCode = newSecret();
  const r = await newRequest(db, { kind: "device", clientId, agentName: name, maker: makerOf(name), fromHost: client ? hostOf(String(client.clientUri)) : cleanName(p.fromHost, "").toLowerCase(), deviceHash: sha256(deviceCode) }, now);
  return { deviceCode, ...r };
}

export type RequestView = { id: string; kind: "oauth" | "device"; agentName: string; maker: string; fromHost: string; code: string; expiresAt: string; status: AuthRequest["status"]; connectedBefore: boolean };
async function findRequest(db: Firestore, idOrCode: { id?: unknown; code?: unknown }, now: Date) {
  let id = typeof idOrCode.id === "string" && /^[a-f0-9]{24}$/.test(idOrCode.id) ? idOrCode.id : "";
  if (!id) {
    const code = normalizeCode(idOrCode.code);
    if (!code) throw new AgentAuthError("That code doesn't look right. It's 8 letters and numbers, like K7QM-4F2D.", 400);
    const c = (await db.doc(`agentCodes/${code}`).get()).data();
    if (!c || String(c.expiresAt) <= now.toISOString()) throw new AgentAuthError("That code isn't valid or has run out. Ask your assistant for a new one.", 404);
    id = String(c.requestId);
  }
  const ref = db.doc(`agentAuthRequests/${id}`);
  const r = (await ref.get()).data() as AuthRequest | undefined;
  if (!r) throw new AgentAuthError("That connect request wasn't found.", 404);
  if (r.status === "pending" && r.expiresAt <= now.toISOString()) throw new AgentAuthError("This connect request has run out. Ask your assistant to connect again.", 410);
  return { id, ref, r };
}
export async function viewRequest(db: Firestore, uid: string | null, idOrCode: { id?: unknown; code?: unknown }, now = new Date()): Promise<RequestView> {
  const { id, r } = await findRequest(db, idOrCode, now);
  const before = uid ? !(await db.collection("agentGrants").where("uid", "==", uid).get()).docs.every((d) => d.data().agentName !== r.agentName) : false;
  return { id, kind: r.kind, agentName: r.agentName, maker: r.maker, fromHost: r.fromHost, code: formatCode(r.code), expiresAt: r.expiresAt, status: r.status, connectedBefore: before };
}

// Can this member connect assistants? (Admin → Limits: agentConnect, by plan.)
export async function canConnect(db: Firestore, uid: string): Promise<{ ok: boolean; user: Record<string, unknown> }> {
  const user = (await db.doc(`users/${uid}`).get()).data();
  if (!user || user.suspended) return { ok: false, user: user ?? {} };
  const tier = effectiveTier({ username: String(user.username ?? ""), role: user.role, accountTier: user.accountTier } as never);
  return { ok: (await planLimit(db, uid, "agentConnect", tier)) > 0, user };
}

// The member said yes on the Connect screen: the grant is made with what they chose. An OAuth assistant gets a one-time code on its
// return address; a device-flow assistant collects its token by asking again. Connecting the same assistant again replaces its
// earlier access (one card per assistant in Console).
export async function approveRequest(db: Firestore, uid: string, requestId: string, policyInput: unknown, now = new Date()): Promise<{ grantId: string; redirect?: string }> {
  const { id, ref, r } = await findRequest(db, { id: requestId }, now);
  if (r.status !== "pending") throw new AgentAuthError("This connect request was already answered.", 409);
  const allowed = await canConnect(db, uid);
  if (!allowed.ok) throw new AgentAuthError("Your plan doesn't include connecting AI assistants yet. See Pricing.", 403, "access_denied");
  const s = await getAgentSettings(db);
  const policy = cleanGrant(policyInput ?? defaultGrant(s), s);
  const grantId = newId(6);
  const authCode = r.kind === "oauth" ? newSecret() : "";
  const grant: GrantDoc = {
    uid, clientId: r.clientId, agentName: r.agentName, maker: r.maker, fromHost: r.fromHost, via: r.kind === "oauth" ? "oauth" : "code", policy, status: "active",
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + policy.limits.accessDays * 86_400_000).toISOString(),
  };
  const earlier = (await db.collection("agentGrants").where("uid", "==", uid).get()).docs.filter((d) => d.data().agentName === r.agentName && d.data().status !== "revoked");
  await db.runTransaction(async (t) => {
    const fresh = (await t.get(ref)).data() as AuthRequest | undefined;
    if (!fresh || fresh.status !== "pending") throw new AgentAuthError("This connect request was already answered.", 409);
    t.set(db.doc(`agentGrants/${grantId}`), grant);
    t.update(ref, { status: "approved", uid, grantId, ...(authCode ? { authCodeHash: sha256(authCode) } : {}) });
    t.delete(db.doc(`agentCodes/${r.code}`));
    for (const e of earlier) t.update(e.ref, { status: "revoked", revokedAt: now.toISOString(), hash: "" });
  });
  if (r.kind !== "oauth") return { grantId };
  const u = new URL(r.redirectUri!);
  u.searchParams.set("code", `${id}.${authCode}`);
  if (r.state) u.searchParams.set("state", r.state);
  return { grantId, redirect: u.toString() };
}

export async function denyRequest(db: Firestore, requestId: string, now = new Date()): Promise<{ redirect?: string }> {
  const { ref, r } = await findRequest(db, { id: requestId }, now);
  if (r.status !== "pending") return {};
  await ref.update({ status: "denied" });
  await db.doc(`agentCodes/${r.code}`).delete().catch(() => {});
  if (r.kind !== "oauth") return {};
  const u = new URL(r.redirectUri!);
  u.searchParams.set("error", "access_denied");
  if (r.state) u.searchParams.set("state", r.state);
  return { redirect: u.toString() };
}

// Hands out the token, once: the grant's secret is made now and only its hash kept.
async function issue(db: Firestore, reqRef: FirebaseFirestore.DocumentReference, grantId: string, now: Date) {
  const secret = newSecret();
  const g = db.doc(`agentGrants/${grantId}`);
  const out = await db.runTransaction(async (t) => {
    const [req, grant] = await Promise.all([t.get(reqRef), t.get(g)]);
    if (req.data()?.status !== "approved") throw new AgentAuthError("This code was already used.", 400, "invalid_grant");
    const gd = grant.data() as GrantDoc | undefined;
    if (!gd || gd.status === "revoked") throw new AgentAuthError("The member disconnected this assistant.", 400, "invalid_grant");
    t.update(reqRef, { status: "used" });
    t.update(g, { hash: sha256(secret), issuedAt: now.toISOString() });
    return gd;
  });
  return { access_token: `naa_${grantId}.${secret}`, token_type: "Bearer", expires_in: Math.max(0, Math.floor((new Date(out.expiresAt).getTime() - now.getTime()) / 1000)), scope: out.policy.scopes.join(" ") };
}

// POST /token with grant_type=authorization_code: the one-time code, the PKCE verifier, and the same client and return address.
export async function exchangeCode(db: Firestore, p: Record<string, unknown>, now = new Date()) {
  const [id, secret] = String(p.code ?? "").split(".");
  if (!/^[a-f0-9]{24}$/.test(id ?? "") || !secret) throw new AgentAuthError("That code isn't valid.", 400, "invalid_grant");
  const ref = db.doc(`agentAuthRequests/${id}`);
  const r = (await ref.get()).data() as AuthRequest | undefined;
  if (!r || r.kind !== "oauth" || r.status !== "approved" || !secretMatches(secret, r.authCodeHash)) throw new AgentAuthError("That code isn't valid or was already used.", 400, "invalid_grant");
  if (new Date(r.createdAt).getTime() + 20 * 60_000 < now.getTime()) throw new AgentAuthError("That code has run out.", 400, "invalid_grant");
  if (p.client_id !== r.clientId || p.redirect_uri !== r.redirectUri) throw new AgentAuthError("The client or return address doesn't match.", 400, "invalid_grant");
  if (!pkceMatches(p.code_verifier, r.codeChallenge!)) throw new AgentAuthError("The PKCE verifier doesn't match.", 400, "invalid_grant");
  return issue(db, ref, r.grantId!, now);
}

// The device flow's poll (and connect_account's second call): waiting, refused, run out, or the token (once).
export async function pollDevice(db: Firestore, deviceCode: unknown, now = new Date()): Promise<{ status: "waiting" | "denied" | "expired" } | { status: "connected"; token: Awaited<ReturnType<typeof issue>> }> {
  const hash = sha256(String(deviceCode ?? ""));
  const snap = await db.collection("agentAuthRequests").where("deviceHash", "==", hash).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new AgentAuthError("Unknown device_code.", 400, "invalid_grant");
  const r = doc.data() as AuthRequest;
  if (r.status === "denied") return { status: "denied" };
  if (r.status === "used") throw new AgentAuthError("This connection was already collected.", 400, "invalid_grant");
  if (r.status === "pending") return r.expiresAt <= now.toISOString() ? { status: "expired" } : { status: "waiting" };
  return { status: "connected", token: await issue(db, doc.ref, r.grantId!, now) };
}

// ---- every MCP call with an agent token
export type AgentCaller = { grantId: string; uid: string; grant: GrantDoc; user: Record<string, unknown> };
export type AuthFail = { fail: "invalid" | "expired" | "revoked" | "paused" | "plan"; message: string };
export async function authenticateAgent(db: Firestore, token: string, now = new Date()): Promise<AgentCaller | AuthFail> {
  const t = parseAgentToken(token);
  if (!t) return { fail: "invalid", message: "That access token isn't valid." };
  const snap = await db.doc(`agentGrants/${t.id}`).get();
  const g = snap.data() as GrantDoc | undefined;
  if (!g || !g.hash || !secretMatches(t.secret, g.hash)) return { fail: g?.status === "revoked" ? "revoked" : "invalid", message: "That access token isn't valid or the member disconnected this assistant." };
  if (g.status === "revoked") return { fail: "revoked", message: "The member disconnected this assistant. Connect again to keep working." };
  if (g.expiresAt <= now.toISOString()) return { fail: "expired", message: "Access has run out. Ask the member to connect again." };
  const allowed = await canConnect(db, g.uid);
  if (!allowed.ok) return { fail: "plan", message: "This member's account can't use connected assistants right now." };
  if (g.status === "paused") return { fail: "paused", message: "The member has paused this assistant. Nothing can be read or changed until they resume it in Console → Connected agents." };
  if (!g.lastActiveAt || now.getTime() - new Date(g.lastActiveAt).getTime() > 60_000) snap.ref.update({ lastActiveAt: now.toISOString() }).catch(() => {});
  return { grantId: t.id, uid: g.uid, grant: g, user: allowed.user };
}

// One more action today, if the grant's daily limit allows it (reading counts too). Exact under concurrency (a transaction).
export async function countAction(db: Firestore, grantId: string, limit: number, now = new Date()): Promise<{ ok: boolean; used: number }> {
  const ref = db.doc(`agentUsage/${grantId}_${dayKey(now)}`);
  return db.runTransaction(async (t) => {
    const used = Number((await t.get(ref)).data()?.count) || 0;
    if (used >= limit) return { ok: false, used };
    t.set(ref, { grantId, day: dayKey(now), count: used + 1, expireAt: new Date(now.getTime() + 8 * 86_400_000) }, { merge: true });
    return { ok: true, used: used + 1 };
  });
}
export async function usedToday(db: Firestore, grantId: string, now = new Date()): Promise<number> {
  return Number((await db.doc(`agentUsage/${grantId}_${dayKey(now)}`).get()).data()?.count) || 0;
}

// ---- Console: the member's own grants
export async function listGrants(db: Firestore, uid: string): Promise<(GrantDoc & { id: string })[]> {
  return (await db.collection("agentGrants").where("uid", "==", uid).get()).docs.map((d) => ({ ...(d.data() as GrantDoc), id: d.id }));
}
async function ownGrant(db: Firestore, uid: string, id: string) {
  const ref = db.doc(`agentGrants/${String(id).replace(/[^a-f0-9]/g, "")}`);
  const g = (await ref.get()).data() as GrantDoc | undefined;
  if (!g || g.uid !== uid) throw new AgentAuthError("That assistant wasn't found.", 404);
  return { ref, g };
}
export async function setGrantStatus(db: Firestore, uid: string, id: string, status: "active" | "paused", now = new Date()) {
  const { ref, g } = await ownGrant(db, uid, id);
  if (g.status === "revoked") throw new AgentAuthError("This assistant was disconnected. Connect it again instead.", 409);
  await ref.update({ status, ...(status === "paused" ? { pausedAt: now.toISOString() } : {}) });
}
export async function editGrant(db: Firestore, uid: string, id: string, policyInput: unknown, renew = false, now = new Date()) {
  const { ref, g } = await ownGrant(db, uid, id);
  if (g.status === "revoked") throw new AgentAuthError("This assistant was disconnected. Connect it again instead.", 409);
  const policy = cleanGrant(policyInput ?? g.policy, await getAgentSettings(db));
  const days = policy.limits.accessDays;
  await ref.update({ policy, ...(renew || days !== g.policy.limits.accessDays ? { expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString() } : {}) });
  return policy;
}
// Disconnect: the token stops working at once. Its waiting requests in Nana's inbox are dismissed.
export async function revokeGrant(db: Firestore, uid: string, id: string, now = new Date()) {
  const { ref } = await ownGrant(db, uid, id);
  await ref.update({ status: "revoked", revokedAt: now.toISOString(), hash: "" });
  const waiting = await db.collection("agentProposals").where("uid", "==", uid).where("status", "==", "pending").get();
  for (const d of waiting.docs) if (d.data().source === ref.id) await d.ref.update({ status: "dismissed", decidedAt: now.toISOString() });
}
