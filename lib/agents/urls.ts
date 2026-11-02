import { familyHost, isLocalHost, mainSiteUrl, mcpOrigin, mcpServerUrl } from "@/lib/host";

// Every address the agent layer shows (Connect screen, link page, Console, emails, the MCP server's own answers), worked out from the
// host being viewed so it stays in the visitor's family: on www.naapp.tech the MCP server is https://mcp.naapp.tech, on
// app.notesapp.name.ng it is https://mcp.notesapp.name.ng. Nothing here is written in (tests/agents/domains.test.ts checks).
export type AgentUrls = { mcp: string; connect: string; link: string; linkLabel: string; console: string; docs: string; inbox: string; help: string };

export function agentUrls(hostname: string | null | undefined): AgentUrls {
  const h = String(hostname || "").trim();
  const local = !!h && isLocalHost(h);
  const main = local ? mcpOrigin(h) : mainSiteUrl(h);
  const link = `${main}/link`;
  return {
    mcp: mcpServerUrl(h),
    connect: `${mcpOrigin(h)}/connect`,
    link,
    linkLabel: link.replace(/^https?:\/\/(www\.)?/, ""),
    console: `${main}/console?tab=agents`,
    docs: `${main}/docs#mcp`,
    inbox: `${main}/nana/inbox`,
    help: `${main}/help/connect-an-ai-assistant`,
  };
}

// The host a request was made to (behind Vercel: x-forwarded-host). Used by API routes so what they hand back follows the domain.
export function requestHost(headers: { get(name: string): string | null }): string {
  return (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0].trim();
}
// The main site of the family a request came to: www.<root> for mcp.<root>, app.<root>, … (or the request's own host locally).
export const mainHostFor = (host: string) => (isLocalHost(host) ? host : familyHost(host, "main"));
