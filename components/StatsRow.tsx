"use client";

import { JournalStats } from "@/lib/useJournalStats";

export default function StatsRow({ stats }: { stats: JournalStats }) {
  return (
    <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-slate">
      <span>
        <strong className="text-ink">{stats.journalCount}</strong> journal
        {stats.journalCount === 1 ? "" : "s"}
      </span>
      {!stats.followerUnavailable && (
        <span>
          <strong className="text-ink">{stats.followerCount ?? "…"}</strong> follower
          {stats.followerCount === 1 ? "" : "s"}
        </span>
      )}
      {!stats.subscriberUnavailable && (
        <span>
          <strong className="text-ink">{stats.subscriberCount ?? "…"}</strong> subscriber
          {stats.subscriberCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
