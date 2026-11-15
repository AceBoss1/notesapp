// Finding members on Admin → Users (lib/admin-user-search.ts). Run: npm run test:admin-users
import assert from "node:assert/strict";
import { duplicateMap, filterCounts, filterUsers, matchesQuery, needsAction } from "../../lib/admin-user-search";

const now = Date.parse("2026-11-15T12:00:00Z");
const u = (uid: string, displayName: string, extra: Record<string, unknown> = {}) => ({ uid, username: uid, displayName, createdAt: "2026-10-01T00:00:00Z", accountTier: "standard", ...extra }) as never;
const users = [
  u("ada", "Ada Okafor", { jobTitle: "CEO", workplace: "Okafor Foods", createdAt: "2026-11-12T00:00:00Z" }),
  u("chi", "Chioma Èze", { suspended: true, suspension: { appealStatus: "pending" }, accountTier: "pro" }),
  u("org1", "Lagos Bakers Ltd", { accountKind: "organisation", accountTier: "business" }),
  u("wale", "Wale Staff", { role: "staff" }),
  u("tola", "Tola Campus", { campusBadge: "ambassador", tierRequest: { status: "pending" } }),
  u("david1", "David", { jobTitle: "Teacher", workplace: "Kings College", industry: "education" }),
  u("david2", "David", { jobTitle: "teacher", workplace: "Kings College", industry: "education" }),
  u("david3", "David"),
];
const ctx = { emails: { ada: "a•••a@gmail.com", chi: "c•••i@yahoo.com" }, badgePending: new Set(["wale"]), duplicates: new Set(["david1", "david2"]), now };

// Search: name (accents ignored), @username prefix, uid, work, the visible part of the email.
assert.ok(matchesQuery(users[1], "chioma eze", ctx), "accents ignored");
assert.ok(matchesQuery(users[0], "@ad", ctx) && !matchesQuery(users[3], "@ad", ctx));
assert.ok(matchesQuery(users[0], "okafor foods", ctx));
assert.ok(matchesQuery(users[0], "gmail", ctx) && !matchesQuery(users[1], "gmail", ctx));
assert.ok(matchesQuery(users[2], "org1", ctx));
assert.ok(matchesQuery(users[0], "", ctx));

// Filters.
const ids = (q: Parameters<typeof filterUsers>[1]) => filterUsers(users, q, ctx).map((x) => (x as { uid: string }).uid);
assert.deepEqual(ids({ filter: "action" }).sort(), ["chi", "tola", "wale"], "appeal, Basic request, badge application");
assert.deepEqual(ids({ filter: "suspended" }), ["chi"]);
assert.deepEqual(ids({ filter: "organisations" }), ["org1"]);
assert.deepEqual(ids({ filter: "team" }), ["wale"]);
assert.deepEqual(ids({ filter: "campus" }), ["tola"]);
assert.deepEqual(ids({ filter: "new" }), ["ada"]);
assert.deepEqual(ids({ filter: "duplicates" }).sort(), ["david1", "david2"]);
assert.deepEqual(ids({ tier: "business" }), ["org1"]);
assert.equal(ids({ sort: "newest" })[0], "ada");
assert.equal(ids({ sort: "name", q: "david" }).length, 3);
assert.equal(ids({ sort: "name" })[0], "ada");
const counts = filterCounts(users, {}, ctx);
assert.equal(counts.all, 8); assert.equal(counts.action, 3); assert.equal(counts.suspended, 1);
assert.equal(filterCounts(users, { q: "david" }, ctx).duplicates, 2, "counts follow the search");
assert.ok(needsAction(users[1], ctx) && !needsAction(users[0], ctx));

// Possible duplicates: same sign-in email, or same name AND same work and field; never the name alone.
const head = (x: { jobTitle?: string; workplace?: string }) => [x.jobTitle, x.workplace].filter(Boolean).join(" at ").trim();
const dup = duplicateMap(users as never[], { ada: 1, wale: 1 }, head as never);
assert.deepEqual(dup.get("david1")!.map((d) => [(d.other as { uid: string }).uid, d.why]), [["david2", "same name and work as"]]);
assert.equal(dup.get("david3"), undefined, "the same name alone is not a duplicate");
assert.deepEqual(dup.get("ada")!.map((d) => [(d.other as { uid: string }).uid, d.why]), [["wale", "same email as"]]);

console.log("ADMIN USERS SEARCH OK");
