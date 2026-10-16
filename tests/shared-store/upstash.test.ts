// Shared rate limits and cache (lib/rate-limit.ts, lib/shared-store.ts) against a stand-in for Upstash's REST API, and the
// fallback to memory when it's missing or down. Run: npx -y tsx tests/shared-store/upstash.test.ts → "ALL OK".
import assert from "node:assert/strict";
import http from "node:http";
import type { NextRequest } from "next/server";

const store = new Map<string, string>();
let calls = 0, down = false;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    calls++;
    if (down || req.headers.authorization !== "Bearer t0ken" || req.url !== "/pipeline") { res.writeHead(down ? 503 : 401); return res.end("{}"); }
    const out = (JSON.parse(body) as string[][]).map(([cmd, key, ...rest]) => {
      if (cmd === "INCR") { const n = Number(store.get(key) ?? 0) + 1; store.set(key, String(n)); return { result: n }; }
      if (cmd === "EXPIRE") return { result: 1 };
      if (cmd === "GET") return { result: store.get(key) ?? null };
      if (cmd === "SET") { store.set(key, rest[0]); return { result: "OK" }; }
      return { error: "unknown" };
    });
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out));
  });
});

(async () => {
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const port = (server.address() as { port: number }).port;
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = "t0ken";
  const { rateLimit } = await import("../../lib/rate-limit");
  const { cacheGet, cacheSet } = await import("../../lib/shared-store");
  const req = {} as NextRequest;

  // shared: three allowed, the fourth refused, all counted in the store
  for (let i = 0; i < 3; i++) assert.equal(await rateLimit(req, "t", "alice", 3, 60), null);
  const r = await rateLimit(req, "t", "alice", 3, 60);
  assert.equal(r?.status, 429); assert.ok(Number(r?.headers.get("Retry-After")) >= 1);
  assert.ok([...store.keys()].some((k) => k.startsWith("rl:t:alice:")), "counted in the shared store");
  // another instance (a fresh in-memory map) sees the same count, because the count lives in the store
  store.set([...store.keys()].find((k) => k.startsWith("rl:t:alice:"))!, "3");
  assert.equal((await rateLimit(req, "t", "alice", 3, 60))?.status, 429);
  assert.equal(await rateLimit(req, "t", "bob", 3, 60), null, "per key");

  // cache
  await cacheSet("x", { a: 1 }, 60);
  assert.deepEqual(await cacheGet("x"), { a: 1 }); assert.equal(await cacheGet("missing"), undefined);

  // Upstash down: falls back to memory and still limits
  down = true; const before = calls;
  for (let i = 0; i < 2; i++) assert.equal(await rateLimit(req, "t", "carol", 2, 60), null);
  assert.equal((await rateLimit(req, "t", "carol", 2, 60))?.status, 429);
  assert.ok(calls > before, "it tried the store first");
  await cacheSet("y", 5, 60); assert.equal(await cacheGet("y"), 5);

  server.close();
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
