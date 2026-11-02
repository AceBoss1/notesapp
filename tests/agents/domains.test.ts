// No domain is written into the agent layer (owner, 2 Nov 2026): the MCP address, the Connect and link pages and every link follow the
// domain being viewed (lib/host.ts). Checks the derivation, then scans every file the agent layer added for a written-in domain.
// Run: npm run test:agents (with the primary address unset and with NEXT_PUBLIC_ROOT_DOMAIN=naapp.tech) → "DOMAINS OK".
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { APP_SHORT_DOMAINS, KNOWN_ROOTS, LEGACY_ROOT_DOMAIN, MCP_HOST, mcpOrigin, mcpServerUrl } from "../../lib/host";
import { agentUrls } from "../../lib/agents/urls";

// ---- the MCP address follows the family being viewed
assert.equal(mcpServerUrl("www.naapp.tech"), "https://mcp.naapp.tech");
assert.equal(mcpServerUrl("app.naapp.tech"), "https://mcp.naapp.tech");
assert.equal(mcpServerUrl("mcp.naapp.tech"), "https://mcp.naapp.tech");
assert.equal(mcpServerUrl("www.notesapp.name.ng"), "https://mcp.notesapp.name.ng");
assert.equal(mcpServerUrl("LIFE.NOTESAPP.NAME.NG:443"), "https://mcp.notesapp.name.ng");
assert.equal(mcpServerUrl("notesapp.ng"), `https://${MCP_HOST}`, "the short app domain: the primary family");
assert.equal(mcpServerUrl("notes.brand.example"), `https://${MCP_HOST}`, "a member's own domain: the primary address");
assert.equal(mcpServerUrl(null), `https://${MCP_HOST}`);
assert.equal(mcpServerUrl("localhost:3000"), "http://localhost:3000/api/mcp", "development");
assert.equal(mcpServerUrl("pr-12-notesapp.vercel.app"), "https://pr-12-notesapp.vercel.app/api/mcp", "previews");
assert.equal(mcpOrigin("www.naapp.tech"), "https://mcp.naapp.tech");
const u = agentUrls("www.naapp.tech");
assert.deepEqual(u, { mcp: "https://mcp.naapp.tech", connect: "https://mcp.naapp.tech/connect", link: "https://www.naapp.tech/link", linkLabel: "naapp.tech/link", console: "https://www.naapp.tech/console?tab=agents", docs: "https://www.naapp.tech/docs#mcp", inbox: "https://www.naapp.tech/nana/inbox", help: "https://www.naapp.tech/help/connect-an-ai-assistant" });
assert.equal(agentUrls("mcp.notesapp.name.ng").link, "https://www.notesapp.name.ng/link", "the link page lives on the main site of the same family");
assert.equal(agentUrls("localhost:3000").connect, "http://localhost:3000/connect");
assert.equal(agentUrls("localhost:3000").link, "http://localhost:3000/link");

// ---- no written-in domain in the files the agent layer added
const ROOTS = [...new Set([...KNOWN_ROOTS, LEGACY_ROOT_DOMAIN, ...APP_SHORT_DOMAINS, "naapp.tech", "notesapp.name.ng"])];
const FILES = [
  "lib/agents", "components/agents", "app/api/agents", "app/api/nana/inbox", "app/api/console/agents", "app/api/cron/agents",
  "app/(main)/connect", "app/(main)/link", "app/(main)/nana/inbox", "app/(main)/messages/nana/inbox", "app/.well-known",
];
const walk = (p: string): string[] => (!existsSync(p) ? [] : statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : /\.(ts|tsx)$/.test(p) ? [p] : []);
const files = FILES.flatMap(walk);
assert.ok(files.length >= 15, `the agent layer's files are found (${files.length})`);
// Any https://host or bare host.tld that isn't a placeholder (example.com/.example) or an outside product named in copy on purpose.
const ALLOWED = /^(example\.(com|org)|[a-z0-9-]+\.example|schemas?\.|json-schema\.org|www\.w3\.org|modelcontextprotocol\.io|datatracker\.ietf\.org)/;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const r of ROOTS) assert.ok(!text.toLowerCase().includes(r), `${f} writes in the domain ${r}: use lib/host.ts (mcpServerUrl, mainSiteUrl, familyHost) and the request's host`);
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) assert.ok(ALLOWED.test(m[1].toLowerCase()), `${f} writes in the address ${m[0]}`);
}
console.log("DOMAINS OK");
