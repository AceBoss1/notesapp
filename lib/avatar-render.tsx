import React from "react";
import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { AVATAR_MARK, AVATAR_SIZE } from "./avatar-maker";
import { toWebp } from "./cover-render";
void React; // the tests run this file outside Next.js, where JSX needs React in scope

// Puts the mark on a picture from the avatar maker: the [na] icon and "Made with Nana AI" bottom left with nothing behind them (owner, 17 Nov 2026: no white pill), on a square of
// AVATAR_SIZE. Server only. Drawn by next/og in Inter from assets/fonts, like the course covers (lib/cover-render.tsx), then made WebP.
const read = (p: string) => readFile(path.join(process.cwd(), p));
let loaded: Promise<{ font: Buffer; icon: string }> | null = null;
const load = () => (loaded ??= (async () => {
  const [font, icon] = await Promise.all([read("assets/fonts/Inter-800.ttf"), read("public/images/brand/icon-512.png")]);
  return { font, icon: `data:image/png;base64,${icon.toString("base64")}` };
})().catch((e) => { loaded = null; throw e; }));

export async function markAvatar(picture: Buffer, type: string): Promise<{ bytes: Buffer; type: "image/webp" | "image/png" }> {
  const { font, icon } = await load();
  const S = AVATAR_SIZE;
  const res = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: S, height: S, background: "#FBF6F2" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:${type};base64,${picture.toString("base64")}`} width={S} height={S} style={{ position: "absolute", left: 0, top: 0, width: S, height: S, objectFit: "cover" }} alt="" />
        <div style={{ display: "flex", alignItems: "center", position: "absolute", left: 32, bottom: 32, height: 56 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} width={56} height={56} style={{ borderRadius: 14 }} alt="" />
          <span style={{ marginLeft: 14, fontFamily: "Inter", fontWeight: 800, fontSize: 30, color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,0.55)" }}>{AVATAR_MARK}</span>
        </div>
      </div>
    ),
    { width: S, height: S, fonts: [{ name: "Inter", data: font, weight: 800, style: "normal" }] },
  );
  const png = Buffer.from(await res.arrayBuffer());
  const webp = await toWebp(png, 88);
  return webp ? { bytes: webp, type: "image/webp" } : { bytes: png, type: "image/png" };
}
