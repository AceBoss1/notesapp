// Nana's avatar maker, the pure parts and the image providers with a stand-in fetch (lib/avatar-maker.ts, lib/avatar-providers.ts).
// Nothing here reaches a provider. Run: npm run test:avatar → "AVATAR OK".
import assert from "node:assert/strict";
import { AVATAR_MODEL, AVATAR_PHOTO_MAX, AVATAR_PROMPT, AvatarError, avatarDay, checkPhoto, isAvatarProvider, photoType } from "../../lib/avatar-maker";
import { drawAvatar } from "../../lib/avatar-providers";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 2)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(200, 3)]);
const refused = (fn: () => unknown, status: number, re: RegExp) => assert.throws(fn, (e: unknown) => e instanceof AvatarError && e.status === status && re.test(e.message));
const rejects = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof AvatarError && e.status === status && re.test(e.message));

(async () => {
  // the photo is judged by its bytes, not by what the upload called it
  assert.equal(photoType(PNG), "image/png"); assert.equal(photoType(JPG), "image/jpeg"); assert.equal(photoType(WEBP), "image/webp");
  assert.equal(photoType(Buffer.from("<svg onload=alert(1)>")), null);
  refused(() => checkPhoto(Buffer.alloc(0)), 400, /Choose a photo/);
  refused(() => checkPhoto(Buffer.from("GIF89a" + "x".repeat(50))), 400, /JPEG, PNG or WebP/);
  refused(() => checkPhoto(Buffer.concat([JPG, Buffer.alloc(AVATAR_PHOTO_MAX)])), 400, /under 8 MB/);
  assert.equal(checkPhoto(JPG), "image/jpeg");
  assert.ok(isAvatarProvider("openai") && isAvatarProvider("gemini") && isAvatarProvider("cloudflare") && !isAvatarProvider("claude"));
  assert.match(AVATAR_PROMPT, /No text, no logo, no watermark/);
  // the day turns over at midnight in Lagos (UTC+1)
  assert.equal(avatarDay(new Date("2026-11-17T22:59:00Z")), "2026-11-17"); assert.equal(avatarDay(new Date("2026-11-17T23:00:00Z")), "2026-11-18");

  // ---- OpenAI: a form with the photo and the prompt goes out; the picture comes back as base64 ----
  const picture = Buffer.concat([PNG, Buffer.alloc(400, 9)]);
  let seen: { url: string; init?: RequestInit } | null = null;
  const openai = async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ data: [{ b64_json: picture.toString("base64") }] }), { status: 200 }); };
  const out = await drawAvatar(openai, { provider: "openai", key: "sk-test", model: "" }, { bytes: JPG, type: "image/jpeg" });
  assert.deepEqual(out, picture);
  assert.equal(seen!.url, "https://api.openai.com/v1/images/edits");
  assert.equal((seen!.init!.headers as Record<string, string>).authorization, "Bearer sk-test");
  const form = seen!.init!.body as FormData;
  assert.equal(form.get("model"), AVATAR_MODEL.openai, "the default model when none is set"); assert.equal(form.get("size"), "1024x1024"); assert.equal(form.get("prompt"), AVATAR_PROMPT);
  assert.equal((form.get("image") as File).size, JPG.length);

  // ---- Google: the photo goes inline; the picture is the inline part of the answer ----
  const gemini = async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Here you go" }, { inlineData: { mimeType: "image/png", data: picture.toString("base64") } }] } }] }), { status: 200 }); };
  assert.deepEqual(await drawAvatar(gemini, { provider: "gemini", key: "g-test", model: "my-model" }, { bytes: PNG, type: "image/png" }), picture);
  assert.equal(seen!.url, "https://generativelanguage.googleapis.com/v1beta/models/my-model:generateContent");
  assert.equal((seen!.init!.headers as Record<string, string>)["x-goog-api-key"], "g-test");
  const sent = JSON.parse(String(seen!.init!.body));
  assert.equal(sent.contents[0].parts[1].inline_data.mime_type, "image/png"); assert.equal(sent.contents[0].parts[1].inline_data.data, PNG.toString("base64"));

  // ---- when it goes wrong: the member is told what to do, never the provider's own words or the key ----
  const answer = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
  await rejects(drawAvatar(answer(200, { candidates: [{ content: { parts: [{ text: "I can't help with that." }] } }] }), { provider: "gemini", key: "k", model: "" }, { bytes: PNG, type: "image/png" }), 422, /clear photo of just you/);
  await rejects(drawAvatar(answer(200, { data: [] }), { provider: "openai", key: "k", model: "" }, { bytes: PNG, type: "image/png" }), 422, /clear photo/);
  await rejects(drawAvatar(answer(400, { error: { message: "Your request was rejected by the safety system." } }), { provider: "openai", key: "k", model: "" }, { bytes: PNG, type: "image/png" }), 422, /clear photo/);
  await rejects(drawAvatar(answer(401, { error: { message: "Incorrect API key provided: sk-test" } }), { provider: "openai", key: "sk-test", model: "" }, { bytes: PNG, type: "image/png" }), 502, /^The picture couldn't be made just now/);
  await rejects(drawAvatar(async () => { throw new Error("socket hang up"); }, { provider: "gemini", key: "k", model: "" }, { bytes: PNG, type: "image/png" }), 502, /try again/);
  // ---- Cloudflare Workers AI: a form to the account's ai/run endpoint; the picture comes back as base64 inside { result } ----
  const cf = { provider: "cloudflare" as const, key: "cf-token", model: "", account: "acc123" };
  const cfOk = async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ success: true, result: { image: picture.toString("base64") } }), { status: 200, headers: { "content-type": "application/json" } }); };
  assert.deepEqual(await drawAvatar(cfOk, cf, { bytes: JPG, type: "image/jpeg" }, "a portrait"), picture);
  assert.equal(seen!.url, "https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/black-forest-labs/flux-2-klein-4b", "the default model, slashes kept");
  assert.equal(AVATAR_MODEL.cloudflare, "@cf/black-forest-labs/flux-2-klein-4b");
  assert.equal((seen!.init!.headers as Record<string, string>).authorization, "Bearer cf-token");
  const cform = seen!.init!.body as FormData;
  assert.equal(cform.get("prompt"), "a portrait"); assert.equal((cform.get("input_image_0") as File).size, JPG.length); assert.equal(cform.get("width"), "1024");
  // the bare { image } shape, and the picture itself, are taken too
  assert.deepEqual(await drawAvatar(answer(200, { image: picture.toString("base64") }), cf, { bytes: JPG, type: "image/jpeg" }), picture);
  assert.deepEqual(await drawAvatar(async () => new Response(new Uint8Array(picture), { status: 200, headers: { "content-type": "image/png" } }), cf, { bytes: JPG, type: "image/jpeg" }), picture);
  // the day's free allowance used up: "try tomorrow", not a fault; a refusal: a clearer photo; anything else: try again; never the token
  await rejects(drawAvatar(answer(429, { success: false, errors: [{ code: 4006, message: "you have used up your daily free allocation of 10,000 neurons" }] }), cf, { bytes: JPG, type: "image/jpeg" }), 429, /all the pictures it can for today/);
  await rejects(drawAvatar(answer(400, { success: false, errors: [{ message: "Input flagged as NSFW" }] }), cf, { bytes: JPG, type: "image/jpeg" }), 422, /clear photo/);
  await rejects(drawAvatar(answer(401, { success: false, errors: [{ message: "Authentication error cf-token" }] }), cf, { bytes: JPG, type: "image/jpeg" }), 502, /^The picture couldn't be made/);
  await rejects(drawAvatar(answer(200, { success: true, result: {} }), cf, { bytes: JPG, type: "image/jpeg" }), 422, /clear photo/);
  await rejects(drawAvatar(cfOk, { ...cf, account: undefined }, { bytes: JPG, type: "image/jpeg" }), 502, /try again/);
  await rejects(drawAvatar(cfOk, { ...cf, model: "@cf/x/../../evil?y=1" }, { bytes: JPG, type: "image/jpeg" }), 502, /try again/);
  await rejects(drawAvatar(cfOk, { ...cf, model: "@cf/../../accounts" }, { bytes: JPG, type: "image/jpeg" }), 502, /try again/);
  console.log("AVATAR OK");
})().catch((e) => { console.error(e); process.exit(1); });
