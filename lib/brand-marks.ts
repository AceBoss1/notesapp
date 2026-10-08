// The #NotesApp icon marks (shown on /brand, and offered as chat stickers: see lib/stickers.ts).
export const ICON_MARKS = [
  { id: "icon", file: "/images/brand/notesapp-icon.webp", label: "#NotesApp icon" },
  { id: "icon-alt", file: "/images/brand/notesapp-icon-alt.webp", label: "#NotesApp icon (alternate)" },
] as const;

// Seasonal and festival versions of the icon (files are in public/images/seasonal, as .webp).
export const SEASONAL = [
  { file: "valentines.png", label: "Valentine's Day" },
  { file: "eid-al-fitr.png", label: "Eid al-Fitr" },
  { file: "eid-al-adha.png", label: "Eid al-Adha" },
  { file: "igbo-new-yam-festival.png", label: "Igbo New Yam Festival" },
  { file: "lagos-eyo-festival.png", label: "Lagos Eyo Festival" },
  { file: "calabar-carnival.png", label: "Calabar Carnival" },
  { file: "arugungu-fishing-festival.png", label: "Argungu Fishing Festival" },
  { file: "christmas.png", label: "Christmas" },
];
