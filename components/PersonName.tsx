"use client";

import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import TeamBadge from "@/components/TeamBadge";
import { useBadges } from "@/lib/badges-client";
import type { NameBadges } from "@/lib/name-badges";

// A person's name the same way everywhere a name appears beside a picture: Name, then every badge they've earned (the ✔,
// maroon or gold, and the #NotesApp team mark), then @username. Pass `badges` when the profile is already loaded; otherwise
// they're looked up by username (lib/badges-client.ts, one request for a whole list).
export function NameBadgeIcons({ username, badges, size = 15 }: { username?: string | null; badges?: NameBadges | null; size?: number }) {
  const b = useBadges(username, badges);
  if (!b || (!b.level && !b.team)) return null;
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
      {b.level && <VerifiedBadge size={size} level={b.level} goldKind={b.goldKind} />}
      {b.team && <TeamBadge size={size} />}
    </span>
  );
}

export default function PersonName({
  name, username, badges, href, showUsername = true, size = 15, className = "", nameClassName = "font-semibold text-ink", usernameClassName = "text-slate",
}: {
  name: string; username?: string | null; badges?: NameBadges | null; href?: string | null; showUsername?: boolean; size?: number;
  className?: string; nameClassName?: string; usernameClassName?: string;
}) {
  const label = (
    <>
      <span className={nameClassName}>{name}</span>
      <NameBadgeIcons username={username} badges={badges} size={size} />
      {showUsername && username && <span className={`ml-1.5 ${usernameClassName}`}>@{username}</span>}
    </>
  );
  const link = href === undefined ? (username ? `/u/${username}` : null) : href;
  return link ? <Link href={link} className={`inline-flex min-w-0 flex-wrap items-center ${className}`}>{label}</Link> : <span className={`inline-flex min-w-0 flex-wrap items-center ${className}`}>{label}</span>;
}
