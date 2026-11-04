import React from "react";
import { ImageResponse } from "next/og";
void React; // the tests run this file outside Next.js, where JSX needs React in scope

// Watermarked downloads of Media pictures (owner, 3 Nov 2026). Server only. The picture is decoded, a badge with the NotesApp mark and
// "@username" is drawn in its bottom-right corner, and it is saved as a JPEG: the downloaded file always says where it came from and
// whose it is. Nothing to install: the badge is drawn by next/og (what certificates and course covers use) and the picture is decoded and
// encoded by the WebAssembly codecs Next.js ships for its image optimiser (as lib/cover-render.tsx does; next.config.js traces them).

export type Rgba = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

type Codecs = {
  decodeBuffer: (b: Buffer | Uint8Array) => Promise<Rgba>;
  encodeJpeg: (img: Rgba, o: { quality: number }) => Promise<Uint8Array | Buffer>;
};
let codecs: Codecs | null = null;
function loadCodecs(): Codecs {
  // Kept out of the bundle: it loads its own .wasm files from node_modules.
  const req = eval("require") as NodeRequire;
  codecs ??= req("next/dist/server/lib/squoosh/impl") as Codecs;
  return codecs;
}

// The badge's size for a picture: about 5.5% of the shorter side tall, never smaller than 26 px or wider than 70% of the picture.
export function badgeBox(width: number, height: number, username: string): { w: number; h: number; margin: number; font: number } {
  const h = Math.max(26, Math.round(Math.min(width, height) * 0.055));
  const font = Math.round(h * 0.42);
  const text = `@${username}`.length + "NotesApp".length;
  const w = Math.min(Math.round(width * 0.7), Math.round(h * 1.25 + text * font * 0.58 + h * 0.6));
  return { w: Math.max(h * 2, w), h, margin: Math.max(8, Math.round(h * 0.35)), font };
}

// The badge itself, as PNG pixels: a dark rounded pill, the crimson "na" mark, "@username" and "NotesApp".
export async function renderBadge(username: string, w: number, h: number, font: number): Promise<Buffer> {
  const res = new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", background: "rgba(18,6,10,0.62)", borderRadius: h / 2, paddingLeft: h * 0.14, paddingRight: h * 0.4, color: "white" }}>
        <div style={{ display: "flex", width: h * 0.72, height: h * 0.72, borderRadius: h * 0.2, background: "#7a0328", alignItems: "center", justifyContent: "center", fontSize: font, fontWeight: 700, color: "white" }}>na</div>
        <div style={{ display: "flex", marginLeft: h * 0.22, fontSize: font, fontWeight: 700 }}>{`@${username}`}</div>
        <div style={{ display: "flex", marginLeft: h * 0.22, fontSize: font * 0.92, opacity: 0.85 }}>NotesApp</div>
      </div>
    ),
    { width: w, height: h },
  );
  return Buffer.from(await res.arrayBuffer());
}

// Lays `over` onto `base` at (x, y), mixing by `over`'s alpha. Pure, in place; parts outside `base` are skipped.
export function blendOver(base: Rgba, over: Rgba, x: number, y: number): void {
  for (let j = 0; j < over.height; j++) {
    const by = y + j;
    if (by < 0 || by >= base.height) continue;
    for (let i = 0; i < over.width; i++) {
      const bx = x + i;
      if (bx < 0 || bx >= base.width) continue;
      const o = (j * over.width + i) * 4, b = (by * base.width + bx) * 4;
      const a = over.data[o + 3] / 255;
      if (a === 0) continue;
      for (let c = 0; c < 3; c++) base.data[b + c] = Math.round(over.data[o + c] * a + base.data[b + c] * (1 - a));
      base.data[b + 3] = 255;
    }
  }
}

// The whole job: any picture we accept (WebP, JPEG, PNG, GIF's first frame, AVIF) in, a watermarked JPEG out.
export async function watermarkPicture(input: Buffer, username: string, quality = 88): Promise<Buffer> {
  const { decodeBuffer, encodeJpeg } = loadCodecs();
  // The codec's image hands out a fresh copy of its pixels on every `.data`, so each is read once into a plain image.
  const plain = (x: Rgba): Rgba => ({ data: x.data, width: x.width, height: x.height });
  const img = plain(await decodeBuffer(input));
  const box = badgeBox(img.width, img.height, username);
  const badge = plain(await decodeBuffer(await renderBadge(username, box.w, box.h, box.font)));
  blendOver(img, badge, img.width - box.w - box.margin, img.height - box.h - box.margin);
  // JPEG has no transparency: what was see-through becomes white, as most galleries would show it.
  for (let k = 3; k < img.data.length; k += 4) {
    const a = img.data[k];
    if (a === 255) continue;
    for (let c = 1; c <= 3; c++) img.data[k - c] = Math.round(img.data[k - c] * (a / 255) + 255 * (1 - a / 255));
    img.data[k] = 255;
  }
  return Buffer.from(await encodeJpeg(img, { quality }));
}

// The mark for video downloads (lib/media-video-dl.ts): a PNG with a TRANSPARENT background, for a Cloudflare Stream watermark profile.
// No pill behind it: the crimson "na" square, "@username" and "NotesApp" in white with a soft dark edge so they read on light and dark
// frames alike. Stream lays it on at the admin's opacity (see-through), size and corner, so the image itself is drawn solid here.
export const VIDEO_MARK_SIZE = { w: 720, h: 120 };
export async function renderVideoMark(username: string): Promise<Buffer> {
  const { w, h } = VIDEO_MARK_SIZE;
  const font = Math.round(h * 0.42);
  const edge = "0 0 6px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)";
  const res = new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "flex-end", background: "transparent", color: "white", paddingRight: h * 0.08 }}>
        <div style={{ display: "flex", width: h * 0.74, height: h * 0.74, borderRadius: h * 0.2, background: "#7a0328", alignItems: "center", justifyContent: "center", fontSize: font, fontWeight: 700, color: "white" }}>na</div>
        <div style={{ display: "flex", marginLeft: h * 0.2, fontSize: font, fontWeight: 700, textShadow: edge }}>{`@${username}`}</div>
        <div style={{ display: "flex", marginLeft: h * 0.2, fontSize: font * 0.9, textShadow: edge }}>NotesApp</div>
      </div>
    ),
    { width: w, height: h },
  );
  return Buffer.from(await res.arrayBuffer());
}
