"use client";

import AppLink from "@/components/AppLink";
import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isFollowing, followJournal, unfollowJournal } from "@/lib/follows";
import { MANDATORY_USERNAMES } from "@/lib/journals-directory";

// `compactWhenFollowing`: on a profile, once you follow, the button steps aside on phones (where room for Book, Message and
// Gift is short) and stays on larger screens, where "Following" is how you unfollow.
export default function FollowButton({ username, compactWhenFollowing = false }: { username: string; compactWhenFollowing?: boolean }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mandatory = MANDATORY_USERNAMES.includes(username);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setFollowing(null);
      return;
    }
    // If the check fails, show the button anyway (as "Follow") instead of a loading bar that never ends.
    isFollowing(user.uid, username).then(setFollowing).catch((e) => { console.warn("[follow] check failed", e); setFollowing(false); });
  }, [user, username]);

  if (user === undefined || (user && following === null)) {
    return <div className="h-10 w-28 animate-pulse rounded-full bg-rule" />;
  }

  if (!user) {
    return (
      <AppLink href="/signup" className="btn-ghost !px-5 !py-2 text-xs">
        Sign up to follow
      </AppLink>
    );
  }

  if (mandatory) {
    return (
      <span
        title="Auto-followed for every member on the free tier — can't unfollow yet."
        className={`${compactWhenFollowing ? "hidden sm:inline-flex" : "inline-flex"} cursor-default items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/10 px-5 py-2 font-ui text-xs font-semibold text-crimson-bright`}
      >
        ✓ Following
      </span>
    );
  }

  async function toggle() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (following) {
        await unfollowJournal(user.uid, username);
        setFollowing(false);
      } else {
        await followJournal(user.uid, username, false);
        setFollowing(true);
      }
    } catch (e) {
      // Say so instead of failing silently; the code (e.g. permission-denied) tells us where to look.
      const code = (e as { code?: string })?.code;
      console.warn("[follow] failed", e);
      setError(e instanceof Error && !code ? e.message : `Couldn't ${following ? "unfollow" : "follow"} right now${code ? ` (${code})` : ""}. Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={`${compactWhenFollowing && following && !error ? "hidden sm:inline-flex" : "inline-flex"} flex-col items-start gap-1`}>
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
    {error && <span role="alert" className="max-w-[16rem] text-[11px] text-crimson">{error}</span>}
    </span>
  );
}
