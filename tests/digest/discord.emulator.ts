// Changelog → Discord #announcements (lib/discord.ts) against the Firestore emulator. Part of npm run test:digest → "DISCORD OK".
import assert from "node:assert/strict";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { announceReleases, isDiscordWebhook, releaseMessage } from "../../lib/discord";
import type { Release } from "../../lib/changelog";
if (!getApps().length) initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const URL_OK = "https://discord.com/api/webhooks/123456/abc_DEF-ghi";
const rel = (v: string, text = "Something new"): Release => ({ version: v, bump: "minor", date: "2026-10-17", changes: [{ kind: "added", text }, { kind: "fixed", text: "A fix" }] });
(async () => {
  assert.ok(isDiscordWebhook(URL_OK));
  assert.ok(!isDiscordWebhook("https://evil.com/api/webhooks/1/x")); assert.ok(!isDiscordWebhook("http://discord.com/api/webhooks/1/x")); assert.ok(!isDiscordWebhook(""));
  const m = releaseMessage(rel("v1.0.0"), "https://www.notesapp.name.ng");
  assert.equal(m.embeds[0].title, "#NotesApp v1.0.0"); assert.equal(m.embeds[0].url, "https://www.notesapp.name.ng/changelog");
  assert.match(m.embeds[0].description, /\*\*✨ Added:\*\* Something new\n\n\*\*🛠 Fixed:\*\* A fix/); assert.deepEqual(m.allowed_mentions.parse, []);
  assert.ok(releaseMessage(rel("v9", "x".repeat(5000))).embeds[0].description.length <= 3950, "kept under Discord's limit");

  const posts: string[] = [];
  const post = async (_u: string, body: unknown) => { posts.push((body as { embeds: { title: string }[] }).embeds[0].title); };
  // no webhook set (or not a Discord one): nothing
  assert.deepEqual(await announceReleases(db, post, [rel("v0.45.0")], ""), []);
  assert.deepEqual(await announceReleases(db, post, [rel("v0.45.0")], "https://example.com/x"), []);
  // first run: only the newest, not the history
  const list = [rel("v0.45.0"), rel("v0.44.0"), rel("v0.43.0")];
  assert.deepEqual(await announceReleases(db, post, list, URL_OK), ["v0.45.0"]);
  assert.deepEqual(await announceReleases(db, post, list, URL_OK), [], "never twice");
  // later releases: oldest first, at most three a run
  const later = [rel("v0.50.0"), rel("v0.49.0"), rel("v0.48.0"), rel("v0.47.0"), rel("v0.46.0"), ...list];
  assert.deepEqual(await announceReleases(db, post, later, URL_OK), ["v0.46.0", "v0.47.0", "v0.48.0"]);
  assert.deepEqual(await announceReleases(db, post, later, URL_OK), ["v0.49.0", "v0.50.0"]);
  assert.deepEqual(posts, ["#NotesApp v0.45.0", "#NotesApp v0.46.0", "#NotesApp v0.47.0", "#NotesApp v0.48.0", "#NotesApp v0.49.0", "#NotesApp v0.50.0"]);
  // Discord down: nothing is marked, so the next run tries again
  const next = [rel("v0.51.0"), ...later];
  await assert.rejects(announceReleases(db, async () => { throw new Error("Discord answered 500"); }, next, URL_OK), /500/);
  assert.deepEqual(await announceReleases(db, post, next, URL_OK), ["v0.51.0"]);
  console.log("DISCORD OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
