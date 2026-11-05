// Media phase M1, the pure parts (lib/media-rules.ts, the Media limits, the permanent NotesApp mark: lib/media-mark.ts, lib/media-watermark.tsx). Run: npm run test:media → "ALL OK".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_MEDIA_SETTINGS, MEDIA_PICTURE_POSTS_DAILY, MEDIA_VIDEO_WEEKLY_LIMIT, allowedSwitches, cleanMediaSettings, isOwnMediaKey, mediaPageVisible, mediaVisible,
  sitePictureId, sitePicturesOf, sniffPicture, type MediaAudience, type Relation,
} from "../../lib/media-rules";
import { LIMITS, LIMIT_TIERS, capOf, cleanOverrides, limitFor } from "../../lib/limits";
import { VIDEO_WEEKLY_LIMIT } from "../../lib/video-rules";
import { MOMENT_VIDEO_WEEKLY_LIMIT } from "../../lib/moments-rules";
import { blendOver, markPicture, renderMarks, renderVideoMark, type Rgba } from "../../lib/media-watermark";
import {
  MARK_SHAPES, STREAM_PROFILE, WATERMARK_DEFAULTS, cleanWatermarkOverrides, cornerText, downloadView, markGeometry, markProfileKey, shapeOf, shapeSize,
  signedDownloadUrl, watermarkSettings, withFilename,
} from "../../lib/media-mark";

const ROOT = join(__dirname, "..", "..");
const rel = (o: Partial<Relation> = {}): Relation => ({ signedIn: true, self: false, viewerFollows: false, followsViewer: false, subscribed: false, blocked: false, ...o });
const adult = { teen: false }, teen = { teen: true }, kept = { keepRepliesFollowers: true };

(async () => {
  // ── Who sees a post ──
  const see = (audience: MediaAudience, r: Relation, owner: Record<string, unknown> = adult, status: "ready" | "processing" = "ready") => mediaVisible({ owner, audience, status, rel: r });
  assert.equal(see("everyone", rel({ signedIn: false })), true, "everyone: even signed out");
  assert.equal(see("followers", rel({ signedIn: false })), false);
  assert.equal(see("followers", rel()), false, "followers: not a stranger");
  assert.equal(see("followers", rel({ viewerFollows: true })), true);
  assert.equal(see("subscribers", rel({ viewerFollows: true })), false, "subscribers: following isn't enough");
  assert.equal(see("subscribers", rel({ subscribed: true })), true);
  assert.equal(see("everyone", rel({ blocked: true })), false, "a block hides everything");
  assert.equal(see("everyone", rel(), adult, "processing"), false, "a video still processing is the owner's only");
  assert.equal(see("subscribers", rel({ self: true }), adult, "processing"), true, "the owner sees their own, any status");
  // Teen mode: mutual followers only, whatever the audience says; never signed out.
  assert.equal(see("everyone", rel({ signedIn: false }), teen), false, "a teen's everyone post isn't public");
  assert.equal(see("everyone", rel({ viewerFollows: true }), teen), false, "following a teen isn't enough");
  assert.equal(see("everyone", rel({ viewerFollows: true, followsViewer: true }), teen), true, "mutual followers see it");
  assert.equal(see("subscribers", rel({ viewerFollows: true, followsViewer: true }), teen), true, "the teen rule replaces the audience");
  assert.equal(see("everyone", rel({ viewerFollows: true }), kept), false, "kept the teen rule after 18");
  assert.equal(mediaPageVisible(teen, rel({ signedIn: false })), false);
  assert.equal(mediaPageVisible(teen, rel({ viewerFollows: true, followsViewer: true })), true);
  assert.equal(mediaPageVisible(adult, rel({ signedIn: false })), true);
  assert.equal(mediaPageVisible(adult, rel({ blocked: true })), false);

  // ── Switches: teens get no downloads, shares or gifts ──
  const all = { allowComments: true, allowShares: true, allowGifts: true, allowDownloads: true };
  assert.deepEqual(allowedSwitches(adult, all), all);
  assert.deepEqual(allowedSwitches(teen, all), { allowComments: true, allowShares: false, allowGifts: false, allowDownloads: false });
  assert.deepEqual(allowedSwitches(kept, all), { allowComments: true, allowShares: false, allowGifts: false, allowDownloads: false });

  // ── Site pictures: shown by default, ids stable, each once, sections that are off left out ──
  const site = {
    cover: "https://cdn.test/cover.webp",
    blocks: {
      hero: { on: true, image: "https://cdn.test/hero.webp" },
      gallery: { on: true, items: [{ image: "https://cdn.test/g1.webp", caption: "Shop" }, { image: "https://cdn.test/cover.webp", caption: "dup" }, { image: "" }] },
      services: { on: false, items: [{ image: "https://cdn.test/s1.webp", name: "Braids" }] },
    },
  };
  const pics = sitePicturesOf(site);
  assert.deepEqual(pics.map((p) => [p.source, p.url]), [["cover", "https://cdn.test/cover.webp"], ["hero", "https://cdn.test/hero.webp"], ["gallery", "https://cdn.test/g1.webp"]]);
  assert.ok(pics.every((p) => !p.hidden), "site pictures show by default");
  assert.equal(sitePictureId("https://cdn.test/g1.webp"), pics[2].id, "the id comes from the address");
  assert.match(pics[0].id, /^s[0-9a-f]{16}$/);
  assert.notEqual(pics[0].id, pics[1].id);
  const hidden = sitePicturesOf(site, [pics[1].id]);
  assert.deepEqual(hidden.map((p) => p.hidden), [false, true, false], "one hidden, the rest shown");
  assert.equal(sitePicturesOf({ ...site, blocks: { ...site.blocks, services: { on: true, items: site.blocks.services.items } } }).length, 4, "services when that section is on");
  assert.deepEqual(sitePicturesOf(null), []);
  assert.deepEqual(cleanMediaSettings(undefined), DEFAULT_MEDIA_SETTINGS, "defaults: site pictures shown, album on");
  assert.deepEqual(cleanMediaSettings({ hideAllSite: true, hiddenSite: [pics[0].id, pics[0].id, "nope", 7], showAlbum: false }), { hideAllSite: true, hiddenSite: [pics[0].id], showAlbum: false });

  // ── Uploads: our own folder only, and real pictures ──
  assert.equal(isOwnMediaKey("media/u1/1700-a.webp", "u1"), true);
  assert.equal(isOwnMediaKey("media/u2/1700-a.webp", "u1"), false, "someone else's folder");
  assert.equal(isOwnMediaKey("moments/u1/a.webp", "u1"), false, "another purpose's folder");
  assert.equal(isOwnMediaKey("media/u1/../u2/a.webp", "u1"), false);
  const bytes = (s: string, pre: number[] = []) => new Uint8Array([...pre, ...Array.from(s, (c) => c.charCodeAt(0))]);
  assert.equal(sniffPicture(bytes("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(sniffPicture(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
  assert.equal(sniffPicture(bytes("PNG\r\n", [0x89])), "png");
  assert.equal(sniffPicture(bytes("<html><script>")), null, "HTML posing as a picture");

  // ── Admin → Limits: a Media group, the video ladder mirrors post videos and video moments ──
  const media = LIMITS.filter((l) => l.group === "Media").map((l) => l.key);
  assert.deepEqual(media, ["mediaVideosPerWeek", "mediaVideoMaxSeconds", "mediaPicturePostsPerDay", "mediaStorageGB"]);
  assert.deepEqual(MEDIA_VIDEO_WEEKLY_LIMIT, VIDEO_WEEKLY_LIMIT, "same ladder as post videos");
  assert.deepEqual(MEDIA_VIDEO_WEEKLY_LIMIT, MOMENT_VIDEO_WEEKLY_LIMIT, "and video moments");
  for (const t of LIMIT_TIERS) assert.equal(limitFor("mediaPicturePostsPerDay", t), MEDIA_PICTURE_POSTS_DAILY[t]);
  assert.equal(limitFor("mediaVideosPerWeek", "standard"), 0, "Free Standard: pictures only");
  assert.equal(limitFor("mediaVideoMaxSeconds", "pro"), 180);
  assert.equal(capOf("mediaStorageGB", "pro", { mediaStorageGB: { pro: 0 } }), Infinity, "0 GB means no limit");
  assert.deepEqual(cleanOverrides({ mediaVideosPerWeek: { basic: 3, pro: 7 }, mediaVideoMaxSeconds: { basic: 5 } }), { mediaVideosPerWeek: { basic: 3 } }, "defaults and out-of-range values aren't saved");

  // ── The permanent NotesApp mark: where it goes (lib/media-mark.ts) ──
  // The approved mockup (5 Nov): centre logo ≈ 60% of the width at 16%; corner letters 3.6% of the width, 3% in, at 88%.
  const shapes: [string, number, number][] = [["square", 1600, 1600], ["phone 9:16", 1080, 1920], ["wide 4:1", 2400, 600], ["16:9", 1920, 1080], ["small", 670, 510], ["tall 1:3", 600, 1800]];
  for (const [name, w, h] of shapes) {
    const g = markGeometry(w, h, "emmanuel");
    const inside = (b: { x: number; y: number; w: number; h: number }) => b.x >= 0 && b.y >= 0 && b.x + b.w <= w + 1 && b.y + b.h <= h + 1;
    assert.ok(inside(g.centre) && inside(g.corner), `${name}: both marks inside the picture`);
    assert.ok(Math.abs(g.centre.x + g.centre.w / 2 - w / 2) <= 1 && Math.abs(g.centre.y + g.centre.h / 2 - h / 2) <= 1, `${name}: the logo is centred`);
    assert.ok(g.centre.w <= w * 0.61 && g.centre.h <= h * 0.4 + 1, `${name}: the logo is at most 60% of the width and 40% of the height`);
    assert.equal(g.centre.opacity, 0.16, "faint");
    assert.equal(g.corner.opacity, 0.88);
    assert.ok(g.corner.x + g.corner.w >= w * 0.96 && g.corner.y + g.corner.h >= h * 0.96, `${name}: bottom right, 3% in`);
    assert.ok(g.corner.font <= w * 0.036 + 1 && g.corner.font <= h * 0.06 + 1, `${name}: the corner letters follow the picture`);
    assert.equal(g.corner.text, "@emmanuel");
  }
  // Same look at any size: a phone photo and the same photo at half size have marks in the same proportion.
  const big = markGeometry(1080, 1920, "emmanuel"), half = markGeometry(540, 960, "emmanuel");
  assert.ok(Math.abs(big.centre.w / 1080 - half.centre.w / 540) < 0.01 && Math.abs(big.corner.font / 1080 - half.corner.font / 540) < 0.01, "scales with the picture");
  assert.ok(Math.abs(markGeometry(2000, 1000, "x").centre.w - 1200) <= 2, "the logo is 60% of a wide picture's width");
  assert.ok(Math.abs(markGeometry(1000, 1000, "x").corner.font - 36) <= 1, "corner letters 3.6% of the width");
  // The corner never says NotesApp: only the na square and @username.
  assert.equal(cornerText("emmanuel"), "@emmanuel");
  assert.ok(!/notesapp/i.test(markGeometry(800, 600, "emmanuel").corner.text), "no NotesApp word in the corner");
  // A very long username still fits in 70% of the width; other corners from Admin.
  const long = markGeometry(600, 600, "a".repeat(40));
  assert.ok(long.corner.w <= 600 * 0.7 + 1 && long.corner.x >= 0);
  const ul = markGeometry(1000, 800, "x", watermarkSettings({ corner: 3 }));
  assert.ok(ul.corner.x <= 31 && ul.corner.y <= 25 && ul.corner.corner === "upperLeft");
  // Admin's numbers: whole numbers in range only; old (v0.134) keys dropped; never solid.
  assert.deepEqual(cleanWatermarkOverrides({ centreOpacityPct: 20, cornerOpacityPct: 100, cornerSizePct: "150", paddingPct: 2.5, opacityPct: 30, sizePct: 22, junk: 1 }), { centreOpacityPct: 20, cornerSizePct: 150 });
  assert.ok(watermarkSettings({ cornerOpacityPct: 100 }).cornerOpacityPct <= 90, "the corner stays see-through");
  assert.equal(markGeometry(1000, 1000, "x", watermarkSettings({ cornerSizePct: 200 })).corner.font, 72, "the size setting scales the corner");
  // Videos: one Stream profile per frame shape, a full-frame PNG laid on at scale 1 in the centre.
  assert.deepEqual([shapeOf(1080, 1920), shapeOf(1920, 1080), shapeOf(1000, 1000), shapeOf(1280, 800), shapeOf(2560, 1080), shapeOf(undefined, 5)], ["9x16", "16x9", "1x1", "16x10", "21x9", "16x9"]);
  for (const k of Object.keys(MARK_SHAPES) as (keyof typeof MARK_SHAPES)[]) { const z = shapeSize(k); assert.ok(Math.max(z.w, z.h) === 1280 && Math.abs(z.w / z.h - MARK_SHAPES[k]) < 0.01); }
  assert.deepEqual(STREAM_PROFILE, { opacity: 1, padding: 0, scale: 1, position: "center" });
  assert.notEqual(markProfileKey("Tunde", "9x16", WATERMARK_DEFAULTS), markProfileKey("Tunde", "16x9", WATERMARK_DEFAULTS));
  assert.equal(markProfileKey("Tunde", "9x16", WATERMARK_DEFAULTS), markProfileKey("tunde", "9x16", WATERMARK_DEFAULTS), "usernames are matched without case");
  assert.notEqual(markProfileKey("tunde", "9x16", WATERMARK_DEFAULTS), markProfileKey("tunde", "9x16", watermarkSettings({ centreOpacityPct: 20 })), "a new look, a new profile");
  // Downloads: the creator sees preparing/failed; the MP4 link names the file; a signed video's MP4 carries a token.
  assert.deepEqual([downloadView({ state: "rendering", startedAt: "", updatedAt: "" }), downloadView({ state: "ready", startedAt: "", updatedAt: "" }), downloadView(undefined)], ["preparing", "ready", undefined]);
  assert.equal(withFilename("https://c/v1/downloads/default.mp4", "tunde-notesapp-ab12cd.mp4"), "https://c/v1/downloads/default.mp4?filename=tunde-notesapp-ab12cd.mp4");
  assert.equal(signedDownloadUrl("https://customer-x.cloudflarestream.com/c1/downloads/default.mp4", "c1", "T.k"), "https://customer-x.cloudflarestream.com/T.k/downloads/default.mp4");

  // blendOver: mixing by alpha, in place.
  const base: Rgba = { data: new Uint8Array(4 * 4 * 4).fill(0), width: 4, height: 4 };
  for (let k = 3; k < base.data.length; k += 4) base.data[k] = 255;
  const over: Rgba = { data: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 128, 255, 255, 255, 255]), width: 2, height: 2 };
  blendOver(base, over, 3, 3); // only its top-left pixel lands inside
  assert.deepEqual(Array.from(base.data.slice((3 * 4 + 3) * 4, (3 * 4 + 3) * 4 + 4)), [255, 255, 255, 255]);
  assert.equal(base.data[0], 0, "the rest is untouched");
  const blank: Rgba = { data: new Uint8Array(4).fill(0), width: 1, height: 1 };
  blendOver(blank, { data: new Uint8Array([200, 100, 50, 128]), width: 1, height: 1 }, 0, 0);
  assert.deepEqual(Array.from(blank.data.slice(0, 3)), [100, 50, 25], "half see-through mixes half and half");

  // ── A real picture (lib/media-watermark.tsx): same size out, WebP stays WebP, JPEG becomes JPEG; the corner and centre changed. ──
  const req = eval("require") as NodeRequire;
  const sq = req("next/dist/server/lib/squoosh/impl") as { decodeBuffer: (b: Buffer) => Promise<Rgba>; encodeWebp: (i: Rgba, o: { quality: number }) => Promise<Uint8Array> };
  const plain = (x: Rgba): Rgba => ({ data: x.data, width: x.width, height: x.height });
  for (const file of ["public/anya/anya-display-case-black.webp", "public/anya/anya-nana-case.webp", "public/images/journal/defi.jpg"]) {
    const src = readFileSync(join(ROOT, file));
    const b0 = plain(await sq.decodeBuffer(src));
    const out = await markPicture(src, "emmanuel");
    assert.equal(sniffPicture(out.bytes), file.endsWith(".webp") ? "webp" : "jpeg", `${file}: format kept`);
    assert.equal(out.type, file.endsWith(".webp") ? "image/webp" : "image/jpeg");
    const after = plain(await sq.decodeBuffer(out.bytes));
    assert.deepEqual([after.width, after.height], [b0.width, b0.height], "same size");
    const diff = (x0: number, y0: number, x1: number, y1: number) => {
      let d = 0, n = 0;
      for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) { const k = (y * b0.width + x) * 4; d += Math.abs(after.data[k] - b0.data[k]) + Math.abs(after.data[k + 1] - b0.data[k + 1]); n++; }
      return d / n;
    };
    const g = markGeometry(b0.width, b0.height, "emmanuel");
    assert.ok(diff(g.corner.x + g.corner.w - g.corner.square, g.corner.y, g.corner.x + g.corner.w, g.corner.y + g.corner.h) > 18 || diff(g.corner.x, g.corner.y, g.corner.x + g.corner.square, g.corner.y + g.corner.h) > 18, `${file}: the na @username mark is in the corner`);
    assert.ok(diff(g.centre.x, g.centre.y, g.centre.x + g.centre.square, g.centre.y + g.centre.h) > 4, `${file}: the faint logo is in the middle`);
    assert.ok(diff(0, 0, Math.min(60, g.centre.x), Math.min(60, g.centre.y)) < 8, `${file}: the rest of the picture is kept`);
  }
  // keepFormat (the re-marking job writing over the same address): a PNG comes back a PNG, a JPEG a JPEG; a GIF can't be kept.
  {
    const { FormatNotKept } = await import("../../lib/media-mark");
    const src = readFileSync(join(ROOT, "public/images/journal/defi.jpg"));
    const raw = plain(await sq.decodeBuffer(src));
    const req2 = eval("require") as NodeRequire;
    const { encodePng } = req2("next/dist/server/lib/squoosh/impl") as { encodePng: (i: Rgba) => Promise<Uint8Array> };
    const pngIn = Buffer.from(await encodePng(raw));
    const pngOut = await markPicture(pngIn, "emmanuel", undefined, { keepFormat: true });
    assert.deepEqual([sniffPicture(pngOut.bytes), pngOut.type, pngOut.ext], ["png", "image/png", "png"]);
    assert.equal(sniffPicture((await markPicture(src, "emmanuel", undefined, { keepFormat: true })).bytes), "jpeg");
    assert.equal((await markPicture(pngIn, "emmanuel")).type, "image/jpeg", "a new upload's PNG becomes a JPEG as before");
    await assert.rejects(markPicture(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(30)]), "x", undefined, { keepFormat: true }), (e: Error) => e instanceof FormatNotKept);
  }
  // The mark for a video profile: a PNG of the frame's shape, transparent where there's no mark.
  {
    const png = await renderVideoMark("tundemoney", "9x16");
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const img = plain(await sq.decodeBuffer(png));
    assert.deepEqual([img.width, img.height], [720, 1280]);
    assert.equal(img.data[3], 0, "the top-left corner is fully see-through");
    let clear = 0, drawn = 0;
    for (let k = 3; k < img.data.length; k += 4) { if (img.data[k] === 0) clear++; else drawn++; }
    assert.ok(clear > (img.data.length / 4) * 0.8 && drawn > 1000, "mostly see-through around the drawn marks");
    const g = markGeometry(720, 1280, "tundemoney");
    const at = (x: number, y: number) => img.data[(Math.round(y) * 720 + Math.round(x)) * 4 + 3];
    assert.ok(at(g.corner.x + g.corner.w - g.corner.square / 2, g.corner.y + g.corner.h / 2) > 150, "the corner square is drawn where the geometry says");
    const c = at(g.centre.x + g.centre.square / 2, g.centre.y + g.centre.h / 2);
    assert.ok(c > 20 && c < 70, `the centre square is faint (alpha ${c})`);
    assert.equal((await renderMarks(300, 200, "x")).subarray(1, 4).toString(), "PNG");
  }

  // The routes that mark pictures are traced with the codecs and fonts.
  const cfg = readFileSync(join(ROOT, "next.config.js"), "utf8");
  for (const r of ["/api/media/posts/[id]/download", "/api/media/posts", "/api/upload/mark", "/api/admin/media-marks", "/api/cron/reminders"]) assert.ok(cfg.includes(`"${r}": ["./node_modules/next/dist/server/lib/squoosh/**", "./assets/fonts/Inter-*.ttf"]`), `${r} is traced with the codecs and fonts`);
  // Cloudflare Stream refusing an upload (its storage used up) is told apart from Firestore's daily quota: the member is not told
  // "we're at capacity", and the error is a StreamError the Media routes turn into an honest message.
  {
    const { StreamError } = await import("../../lib/stream");
    const { friendlyMessage } = await import("../../lib/api-errors");
    const full = new StreamError(400, 10011, "Storage capacity exceeded. Your account's storage quota has been used.");
    assert.ok(full instanceof Error && full.message.startsWith("Cloudflare Stream:") && full.storageFull, "Stream storage full");
    assert.equal(new StreamError(500, undefined, "Internal error").storageFull, false);
    const f = friendlyMessage(full, "x");
    assert.ok(!/at capacity/.test(f.message), "not shown as our capacity");
    assert.match(friendlyMessage(new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."), "x").message, /at capacity/, "Firestore's quota still is");
  }
  console.log("ALL OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
