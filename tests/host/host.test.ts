// Host helpers (lib/host.ts): links to the main site follow the domain being viewed, never a written-in domain (owner, 2 Nov 2026:
// "by notesapp was hard coded on prep.naapp.tech"). Run: npm run test:host → "HOST OK". Runs with the primary address unset
// (notesapp.name.ng) and with NEXT_PUBLIC_ROOT_DOMAIN=naapp.tech (the script runs both).
import assert from "node:assert/strict";
import { MAIN_HOST, ROOT_DOMAIN, familyHost, isPrepHost, mainSiteUrl, ourRoot, roleOf } from "../../lib/host";

const primary = `https://${MAIN_HOST}`;
assert.equal(MAIN_HOST, `www.${ROOT_DOMAIN}`);

// Exam Prep's "by NotesApp", Terms and Privacy: the main site of the family being viewed.
assert.equal(mainSiteUrl("prep.naapp.tech"), "https://www.naapp.tech");
assert.equal(mainSiteUrl("prep.naapp.tech", "/terms"), "https://www.naapp.tech/terms");
assert.equal(mainSiteUrl("PREP.NAAPP.TECH:443", "privacy"), "https://www.naapp.tech/privacy", "case, port and a path without its slash");
assert.equal(mainSiteUrl("prep.notesapp.name.ng"), "https://www.notesapp.name.ng");
assert.equal(mainSiteUrl("prep.notesapp.name.ng", "/terms"), "https://www.notesapp.name.ng/terms");
// Member sites previewed on our domains: the same family.
assert.equal(mainSiteUrl("www.naapp.tech"), "https://www.naapp.tech");
assert.equal(mainSiteUrl("naapp.tech"), "https://www.naapp.tech");
assert.equal(mainSiteUrl("life.notesapp.name.ng"), "https://www.notesapp.name.ng");
// Everything else: the primary address from the setting.
for (const h of ["localhost:3290", "127.0.0.1:3000", "notesapp-git-x.vercel.app", "shop.brand.com", "brand.com.ng", "", null, undefined]) {
  assert.equal(mainSiteUrl(h), primary, `${h} → the primary address`);
}
assert.equal(mainSiteUrl("localhost:3290", "/terms"), `${primary}/terms`);
assert.equal(mainSiteUrl("notesapp.ng"), primary, "the short app domain's main site is the primary one");
assert.equal(mainSiteUrl("app.notesapp.ng", "/terms"), `${primary}/terms`);

// The family helpers it builds on.
assert.deepEqual(ourRoot("prep.naapp.tech"), { root: "naapp.tech", sub: "prep" });
assert.equal(roleOf(ourRoot("prep.naapp.tech")!), "prep");
assert.equal(isPrepHost("prep.notesapp.name.ng"), true);
assert.equal(isPrepHost("www.naapp.tech"), false);
assert.equal(familyHost("prep.naapp.tech", "main"), "www.naapp.tech");
assert.equal(familyHost("www.notesapp.name.ng", "prep"), "prep.notesapp.name.ng");
assert.equal(familyHost("localhost:3290", "main"), "localhost:3290", "one host locally (middleware); mainSiteUrl differs on purpose");

console.log(`HOST OK (primary ${ROOT_DOMAIN})`);
