import { createHash, randomBytes } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { SITE_URL } from "@/lib/host";
import { setting } from "@/lib/config";

// Granola's hosted MCP server, used by the team hub. Each staff member connects their own Granola account (OAuth 2.1 with PKCE and dynamic
// client registration, so nothing to register by hand); their tokens are kept encrypted (AES-256-GCM, ACCOUNT_DATA_KEY) in the server-only
// collection granolaConnections and never sent to a browser. Notes are read on demand from Granola and not stored here; only what a person
// chooses to add to the work board is saved, as ordinary work items. Collections (all server-only): granolaConnections, granolaStates
// (one-time sign-in states, 10 minutes), integrationClients (our registered client id).
export class GranolaError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const mcpUrl = () => (setting("GRANOLA_MCP_URL") || "https://mcp.granola.ai/mcp").replace(/\/$/, "");
const site = () => SITE_URL;
export const redirectUri = () => `${site()}/api/admin/granola/callback`;
const PROTOCOL = "2025-06-18";
const STATE_TTL_MS = 10 * 60_000;
const b64url = (b: Buffer) => b.toString("base64url");

type Meta = { authorization_endpoint: string; token_endpoint: string; registration_endpoint?: string };
type Tokens = { access: string; refresh?: string; expiresAt: number };

const getJson = async (url: string): Promise<Record<string, unknown> | null> => {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

// Where to sign in: the MCP server names its authorization server (RFC 9728); that server describes its endpoints (RFC 8414).
export async function discover(): Promise<Meta> {
  const origin = new URL(mcpUrl()).origin;
  const resource = (await getJson(`${origin}/.well-known/oauth-protected-resource`)) ?? (await getJson(`${origin}/.well-known/oauth-protected-resource${new URL(mcpUrl()).pathname}`));
  const asBase = String((resource?.authorization_servers as string[] | undefined)?.[0] ?? origin).replace(/\/$/, "");
  const meta = (await getJson(`${asBase}/.well-known/oauth-authorization-server`)) ?? (await getJson(`${asBase}/.well-known/openid-configuration`));
  if (!meta?.authorization_endpoint || !meta?.token_endpoint) throw new GranolaError("Couldn't reach Granola's sign-in. Try again in a moment.", 502);
  return meta as unknown as Meta;
}

async function clientId(db: Firestore, meta: Meta): Promise<string> {
  const ref = db.doc("integrationClients/granola");
  const saved = (await ref.get()).data();
  if (saved?.clientId && saved.redirectUri === redirectUri() && saved.mcp === mcpUrl()) return String(saved.clientId);
  if (!meta.registration_endpoint) throw new GranolaError("Granola doesn't allow automatic setup here. Please contact us.", 502);
  const r = await fetch(meta.registration_endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ client_name: "#NotesApp team hub", redirect_uris: [redirectUri()], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }),
  });
  const j = (await r.json().catch(() => ({}))) as { client_id?: string };
  if (!r.ok || !j.client_id) throw new GranolaError("Granola didn't accept our connection request. Please try again later.", 502);
  await ref.set({ clientId: j.client_id, redirectUri: redirectUri(), mcp: mcpUrl(), createdAt: new Date().toISOString() });
  return j.client_id;
}

// Step 1: where to send the person to approve access. A one-time state ties their return to them.
export async function startAuth(db: Firestore, uid: string, now = new Date()): Promise<{ url: string }> {
  if (!accountCryptoConfigured()) throw new GranolaError("Connecting Granola isn't set up yet (the server's encryption key is missing).", 503);
  const meta = await discover();
  const id = await clientId(db, meta);
  const state = b64url(randomBytes(24)), verifier = b64url(randomBytes(48));
  await db.doc(`granolaStates/${state}`).set({ uid, verifier, createdAt: now.toISOString(), expiresAt: now.getTime() + STATE_TTL_MS });
  const u = new URL(meta.authorization_endpoint);
  u.search = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: redirectUri(), state, code_challenge: b64url(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256", resource: mcpUrl() }).toString();
  return { url: u.toString() };
}

const tokenRequest = async (meta: Meta, params: Record<string, string>): Promise<Tokens & { raw: Record<string, unknown> }> => {
  const r = await fetch(meta.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(params).toString(), signal: AbortSignal.timeout(15_000) });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!r.ok || !j.access_token) throw new GranolaError(r.status === 400 || r.status === 401 ? "Granola's approval has expired. Connect again." : "Granola didn't respond. Try again in a moment.", r.status === 400 || r.status === 401 ? 401 : 502);
  return { access: j.access_token, refresh: j.refresh_token, expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000, raw: j as Record<string, unknown> };
};

// Step 2: the person comes back with a code. Returns who it was, so the page can send them back to the hub.
export async function completeAuth(db: Firestore, state: string, code: string, now = new Date()): Promise<string> {
  if (!state || !code) throw new GranolaError("That sign-in link isn't complete.");
  const ref = db.doc(`granolaStates/${state}`);
  const s = (await ref.get()).data();
  await ref.delete().catch(() => {}); // one use only
  if (!s || Number(s.expiresAt) < now.getTime()) throw new GranolaError("That sign-in took too long. Start again from the team hub.");
  const meta = await discover();
  const id = await clientId(db, meta);
  const t = await tokenRequest(meta, { grant_type: "authorization_code", code, redirect_uri: redirectUri(), client_id: id, code_verifier: String(s.verifier), resource: mcpUrl() });
  await db.doc(`granolaConnections/${s.uid}`).set({ uid: s.uid, secret: encryptSecret(JSON.stringify({ access: t.access, refresh: t.refresh, expiresAt: t.expiresAt })), clientId: id, connectedAt: now.toISOString() });
  return String(s.uid);
}

async function tokens(db: Firestore, uid: string): Promise<Tokens> {
  const ref = db.doc(`granolaConnections/${uid}`);
  const d = (await ref.get()).data();
  if (!d?.secret) throw new GranolaError("Connect Granola first.", 409);
  let t: Tokens;
  try { t = JSON.parse(decryptSecret(String(d.secret))); } catch { throw new GranolaError("Connect Granola again.", 409); }
  if (t.expiresAt - 60_000 > Date.now()) return t;
  if (!t.refresh) throw new GranolaError("Granola's approval has expired. Connect again.", 409);
  const meta = await discover();
  const n = await tokenRequest(meta, { grant_type: "refresh_token", refresh_token: t.refresh, client_id: String(d.clientId), resource: mcpUrl() }).catch((e) => {
    if (e instanceof GranolaError && e.status === 401) throw new GranolaError("Granola's approval has expired. Connect again.", 409);
    throw e;
  });
  const next: Tokens = { access: n.access, refresh: n.refresh ?? t.refresh, expiresAt: n.expiresAt };
  await ref.update({ secret: encryptSecret(JSON.stringify(next)) });
  return next;
}

export async function disconnect(db: Firestore, uid: string): Promise<void> {
  await db.doc(`granolaConnections/${uid}`).delete();
}
export async function granolaStatus(db: Firestore, uid: string) {
  const d = (await db.doc(`granolaConnections/${uid}`).get()).data();
  return { connected: !!d, connectedAt: (d?.connectedAt as string) ?? null, canConnect: accountCryptoConfigured() };
}

// ── Talking to the MCP server (streamable HTTP: replies are plain JSON or a short event stream) ───────────────────────────────────────
const parseReply = async (r: Response): Promise<Record<string, unknown> | null> => {
  const text = await r.text();
  if (!text.trim()) return null;
  if ((r.headers.get("content-type") || "").includes("text/event-stream")) {
    let last: Record<string, unknown> | null = null;
    for (const line of text.split(/\r?\n/)) if (line.startsWith("data:")) { try { const j = JSON.parse(line.slice(5).trim()); if (j && (j.result !== undefined || j.error !== undefined)) last = j; } catch { /* partial line */ } }
    return last;
  }
  try { return JSON.parse(text); } catch { return null; }
};

async function rpc(access: string, session: string | null, body: Record<string, unknown>): Promise<{ json: Record<string, unknown> | null; session: string | null; status: number }> {
  const r = await fetch(mcpUrl(), {
    method: "POST", signal: AbortSignal.timeout(60_000), body: JSON.stringify({ jsonrpc: "2.0", ...body }),
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${access}`, "MCP-Protocol-Version": PROTOCOL, ...(session ? { "Mcp-Session-Id": session } : {}) },
  });
  return { json: await parseReply(r), session: r.headers.get("mcp-session-id") ?? session, status: r.status };
}

export type ToolResult = { text: string; isError: boolean };
// Calls one tool as this person. Opens a session, calls, and leaves it (nothing is kept between calls).
export async function callTool(db: Firestore, uid: string, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const t = await tokens(db, uid);
  const init = await rpc(t.access, null, { id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "notesapp-team-hub", version: "1.0" } } });
  if (init.status === 401) throw new GranolaError("Granola's approval has expired. Connect again.", 409);
  if (init.status >= 400 || !init.json || init.json.error) throw new GranolaError("Granola didn't respond. Try again in a moment.", 502);
  await rpc(t.access, init.session, { method: "notifications/initialized" }).catch(() => {});
  const res = await rpc(t.access, init.session, { id: 2, method: "tools/call", params: { name, arguments: args } });
  if (res.status === 401) throw new GranolaError("Granola's approval has expired. Connect again.", 409);
  if (!res.json) throw new GranolaError("Granola didn't respond. Try again in a moment.", 502);
  if (res.json.error) throw new GranolaError(String((res.json.error as { message?: string }).message || "Granola refused that request."), 502);
  const r = res.json.result as { content?: { type: string; text?: string }[]; isError?: boolean };
  const text = (r.content ?? []).filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n\n");
  return { text, isError: r.isError === true };
}

export const RANGES = ["this_week", "last_week", "last_30_days"] as const;
export const listMeetings = (db: Firestore, uid: string, range: unknown) =>
  callTool(db, uid, "list_meetings", { time_range: (RANGES as readonly string[]).includes(String(range)) ? String(range) : "this_week" });
export const askGranola = (db: Firestore, uid: string, query: unknown) => {
  const q = String(query ?? "").trim().slice(0, 600);
  if (q.length < 3) throw new GranolaError("Ask a question, for example “What did we decide about pricing?”.");
  return callTool(db, uid, "query_granola_meetings", { query: q });
};
export const whoAmI = (db: Firestore, uid: string) => callTool(db, uid, "get_account_info");

// Lines of a Granola answer that look like action items or bullet points, for the person to pick from. Plain text in, short titles out.
export function candidateItems(text: string, max = 12): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:[-*•]|\d{1,2}[.)]|\[[ xX]\])\s+(.{6,})$/);
    if (!m) continue;
    const t = m[1].replace(/\[\[\d+\]\]\([^)]*\)/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
    if (t.length >= 6 && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
