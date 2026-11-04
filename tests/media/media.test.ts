// Media phase M1, the pure parts (lib/media-rules.ts, the Media limits, lib/media-watermark.tsx). Run: npm run test:media → "ALL OK".
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
import { badgeBox, blendOver, renderVideoMark, watermarkPicture, type Rgba } from "../../lib/media-watermark";
import {
  DL_GIVE_UP_MS, WATERMARK_DEFAULTS, cleanWatermarkOverrides, dlPending, dlView, nextDlStep, signedDownloadUrl, streamWatermarkParams, watermarkProfileKey,
  watermarkSettings, type VideoDl,
} from "../../lib/media-video-dl";

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

  // ── Watermark ──
  const box = badgeBox(1200, 1600, "tundemoney");
  assert.ok(box.h >= 26 && box.w <= 1200 * 0.7 && box.w > box.h * 2, "badge fits the picture");
  assert.ok(badgeBox(200, 200, "a".repeat(40)).w <= 140, "a long name never covers most of a small picture");
  const base: Rgba = { data: new Uint8Array(4 * 4 * 4).fill(0), width: 4, height: 4 };
  for (let k = 3; k < base.data.length; k += 4) base.data[k] = 255;
  const over: Rgba = { data: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 128, 255, 255, 255, 255]), width: 2, height: 2 };
  blendOver(base, over, 3, 3); // only its top-left pixel lands inside
  assert.deepEqual(Array.from(base.data.slice((3 * 4 + 3) * 4, (3 * 4 + 3) * 4 + 4)), [255, 255, 255, 255]);
  assert.equal(base.data[0], 0, "the rest is untouched");
  const blank: Rgba = { data: new Uint8Array(4).fill(0), width: 1, height: 1 };
  blendOver(blank, { data: new Uint8Array([200, 100, 50, 128]), width: 1, height: 1 }, 0, 0);
  assert.deepEqual(Array.from(blank.data.slice(0, 3)), [100, 50, 25], "half see-through mixes half and half");

  // A real picture: same size out, a JPEG, the bottom-right corner changed, the top-left not.
  const req = eval("require") as NodeRequire;
  const sq = req("next/dist/server/lib/squoosh/impl") as { decodeBuffer: (b: Buffer) => Promise<Rgba>; encodeWebp: (i: Rgba, o: { quality: number }) => Promise<Uint8Array> };
  const src = readFileSync(join(ROOT, "public/images/journal/defi.jpg"));
  const before = await sq.decodeBuffer(src);
  const plain = (x: Rgba): Rgba => ({ data: x.data, width: x.width, height: x.height });
  const b0 = plain(before);
  // The same picture as WebP, as Media stores it.
  const webp = Buffer.from(await sq.encodeWebp(b0, { quality: 85 }));
  assert.equal(sniffPicture(webp), "webp");
  for (const input of [src, webp]) {
    const out = await watermarkPicture(input, "tundemoney");
    assert.equal(sniffPicture(out), "jpeg", "a JPEG comes out");
    const after = plain(await sq.decodeBuffer(out));
    assert.deepEqual([after.width, after.height], [b0.width, b0.height], "same size");
    const diff = (x0: number, y0: number, x1: number, y1: number) => {
      let d = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * b0.width + x) * 4; d += Math.abs(after.data[k] - b0.data[k]) + Math.abs(after.data[k + 1] - b0.data[k + 1]); n++; }
      return d / n;
    };
    const bx = badgeBox(b0.width, b0.height, "tundemoney");
    const x0 = b0.width - bx.w - bx.margin, y0 = b0.height - bx.h - bx.margin;
    assert.ok(diff(x0 + 4, y0 + 4, x0 + bx.w - 4, y0 + bx.h - 4) > 25, "the badge is stamped in the corner");
    assert.ok(diff(0, 0, 120, 120) < 12, "the rest of the picture is kept");
  }

  // ── Watermarked video downloads (lib/media-video-dl.ts) ──
  // The look: see-through by default and never solid; whole numbers within each range; corners by Stream's names.
  assert.deepEqual(streamWatermarkParams(WATERMARK_DEFAULTS), { opacity: 0.4, scale: 0.22, padding: 0.04, position: "lowerRight" });
  assert.deepEqual(cleanWatermarkOverrides({ opacityPct: 100, sizePct: "30", paddingPct: 2.5, corner: 2, junk: 1 }), { sizePct: 30, corner: 2 }, "100% (solid) and fractions are refused");
  assert.equal(streamWatermarkParams(watermarkSettings({ corner: 3 })).position, "upperLeft");
  assert.ok(watermarkSettings({ opacityPct: 90 }).opacityPct <= 70, "the mark stays see-through");
  assert.notEqual(watermarkProfileKey("Tunde", WATERMARK_DEFAULTS), watermarkProfileKey("tunde2", WATERMARK_DEFAULTS));
  assert.equal(watermarkProfileKey("Tunde", WATERMARK_DEFAULTS), watermarkProfileKey("tunde", WATERMARK_DEFAULTS), "usernames are matched without case");
  // The steps: the original's MP4 → the marked copy → the copy's MP4 → ready; any error fails; a day without finishing gives up.
  const t0 = Date.parse("2026-11-03T10:00:00Z");
  const dl = (state: VideoDl["state"], extra: Partial<VideoDl> = {}): VideoDl => ({ state, startedAt: new Date(t0).toISOString(), updatedAt: "", profileUid: "wm1", bytes: 10, ...extra });
  const now = t0 + 60_000;
  assert.deepEqual(nextDlStep(dl("source"), { now, sourceDownload: { status: "inprogress", url: "" } }), { do: "wait" });
  assert.deepEqual(nextDlStep(dl("source"), { now, sourceDownload: { status: "ready", url: "https://c/sv/downloads/default.mp4" } }), { do: "copy", url: "https://c/sv/downloads/default.mp4" });
  assert.equal(nextDlStep(dl("source"), { now, sourceDownload: { status: "error", url: "" } }).do, "fail");
  assert.equal(nextDlStep(dl("source"), { now, sourceDownload: null }).do, "fail");
  assert.deepEqual(nextDlStep(dl("copying", { copyUid: "c1" }), { now, copy: { readyToStream: false } }), { do: "wait" });
  assert.deepEqual(nextDlStep(dl("copying", { copyUid: "c1" }), { now, copy: { readyToStream: true } }), { do: "render" });
  assert.equal(nextDlStep(dl("copying", { copyUid: "c1" }), { now, copy: { readyToStream: false, state: "error" } }).do, "fail");
  assert.deepEqual(nextDlStep(dl("rendering", { copyUid: "c1" }), { now, copy: { readyToStream: true, size: 99 }, copyDownload: { status: "ready", url: "https://c/c1/downloads/default.mp4" } }), { do: "ready", url: "https://c/c1/downloads/default.mp4", bytes: 99 });
  assert.equal(nextDlStep(dl("rendering", { copyUid: "c1" }), { now: t0 + DL_GIVE_UP_MS + 1, copyDownload: { status: "inprogress", url: "" } }).do, "fail", "gives up after a day");
  assert.deepEqual(nextDlStep(dl("ready"), { now }), { do: "wait" });
  assert.ok(dlPending(dl("copying")) && !dlPending(dl("ready")) && !dlPending(dl("failed")) && !dlPending(undefined));
  assert.deepEqual([dlView(dl("source")), dlView(dl("rendering")), dlView(dl("ready")), dlView(dl("failed")), dlView(undefined)], ["preparing", "preparing", "ready", "failed", undefined]);
  // The copy keeps signed links on: its MP4 address carries a token in place of its id.
  assert.equal(signedDownloadUrl("https://customer-x.cloudflarestream.com/c1/downloads/default.mp4", "c1", "T.k", "tunde-notesapp-ab12cd.mp4"), "https://customer-x.cloudflarestream.com/T.k/downloads/default.mp4?filename=tunde-notesapp-ab12cd.mp4");
  // The mark is a PNG with a transparent background (Stream lays it on see-through).
  {
    const png = await renderVideoMark("tundemoney");
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const req = eval("require") as NodeRequire;
    const { decodeBuffer } = req("next/dist/server/lib/squoosh/impl") as { decodeBuffer: (b: Buffer) => Promise<Rgba> };
    const img = await decodeBuffer(png);
    const data = img.data;
    assert.equal(data[3], 0, "the top-left corner is fully see-through");
    let clear = 0, solid = 0;
    for (let k = 3; k < data.length; k += 4) { if (data[k] === 0) clear++; else if (data[k] === 255) solid++; }
    assert.ok(clear > data.length / 8 && solid > 100, "mostly see-through around a drawn mark");
  }

  // The download route is traced with the codecs, and the studio and tab exist.
  assert.match(readFileSync(join(ROOT, "next.config.js"), "utf8"), /"\/api\/media\/posts\/\[id\]\/download": \["\.\/node_modules\/next\/dist\/server\/lib\/squoosh\/\*\*"\]/);
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
