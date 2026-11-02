import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { AGENT_CALL, parseToken, type AgentCallMark } from "@/lib/api-keys";
import { ERR, PROTOCOL_VERSIONS, handleMessage, type Server, type ToolDef, type ToolResult } from "@/lib/mcp/protocol";
import { MEMBER_ROUTES, TOOLS, ToolError, publicTool } from "@/lib/mcp/tools";
import { actionEntry, logAction, type LogResult } from "@/lib/mcp/log";
import { AGENT_TOOLS, CONNECT_TOOL } from "@/lib/agents/catalog";
import { AgentAuthError, authenticateAgent, countAction, pollDevice, startDevice, type AgentCaller } from "@/lib/agents/grants-server";
import { AgentToolError, agentWriteTool, myMessages } from "@/lib/agents/agent-tools-server";
import { decide } from "@/lib/agents/scopes";
import { describeCall } from "@/lib/agents/activity";
import { agentUrls, requestHost } from "@/lib/agents/urls";
import { formatCode } from "@/lib/agents/pairing";
import { getAgentSettings } from "@/lib/agents/config-server";
import { mainSiteUrl, mcpOrigin } from "@/lib/host";
import { GET as v1Me } from "@/app/api/v1/me/route";
import { GET as v1Posts } from "@/app/api/v1/posts/route";
import { GET as v1Bookings } from "@/app/api/v1/bookings/route";
import { GET as v1Orders } from "@/app/api/v1/orders/route";
import { GET as v1Earnings } from "@/app/api/v1/earnings/route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The NotesApp MCP server (Streamable HTTP, stateless; also at https://mcp.<the domain's family>/ through middleware.ts). POST one JSON-RPC
// message (or a batch); the answer is plain JSON. No cookies: a member's tools take a credential in the Authorization header, so any web
// page may call it (CORS open).
//   - Anyone: the reading tools (lib/mcp/tools.ts) and connect_account (start connecting an account with a pairing code).
//   - A member's API key (nak_…, Enterprise): the my_* reading tools, through /api/v1 with the key's scopes.
//   - A connected assistant's token (naa_…, Connect NotesApp): the my_* tools its member allowed, and the changing tools (lib/agents),
//     each decided by the member's rules: done, waiting in Nana's inbox, or refused. Every call counts towards its daily limit.
// An account tool called with no credential answers HTTP 401 with the OAuth discovery header, so assistants that sign in with OAuth start
// the Connect NotesApp screen. Every tool call is logged (lib/mcp/log.ts), the connected ones with the member and a plain summary.
const V1: Record<string, (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>> = {
  my_profile: v1Me, my_posts: v1Posts, my_bookings: v1Bookings, my_orders: v1Orders, my_earnings: v1Earnings,
};
const ALL_TOOLS: ToolDef[] = [...TOOLS, CONNECT_TOOL, ...AGENT_TOOLS];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store", ...headers } });
const unauthorized = (req: NextRequest, message: string, error = "invalid_token") =>
  json({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }, 401, { "WWW-Authenticate": `Bearer resource_metadata="${mcpOrigin(requestHost(req.headers))}/.well-known/oauth-protected-resource", error="${error}", error_description="${message.replace(/"/g, "'").replace(/[^\x20-\x7e]/g, "")}"` });

async function memberTool(req: NextRequest, name: string, args: Record<string, unknown>, agent?: AgentCaller): Promise<ToolResult> {
  const auth = req.headers.get("authorization") || "";
  if (!agent && !/^Bearer\s+nak_/i.test(auth)) throw new ToolError("This tool needs your #NotesApp API key (Console → API, Authorization: Bearer nak_…) or a connected assistant's token (connect_account).");
  const r = MEMBER_ROUTES[name];
  const url = new URL(r.path, req.url);
  for (const [k, v] of Object.entries(r.query(args))) url.searchParams.set(k, v);
  const inner = new NextRequest(url, { headers: { authorization: agent ? "" : auth, "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" } });
  if (agent) (inner as unknown as Record<symbol, AgentCallMark>)[AGENT_CALL] = { uid: agent.uid, grantId: agent.grantId, user: agent.user };
  const res = await V1[name](inner, { params: {} });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { data: { error: body?.error?.message ?? "That didn't work.", code: body?.error?.code ?? res.status }, isError: true };
  return { data: body };
}

// connect_account: the device flow inside the MCP server, for assistants without OAuth.
async function connectTool(req: NextRequest, args: Record<string, unknown>): Promise<ToolResult> {
  const db = getAdminDb();
  const urls = agentUrls(requestHost(req.headers));
  if (typeof args.device_id === "string" && args.device_id) {
    const r = await pollDevice(db, args.device_id);
    if (r.status === "connected") return { data: { status: "connected", access_token: r.token.access_token, token_type: "Bearer", expires_in: r.token.expires_in, how_to_use: "Send Authorization: Bearer <access_token> on every request to this server. Keep it secret; the member can pause or disconnect you any time." } };
    return { data: { status: r.status, message: r.status === "waiting" ? "The member hasn't answered yet. Try again in a few seconds." : r.status === "denied" ? "The member said no." : "The code ran out. Start again." } };
  }
  const limited = await rateLimit(req, "agent-connect", clientIp(req), 10, 600);
  if (limited) throw new ToolError("Too many connect requests from here. Try again in a few minutes.");
  const d = await startDevice(db, { agentName: args.agent_name ?? req.headers.get("user-agent") });
  const minutes = Math.round((new Date(d.expiresAt).getTime() - Date.now()) / 60_000);
  return { data: {
    status: "waiting", code: formatCode(d.code), link: urls.link, connect_url: `${urls.connect}?code=${d.code}`, expires_in_minutes: minutes, device_id: d.deviceCode,
    tell_the_member: `Open ${urls.link} and type the code ${formatCode(d.code)} (or open ${urls.connect}?code=${d.code}). You'll choose what I may see and do, then press Connect.`,
    next: "Call connect_account again with this device_id once they've connected.",
  } };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// A person opening the address in a browser (asking for a page) goes to the docs on the same domain. An MCP client asking for a
// server-sent stream is told there isn't one, as the transport allows (405).
export async function GET(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  const docs = mainSiteUrl(requestHost(req.headers), "/docs#mcp");
  if (accept.includes("text/html") && !accept.includes("text/event-stream")) return NextResponse.redirect(docs, 307);
  return new NextResponse(JSON.stringify({ error: `This MCP server answers POST requests (JSON-RPC). See ${docs}.` }), { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS", "Content-Type": "application/json" } });
}

const ACCOUNT_TOOLS = new Set(ALL_TOOLS.filter((t) => t.needsKey || t.needsAgent).map((t) => t.name));
const callsAccountTool = (m: unknown) => !!m && typeof m === "object" && (m as { method?: string }).method === "tools/call" && ACCOUNT_TOOLS.has(String((m as { params?: { name?: string } }).params?.name ?? ""));

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "mcp", clientIp(req), 120, 60);
  if (limited) return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests: slow down and try again in a minute." } }, 429);
  const asked = req.headers.get("mcp-protocol-version");
  if (asked && !(PROTOCOL_VERSIONS as readonly string[]).includes(asked)) return json({ jsonrpc: "2.0", id: null, error: { code: ERR.invalidRequest, message: `Unsupported MCP-Protocol-Version: ${asked}. Supported: ${PROTOCOL_VERSIONS.join(", ")}.` } }, 400);
  const version = asked || "2025-03-26"; // no header: the spec says assume 2025-03-26
  let body: unknown;
  try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: ERR.parse, message: "Parse error: send one JSON-RPC message as JSON." } }, 400); }

  const db = getAdminDb();
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const keyId = parseToken(bearer)?.id;
  const client = req.headers.get("user-agent") || "";
  const host = requestHost(req.headers);
  // A connected assistant: its token must be good (else 401 so it can sign in again); paused, it may still connect but every tool says so.
  let agent: AgentCaller | undefined;
  let paused = "";
  if (bearer.startsWith("naa_")) {
    const a = await authenticateAgent(db, bearer);
    if ("fail" in a) {
      if (a.fail !== "paused") return unauthorized(req, a.message);
      paused = a.message;
    } else agent = a;
  } else if (!bearer && (Array.isArray(body) ? body.some(callsAccountTool) : callsAccountTool(body))) {
    return unauthorized(req, "This tool needs a #NotesApp account: connect one (OAuth, or call connect_account), or send a member's API key as Authorization: Bearer nak_….", "invalid_request");
  }
  const settings = agent ? await getAgentSettings(db) : null;

  const server: Server = {
    tools: ALL_TOOLS,
    call: async (name, args) => {
      const def = ALL_TOOLS.find((t) => t.name === name)!;
      const log = (ok: boolean, result: LogResult | undefined, extra: { error?: string; proposalId?: string } = {}) =>
        void logAction(db, actionEntry(name, args, ok, { keyId: def.needsKey && !agent ? keyId : undefined, client, ...extra, ...(agent ? { uid: agent.uid, grantId: agent.grantId, agent: agent.grant.agentName, summary: describeCall(name, args, result), result, logDays: settings!.logDays } : {}) }));
      try {
        if (paused) throw new AgentToolError(paused, "blocked");
        if (name === "connect_account") { const r = await connectTool(req, args); log(true, undefined); return r; }
        if (def.needsAgent && !agent) throw new ToolError("This tool is for an assistant the member connected (connect_account, or sign in with OAuth).");
        if (agent) {
          // The member's rules first (scopes, money), then today's limit: reading counts too.
          const d = decide(agent.grant.policy, name);
          if (d.kind === "deny") throw new AgentToolError(d.reason, "blocked");
          const n = await countAction(db, agent.grantId, agent.grant.policy.limits.actionsPerDay);
          if (!n.ok) throw new AgentToolError(`This assistant has used its ${agent.grant.policy.limits.actionsPerDay} actions for today. It resets at midnight, Lagos time; the member can raise the limit in Console → Connected agents.`, "blocked");
          if (name === "my_messages") { const r = { data: await myMessages(db, agent.uid, Number(args.limit) || 10) }; log(true, "read"); return r; }
          if (def.needsAgent) {
            const out = await agentWriteTool(db, agent, name, args, host);
            log(true, out.result, { proposalId: out.proposalId });
            return { data: out.data };
          }
          const r = def.needsKey ? await memberTool(req, name, args, agent) : await publicTool(db, name, args);
          log(!r.isError, r.isError ? "failed" : "read", { error: r.isError ? String((r.data as { error?: string })?.error ?? "") : undefined });
          return r;
        }
        const r = def.needsKey ? await memberTool(req, name, args) : await publicTool(db, name, args);
        log(!r.isError, undefined, { error: r.isError ? String((r.data as { error?: string })?.error ?? "") : undefined });
        return r;
      } catch (e) {
        const known = e instanceof ToolError || e instanceof AgentToolError || e instanceof AgentAuthError;
        const message = known ? (e as Error).message : "Something went wrong on our side. Try again in a moment.";
        if (!known) console.error("mcp tool failed", name, e);
        log(false, e instanceof AgentToolError ? e.result : agent ? "failed" : undefined, { error: message });
        return { data: { error: message }, isError: true };
      }
    },
  };
  if (Array.isArray(body)) {
    if (!body.length || body.length > 20) return json({ jsonrpc: "2.0", id: null, error: { code: ERR.invalidRequest, message: "Send 1 to 20 messages in a batch." } }, 400);
    const out = (await Promise.all(body.map((m) => handleMessage(m, server, version)))).filter(Boolean);
    return out.length ? json(out) : new NextResponse(null, { status: 202, headers: CORS });
  }
  const out = await handleMessage(body, server, version);
  return out ? json(out) : new NextResponse(null, { status: 202, headers: CORS });
}
