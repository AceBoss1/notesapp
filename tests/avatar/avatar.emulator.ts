// Nana's avatar maker on the Firestore emulator (lib/avatar-maker-server.ts): only the team on the staff test pass, the daily limit, a
// count that goes up only when a picture was kept, and the real mark drawn on a real picture. The image model and the bucket are
// stand-ins. Run: npm run test:avatar-server → "AVATAR SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const S = await import("../../lib/avatar-maker-server");
  const { AVATAR_PER_DAY, AvatarError, photoType } = await import("../../lib/avatar-maker");
  const { markAvatar } = await import("../../lib/avatar-render");
  const { ImageResponse } = await import("next/og");
  const React = (await import("react")).default;
  const refused = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof AvatarError && e.status === status && re.test(e.message));
  const now = new Date("2026-11-17T10:00:00Z");

  // a real picture for the stand-in image model to "draw": a plain blue square
  const drawn = Buffer.from(await new ImageResponse(React.createElement("div", { style: { display: "flex", width: 512, height: 512, background: "#3D5AFE" } }), { width: 512, height: 512 }).arrayBuffer());
  const photo = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 5)]);
  const kept: { key: string; bytes: Buffer; type: string }[] = [];
  let calls = 0, fail = false;
  const deps = (over: Partial<Parameters<typeof S.makeAvatar>[3] & object> = {}) => ({
    config: () => ({ provider: "openai" as const, key: "sk-test", model: "gpt-image-1" }),
    fetch: async () => { calls++; return fail ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({ data: [{ b64_json: drawn.toString("base64") }] }), { status: 200 }); },
    mark: markAvatar,
    store: async (key: string, bytes: Buffer, type: string) => { kept.push({ key, bytes, type }); return `https://media.test/${key}`; },
    ...over,
  });

  await db.doc("users/staff1").set({ username: "staff1", role: "staff" });
  await db.doc("users/member1").set({ username: "member1" });

  // ---- the pass is off: nobody, not even the team ----
  assert.deepEqual(await S.avatarStatus(db, "staff1", deps(), now), { open: false, ready: false, limit: 0, used: 0, left: 0, closed: (await import("../../lib/avatar-maker")).AVATAR_CLOSED });
  await refused(S.makeAvatar(db, "staff1", photo, deps(), now), 403, /being tested by the #NotesApp team/);
  assert.equal(calls, 0, "the image model is never called for someone who may not use it");

  // ---- the pass is on: the team, not other members ----
  await db.doc("serverConfig/staffPass").set({ on: true, until: new Date(now.getTime() + 3 * 86_400_000).toISOString() });
  (await import("../../lib/staff-pass-server")).resetStaffPassCache();
  await refused(S.makeAvatar(db, "member1", photo, deps(), now), 403, /being tested/);
  assert.equal((await S.avatarStatus(db, "member1", deps(), now)).open, false);
  const st = await S.avatarStatus(db, "staff1", deps(), now);
  assert.equal(st.open, true); assert.equal(st.ready, true); assert.equal(st.left, AVATAR_PER_DAY);

  // ---- no image model set up: said plainly, nothing counted ----
  assert.equal((await S.avatarStatus(db, "staff1", { config: () => null }, now)).ready, false);
  await refused(S.makeAvatar(db, "staff1", photo, deps({ config: () => null }), now), 503, /isn't set up yet/);
  // ---- a file that isn't a photo ----
  await refused(S.makeAvatar(db, "staff1", Buffer.from("<svg/>"), deps(), now), 400, /JPEG, PNG or WebP/);
  assert.equal(calls, 0);

  // ---- an avatar: drawn, marked, kept under the member's own folder, counted ----
  const made = await S.makeAvatar(db, "staff1", photo, deps(), now);
  assert.match(made.url, /^https:\/\/media\.test\/avatars\/staff1\/\d+-nana\.(webp|png)$/);
  assert.equal(made.left, AVATAR_PER_DAY - 1); assert.equal(calls, 1); assert.equal(kept.length, 1);
  assert.ok(photoType(kept[0].bytes) === "image/webp" || photoType(kept[0].bytes) === "image/png", "a real picture comes out of the mark");
  assert.notDeepEqual(kept[0].bytes, drawn, "the mark was drawn on it");
  assert.equal((await db.doc("avatarCounts/staff1_2026-11-17").get()).data()?.count, 1);

  // ---- the image model fails: the member is told, and it doesn't cost them one of the day's ----
  fail = true;
  await refused(S.makeAvatar(db, "staff1", photo, deps(), now), 502, /couldn't be made just now/);
  fail = false;
  assert.equal((await S.avatarStatus(db, "staff1", deps(), now)).used, 1);

  // ---- the day's limit, and a new day ----
  await db.doc("avatarCounts/staff1_2026-11-17").set({ count: AVATAR_PER_DAY }, { merge: true });
  await refused(S.makeAvatar(db, "staff1", photo, deps(), now), 429, /more tomorrow/);
  assert.equal((await S.avatarStatus(db, "staff1", deps(), now)).left, 0);
  assert.equal((await S.makeAvatar(db, "staff1", photo, deps(), new Date(now.getTime() + 86_400_000))).left, AVATAR_PER_DAY - 1);

  // ---- real settings: nothing set means not set up; a provider and a key are both needed ----
  assert.equal(S.avatarConfig(), null);
  console.log("AVATAR SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
