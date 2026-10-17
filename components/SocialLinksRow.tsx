import type { ReactNode } from "react";
import Link from "next/link";
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
// it can't read isn't shown. On your own profile (`editable`) a pencil after the icons opens Edit profile at Social links, and with no
// links yet an "Add your social links" button shows instead.
export default function SocialLinksRow({ social, className = "", editable = false }: { social?: SocialLinks; className?: string; editable?: boolean }) {
  const links = LINKS.map((l) => ({ ...l, href: socialHref(l.key, social?.[l.key]) })).filter((l): l is typeof l & { href: string } => !!l.href);
  if (links.length === 0) {
    if (!editable) return null;
    return <p className={`mt-3 flex ${className}`}><Link href="/profile/edit#links" className="rounded-full border border-dashed border-crimson/50 px-4 py-1.5 font-ui text-xs font-semibold text-crimson hover:bg-crimson/5">+ Add your social links</Link></p>;
  }
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
      {editable && (
        <Link href="/profile/edit#links" title="Edit your social links" aria-label="Edit your social links" className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-rule text-slate transition-colors hover:border-crimson hover:text-crimson">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /></svg>
        </Link>
      )}
    </p>
  );
}
