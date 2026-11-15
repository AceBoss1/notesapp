// Throwaway email domains (lib/email-blocklist.ts). Run: npm run test:email-blocklist
import assert from "node:assert/strict";
import { blocklistRegex, cleanDomain, emailDomain, isBlockedEmail, isBlockedIn } from "../../lib/email-blocklist";

assert.equal(emailDomain(" Ada@Petchi.UK "), "petchi.uk");
for (const e of ["ada@petchi.uk", "ADA@PETCHI.UK", "x@mail.petchi.uk", "x@a.b.petchi.uk", "x@petchi.uk."]) assert.equal(isBlockedEmail(e), true, e);
for (const e of ["ada@gmail.com", "x@notpetchi.uk", "x@petchi.uk.ng", "x@petchi.co.uk", "", "no-at-sign", null, undefined]) assert.equal(isBlockedEmail(e as string), false, String(e));
// Added in Admin
assert.equal(isBlockedEmail("x@temp-mail.example", ["temp-mail.example"]), true);
assert.equal(isBlockedIn("x@sub.temp-mail.example", ["temp-mail.example"]), true);
// Cleaning what an admin types
assert.equal(cleanDomain(" Mail.Temp-Mail.EXAMPLE. "), "mail.temp-mail.example");
assert.equal(cleanDomain("@kuku.lu"), "kuku.lu");
assert.equal(cleanDomain("https://kuku.lu/inbox"), "kuku.lu");
for (const bad of ["", "nodot", "a..b", "-x.com", "x.c", "x .com", "*.com"]) assert.equal(cleanDomain(bad), "", bad);
// The regex firestore.rules uses agrees with the code (rules match the whole lowercased email)
const re = new RegExp(`^${blocklistRegex(["petchi.uk", "temp-mail.example"])}$`);
for (const e of ["a@petchi.uk", "a@x.petchi.uk", "a@temp-mail.example", "a@b.temp-mail.example", "a@petchi.uk."]) assert.ok(re.test(e), e);
for (const e of ["a@gmail.com", "a@notpetchi.uk", "a@petchi.uk.ng", "a@temp-mailxexample", "a@temp-mail.example.com"]) assert.ok(!re.test(e), e);
assert.equal(blocklistRegex([]), "^$");
console.log("ALL OK");
