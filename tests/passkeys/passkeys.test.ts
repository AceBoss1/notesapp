// Passkeys, the pure rules (lib/passkeys.ts): which domain family a passkey belongs to, which origins may use it, names.
// Run: npm run test:passkeys → "ALL OK" (twice: the pure rules, then the emulator test).
import assert from "node:assert/strict";
import { cleanName, deviceLabel, originAllowed, rpIdFor } from "../../lib/passkeys";

// One RP ID per domain family; members' own domains and unknown hosts get none.
assert.equal(rpIdFor("www.naapp.tech"), "naapp.tech");
assert.equal(rpIdFor("app.naapp.tech"), "naapp.tech");
assert.equal(rpIdFor("life.notesapp.name.ng"), "notesapp.name.ng");
assert.equal(rpIdFor("prep.notesapp.name.ng:443"), "notesapp.name.ng");
assert.equal(rpIdFor("WWW.NAAPP.TECH."), "naapp.tech");
assert.equal(rpIdFor("localhost:3000"), "localhost");
assert.equal(rpIdFor("notesapp-git-x.vercel.app"), "notesapp-git-x.vercel.app");
assert.equal(rpIdFor("www.precheks.com.ng"), null);
assert.equal(rpIdFor(""), null);
assert.equal(rpIdFor(undefined), null);

// Origins: https on the RP ID or a subdomain of it; http only on localhost.
assert.equal(originAllowed("https://www.naapp.tech", "naapp.tech"), true);
assert.equal(originAllowed("https://naapp.tech", "naapp.tech"), true);
assert.equal(originAllowed("https://life.naapp.tech", "naapp.tech"), true);
assert.equal(originAllowed("http://www.naapp.tech", "naapp.tech"), false);
assert.equal(originAllowed("https://evilnaapp.tech", "naapp.tech"), false);
assert.equal(originAllowed("https://naapp.tech.evil.com", "naapp.tech"), false);
assert.equal(originAllowed("https://www.notesapp.name.ng", "naapp.tech"), false);
assert.equal(originAllowed("http://localhost:3000", "localhost"), true);
assert.equal(originAllowed("not a url", "naapp.tech"), false);
assert.equal(originAllowed(null, "naapp.tech"), false);

// Names.
assert.equal(cleanName("  My   phone "), "My phone");
assert.equal(cleanName(""), "Passkey");
assert.equal(cleanName(42, "Mac"), "Mac");
assert.equal(cleanName("x".repeat(60)).length, 40);
assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "iPhone");
assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-A145F)"), "Android phone");
assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "Windows computer");
assert.equal(deviceLabel(null), "Passkey");

console.log("ALL OK");
