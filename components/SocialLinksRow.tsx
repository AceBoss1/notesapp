import type { ReactNode } from "react";
import type { SocialLinks } from "@/lib/admin";
import { socialHref } from "@/lib/social-links";
import { FacebookIcon, GlobeIcon, InstagramIcon, LinkedInIcon, TikTokIcon, WhatsAppIcon, XIcon } from "@/components/ContactIcons";

const LINKS: { key: keyof SocialLinks; label: string; icon: ReactNode }[] = [
  { key: "linkedin", label: "LinkedIn", icon: <LinkedInIcon size={18} /> },
  { key: "instagram", label: "Instagram", icon: <InstagramIcon size={18} /> },
  { key: "facebook", label: "Facebook", icon: <FacebookIcon size={18} /> },
  { key: "twitter", label: "X", icon: <XIcon size={18} /> },
  { key: "tiktok", label: "TikTok", icon: <TikTokIcon size={18} /> },
  { key: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon size={18} /> },
  { key: "website", label: "Website", icon: <GlobeIcon size={18} /> },
];

// A member's social links, as saved on Edit profile, shown as a row of icons (the name is the hover text and the screen-reader
// label). What they typed is read by socialHref: full addresses, bare ones, handles and WhatsApp numbers all work; anything
// it can't read isn't shown.
export default function SocialLinksRow({ social, className = "" }: { social?: SocialLinks; className?: string }) {
  const links = LINKS.map((l) => ({ ...l, href: socialHref(l.key, social?.[l.key]) })).filter((l): l is typeof l & { href: string } => !!l.href);
  if (links.length === 0) return null;
  return (
    <p className={`mt-3 flex flex-wrap gap-2 ${className}`}>
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={l.label}
          aria-label={l.label}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-crimson transition-colors hover:border-crimson hover:bg-crimson hover:text-paper"
        >
          {l.icon}
        </a>
      ))}
    </p>
  );
}
