import type { SocialLinks } from "@/lib/admin";

const LABELS: { key: keyof SocialLinks; label: string }[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "twitter", label: "X" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "website", label: "Website" },
];

// A member's social links, as saved on Edit profile. Only http(s) URLs are
// rendered as links (the value is user-entered).
export default function SocialLinksRow({ social }: { social?: SocialLinks }) {
  const links = LABELS.filter((l) => /^https?:\/\//i.test(social?.[l.key] || ""));
  if (links.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-ui text-xs font-semibold text-crimson">
      {links.map((l) => (
        <a key={l.key} href={social![l.key]} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-crimson-bright">
          {l.label} ↗
        </a>
      ))}
    </p>
  );
}
