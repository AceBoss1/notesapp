"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import { NameBadgeIcons } from "@/components/PersonName";
import type { NameBadges } from "@/lib/name-badges";

// "People and channels to follow": a row of small cards that scrolls sideways on a phone.
export type FollowCard = { username: string; displayName: string; avatar: string; isOrg?: boolean; badges?: NameBadges | null };
export default function FollowCards({ people }: { people: FollowCard[] }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {people.map((p) => (
        <div key={p.username} className="card flex w-44 flex-shrink-0 flex-col items-center p-4 text-center">
          <Link href={`/u/${p.username}`} className="flex flex-col items-center">
            <Avatar src={p.avatar} alt={p.displayName} size={56} square={p.isOrg} />
            <span className="mt-2 flex max-w-full items-center justify-center font-ui text-sm font-semibold text-ink">
              <span className="truncate">{p.displayName}</span>
              <NameBadgeIcons username={p.username} badges={p.badges} size={13} />
            </span>
            <span className="max-w-full truncate text-xs text-slate">@{p.username}</span>
          </Link>
          <div className="mt-3"><FollowButton username={p.username} /></div>
        </div>
      ))}
    </div>
  );
}
