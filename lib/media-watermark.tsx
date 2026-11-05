import React from "react";
import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { MARK_CRIMSON, MARK_WORD, WATERMARK_DEFAULTS, markGeometry, shapeSize, type MarkGeometry, type MarkShape, type WatermarkSettings } from "./media-mark";
void React; // the tests run this file outside Next.js, where JSX needs React in scope

// Draws the permanent NotesApp mark (lib/media-mark.ts has the look and the geometry). Server only. The marks are drawn by next/og (what
// certificates and course covers use) in Inter from assets/fonts, and pictures are decoded and encoded by the WebAssembly codecs Next.js
// ships for its image optimiser (as lib/cover-render.tsx does; next.config.js traces them and the fonts).

export type Rgba = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

type Codecs = {
  decodeBuffer: (b: Buffer | Uint8Array) => Promise<Rgba>;
  encodeJpeg: (img: Rgba, o: { quality: number }) => Promise<Uint8Array | Buffer>;
  encodeWebp: (img: Rgba, o: { quality: number }) => Promise<Uint8Array | Buffer>;
};
let codecs: Codecs | null = null;
function loadCodecs(): Codecs {
  // Kept out of the bundle: it loads its own .wasm files from node_modules.
  const req = eval("require") as NodeRequire;
  codecs ??= req("next/dist/server/lib/squoosh/impl") as Codecs;
  return codecs;
}
type Font = { name: string; data: Buffer; weight: 700 | 800; style: "normal" };
let fonts: Promise<Font[]> | null = null;
const loadFonts = () => (fonts ??= Promise.all([700, 800].map(async (w) => ({ name: "Inter", data: await readFile(path.join(process.cwd(), `assets/fonts/Inter-${w}.ttf`)), weight: w as 700 | 800, style: "normal" as const })))
  .catch((e) => { fonts = null; throw e; }));

// The faint full logo, filling its box (lib/media-mark.ts markGeometry().centre).
function Centre({ g }: { g: MarkGeometry }) {
  const c = g.centre;
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", opacity: c.opacity, fontFamily: "Inter" }}>
      <div style={{ display: "flex", width: c.square, height: c.square, borderRadius: c.square * 0.18, background: MARK_CRIMSON, color: "white", alignItems: "center", justifyContent: "center", fontSize: Math.round(c.square * (8.5 / 15)), fontWeight: 800 }}>na</div>
      <div style={{ display: "flex", marginLeft: c.gap, fontSize: c.font, fontWeight: 800, color: "white", lineHeight: 1, textShadow: `0 0 ${Math.max(1, Math.round(c.font * 0.07))}px rgba(0,0,0,0.6)` }}>{MARK_WORD}</div>
    </div>
  );
}
// "na @username" in the corner, filling its box from the corner's side.
function Corner({ g }: { g: MarkGeometry }) {
  const k = g.corner;
  const edge = `0 ${Math.max(1, Math.round(k.font * 0.06))}px ${Math.max(2, Math.round(k.font * 0.16))}px rgba(0,0,0,0.85), 0 0 ${Math.max(1, Math.round(k.font * 0.05))}px rgba(0,0,0,0.9)`;
  const right = k.corner === "lowerRight" || k.corner === "upperRight";
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: right ? "flex-end" : "flex-start", opacity: k.opacity, fontFamily: "Inter" }}>
      <div style={{ display: "flex", width: k.square, height: k.square, borderRadius: k.square * 0.18, background: MARK_CRIMSON, color: "white", alignItems: "center", justifyContent: "center", fontSize: k.font, fontWeight: 800, boxShadow: `0 ${Math.max(1, Math.round(k.font * 0.05))}px ${Math.max(2, Math.round(k.font * 0.14))}px rgba(0,0,0,0.6)` }}>na</div>
      <div style={{ display: "flex", marginLeft: k.gap, fontSize: k.font, fontWeight: 700, color: "white", lineHeight: 1, textShadow: edge }}>{k.text}</div>
    </div>
  );
}
// The corner's box is drawn wider than the estimate (on the corner's side nothing moves), so a username with wide letters still fits.
const cornerBox = (g: MarkGeometry) => {
  const k = g.corner, right = k.corner === "lowerRight" || k.corner === "upperRight";
  const w = Math.min(g.width, Math.round(k.w * 1.3) + 4), h = k.h + 8;
  return { x: right ? Math.max(0, k.x + k.w - w) : k.x, y: Math.max(0, k.y - 4), w, h };
};
const png = async (node: React.ReactElement, width: number, height: number) =>
  Buffer.from(await new ImageResponse(node, { width: Math.max(1, width), height: Math.max(1, height), fonts: await loadFonts() }).arrayBuffer());

// The marks for a frame of width × height, as one PNG with a transparent background (a video's watermark profile).
export async function renderMarks(width: number, height: number, username: string, s: WatermarkSettings = WATERMARK_DEFAULTS): Promise<Buffer> {
  const g = markGeometry(width, height, username, s), cb = cornerBox(g);
  return png(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "transparent" }}>
      <div style={{ display: "flex", position: "absolute", left: 0, top: g.centre.y, width: g.width, height: g.centre.h }}><Centre g={g} /></div>
      <div style={{ display: "flex", position: "absolute", left: cb.x, top: cb.y, width: cb.w, height: cb.h }}><Corner g={g} /></div>
    </div>, g.width, g.height);
}

// The PNG for a creator's Cloudflare Stream watermark profile of one frame shape (lib/media-mark.ts MARK_SHAPES): the whole frame,
// transparent, with both marks in place. Stream lays it on at scale 1.0 in the centre.
export const renderVideoMark = (username: string, shape: MarkShape, s: WatermarkSettings = WATERMARK_DEFAULTS) => {
  const { w, h } = shapeSize(shape);
  return renderMarks(w, h, username, s);
};

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
      base.data[b + 3] = Math.max(base.data[b + 3], Math.round(255 * a + base.data[b + 3] * (1 - a)));
    }
  }
}

export type MarkedPicture = { bytes: Buffer; type: "image/webp" | "image/jpeg"; ext: "webp" | "jpg"; width: number; height: number };
// The whole job for a picture: any picture we accept (WebP, JPEG, PNG, GIF's first frame, AVIF) in, the marked picture out. A WebP stays
// WebP (what the studio uploads); anything else becomes a JPEG (what was see-through becomes white, as most galleries would show it).
export async function markPicture(input: Buffer, username: string, s: WatermarkSettings = WATERMARK_DEFAULTS, quality = 86): Promise<MarkedPicture> {
  const { decodeBuffer, encodeJpeg, encodeWebp } = loadCodecs();
  // The codec's image hands out a fresh copy of its pixels on every `.data`, so each is read once into a plain image.
  const plain = (x: Rgba): Rgba => ({ data: x.data, width: x.width, height: x.height });
  const img = plain(await decodeBuffer(input));
  // Each mark is drawn in its own box and laid on where it goes (much quicker than a whole transparent frame on a big photo).
  const g = markGeometry(img.width, img.height, username, s), cb = cornerBox(g);
  blendOver(img, plain(await decodeBuffer(await png(<Centre g={g} />, g.width, g.centre.h))), 0, g.centre.y);
  blendOver(img, plain(await decodeBuffer(await png(<Corner g={g} />, cb.w, cb.h))), cb.x, cb.y);
  const webp = input.subarray(0, 4).toString("latin1") === "RIFF" && input.subarray(8, 12).toString("latin1") === "WEBP";
  if (webp) return { bytes: Buffer.from(await encodeWebp(img, { quality })), type: "image/webp", ext: "webp", width: img.width, height: img.height };
  for (let k = 3; k < img.data.length; k += 4) {
    const a = img.data[k];
    if (a === 255) continue;
    for (let c = 1; c <= 3; c++) img.data[k - c] = Math.round(img.data[k - c] * (a / 255) + 255 * (1 - a / 255));
    img.data[k] = 255;
  }
  return { bytes: Buffer.from(await encodeJpeg(img, { quality })), type: "image/jpeg", ext: "jpg", width: img.width, height: img.height };
}
