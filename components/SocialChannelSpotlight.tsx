"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import SubscribeButton from "@/components/SubscribeButton";
import StatsRow from "@/components/StatsRow";
import JournalRow from "@/components/JournalRow";
import { useJournalStats } from "@/lib/useJournalStats";
import { NA_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import { NoteWithComputed } from "@/lib/firestore-notes";

// Unlike @notesapp, this channel's entries are real notes — an admin
// posts as it via the author toggle in NoteForm.tsx. Shown here by
// default (not buried behind the Channels tab) so it's actually
// discoverable the moment something's published under it.
export default function SocialChannelSpotlight({ allNotes }: { allNotes: NoteWithComputed[] }) {
  const posts = allNotes.filter((n) => n.author === NA_NOTESAPP_PROFILE.displayName);
  const stats = useJournalStats(NA_NOTESAPP_PROFILE.username, posts.length);

  return (
    <section className="card p-8">
      <span className="eyebrow">Channel</span>
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar src={NA_NOTESAPP_PROFILE.avatar} alt={NA_NOTESAPP_PROFILE.displayName} size={64} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl text-ink">{NA_NOTESAPP_PROFILE.displayName}</h2>
            <span className="rounded-full bg-crimson/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wideish text-crimson-bright">
              @na-notesapp
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate">{NA_NOTESAPP_PROFILE.bio}</p>
          <div className="mt-4">
            <StatsRow stats={stats} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <FollowButton username={NA_NOTESAPP_PROFILE.username} />
            <SubscribeButton username={NA_NOTESAPP_PROFILE.username} />
            <Link href={`/u/${NA_NOTESAPP_PROFILE.username}`} className="btn-ghost !px-5 !py-2 text-xs">
              View journal
            </Link>
          </div>
        </div>
      </div>

      {posts.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-rule pt-6 sm:grid-cols-2">
          {posts.slice(0, 4).map((n) => (
            <JournalRow key={n.id} note={n} />
          ))}
        </div>
      )}
    </section>
  );
}
