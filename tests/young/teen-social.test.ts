// Teen mode on Moments and Notes Life (lib/young.ts, v0.121.0). Run: npm run test:young-social → "ALL OK".
import assert from "node:assert/strict";
import {
  MENTION_BLOCKED, REPLY_BLOCKED, RESHARE_BLOCKED, TEEN_INVITEE, firstName, hearsOnlyFromFollowed, inviteeShown, keptOffLists, lifeRowShown, mayReach, mayReshare, teenAudience,
} from "../../lib/young";

const adult = {}, teen = { teen: true }, kept = { keepRepliesFollowers: true }, hidden = { keepHidden: true }, kid = { teen: true, kid: true };

// Who is protected: teen mode (child profiles carry teen: true too), or replies kept to followers on turning 18
assert.equal(hearsOnlyFromFollowed(teen), true); assert.equal(hearsOnlyFromFollowed(kid), true); assert.equal(hearsOnlyFromFollowed(kept), true);
assert.equal(hearsOnlyFromFollowed(adult), false); assert.equal(hearsOnlyFromFollowed(null), false); assert.equal(hearsOnlyFromFollowed(undefined), false);
assert.equal(hearsOnlyFromFollowed({ teen: "true" }), false, "only a real true");
assert.equal(hearsOnlyFromFollowed(hidden), false, "keepHidden is about lists, not who can reply");

// Replies and @mentions: only from someone the teen follows
assert.equal(mayReach({ target: teen, self: false, targetFollowsThem: false }), false, "a stranger can't reply to or mention a teen");
assert.equal(mayReach({ target: teen, self: false, targetFollowsThem: true }), true, "someone the teen follows can");
assert.equal(mayReach({ target: kept, self: false, targetFollowsThem: false }), false, "kept on turning 18");
assert.equal(mayReach({ target: adult, self: false, targetFollowsThem: false }), true, "adults: anyone");
assert.equal(mayReach({ target: teen, self: true, targetFollowsThem: false }), true, "yourself");

// A teen's moments: themselves and people they follow back, never anyone signed out
assert.equal(teenAudience({ signedIn: true, self: false, viewerFollows: true, followsViewer: true }), true);
assert.equal(teenAudience({ signedIn: true, self: false, viewerFollows: true, followsViewer: false }), false, "a follower the teen doesn't follow back");
assert.equal(teenAudience({ signedIn: true, self: false, viewerFollows: false, followsViewer: true }), false, "someone the teen follows who doesn't follow them");
assert.equal(teenAudience({ signedIn: true, self: true, viewerFollows: false, followsViewer: false }), true, "the teen");
assert.equal(teenAudience({ signedIn: false, self: false, viewerFollows: true, followsViewer: true }), false, "never signed out");

// Reshares: never of a teen's moment
assert.equal(mayReshare(teen), false); assert.equal(mayReshare(kept), false); assert.equal(mayReshare(adult), true);

// The words the stopped person sees
assert.equal(firstName({ displayName: "Ada Obi", username: "ada" }), "Ada"); assert.equal(firstName({ username: "ada" }), "ada"); assert.equal(firstName(null), "This");
assert.match(REPLY_BLOCKED("Ada"), /^Only people Ada follows can reply/);
assert.match(MENTION_BLOCKED("ada"), /^@ada only hears from people they follow/);
assert.match(RESHARE_BLOCKED, /can't be reshared/);

// Notes Life lists: teen mode and keepHidden keep a player off, except for themselves and people they follow back
assert.equal(keptOffLists(teen), true); assert.equal(keptOffLists(hidden), true); assert.equal(keptOffLists(kept), false); assert.equal(keptOffLists(adult), false);
assert.equal(lifeRowShown({ user: adult, self: false, viewerFollows: false, followsViewer: false }), true, "adults are on the list for everyone");
assert.equal(lifeRowShown({ user: teen, self: false, viewerFollows: false, followsViewer: false }), false, "a teen isn't, for strangers");
assert.equal(lifeRowShown({ user: teen, self: false, viewerFollows: true, followsViewer: false }), false, "nor for a follower they don't follow back");
assert.equal(lifeRowShown({ user: teen, self: false, viewerFollows: true, followsViewer: true }), true, "but is for people they follow back");
assert.equal(lifeRowShown({ user: hidden, self: true, viewerFollows: false, followsViewer: false }), true, "and for themselves");

// Invite list: a teen who doesn't follow the inviter shows without name, picture or id
const row = { uid: "u1", username: "tolu", name: "Tolu", avatar: "a.webp", joinedAt: 1, status: "paid" as const };
assert.deepEqual(inviteeShown(row, adult, false, "hidden-0"), row);
assert.deepEqual(inviteeShown(row, teen, true, "hidden-0"), row, "they follow you: shown");
assert.deepEqual(inviteeShown(row, teen, false, "hidden-0"), { ...row, uid: "hidden-0", username: "", name: TEEN_INVITEE, avatar: "" }, "status and date stay, so the invite still counts");
console.log("ALL OK");
