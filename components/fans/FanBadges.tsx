"use client";

import { useEffect, useState } from "react";
import { TIER_BADGE, TIER_NAME, type RankBadge, type SubTier } from "@/lib/fans";

// The fan and subscription badges next to a name in a creator's space (lib/fans.ts): "🥇 Emmanuel's Top Fan" and "🏆 VVIP". Loaded
// once per list of names from /api/fans/badges (cached a minute), so a comment thread costs one request.
export type FanBadge = { rank?: RankBadge & { place: number }; tier?: SubTier };

const RANK_STYLE: Record<RankBadge["tone"], string> = {
  gold: "bg-[#FFF4D6] text-[#8A5A00] border-[#EBC867]",
  silver: "bg-[#F1F2F5] text-[#4B5563] border-[#CBD0D8]",
  bronze: "bg-[#F8E7DA] text-[#8A4A1F] border-[#DDB394]",
  top10: "bg-[#FBEFEF] text-crimson border-[#EBC7CF]",
  top99: "bg-[#F3F0EC] text-slate border-rule",
};
const TIER_STYLE: Record<SubTier, string> = {
  vvip: "bg-gradient-to-r from-[#2A1A12] to-[#4E0119] text-[#F6D27A] border-[#B9831A]",
  vip: "bg-[#E9EEF8] text-[#2B3A8C] border-[#B9C4E6]",
  premium: "bg-[#EAF3EC] text-[#3D5A45] border-[#BFD6C6]",
};
const chip = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-ui text-[11px] font-bold leading-tight";

export function RankChip({ rank }: { rank: RankBadge }) {
  return <span className={`${chip} ${RANK_STYLE[rank.tone]}`} title={rank.label}>{rank.emoji} {rank.label}</span>;
}
export function TierChip({ tier }: { tier: SubTier }) {
  const b = TIER_BADGE[tier];
  return <span className={`${chip} ${TIER_STYLE[tier]}`} title={`${TIER_NAME[tier]} subscriber`}>{b.emoji} {b.label}</span>;
}
export function FanChips({ badge }: { badge?: FanBadge | null }) {
  if (!badge || (!badge.rank && !badge.tier)) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {badge.rank && <RankChip rank={badge.rank} />}
      {badge.tier && <TierChip tier={badge.tier} />}
    </span>
  );
}

// The badges for these people in this creator's space.
export function useFanBadges(creatorUsername: string | null | undefined, uids: string[]): Record<string, FanBadge> {
  const [badges, setBadges] = useState<Record<string, FanBadge>>({});
  const key = Array.from(new Set(uids)).sort().join(",");
  useEffect(() => {
    if (!creatorUsername || !key) return;
    let on = true;
    fetch(`/api/fans/badges?creator=${encodeURIComponent(creatorUsername)}&uids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (on && j?.badges) setBadges(j.badges); })
      .catch(() => {});
    return () => { on = false; };
  }, [creatorUsername, key]);
  return badges;
}
