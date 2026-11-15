// Throwaway emails, the pure rules (lib/throwaway-emails.ts). Run: npm run test:throwaway
import assert from "node:assert/strict";
import { BUILT_IN_DOMAINS, blockedBy, cleanDomain, domainOf, fullList, isOrdinary, parseDomains } from "../../lib/throwaway-emails";

assert.equal(cleanDomain(" Temp-Mail.Example "), "temp-mail.example");
assert.equal(cleanDomain("https://kuku.lu/inbox"), "kuku.lu");
assert.equal(cleanDomain("someone@petchi.uk"), "petchi.uk");
assert.equal(cleanDomain("not a domain"), null);
assert.equal(cleanDomain("localhost"), null);
assert.equal(domainOf("A.B@Mail.Petchi.UK"), "mail.petchi.uk");
assert.equal(domainOf("nope"), null);

const list = fullList(["kuku.lu"]);
assert.ok(list.includes("petchi.uk") && list.includes("kuku.lu"));
assert.equal(new Set(fullList(["petchi.uk"])).size, fullList([]).length, "no repeats");
assert.equal(blockedBy("x@petchi.uk", list), "petchi.uk");
assert.equal(blockedBy("x@mail.petchi.uk", list), "petchi.uk", "subdomains too");
assert.equal(blockedBy("x@a.b.c.kuku.lu", list), "kuku.lu");
assert.equal(blockedBy("x@notpetchi.uk", list), null, "not a subdomain");
assert.equal(blockedBy("x@gmail.com", list), null);
assert.equal(blockedBy(undefined, list), null);

assert.ok(isOrdinary("gmail.com") && isOrdinary("mail.yahoo.com") && !isOrdinary("petchi.uk"));
for (const d of BUILT_IN_DOMAINS) assert.ok(!isOrdinary(d), `${d} is built in, not ordinary`);

const p = parseDomains("temp-mail.example\nanother-throwaway.example, gmail.com; kuku.lu\n???\ntemp-mail.example", ["kuku.lu"]);
assert.deepEqual(p.add, ["temp-mail.example", "another-throwaway.example"]);
assert.deepEqual(p.refused.map((r) => r.input), ["gmail.com", "???"]);
assert.match(p.refused[0].why, /ordinary/);

console.log("THROWAWAY RULES OK");
