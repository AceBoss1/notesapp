"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import { NoteWithComputed } from "@/lib/firestore-notes";

export type DirectoryEntry = {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
};

export default function JournalDirectory({
  entries,
  allNotes,
  emptyMessage,
}: {
  entries: DirectoryEntry[];
  allNotes: NoteWithComputed[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {entries.map((entry) => {
        const journalCount = allNotes.filter((n) => n.author === entry.displayName).length;
        return (
          <div key={entry.username} className="card flex items-center gap-4 p-5">
            <Link href={`/u/${entry.username}`} className="flex flex-1 items-center gap-4">
              <Avatar src={entry.avatar} alt={entry.displayName} size={48} />
              <div>
                <p className="font-ui text-sm font-bold text-ink">{entry.displayName}</p>
                <p className="font-mono text-xs text-slate">
                  @{entry.username} · {journalCount} journal{journalCount === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
            <FollowButton username={entry.username} />
          </div>
        );
      })}
    </div>
  );
}
