import type { Tier } from "@/lib/partner-network";
import { TIER_LABEL } from "@/lib/partner-network";

// The partner tier chip. Certified and Premier carry a shield with a tick inside (owner, 9 Nov 2026: "certified partner badges should
// have this shield ⛨ with ✔ inside"): drawn in SVG so it looks the same on every device, where the emoji wouldn't.
export function ShieldCheck({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M12 2.5 4 5.5v6.2c0 4.9 3.4 8.8 8 9.8 4.6-1 8-4.9 8-9.8V5.5l-8-3Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m8.3 12.2 2.6 2.6 5-5.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const tierClass = (t: Tier) => t === "premier" ? "bg-crimson-deep text-[#F4B860]" : t === "certified" ? "bg-crimson text-paper" : "bg-field text-ink";

export default function TierBadge({ tier, suffix = "", className = "" }: { tier: Tier; suffix?: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold ${tierClass(tier)} ${className}`}>
      {tier !== "registered" && <ShieldCheck />}{TIER_LABEL[tier]}{suffix}
    </span>
  );
}
