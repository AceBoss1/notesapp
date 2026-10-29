// Country suggestions while typing (lib/country-suggest.ts) and the Flags pack.
// Run: npm run test:emoji
import assert from "node:assert/strict";
import { COUNTRIES, flagOf } from "../../lib/countries";
import { applyOffer, countriesAt, offersFor } from "../../lib/country-suggest";
import { NOTESAPP_EMOJI } from "../../lib/messages-rules";

const at = (s: string) => countriesAt(s, s.length).map((m) => m.country.code);
assert.equal(COUNTRIES.filter((c) => /^(NG|GH|KE|ZA|EG|DZ|AO|BJ|BW|BF|BI|CV|CM|CF|TD|KM|CG|CD|CI|DJ|GQ|ER|SZ|ET|GA|GM|GN|GW|LS|LR|LY|MG|MW|ML|MR|MU|MA|MZ|NA|NE|RW|ST|SN|SC|SL|SO|SS|SD|TZ|TG|TN|UG|ZM|ZW)$/.test(c.code)).length, 54, "all 54 African countries");
assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length, "no country twice");
assert.equal(flagOf("ng"), "🇳🇬");
for (const c of COUNTRIES) assert.ok(NOTESAPP_EMOJI[`:x-flag-${c.code.toLowerCase()}:`], `${c.name} has a flag emoji`);

assert.deepEqual(at("I love Nigeria"), ["NG"], "a whole name");
assert.ok(at("going to nig").includes("NG") && at("going to nig").includes("NE"), "a start of a name offers both Nigeria and Niger");
assert.deepEqual(at("Holiday in South Afr"), ["ZA"], "two words, longest first");
assert.deepEqual(at("from Naija"), ["NG"], "other names count");
assert.deepEqual(at("see you in GH"), ["GH"], "a code in capitals");
assert.deepEqual(at("we did it in ng"), [], "codes in small letters don't");
assert.deepEqual(at("see you in us"), [], "everyday words don't");
assert.deepEqual(at("ab"), [], "two letters of a name aren't enough");
assert.deepEqual(at("Côte d'Iv"), ["CI"], "accents and apostrophes");
assert.deepEqual(at("cote d'iv"), ["CI"], "without the accent too");
assert.deepEqual(countriesAt("Nigeria is great", 7).map((m) => m.country.code), ["NG"], "at the caret, not the end");
assert.deepEqual(countriesAt("Nigeriaa", 7), [], "not in the middle of a word");

const [ng] = countriesAt("I love Nigeria", 14);
assert.deepEqual(offersFor(ng).map((o) => o.kind), ["flag", "map"], "Nigeria has a flag and a map");
assert.deepEqual(applyOffer("I love Nigeria", ng, ":x-flag-ng:"), { text: "I love Nigeria :x-flag-ng: ", caret: 27 });
const [part] = countriesAt("Off to Gha", 10);
assert.equal(applyOffer("Off to Gha", part, ":x-flag-gh:").text, "Off to Ghana :x-flag-gh: ", "a short name is finished");
const [code] = countriesAt("Made in NG!", 11);
assert.equal(code, undefined, "punctuation after a code stops it");
const [code2] = countriesAt("Made in NG", 10);
assert.equal(applyOffer("Made in NG", code2, ":x-flag-ng:").text, "Made in :x-flag-ng: ", "a code is replaced");
const [ke] = countriesAt("Kenya", 5);
assert.equal(offersFor(ke)[1].emoji, ":x-kenya:");
const [fr] = countriesAt("France", 6);
assert.equal(offersFor(fr).length, 1, "no map, just the flag");
console.log("COUNTRY SUGGESTIONS OK");
