"use client";

import { headline } from "@/lib/profile-work";
import { useEffect, useState } from "react";
import { badgeLevel, getUserByUsername, goldKindOf, roleLabelFor, UserProfile } from "@/lib/users";
import { getFollowerCount } from "@/lib/follows";
import { GOLD_BADGE_TITLE } from "@/lib/badges";
import { NameBadgeIcons } from "@/components/PersonName";
import { badgesOf, NO_BADGES } from "@/lib/name-badges";
import { OrgLabel } from "@/components/OrgNotice";
import SocialLinksRow from "@/components/SocialLinksRow";
import FollowButton from "@/components/FollowButton";
import GiftButton from "@/components/GiftButton";
import { useSite } from "./SiteContext";

// The member's profile block at the top of their Home page: their cover photo if they set one, logo, name with its badges, role, bio, the gold endorsement
// line, social icons, followers and join date, and the Follow / Gift buttons. The same facts as their #NotesApp profile. `noCover`: the
// cover is already shown above, as the shop banner (SiteHome's StoreBanner).
export default function SiteProfileHeader({ noCover = false }: { noCover?: boolean }) {
  const ctx = useSite();
  const site = noCover ? { ...ctx, cover: "" } : ctx;
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

  // A cover across the top, the logo overlapping its lower edge: the member's photo, or the #NotesApp African pattern until they add one.
  return (
    <div>
    {site.cover ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={site.cover} alt="" className="aspect-[3/1] w-full rounded-2xl object-cover sm:aspect-[4/1]" />
    ) : <div aria-hidden className="na-pattern na-pattern-cover aspect-[3/1] w-full rounded-2xl border border-rule sm:aspect-[4/1]" />}
    <section className={`flex flex-col items-start gap-6 sm:flex-row px-2 sm:px-6`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={site.avatar} alt={site.displayName} className={`h-28 w-28 shrink-0 border object-cover relative -mt-14 border-4 border-paper bg-paper shadow-sm ${site.isOrg ? "rounded-2xl" : "rounded-full"}`} />
      <div className="min-w-0 sm:pt-4">
        <h1 className="flex flex-wrap items-center gap-2 font-display text-4xl text-ink">
          {site.displayName}
          <NameBadgeIcons username={site.username} size={22} badges={profile ? badgesOf(profile) : NO_BADGES} />
          <OrgLabel profile={profile} />
        </h1>
        {profile && headline(profile) && <p className="mt-1 text-base font-semibold text-ink">{headline(profile)}</p>}
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
      <div className="flex shrink-0 flex-wrap gap-3 sm:ml-auto sm:pt-4">
        <FollowButton username={site.username} />
        <GiftButton username={site.username} publisherUid={site.uid} />
      </div>
    </section>
    </div>
  );
}
