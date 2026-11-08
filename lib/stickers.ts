import { CAMPAIGN_MARKS, ICON_MARKS, SEASONAL, WORDMARK_MARKS } from "./brand-marks";

// Chat stickers: moment packs for big national days (MOMENT_PACKS, shown first) and every icon on the /brand page, each sent as a message
// of its own. A message stores only the sticker's id; the picture is one of our own static files, so nothing is uploaded and anything not
// in this list is refused.
export type Sticker = { id: string; label: string; src: string; wide?: boolean };

// Moment packs: stickers for a big national moment, first in the picker while it's fresh. Our own drawings (public/images/stickers/),
// each carrying the "na" mark. Add a pack at the top; older packs stay sendable (messages store only the id).
export const MOMENT_PACKS: { name: string; stickers: Sticker[] }[] = [
  {
    // Nigeria's Flamingos win the U-17 Women's World Cup, beating Japan 2-1 (7 November 2026).
    name: "Flamingos: world champions",
    stickers: [
      ["flamingos-champions", "Champions!"], ["flamingos-flamingo", "Flamingos!"], ["flamingos-score", "Full time: Nigeria 2, Japan 1"],
      ["flamingos-proud", "Proudly Naija"], ["flamingos-oshey", "Oshey Flamingos!"], ["flamingos-world-champions", "U-17 Women's World Champions 2026"],
    ].map(([id, label]) => ({ id, label, src: `/images/stickers/${id}.webp` })),
  },
];

export const STICKERS: Sticker[] = [
  ...MOMENT_PACKS.flatMap((p) => p.stickers),
  ...ICON_MARKS.map((m) => ({ id: m.id, label: m.label, src: m.file })),
  ...WORDMARK_MARKS.map((m) => ({ id: m.id, label: m.label, src: m.file, wide: true })),
  ...CAMPAIGN_MARKS.map((m) => ({ id: m.id, label: m.label, src: m.file, wide: true })),
  ...SEASONAL.map((s) => {
    const id = s.file.replace(/\.png$/, "");
    return { id, label: s.label, src: `/images/seasonal/${id}.webp` };
  }),
];

export const stickerById = (id: unknown): Sticker | undefined => STICKERS.find((s) => s.id === id);
