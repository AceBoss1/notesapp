// Masking members' contact details in admin pages (lib/pii.ts). Run: npm run test:pii → "ALL OK".
import assert from "node:assert/strict";
import { isRevealKind, maskContacts, maskEmail, maskPhone, revealReason } from "../../lib/pii";

assert.equal(maskEmail("adaeze.okafor@gmail.com"), "a•••r@gmail.com");
assert.equal(maskEmail("Jo@company.ng"), "J•••@company.ng", "two letters: only the first shows");
assert.equal(maskEmail("x@y.com"), "x•••@y.com");
assert.equal(maskEmail("  a.b@c.d  "), "a•••b@c.d", "trimmed");
assert.equal(maskEmail("not-an-email"), "•••");
assert.equal(maskEmail(""), ""); assert.equal(maskEmail(undefined), "");

assert.equal(maskPhone("+234 803 123 4567"), "••• ••• 4567");
assert.equal(maskPhone("08031234567"), "••• ••• 4567");
assert.equal(maskPhone("123"), "••••");
assert.equal(maskPhone(""), "");

// Every email and phone, at any depth and under any …Email / …Phone name; nothing else changes.
const order = { reference: "r1", email: "buyer@mail.com", amountKobo: 500000, address: { fullName: "Ada Obi", phone: "08031234567", street: "1 Marina" }, holders: [{ holderPhone: "07012345678", name: "Rider" }], buyerEmail: "b2@x.ng", emailVerified: true, createdAt: "2026-10-24" };
assert.deepEqual(maskContacts(order), { reference: "r1", email: "b•••r@mail.com", amountKobo: 500000, address: { fullName: "Ada Obi", phone: "••• ••• 4567", street: "1 Marina" }, holders: [{ holderPhone: "••• ••• 5678", name: "Rider" }], buyerEmail: "b•••@x.ng", emailVerified: true, createdAt: "2026-10-24" });
assert.deepEqual(maskContacts([{ email: "a@b.c" }, null, 3]), [{ email: "a•••@b.c" }, null, 3]);
assert.equal(order.email, "buyer@mail.com", "the original is left alone");

assert.equal(revealReason("Payment or refund", ""), "Payment or refund");
assert.equal(revealReason("Replying to them", " ticket 42 "), "Replying to them: ticket 42");
assert.equal(revealReason("Other", "abc"), null, "Other needs a few words");
assert.equal(revealReason("Other", "court order 7"), "Other: court order 7");
assert.equal(revealReason("Because", ""), null);
assert.equal(revealReason(undefined, "x"), null);

assert.ok(isRevealKind("member-email")); assert.ok(!isRevealKind("toString")); assert.ok(!isRevealKind("bank"));
console.log("ALL OK");
