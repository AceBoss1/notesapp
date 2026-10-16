// Weekly digest (lib/digest.ts, lib/digest-server.ts) against the Firestore emulator. Run: npm run test:digest → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
process.env.EMAIL_LINK_SECRET = "test-secret";
import { buildDigest, digestToken, digestWanted, digestWeek, setDigestWanted, validDigestToken, weekPool } from "../../lib/digest-server";
import { pickStories, renderDigestHtml, renderDigestText, type PoolStory } from "../../lib/digest";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  // when: Sunday 5 PM Lagos = 16:00 UTC
  const sun = Date.UTC(2026, 9, 18, 16, 0);
  assert.equal(digestWeek(new Date(sun)).startsAt, sun); assert.equal(digestWeek(new Date(sun)).id, "2026-10-18");
  assert.equal(digestWeek(new Date(sun + 3_600_000 * 30)).startsAt, sun, "Monday evening still belongs to Sunday's run");
  assert.equal(digestWeek(new Date(sun - 60_000)).startsAt, sun - 7 * 86_400_000, "a minute early is last week's");

  // links
  const t = digestToken("u_ada");
  assert.ok(validDigestToken("u_ada", t)); assert.ok(!validDigestToken("u_bola", t)); assert.ok(!validDigestToken("u_ada", t.slice(1) + "x"));

  // choosing
  const base = { summary: "", href: "", image: null, writerAvatar: "", readMinutes: 3, comments: 0, premium: false, publishedAt: "2026-10-15T10:00:00Z" };
  const pool: PoolStory[] = [
    { ...base, id: "1", authorUid: "u_x", authorUsername: "x", title: "Popular", writerName: "X", likes: 900, tags: [] },
    { ...base, id: "2", authorUid: "u_f", authorUsername: "followed", title: "From someone I follow", writerName: "F", likes: 1, tags: [] },
    { ...base, id: "3", authorUid: "u_y", authorUsername: "y", title: "Matches my interest", writerName: "Y", likes: 5, tags: ["#Fintech"] },
    { ...base, id: "4", authorUid: "u_me", authorUsername: "me", title: "My own", writerName: "Me", likes: 5000, tags: [] },
  ];
  const picked = pickStories(pool, { uid: "u_me", follows: new Set(["followed"]), interests: ["fintech"] });
  assert.deepEqual(picked.map((s) => s.id), ["2", "3", "1"]);

  // the week's journals and one member's email
  const now = new Date("2026-10-18T16:05:00Z");
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada Obi", avatar: "/images/headshots/default-avatar.png", interests: ["design"] });
  await db.doc("users/u_writer").set({ username: "writer", displayName: "Tola Writer", avatar: "https://media.example.com/t.jpg" });
  await db.doc("follows/u_ada_writer").set({ followerUid: "u_ada", username: "writer" });
  await db.doc("notes/n1").set({ status: "published", date: "2026-10-16T09:00:00Z", slug: "pay-gap", title: "Minding the pay gap", content: "**Bold** opening of the post with [a link](https://x.y) and more words.", author: "Precheks", authorUid: "u_org", authorUsername: "precheks", writerUid: "u_writer", likeCount: 3, tags: ["design"] });
  await db.doc("notes/n1/comments/c1").set({ content: "hi" });
  await db.doc("notes/n2").set({ status: "draft", date: "2026-10-16T09:00:00Z", slug: "draft", title: "Draft", content: "x", author: "A" });
  await db.doc("notes/n3").set({ status: "published", date: "2026-10-01T09:00:00Z", slug: "old", title: "Too old", content: "x", author: "A" });
  const week = await weekPool(db, now);
  assert.deepEqual(week.map((s) => s.id), ["n1"]);
  assert.equal(week[0].comments, 1); assert.equal(week[0].writerName, "Tola Writer"); assert.equal(week[0].inName, "Precheks");
  assert.match(week[0].summary, /^Bold opening of the post with a link and more words\.$/);
  const d = await buildDigest(db, "u_ada", week);
  assert.ok(d); assert.equal(d!.reader.name, "Ada Obi"); assert.match(d!.reader.avatar, /^https:\/\/www\..+\/images\/headshots\/default-avatar\.png$/);
  assert.match(d!.unsubscribeUrl, /\/api\/digest\/unsubscribe\?u=u_ada&t=/);
  const html = renderDigestHtml(d!);
  assert.ok(html.includes("Stories for <strong>Ada Obi</strong>") && html.includes("Tola Writer <span") && html.includes("Minding the pay gap"));
  assert.ok(renderDigestText(d!).includes("Unsubscribe from the weekly digest: "));
  assert.equal(await buildDigest(db, "u_writer", []), null, "nothing to read, nothing sent");

  // the choice
  assert.equal(await digestWanted(db, "u_ada"), true);
  await setDigestWanted(db, "u_ada", false, "link"); assert.equal(await digestWanted(db, "u_ada"), false);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
