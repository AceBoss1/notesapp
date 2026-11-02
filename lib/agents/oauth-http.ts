import { NextRequest, NextResponse } from "next/server";
import { AgentAuthError } from "./grants-server";
import { mcpOrigin } from "@/lib/host";
import { agentUrls } from "./urls";
import { requestHost } from "./urls";
import { READ_SCOPES } from "./scopes";

// Shared by the OAuth endpoints (app/api/agents/oauth/*): CORS (assistants call them from anywhere), form or JSON bodies, and RFC 6749
// errors. The issuer is the MCP address of the domain family the request came to (mcp.<root>), never a written-in address.
export const OAUTH_CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version", "Access-Control-Max-Age": "86400" };
export const oauthJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { ...OAUTH_CORS, "Cache-Control": "no-store" } });
export const preflight = () => new NextResponse(null, { status: 204, headers: OAUTH_CORS });
export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(await req.text()));
  return ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
}
export function oauthFail(err: unknown) {
  if (err instanceof AgentAuthError) return oauthJson({ error: err.code, error_description: err.message }, err.status >= 500 ? err.status : 400);
  console.error("[agents] oauth failed", err);
  return oauthJson({ error: "server_error", error_description: "Something went wrong. Try again." }, 500);
}

export function serverMetadata(req: NextRequest) {
  const o = mcpOrigin(requestHost(req.headers));
  return {
    issuer: o,
    authorization_endpoint: `${o}/connect`,
    token_endpoint: `${o}/api/agents/oauth/token`,
    registration_endpoint: `${o}/api/agents/oauth/register`,
    device_authorization_endpoint: `${o}/api/agents/oauth/device`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "urn:ietf:params:oauth:grant-type:device_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: READ_SCOPES.map((s) => s.id),
    service_documentation: agentUrls(requestHost(req.headers)).docs,
  };
}
export function resourceMetadata(req: NextRequest) {
  const o = mcpOrigin(requestHost(req.headers));
  return { resource: o, authorization_servers: [o], bearer_methods_supported: ["header"], scopes_supported: READ_SCOPES.map((s) => s.id), resource_name: "#NotesApp" };
}
