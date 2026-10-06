import { PARTNER_ICONS } from "@/lib/site";

// A reference customer's logo as a small rounded square, the size of the #NotesApp icon in the copyright bar.
export default function PartnerIcon({ partner, size = 16 }: { partner: keyof typeof PARTNER_ICONS; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={PARTNER_ICONS[partner]} alt="" width={size} height={size} className="inline-block shrink-0 rounded object-cover align-[-0.15em]" style={{ width: size, height: size }} />;
}
