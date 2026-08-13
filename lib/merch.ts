// Official #NotesApp merch — demo catalogue, no real checkout or
// print-on-demand integration yet. Each item can be previewed with any
// of the brand's core or seasonal logos, matching /brand's wardrobe.

export type MerchItem = {
  id: string;
  name: string;
  emoji: string; // stand-in visual — no real product photography yet
  price: string;
};

export const MERCH_ITEMS: MerchItem[] = [
  { id: "tshirt", name: "T-Shirt", emoji: "👕", price: "₦12,000" },
  { id: "cap", name: "Cap", emoji: "🧢", price: "₦8,000" },
  { id: "mug", name: "Mug", emoji: "☕", price: "₦6,500" },
  { id: "stanley", name: "Stanley-Style Cup", emoji: "🥤", price: "₦18,000" },
  { id: "mousepad", name: "Mouse Pad", emoji: "🖱️", price: "₦5,000" },
  { id: "coffeecup", name: "Coffee Cup", emoji: "🫖", price: "₦6,000" },
  { id: "laptopbag", name: "Laptop Bag", emoji: "💼", price: "₦25,000" },
];

export type LogoOption = {
  id: string;
  label: string;
  image: string;
};

export const LOGO_OPTIONS: LogoOption[] = [
  { id: "core", label: "Core Mark", image: "/images/brand/notesapp-icon.webp" },
  { id: "valentines", label: "Valentine's Day", image: "/images/seasonal/valentines.webp" },
  { id: "eid-al-fitr", label: "Eid al-Fitr", image: "/images/seasonal/eid-al-fitr.webp" },
  { id: "eid-al-adha", label: "Eid al-Adha", image: "/images/seasonal/eid-al-adha.webp" },
  { id: "igbo-new-yam", label: "Igbo New Yam Festival", image: "/images/seasonal/igbo-new-yam-festival.webp" },
  { id: "eyo", label: "Lagos Eyo Festival", image: "/images/seasonal/lagos-eyo-festival.webp" },
  { id: "calabar", label: "Calabar Carnival", image: "/images/seasonal/calabar-carnival.webp" },
  { id: "argungu", label: "Argungu Fishing Festival", image: "/images/seasonal/arugungu-fishing-festival.webp" },
  { id: "christmas", label: "Christmas", image: "/images/seasonal/christmas.webp" },
];
