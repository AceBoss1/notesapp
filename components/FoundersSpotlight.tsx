"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import SubscribeButton from "@/components/SubscribeButton";
import StatsRow from "@/components/StatsRow";
import { useJournalStats } from "@/lib/useJournalStats";
import { FOUNDER_JOURNALS } from "@/lib/journals-directory";
import { NoteWithComputed } from "@/lib/firestore-notes";

function FounderRow({
  founder,
  journalCount,
}: {
  founder: (typeof FOUNDER_JOURNALS)[number];
  journalCount: number;
}) {
  const stats = useJournalStats(founder.username, journalCount);

  return (
    <div className="flex flex-col gap-5 border-t border-rule p-6 first:border-t-0 sm:flex-row sm:items-center">
      <Link href={`/u/${founder.username}`} className="flex flex-1 items-center gap-4">
        <Avatar src={founder.avatar} alt={founder.displayName} size={64} />
        <div>
          <p className="font-ui text-base font-bold text-ink">{founder.displayName}</p>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            {founder.bio}
          </p>
          <div className="mt-1.5">
            <StatsRow stats={stats} />
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 flex-wrap gap-3">
        <FollowButton username={founder.username} />
        <SubscribeButton username={founder.username} />
      </div>
    </div>
  );
}

export default function FoundersSpotlight({ allNotes }: { allNotes: NoteWithComputed[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="p-8 pb-0">
        <span className="eyebrow">People</span>
        <h2 className="mt-2 font-display text-2xl text-ink">The founders' journals</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate">
          Auto-followed for every member, same as @notesapp — both run
          their entire practice on #NotesApp, publicly, from day one.
        </p>
      </div>
      <div className="mt-6">
        {FOUNDER_JOURNALS.map((founder) => (
          <FounderRow
            key={founder.username}
            founder={founder}
            journalCount={allNotes.filter((n) => n.author === founder.displayName).length}
          />
        ))}
      </div>
    </section>
  );
}
