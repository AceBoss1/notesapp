// Who appears in the "Trusted by" and "Partners and integrations" strips (home and About). Edit here; nothing else needs touching.
// Only add a name that is real: customers who agreed to be named, and services we actually connect to.

// Customers who run on #NotesApp, by username. Their name and logo come from their profile, so the strip follows what they change
// there (a company that upgrades to an organisation account just keeps showing). `what` is the short line under the name.
export const TRUSTED_BY: { username: string; what?: string }[] = [
  { username: "precheks", what: "Journal" },
  { username: "apexglitz", what: "Shop" },
  { username: "clickam", what: "Journal and shop" },
  { username: "lwb", what: "Shop and courses" },
  { username: "chef_adams" },
];

// Partners and the services #NotesApp is connected to. `logo` is a file in public/images/partners/; leave it out to show the name only.
// To add a logo: save the file there (SVG or PNG with a transparent background, about 80px tall is plenty) and add the line below.
// Still without a logo file: Paystack, Paylony, Dojah and LinkedIn (their logos come from each company's brand page).
export const PARTNERS: { name: string; what: string; logo?: string; href?: string }[] = [
  { name: "Whogohost (go54)", what: "Domain partner · gold partnership", logo: "/images/partners/whogohost-gold-partner.png", href: "/domains" },
  { name: "Paystack", what: "Payments in Naira" },
  { name: "Paylony", what: "Bank payouts" },
  { name: "Cloudflare", what: "Storage and video", logo: "/images/partners/cloudflare.svg" },
  { name: "Google Firebase", what: "Accounts and data", logo: "/images/partners/firebase.svg" },
  { name: "Vercel", what: "Hosting", logo: "/images/partners/vercel.svg" },
  { name: "Resend", what: "Email", logo: "/images/partners/resend.svg" },
  { name: "Dojah", what: "Identity checks" },
  { name: "LinkedIn", what: "Sharing your posts" },
  { name: "X", what: "Sharing your posts", logo: "/images/partners/x.svg" },
];
