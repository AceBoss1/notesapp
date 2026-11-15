// Throwaway email domains (lib/email-blocklist.ts). Run: npm run test:email-blocklist
import assert from "node:assert/strict";
import { emailDomain, isBlockedEmail } from "../../lib/email-blocklist";

assert.equal(emailDomain(" Ada@Petchi.UK "), "petchi.uk");
for (const e of ["ada@petchi.uk", "ADA@PETCHI.UK", "x@mail.petchi.uk", "x@a.b.petchi.uk", "x@petchi.uk."]) assert.equal(isBlockedEmail(e), true, e);
for (const e of ["ada@gmail.com", "x@notpetchi.uk", "x@petchi.uk.ng", "x@petchi.co.uk", "", "no-at-sign", null, undefined]) assert.equal(isBlockedEmail(e as string), false, String(e));
console.log("ALL OK");
