"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import SubscribeButton from "@/components/SubscribeButton";
import StatsRow from "@/components/StatsRow";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useJournalStats } from "@/lib/useJournalStats";
import { OFFICIAL_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import { NOTESAPP_POSTS } from "@/lib/notesapp-posts";

// @notesapp isn't a person, so there's no calendar to book — the card
// that would be "Book a session" on an individual's profile is a
// Subscribe card here instead: subscribing to the channel is the
// analogous action for a brand journal.
export default function ChannelSpotlight() {
  // journalCount is the 5 hardcoded posts (lib/notesapp-posts.ts) —
  // @notesapp has no entries in the shared /notes collection at all,
  // by design (see lib/journals-directory.ts), so there's nothing to
  // filter allNotes for here.
  const journalCount = NOTESAPP_POSTS.length;
  const stats = useJournalStats(OFFICIAL_NOTESAPP_PROFILE.username, journalCount);

  return (
    <section className="card overflow-hidden border-crimson/30 bg-gradient-to-br from-crimson/5 to-transparent">
      <div className="p-8">
        <span className="eyebrow">Channel</span>
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar
            src={OFFICIAL_NOTESAPP_PROFILE.avatar}
            alt={OFFICIAL_NOTESAPP_PROFILE.displayName}
            size={72}
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl text-ink">
                {OFFICIAL_NOTESAPP_PROFILE.displayName}
              </h2>
              <VerifiedBadge />
              <span className="rounded-full bg-crimson/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wideish text-crimson-bright">
                Official
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate">
              This is the platform's own journal — build notes, feature
              announcements, and the occasional look behind the
              scenes at how #NotesApp is put together. Every member
              follows it automatically the moment they sign up, and it
              can't be unfollowed on the free tier, same as both
              founders' journals. Subscribing unlocks anything we mark
              premium here — early access notes, deeper build
              write-ups, that kind of thing.
            </p>
            <div className="mt-4">
              <StatsRow stats={stats} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <FollowButton username={OFFICIAL_NOTESAPP_PROFILE.username} />
              <Link href={`/u/${OFFICIAL_NOTESAPP_PROFILE.username}`} className="btn-ghost !px-5 !py-2 text-xs">
                View journal
              </Link>
            </div>
          </div>
        </div>

        {/* The Subscribe card — this is what sits where a "Book a
            session" card would on a person's profile. There's no
            calendar to book for a brand channel, but subscribing to
            unlock its premium entries is the equivalent action. */}
        <div className="mt-8 rounded-xl2 border border-crimson/30 bg-card p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="font-ui text-base font-bold text-ink">
              Subscribe to the #NotesApp channel
            </p>
            <p className="mt-1 text-sm text-slate">
              Unlocks every premium entry we publish here — early
              access notes and deeper build write-ups.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:shrink-0">
            <SubscribeButton username={OFFICIAL_NOTESAPP_PROFILE.username} />
          </div>
        </div>
      </div>
    </section>
  );
}
