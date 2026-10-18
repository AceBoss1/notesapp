// The journal author backfill's decisions (lib/backfills.ts). Run: npx -y tsx tests/authors/backfill.test.ts → "ALL OK".
import assert from "node:assert/strict";
import { planBackfill, type Lookups } from "../../lib/backfills";

const users = [{ uid: "u_emma", username: "emmanuel", displayName: "Emmanuel Adams" }, { uid: "u_ada", username: "ada", displayName: "Ada Obi" }, { uid: "u_ada2", username: "ada2", displayName: "Ada Obi" }, { uid: "u_tola", username: "tola", displayName: "Tola" }];
const l: Lookups = {
  uidOfUsername: async (u) => users.find((x) => x.username === u)?.uid ?? null,
  usernameOfUid: async (uid) => users.find((x) => x.uid === uid)?.username ?? null,
  byDisplayName: async (n) => users.filter((x) => x.displayName === n).map(({ uid, username }) => ({ uid, username })),
};
(async () => {
  // a founder's post published by an admin under the founder's name
  assert.deepEqual((await planBackfill({ author: "Emmanuel Adams" }, l)).set, { authorUsername: "emmanuel", authorUid: "u_emma" });
  // a self-published post that has its uid but not its username
  assert.deepEqual((await planBackfill({ author: "Tola T", authorUid: "u_tola" }, l)).set, { authorUsername: "tola" });
  // already complete: nothing to do
  assert.deepEqual((await planBackfill({ author: "x", authorUid: "u_tola", authorUsername: "tola" }, l)).set, {});
  // the @na-notesapp channel: a username, no account id
  assert.deepEqual((await planBackfill({ author: "NotesApp" }, l)).set, { authorUsername: "na-notesapp" });
  // two accounts share a name: left for a person
  const twin = await planBackfill({ author: "Ada Obi" }, l);
  assert.deepEqual(twin.set, {}); assert.match(twin.unsure[0], /matches 2 accounts/);
  // co-authors get their ids where the name is unique
  const co = await planBackfill({ author: "Tola", authorUid: "u_tola", authorUsername: "tola", coAuthors: ["Emmanuel Adams", "Ada Obi"] }, l);
  assert.deepEqual(co.set, { coAuthorUids: ["u_emma"] }); assert.equal(co.unsure.length, 1);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
