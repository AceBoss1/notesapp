import type { SocialLinks } from "./admin";

// What members type into their social links on Edit profile, turned into a link we can show: a full address as it is, a
// bare domain ("linkedin.com/in/ada"), a handle ("@ada" or "ada" for X, Instagram, TikTok, LinkedIn, Facebook) or, for
// WhatsApp, a phone number (Nigerian 0803… becomes 234803…). Anything else gives null and isn't shown. The result is
// always an https:// address, so a typed "javascript:" or similar can never become a link.
const HANDLE = /^@?([A-Za-z0-9._-]{1,60})$/;
const COMMON_TLD = /\.(com|ng|net|org|co|io|me|africa|tech|app|biz|info)$/i;
const BASE: Partial<Record<keyof SocialLinks, (h: string) => string>> = {
  twitter: (h) => `https://x.com/${h}`,
  instagram: (h) => `https://instagram.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  linkedin: (h) => `https://www.linkedin.com/in/${h}`,
  facebook: (h) => `https://facebook.com/${h}`,
};

export function socialHref(key: keyof SocialLinks, raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || (key !== "whatsapp" && /\s/.test(v))) return null; // phone numbers may have spaces; addresses and handles can't
  if (/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v)) return v.replace(/^http:\/\//i, "https://");
  if (key === "whatsapp") {
    const digits = v.replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (/^\d{7,15}$/.test(digits)) return `https://wa.me/${digits.startsWith("0") ? `234${digits.slice(1)}` : digits}`;
    if (/^wa\.me\/\d{7,15}$/i.test(v)) return `https://${v}`;
    return null;
  }
  // A bare address: for a website anything that looks like one; for the networks only "x.com/…"-style addresses with a path
  // or a usual ending, since handles like "ada.okafor" have dots too.
  const domain = /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/\S*)?$/.test(v);
  if (domain && (key === "website" || v.includes("/") || COMMON_TLD.test(v))) return `https://${v}`;
  const h = v.match(HANDLE)?.[1];
  if (key === "linkedin" && /^in\/[A-Za-z0-9._-]+\/?$/i.test(v)) return `https://www.linkedin.com/${v.replace(/\/$/, "")}`;
  return h && BASE[key] ? BASE[key]!(h) : null;
}

// The same, for a whole set: the links to keep (normalised) and the ones we couldn't read.
export function cleanSocial(social: SocialLinks): { clean: SocialLinks; unreadable: (keyof SocialLinks)[] } {
  const clean: SocialLinks = {}, unreadable: (keyof SocialLinks)[] = [];
  for (const [k, v] of Object.entries(social) as [keyof SocialLinks, string | undefined][]) {
    if (!v?.trim()) continue;
    const href = socialHref(k, v);
    if (href) clean[k] = href; else unreadable.push(k);
  }
  return { clean, unreadable };
}
