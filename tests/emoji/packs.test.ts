// Emoji packs (lib/emoji-packs.ts): codes are unique and read back, every drawing exists, and only the free packs are free.
// Run: npm run test:emoji
import assert from "node:assert/strict";
import { EMOJI_PACKS, PACK_EMOJI, lockedPackIn, packUnlocked } from "../../lib/emoji-packs";
import { AFRICA_DRAWINGS } from "../../lib/africa-drawings";
import { NOTESAPP_EMOJI, emojiAsText, isNotesAppEmoji, isReaction, packCodesIn } from "../../lib/messages-rules";

const codes = EMOJI_PACKS.flatMap((p) => p.emojis.map((e) => e.code));
assert.equal(new Set(codes).size, codes.length, "every code is used once");
for (const p of EMOJI_PACKS) {
  assert.ok(p.emojis.length >= 20, `${p.name} has a full grid`);
  for (const e of p.emojis) {
    assert.match(e.code, /^:x-[a-z0-9-]+:$/, `${e.code} looks like a code`);
    assert.ok(!!e.drawing !== !!e.glyph, `${e.code} is a drawing or a glyph`);
    if (e.drawing) assert.ok(AFRICA_DRAWINGS[e.drawing], `${e.code}'s drawing exists`);
    if (e.glyph && !e.flag) assert.ok(!e.glyph.includes("\uFE0F"), `${e.code} has no colour selector`);
    assert.ok(isNotesAppEmoji(e.code), `${e.code} is one of ours`);
    assert.deepEqual(packCodesIn(`hi ${e.code}!`), [e.code], `${e.code} is found in text`);
  }
}
assert.equal(Object.keys(PACK_EMOJI).length, codes.length);
assert.ok(NOTESAPP_EMOJI[":na:"] && isNotesAppEmoji(":academy:"), "the #NotesApp three are still there");
for (const k of ["talkingDrum", "ogene", "agogo", "beninHead", "igboUkwuVase", "nokFigure", "lantern", "nigeria", "ghana", "kenya", "southAfrica", "egypt"])
  assert.ok(PACK_EMOJI[`:x-${k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}:`], `${k} is in the Afro culture pack`);

assert.equal(emojiAsText("Bring the :x-talking-drum: and :x-grin:"), "Bring the Talking drum and Grin", "text-only places read the labels");
assert.equal(emojiAsText("odd :x-nothing: stays"), "odd :x-nothing: stays", "an unknown code is left as typed");

// Free packs for everyone; the rest with Pro and above.
const culture = EMOJI_PACKS.find((p) => p.id === "culture")!, summer = EMOJI_PACKS.find((p) => p.id === "summer")!;
assert.ok(packUnlocked(culture, "standard") && packUnlocked(culture, undefined));
assert.ok(!packUnlocked(summer, "standard") && !packUnlocked(summer, "basic"));
for (const t of ["pro", "business", "enterprise"] as const) assert.ok(packUnlocked(summer, t), `${t} unlocks Summer`);
assert.equal(lockedPackIn("hello :x-grin: :x-talking-drum:", "standard", packCodesIn), null, "free packs send on any plan");
assert.equal(lockedPackIn("beach day :x-beach:", "standard", packCodesIn)?.name, "Summer", "a paid pack is named when locked");
assert.equal(lockedPackIn("beach day :x-beach:", "pro", packCodesIn), null, "Pro sends it");

// Reactions: free pack emojis yes, paid pack emojis no.
assert.ok(isReaction(":x-grin:") && isReaction(":x-ogene:") && isReaction(":na:") && isReaction("👍"));
assert.ok(!isReaction(":x-pumpkin:"), "paid pack emojis aren't reactions");
console.log("EMOJI PACKS OK");
