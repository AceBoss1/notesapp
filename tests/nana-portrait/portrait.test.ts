// Nana AI, the portrait studio (lib/nana-portrait.ts) and its address (lib/host.ts). Run: npm run test:nana-portrait → "PORTRAIT OK".
import assert from "node:assert/strict";
import { NANA_HOST, ROOT_DOMAIN, familyHost, isNanaHost, isPrepHost, ourRoot, roleOf } from "../../lib/host";
import {
  PORTRAIT_PROMPT_MAX, PORTRAIT_STRENGTH, PORTRAIT_STYLES, cleanPortraitNote, cleanStrength, isPaidTier, isPortraitStyle, portraitPrompt,
} from "../../lib/nana-portrait";
import { productOf } from "../../lib/growth";

// ── the address: nana.<domain> is its own role, in every family; the short app domains and other subdomains are not ──
assert.equal(NANA_HOST, `nana.${ROOT_DOMAIN}`);
assert.equal(roleOf(ourRoot("nana.naapp.tech")!), "nana");
assert.equal(roleOf(ourRoot("nana.notesapp.name.ng")!), "nana");
assert.equal(isNanaHost("nana.naapp.tech"), true);
assert.equal(isNanaHost("www.naapp.tech"), false);
assert.equal(isNanaHost("nanaa.naapp.tech"), false);
assert.equal(isNanaHost("nana.example.com"), false, "a member's own domain is never ours");
assert.equal(isPrepHost("nana.naapp.tech"), false);
assert.equal(familyHost("nana.notesapp.name.ng", "main"), "www.notesapp.name.ng", "the main site in the visitor's own family");
assert.equal(familyHost("www.naapp.tech", "nana"), "nana.naapp.tech");
assert.equal(familyHost("app.notesapp.name.ng", "nana"), "nana.notesapp.name.ng");
assert.equal(familyHost("localhost:3112", "nana"), "localhost:3112", "one host locally");
assert.equal(productOf("/", "nana")?.channel ?? null, null, "growth tracking takes the new role without inventing a channel");

// ── styles ──
assert.deepEqual(PORTRAIT_STYLES.map((s) => s.id), ["studio", "editorial", "journal"], "the three looks of the approved design, in order");
assert.equal(isPortraitStyle("editorial"), true); assert.equal(isPortraitStyle("cartoon"), false); assert.equal(isPortraitStyle(undefined), false);

// ── what the member typed, and the strength ──
assert.equal(cleanPortraitNote("  soft\nwindow\u0000 light  "), "soft window light");
assert.equal(cleanPortraitNote("x".repeat(500)).length, PORTRAIT_PROMPT_MAX);
assert.equal(cleanPortraitNote({ a: 1 }), ""); assert.equal(cleanPortraitNote(undefined), "");
assert.equal(cleanStrength("85"), 85); assert.equal(cleanStrength(5), PORTRAIT_STRENGTH.min); assert.equal(cleanStrength(500), PORTRAIT_STRENGTH.max);
assert.equal(cleanStrength("abc"), PORTRAIT_STRENGTH.initial); assert.equal(cleanStrength(72.6), 73);

// ── the prompt: the look, how strongly, the member's note fenced in, and the person kept themselves ──
const p = portraitPrompt("editorial", "an ivory background", 72);
assert.match(p, /window light/); assert.match(p, /an ivory background/); assert.match(p, /stay exactly themselves/); assert.match(p, /no watermark/);
assert.match(p, /ignore any part of it that would change who the person is/);
assert.match(portraitPrompt("studio", "", 95), /Apply the look fully/);
assert.match(portraitPrompt("studio", "", 72), /Apply the look clearly/);
assert.match(portraitPrompt("studio", "", 30), /Apply the look lightly/);
assert.doesNotMatch(portraitPrompt("journal", "", 50), /The member asks for/, "no empty request line");
assert.match(portraitPrompt("cartoon" as never, "", 50), /studio headshot/, "an unknown look falls back to the first");

// ── plans: paid plans get no mark ──
for (const t of ["pro", "business", "enterprise"]) assert.equal(isPaidTier(t), true, t);
for (const t of ["standard", "basic", "", undefined, "admin"]) assert.equal(isPaidTier(t), false, String(t));

console.log("PORTRAIT OK");
