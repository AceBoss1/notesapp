import { ICON_MARKS, SEASONAL } from "./brand-marks";

// Chat stickers: every icon on the /brand page, sent as a message of its own. A message stores only the sticker's id; the picture is
// one of our own static files, so nothing is uploaded and anything not in this list is refused.
export type Sticker = { id: string; label: string; src: string };

export const STICKERS: Sticker[] = [
  ...ICON_MARKS.map((m) => ({ id: m.id, label: m.label, src: m.file })),
  ...SEASONAL.map((s) => {
    const id = s.file.replace(/\.png$/, "");
    return { id, label: s.label, src: `/images/seasonal/${id}.webp` };
  }),
];

export const stickerById = (id: unknown): Sticker | undefined => STICKERS.find((s) => s.id === id);
