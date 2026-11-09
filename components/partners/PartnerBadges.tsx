"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProfileBadge } from "@/lib/partner-network";

// A member's Partner Network badges on their profile: "Verified member of <association>", "Member of <chapter>", and "<Tier> NotesApp
// partner" for people who run a partner. Each links to the partner's page. Workplace staff are never shown.
export default function PartnerBadges({ uid, className = "" }: { uid?: string; className?: string }) {
  const [badges, setBadges] = useState<ProfileBadge[]>([]);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    fetch(`/api/partners/badges?uid=${encodeURIComponent(uid)}`).then((r) => r.json()).then((j) => { if (live) setBadges(j.badges ?? []); }).catch(() => {});
    return () => { live = false; };
  }, [uid]);
  if (!badges.length) return null;
  return (
    <ul className={`flex flex-wrap justify-center gap-1.5 sm:justify-start ${className}`} aria-label="Partner Network badges">
      {badges.map((b) => (
        <li key={b.href + b.label}>
          <Link href={b.href} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${b.kind === "partner" ? "bg-crimson-deep text-[#F4B860]" : "bg-field text-ink ring-1 ring-inset ring-rule"}`}>
            <span aria-hidden="true">{b.kind === "partner" ? "🤝" : "✔"}</span>{b.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
