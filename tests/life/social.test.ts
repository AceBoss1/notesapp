// Notes Life on the rest of NotesApp (lib/life/social.ts). Run: npm run test:life-social → "ALL OK".
import assert from "node:assert/strict";
import { cardTurn, canShowPlayer, hideCard, lifePrivacyOf, LIFE_CARD_PER_DAY } from "../../lib/life/social";

// the card: at most twice a day, a new day starts again, ✕ hides it for a week
let s = cardTurn(null, "2026-10-22T08:00:00.000Z");
assert.equal(s.show, true);
s = cardTurn(s.next, "2026-10-22T12:00:00.000Z"); assert.equal(s.show, true);
s = cardTurn(s.next, "2026-10-22T20:00:00.000Z"); assert.equal(s.show, false, `only ${LIFE_CARD_PER_DAY} a day`);
s = cardTurn(s.next, "2026-10-23T07:00:00.000Z"); assert.equal(s.show, true, "a new day");
const hidden = hideCard(s.next, "2026-10-23T07:05:00.000Z");
assert.equal(cardTurn(hidden, "2026-10-29T07:00:00.000Z").show, false, "hidden for a week");
assert.equal(cardTurn(hidden, "2026-10-30T08:00:00.000Z").show, true, "back after a week");

// privacy: both on by default, off when switched off, always off in teen mode
assert.deepEqual(lifePrivacyOf({}), { teen: false, lifeShow: true, lifeCard: true });
assert.deepEqual(lifePrivacyOf({ lifeShow: false }), { teen: false, lifeShow: false, lifeCard: true });
assert.deepEqual(lifePrivacyOf({ teen: true, lifeShow: true, lifeCard: true }), { teen: true, lifeShow: false, lifeCard: false });

// "Plays Notes Life" shows only between people who follow each other, with the player's switch on, and nobody in teen mode
const adult = lifePrivacyOf({}), teen = lifePrivacyOf({ teen: true }), hiding = lifePrivacyOf({ lifeShow: false });
assert.equal(canShowPlayer({ viewer: adult, player: adult, mutual: true, plays: true }), true);
assert.equal(canShowPlayer({ viewer: adult, player: adult, mutual: false, plays: true }), false, "only mutual follows");
assert.equal(canShowPlayer({ viewer: adult, player: hiding, mutual: true, plays: true }), false, "their switch is off");
assert.equal(canShowPlayer({ viewer: teen, player: adult, mutual: true, plays: true }), false, "not shown to a teen");
assert.equal(canShowPlayer({ viewer: adult, player: teen, mutual: true, plays: true }), false, "never about a teen");
assert.equal(canShowPlayer({ viewer: null, player: adult, mutual: true, plays: true }), false, "signed out sees nothing");
assert.equal(canShowPlayer({ viewer: adult, player: adult, mutual: true, plays: false }), false);
console.log("ALL OK");
