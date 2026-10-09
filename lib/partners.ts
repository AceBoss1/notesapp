import { PARTNER_ICONS } from "./site";

// Who appears in the "Trusted by" and "Partners and integrations" strips (home and About). Edit here; nothing else needs touching.
// Only add a name that is real: customers who agreed to be named, and services we actually connect to.

// Customers who run on #NotesApp. Two so far; the strip only scrolls once there are enough names to make that worthwhile.
export const TRUSTED_BY: { name: string; what: string; icon: string; href?: string }[] = [
  { name: "Precheks", what: "Journal", icon: PARTNER_ICONS.precheks, href: "https://precheks.com.ng" },
  { name: "ApexGlitz Boutique", what: "Shop", icon: PARTNER_ICONS.apexglitz, href: "https://apexglitz.com.ng" },
];

// Partners and the services #NotesApp is connected to (plain names, no logos: those need each company's permission).
export const PARTNERS: { name: string; what: string; image?: string; href?: string }[] = [
  { name: "Whogohost (go54)", what: "Domain partner · gold partnership", image: "/images/partners/whogohost-gold-partner.png", href: "/domains" },
  { name: "Paystack", what: "Payments in Naira" },
  { name: "Paylony", what: "Bank payouts" },
  { name: "Cloudflare", what: "Storage and video" },
  { name: "Google Firebase", what: "Accounts and data" },
  { name: "Vercel", what: "Hosting" },
  { name: "Resend", what: "Email" },
  { name: "Dojah", what: "Identity checks" },
  { name: "LinkedIn", what: "Sharing your posts" },
  { name: "X", what: "Sharing your posts" },
];
