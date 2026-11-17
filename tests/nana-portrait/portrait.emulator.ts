// Nana AI, the portrait studio, on the Firestore emulator (lib/avatar-maker-server.ts makePortrait): the avatar maker's gate (the team
// on the staff test pass), one daily number shared with avatars, the member's prompt reaching the image model, the real mark drawn for
// free plans and none for paid plans, and nothing kept. The image model is a stand-in. Run: npm run test:nana-portrait-server.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const S = await import("../../lib/avatar-maker-server");
  const { AVATAR_PER_DAY, AvatarError } = await import("../../lib/avatar-maker");
  const { markAvatar } = await import("../../lib/avatar-render");
  const { portraitPrompt } = await import("../../lib/nana-portrait");
  const { ImageResponse } = await import("next/og");
  const React = (await import("react")).default;
  const refused = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof AvatarError && e.status === status && re.test(e.message));
  const now = new Date("2026-11-17T10:00:00Z");

  const drawn = Buffer.from(await new ImageResponse(React.createElement("div", { style: { display: "flex", width: 512, height: 512, background: "#3D5AFE" } }), { width: 512, height: 512 }).arrayBuffer());
  const photo = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 5)]);
  const prompts: string[] = [];
  let calls = 0, marks = 0;
  const deps = (over: Partial<Parameters<typeof S.makePortrait>[4] & object> = {}) => ({
    config: () => ({ provider: "openai" as const, key: "sk-test", model: "gpt-image-1" }),
    fetch: async (_url: string, init?: RequestInit) => {
      calls++;
      prompts.push(String((init?.body as FormData).get("prompt")));
      return new Response(JSON.stringify({ data: [{ b64_json: drawn.toString("base64") }] }), { status: 200 });
    },
    mark: async (b: Buffer, t: string) => { marks++; return markAvatar(b, t); },
    webp: async () => null,
    ...over,
  });
  const prompt = portraitPrompt("editorial", "an ivory background", 72);
  await db.doc("users/pstaff").set({ username: "pstaff", role: "staff" });
  await db.doc("users/pmember").set({ username: "pmember" });

  // ---- the pass is off: nobody, and the image model is never called ----
  await refused(S.makePortrait(db, "pstaff", photo, { prompt, paid: false }, deps(), now), 403, /Nana AI is being tested by the #NotesApp team/);
  assert.equal(calls, 0);

  // ---- the pass is on: the team only ----
  await db.doc("serverConfig/staffPass").set({ on: true, until: new Date(now.getTime() + 3 * 86_400_000).toISOString() });
  (await import("../../lib/staff-pass-server")).resetStaffPassCache();
  await refused(S.makePortrait(db, "pmember", photo, { prompt, paid: true }, deps(), now), 403, /being tested/);
  await refused(S.makePortrait(db, "pstaff", photo, { prompt, paid: false }, deps({ config: () => null }), now), 503, /Nana AI isn't set up yet/);
  await refused(S.makePortrait(db, "pstaff", Buffer.from("not a photo at all"), { prompt, paid: false }, deps(), now), 400, /JPEG, PNG or WebP/);
  assert.equal(calls, 0, "nothing reaches the model for a refused request");

  // ---- free plan: the prompt goes to the model, the real mark is drawn, a data address comes back ----
  const free = await S.makePortrait(db, "pstaff", photo, { prompt, paid: false }, deps(), now);
  assert.equal(prompts[0], prompt, "the portrait prompt, not the avatar maker's");
  assert.equal(free.marked, true); assert.equal(marks, 1);
  assert.match(free.image, /^data:image\/(webp|png);base64,/);
  assert.ok(Buffer.from(free.image.split(",")[1], "base64").length > 1000, "a real picture");
  assert.equal(free.left, AVATAR_PER_DAY - 1);

  // ---- paid plan: no mark ----
  const paid = await S.makePortrait(db, "pstaff", photo, { prompt, paid: true }, deps(), now);
  assert.equal(paid.marked, false); assert.equal(marks, 1, "the mark isn't drawn for a paid plan");
  assert.equal(Buffer.from(paid.image.split(",")[1], "base64").equals(drawn), true, "the picture as the model drew it");

  // ---- one daily number with avatars: portraits and avatars count together ----
  assert.equal((await S.avatarStatus(db, "pstaff", deps(), now)).used, 2);
  await db.doc(`avatarCounts/pstaff_${(await import("../../lib/avatar-maker")).avatarDay(now)}`).set({ count: AVATAR_PER_DAY }, { merge: true });
  await refused(S.makePortrait(db, "pstaff", photo, { prompt, paid: true }, deps(), now), 429, /Nana pictures today/);
  assert.equal(calls, 2, "no model call once the day's number is used");
  // the next day starts again
  assert.equal((await S.makePortrait(db, "pstaff", photo, { prompt, paid: true }, deps(), new Date(now.getTime() + 86_400_000))).left, AVATAR_PER_DAY - 1);

  // ---- the avatar maker still sends its own illustration prompt ----
  prompts.length = 0;
  await S.makeAvatar(db, "pstaff", photo, { ...deps(), store: async (k: string) => `https://media.test/${k}` }, new Date(now.getTime() + 2 * 86_400_000));
  assert.match(prompts[0], /flat vector-style illustrated portrait/);

  // ---- Cloudflare: the photo is made small enough first (512 a side), for portraits and avatars alike ----
  const fitted: number[] = [];
  const cfDeps = deps({ config: () => ({ provider: "cloudflare" as const, key: "cf", model: "@cf/black-forest-labs/flux-2-klein-4b", account: "acc" }),
    fit: async (p: { bytes: Buffer; type: "image/jpeg" | "image/png" | "image/webp" }, side: number) => { fitted.push(side); return p; },
    fetch: async () => new Response(JSON.stringify({ success: true, result: { image: drawn.toString("base64") } }), { status: 200, headers: { "content-type": "application/json" } }) });
  await S.makePortrait(db, "pstaff", photo, { prompt, paid: true }, cfDeps, new Date(now.getTime() + 2 * 86_400_000 + 3_600_000));
  assert.deepEqual(fitted, [512]);
  fitted.length = 0;
  await S.makePortrait(db, "pstaff", photo, { prompt, paid: true }, deps(), new Date(now.getTime() + 2 * 86_400_000 + 3_600_000));
  assert.deepEqual(fitted, [], "OpenAI and Google get the photo as it is");
  // the real shrinking, with the encoder Next.js ships: a 1200 x 900 picture becomes 512 x 384 JPEG; a small one is left alone
  const big = Buffer.from(await new ImageResponse(React.createElement("div", { style: { display: "flex", width: 1200, height: 900, background: "#A6093D" } }), { width: 1200, height: 900 }).arrayBuffer());
  const small = await S.fitPhoto({ bytes: big, type: "image/png" }, 512);
  assert.equal(small.type, "image/jpeg");
  const req = eval("require") as NodeRequire;
  const meta = await (req("next/dist/server/lib/squoosh/main") as { getMetadata: (b: Buffer) => Promise<{ width: number; height: number }> }).getMetadata(small.bytes);
  assert.deepEqual([meta.width, meta.height], [512, 384]);
  const tiny = { bytes: drawn, type: "image/png" as const };
  assert.equal(await S.fitPhoto(tiny, 512), tiny, "512 x 512 already fits");

  console.log("PORTRAIT SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
