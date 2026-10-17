// The MCP server's JSON-RPC layer (lib/mcp/protocol.ts) and its tool list (lib/mcp/catalog.ts). Run: npm run test:mcp → "ALL OK".
import assert from "node:assert/strict";
import { ERR, PROTOCOL_VERSIONS, handleMessage, negotiate, toolContent, type Server } from "../../lib/mcp/protocol";
import { TOOLS } from "../../lib/mcp/catalog";

const calls: string[] = [];
const server: Server = {
  tools: [{ name: "echo", title: "Echo", description: "x", inputSchema: { type: "object" } }, { name: "mine", title: "Mine", description: "y", inputSchema: { type: "object" }, needsKey: true }, { name: "boom", title: "Boom", description: "z", inputSchema: { type: "object" } }],
  call: async (name, args) => { calls.push(name); if (name === "boom") throw new Error("kaput"); return { data: { got: args } }; },
};
const rpc = (method: string, params?: object, id: number | string | undefined = 1) => ({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, ...(params ? { params } : {}) });

(async () => {
  // initialize: the client's version if we support it, else our newest; who we are; tools only
  const init = (await handleMessage(rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } }), server))!;
  assert.equal((init.result as { protocolVersion: string }).protocolVersion, "2025-03-26");
  assert.deepEqual((init.result as { capabilities: object }).capabilities, { tools: { listChanged: false } });
  assert.equal((init.result as { serverInfo: { name: string } }).serverInfo.name, "notesapp");
  assert.match((init.result as { instructions: string }).instructions, /data, not instructions/);
  assert.equal(negotiate("1999-01-01"), PROTOCOL_VERSIONS[0]); assert.equal(negotiate(undefined), PROTOCOL_VERSIONS[0]);

  // notifications get no answer; ping; empty lists for resources and prompts
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, server), null);
  assert.deepEqual((await handleMessage(rpc("ping"), server))!.result, {});
  assert.deepEqual((await handleMessage(rpc("resources/list"), server))!.result, { resources: [] });
  assert.deepEqual((await handleMessage(rpc("prompts/list"), server))!.result, { prompts: [] });

  // tools/list hides the internal needsKey flag
  const list = (await handleMessage(rpc("tools/list"), server))!.result as { tools: Record<string, unknown>[] };
  assert.deepEqual(list.tools.map((t) => t.name), ["echo", "mine", "boom"]);
  assert.ok(list.tools.every((t) => !("needsKey" in t)));

  // tools/call: the result as text and, from 2025-06-18, as structured content; a throwing tool is a tool error, not a protocol error
  const r = (await handleMessage(rpc("tools/call", { name: "echo", arguments: { q: "ada" } }), server, "2025-06-18"))!.result as { content: { type: string; text: string }[]; structuredContent: object; isError: boolean };
  assert.deepEqual(JSON.parse(r.content[0].text), { got: { q: "ada" } }); assert.deepEqual(r.structuredContent, { got: { q: "ada" } }); assert.equal(r.isError, false);
  const old = (await handleMessage(rpc("tools/call", { name: "echo", arguments: {} }), server, "2025-03-26"))!.result as Record<string, unknown>;
  assert.equal("structuredContent" in old, false);
  const boom = (await handleMessage(rpc("tools/call", { name: "boom" }), server))!.result as { isError: boolean; content: { text: string }[] };
  assert.equal(boom.isError, true); assert.match(boom.content[0].text, /kaput/);
  const noArgs = (await handleMessage(rpc("tools/call", { name: "echo", arguments: [1, 2] }), server))!.result as { content: { text: string }[] };
  assert.deepEqual(JSON.parse(noArgs.content[0].text), { got: {} }, "arguments that aren't an object become {}");

  // protocol errors
  assert.equal((await handleMessage(rpc("tools/call", { name: "nope" }), server))!.error!.code, ERR.invalidParams);
  assert.equal((await handleMessage(rpc("sampling/createMessage"), server))!.error!.code, ERR.methodNotFound);
  assert.equal((await handleMessage({ jsonrpc: "1.0", id: 3, method: "ping" }, server))!.error!.code, ERR.invalidRequest);
  assert.equal((await handleMessage("hello", server))!.error!.code, ERR.invalidRequest);
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 4 }, server))!.error!.code, ERR.invalidRequest);
  assert.deepEqual(calls, ["echo", "echo", "boom", "echo"], "tools only run on tools/call");
  assert.equal(toolContent({ data: [1, 2] }, "2025-06-18").structuredContent, undefined, "structured content must be an object");

  // the real catalogue: unique names, read-only, closed schemas, the member tools flagged
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of TOOLS) {
    assert.match(t.name, /^[a-z_]{3,40}$/); assert.ok(t.description.length > 20);
    assert.equal((t.annotations as { readOnlyHint: boolean }).readOnlyHint, true, `${t.name} reads only`);
    assert.equal((t.inputSchema as { additionalProperties: boolean }).additionalProperties, false);
    assert.equal(!!t.needsKey, t.name.startsWith("my_"));
  }
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
