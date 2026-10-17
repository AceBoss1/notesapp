import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/host";
import { parseToken } from "@/lib/api-keys";
import { ERR, PROTOCOL_VERSIONS, handleMessage, type Server, type ToolResult } from "@/lib/mcp/protocol";
import { MEMBER_ROUTES, TOOLS, ToolError, publicTool } from "@/lib/mcp/tools";
import { actionEntry, logAction } from "@/lib/mcp/log";
import { GET as v1Me } from "@/app/api/v1/me/route";
import { GET as v1Posts } from "@/app/api/v1/posts/route";
import { GET as v1Bookings } from "@/app/api/v1/bookings/route";
import { GET as v1Orders } from "@/app/api/v1/orders/route";
import { GET as v1Earnings } from "@/app/api/v1/earnings/route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The NotesApp MCP server (Streamable HTTP, stateless; also at https://mcp.<our domain>/ through middleware.ts). POST one JSON-RPC message
// (or a batch); the answer is plain JSON. No cookies are used: a member's tools take their API key in the Authorization header, so any
// web page may call it (CORS open). Read-only in phase 1 (lib/mcp/tools.ts). Every tool call is logged (lib/mcp/log.ts).
const V1: Record<string, (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>> = {
  my_profile: v1Me, my_posts: v1Posts, my_bookings: v1Bookings, my_orders: v1Orders, my_earnings: v1Earnings,
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

async function memberTool(req: NextRequest, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+nak_/i.test(auth)) throw new ToolError("This tool needs your #NotesApp API key: create one in Console → API and send it as Authorization: Bearer nak_….");
  const r = MEMBER_ROUTES[name];
  const url = new URL(r.path, req.url);
  for (const [k, v] of Object.entries(r.query(args))) url.searchParams.set(k, v);
  const res = await V1[name](new NextRequest(url, { headers: { authorization: auth, "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" } }), { params: {} });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { data: { error: body?.error?.message ?? "That didn't work.", code: body?.error?.code ?? res.status }, isError: true };
  return { data: body };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// A person opening the address in a browser (asking for a page) goes to the docs. An MCP client asking for a server-sent stream is told
// there isn't one in phase 1, as the transport allows (405).
export async function GET(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html") && !accept.includes("text/event-stream")) return NextResponse.redirect(`${SITE_URL}/docs#mcp`, 307);
  return new NextResponse(JSON.stringify({ error: `This MCP server answers POST requests (JSON-RPC). See ${SITE_URL}/docs#mcp.` }), { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS", "Content-Type": "application/json" } });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "mcp", clientIp(req), 120, 60);
  if (limited) return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests: slow down and try again in a minute." } }, 429);
  const asked = req.headers.get("mcp-protocol-version");
  if (asked && !(PROTOCOL_VERSIONS as readonly string[]).includes(asked)) return json({ jsonrpc: "2.0", id: null, error: { code: ERR.invalidRequest, message: `Unsupported MCP-Protocol-Version: ${asked}. Supported: ${PROTOCOL_VERSIONS.join(", ")}.` } }, 400);
  const version = asked || "2025-03-26"; // no header: the spec says assume 2025-03-26
  let body: unknown;
  try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: ERR.parse, message: "Parse error: send one JSON-RPC message as JSON." } }, 400); }

  const db = getAdminDb();
  const keyId = parseToken((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""))?.id;
  const client = req.headers.get("user-agent") || "";
  const server: Server = {
    tools: TOOLS,
    call: async (name, args) => {
      try {
        const def = TOOLS.find((t) => t.name === name)!;
        const r = def.needsKey ? await memberTool(req, name, args) : await publicTool(db, name, args);
        void logAction(db, actionEntry(name, args, !r.isError, { keyId: def.needsKey ? keyId : undefined, client, error: r.isError ? String((r.data as { error?: string })?.error ?? "") : undefined }));
        return r;
      } catch (e) {
        const message = e instanceof ToolError ? e.message : "Something went wrong on our side. Try again in a moment.";
        if (!(e instanceof ToolError)) console.error("mcp tool failed", name, e);
        void logAction(db, actionEntry(name, args, false, { keyId, client, error: message }));
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
