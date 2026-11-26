"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMember } from "@/lib/member-client";
import { followJournal, getFollowerCount, isFollowing, unfollowJournal } from "@/lib/follows";

// Follow a host's calendar (docs/EVENTS_DISCOVER.md). Following a calendar is following the account: you hear about each new public
// event (lib/events-server.ts sendAnnouncements) and see their journals in Following.
export default function FollowCalendar({ username, className = "" }: { username: string; className?: string }) {
  const { user } = useMember();
  const [on, setOn] = useState<boolean | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getFollowerCount(username).then(setCount).catch(() => {}); }, [username]);
  useEffect(() => { if (user) isFollowing(user.uid, username).then(setOn).catch(() => setOn(false)); else setOn(false); }, [user, username]);
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/events/calendar/${username}`)}`} className={`btn-ghost !px-4 !py-1.5 text-xs ${className}`}>Follow</Link>;
  async function toggle() {
    if (!user || on === null) return;
    setBusy(true);
    try {
      if (on) { await unfollowJournal(user.uid, username); setOn(false); setCount((c) => (c === null ? c : Math.max(0, c - 1))); }
      else { await followJournal(user.uid, username); setOn(true); setCount((c) => (c === null ? c : c + 1)); }
    } finally { setBusy(false); }
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button type="button" onClick={toggle} disabled={busy || on === null} aria-pressed={!!on} className={on ? "btn-ghost !px-4 !py-1.5 text-xs" : "btn-primary !px-4 !py-1.5 text-xs"}>{on ? "Following ✓" : "Follow"}</button>
      {count !== null && <span className="text-xs text-slate">{count.toLocaleString()} follower{count === 1 ? "" : "s"}</span>}
    </span>
  );
}
