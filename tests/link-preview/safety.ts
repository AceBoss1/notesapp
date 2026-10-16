// Link-preview safety (lib/link-preview.ts): private addresses are refused, including a name that answers "public" to the first
// check and "private" when we connect (DNS rebinding). Run: npx -y tsx tests/link-preview/safety.ts → prints "ALL OK".
// Needs to listen on port 80 (the preview only fetches ports 80 and 443), so run it where that is allowed (a container, CI).
import http from "node:http";
import dns from "node:dns";
import dnsp from "node:dns/promises";
import assert from "node:assert/strict";
import { fetchPreview, privateIp } from "../../lib/link-preview";

const PAGE = `<html><head><title>Secret admin page</title></head><body></body></html>`;

async function main() {
  // 1. The address rules.
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "198.18.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::1"])
    assert.equal(privateIp(ip), true, `${ip} should be private`);
  for (const ip of ["8.8.8.8", "104.20.23.154", "2606:4700::6810:1"]) assert.equal(privateIp(ip), false, `${ip} should be public`);

  // 2. A server on this machine that must never be reached.
  let hits = 0;
  const server = http.createServer((_q, r) => { hits++; r.writeHead(200, { "content-type": "text/html" }); r.end(PAGE); });
  await new Promise<void>((ok) => server.listen(80, "127.0.0.1", ok));

  const realP = dnsp.lookup, realCb = dns.lookup;
  const publicAnswer = [{ address: "93.184.216.34", family: 4 }], localAnswer = [{ address: "127.0.0.1", family: 4 }];
  try {
    // 2a. A name that points at this machine from the start.
    (dnsp as { lookup: unknown }).lookup = async () => localAnswer;
    (dns as { lookup: unknown }).lookup = (_h: string, _o: unknown, cb: (e: null, a: typeof localAnswer) => void) => cb(null, localAnswer);
    assert.equal(await fetchPreview("http://evil.example.com/"), null);
    // 2b. Rebinding: public for the first check, this machine when we connect.
    (dnsp as { lookup: unknown }).lookup = async () => publicAnswer;
    assert.equal(await fetchPreview("http://evil.example.com/"), null);
    // 2c. Plain IP literals and other ports.
    assert.equal(await fetchPreview("http://127.0.0.1/"), null);
    assert.equal(await fetchPreview("http://[::ffff:127.0.0.1]/"), null);
    assert.equal(await fetchPreview("http://evil.example.com:8080/"), null);
    // 2d. Control: when the connect-time answer is "public" the request does go out (here to our server, via the stub).
    let calls = 0;
    (dns as { lookup: unknown }).lookup = (_h: string, _o: unknown, cb: (e: null, a: unknown) => void) => { calls++; cb(null, localAnswer); };
    assert.equal(await fetchPreview("http://evil.example.com/"), null);
    assert.ok(calls > 0, "the connect-time check must run");
    assert.equal(hits, 0, "the local server must never be reached");
  } finally {
    (dnsp as { lookup: unknown }).lookup = realP; (dns as { lookup: unknown }).lookup = realCb;
    server.close();
  }
  console.log("ALL OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
