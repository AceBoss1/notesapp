"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isFollowing, followJournal, unfollowJournal } from "@/lib/follows";
import { MANDATORY_USERNAMES } from "@/lib/journals-directory";

export default function FollowButton({ username }: { username: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const mandatory = MANDATORY_USERNAMES.includes(username);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setFollowing(null);
      return;
    }
    isFollowing(user.uid, username).then(setFollowing);
  }, [user, username]);

  if (user === undefined || (user && following === null)) {
    return <div className="h-10 w-28 animate-pulse rounded-full bg-rule" />;
  }

  if (!user) {
    return (
      <Link href="/signup" className="btn-ghost !px-5 !py-2 text-xs">
        Sign up to follow
      </Link>
    );
  }

  if (mandatory) {
    return (
      <span
        title="Auto-followed for every member on the free tier — can't unfollow yet."
        className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/10 px-5 py-2 font-ui text-xs font-semibold text-crimson-bright"
      >
        ✓ Following
      </span>
    );
  }

  async function toggle() {
    if (!user) return;
    setBusy(true);
    try {
      if (following) {
        await unfollowJournal(user.uid, username);
        setFollowing(false);
      } else {
        await followJournal(user.uid, username, false);
        setFollowing(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={
        following
          ? "btn-ghost !px-5 !py-2 text-xs disabled:opacity-50"
          : "btn-primary !px-5 !py-2 text-xs disabled:opacity-50"
      }
    >
      {busy ? "…" : following ? "Following" : "Follow"}
    </button>
  );
}
