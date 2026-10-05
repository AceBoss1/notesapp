"use client";

import { useEffect, useState } from "react";
import { badgeLevel, getUserByUsername, goldKindOf, roleLabelFor, UserProfile } from "@/lib/users";
import { getFollowerCount } from "@/lib/follows";
import { GOLD_BADGE_TITLE } from "@/lib/badges";
import VerifiedBadge from "@/components/VerifiedBadge";
import { OrgLabel } from "@/components/OrgNotice";
import SocialLinksRow from "@/components/SocialLinksRow";
import FollowButton from "@/components/FollowButton";
import GiftButton from "@/components/GiftButton";
import { useSite } from "./SiteContext";

// The member's profile block at the top of their Home page: logo, name with its badges, role, bio, the gold endorsement
// line, social icons, followers and join date, and the Follow / Gift buttons. The same facts as their #NotesApp profile.
export default function SiteProfileHeader() {
  const site = useSite();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followers, setFollowers] = useState<number | null>(null);

  useEffect(() => {
    getUserByUsername(site.username).then(setProfile).catch(() => setProfile(null));
    getFollowerCount(site.username).then(setFollowers).catch(() => setFollowers(null));
  }, [site.username]);

  const badge = profile ? badgeLevel(profile) : null;
  const gold = profile ? goldKindOf(profile) : undefined;
  const joinedAt = profile?.createdAt ? new Date(profile.createdAt) : null;
  const joined = joinedAt && !Number.isNaN(joinedAt.getTime()) ? joinedAt.toLocaleDateString("en-NG", { month: "long", year: "numeric" }) : "";

  return (
    <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={site.avatar} alt={site.displayName} className="h-28 w-28 shrink-0 rounded-2xl border border-rule object-cover" />
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 font-display text-4xl text-ink">
          {site.displayName}
          {badge && <VerifiedBadge size={22} level={badge} goldKind={gold} />}
          <OrgLabel profile={profile} />
        </h1>
        {profile && <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">{roleLabelFor(profile)} · @{site.username}</p>}
        {site.bio && <p className="mt-3 max-w-xl text-base text-slate">{site.bio}</p>}
        {badge === "gold" && gold && <p className="mt-1 text-xs font-semibold text-slate">{GOLD_BADGE_TITLE[gold].replace("Gold badge — ", "Gold ✔ · ")}</p>}
        <SocialLinksRow social={site.social} />
        {(followers !== null || joined) && (
          <p className="mt-2 font-mono text-xs text-slate">
            {followers !== null && <>{followers} follower{followers === 1 ? "" : "s"}</>}
            {followers !== null && joined && " · "}
            {joined && <>Joined {joined}</>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-3 sm:ml-auto">
        <FollowButton username={site.username} />
        <GiftButton username={site.username} publisherUid={site.uid} />
      </div>
    </section>
  );
}
