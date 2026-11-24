import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

// The share card of a Notes Arcade tournament and of the tournaments list (owner, 24 Nov 2026: "share cards ... for each tournament"):
// 1200 × 630, the Arcade's own look (dark board green, lime accents, the serif headline of the Arcade pages), for WhatsApp, X and
// Facebook link previews. Drawn by app/(arcade)/arcade/tournaments/opengraph-image.tsx and .../[id]/opengraph-image.tsx.
// Fonts come from assets/fonts (OFL), as lib/certificate-image.tsx loads them; if they can't be read the card still draws in the
// renderer's own font rather than failing the preview.

export const CARD_SIZE = { width: 1200, height: 630 };
const INK = "#17251f", BOARD = "#1b2a23", GREEN = "#bdf36b", DEEP = "#83b83c", PAPER = "#f7f7f2", MUTED = "#a9b8ae";

type Font = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  const f = (name: string, file: string, weight: Font["weight"]) => readFile(path.join(process.cwd(), "assets/fonts", file)).then((data) => ({ name, data, weight, style: "normal" as const }));
  fonts ??= Promise.all([f("Inter", "Inter-400.ttf", 400), f("Inter", "Inter-700.ttf", 700), f("Newsreader", "Newsreader-700.ttf", 700), f("Mono", "JetBrainsMono-700.ttf", 700)])
    .catch(() => { fonts = null; return []; });
  return fonts;
}

export type CardFace = {
  kicker: string; // "WHOT TOURNAMENT"
  title: string; // the tournament's name
  sponsor?: string; // "Sponsored by …"
  lines: string[]; // dates, prizes headline, who may play
};

export async function tournamentCard(face: CardFace): Promise<ImageResponse> {
  const loaded = await loadFonts();
  const has = (n: string) => loaded.some((x) => x.name === n);
  const serif = has("Newsreader") ? "Newsreader" : "serif", sans = has("Inter") ? "Inter" : "sans-serif", mono = has("Mono") ? "Mono" : "monospace";
  const big = face.title.length > 48 ? 64 : face.title.length > 28 ? 80 : 96;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: BOARD, padding: 40, fontFamily: sans }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, borderRadius: 32, border: `3px solid ${DEEP}`, padding: "48px 60px", background: INK }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: GREEN, color: INK, fontFamily: mono, fontSize: 24, fontWeight: 700 }}>[na]</div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: PAPER }}>Notes Arcade</div>
            </div>
            <div style={{ display: "flex", fontFamily: mono, fontSize: 22, fontWeight: 700, letterSpacing: 3, color: INK, background: GREEN, borderRadius: 999, padding: "10px 24px" }}>{face.kicker}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: serif, fontSize: big, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2, color: PAPER }}>{face.title}</div>
            {face.sponsor && <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: GREEN, marginTop: 18 }}>{face.sponsor}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {face.lines.filter(Boolean).map((l, i) => (
              <div key={i} style={{ display: "flex", fontSize: i === 0 ? 30 : 26, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? PAPER : MUTED }}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...CARD_SIZE, ...(loaded.length ? { fonts: loaded } : {}) },
  );
}
