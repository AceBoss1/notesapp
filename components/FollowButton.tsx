"use client";

import AppLink from "@/components/AppLink";
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
  const [error, setError] = useState<string | null>(null);

  const mandatory = MANDATORY_USERNAMES.includes(username);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setFollowing(null);
      return;
    }
    // If the check fails, show the button anyway (as "Follow") instead of a loading bar that never ends.
    isFollowing(user.uid, username).then((on) => {
      // An auto-followed account whose follow record was never written (the member joined outside the sign-up form's follow
      // step): write it now, so counts and lists include them too.
      if (!on && mandatory && user.uid) followJournal(user.uid, username, true).catch(() => {});
      setFollowing(on);
    }).catch((e) => { console.warn("[follow] check failed", e); setFollowing(false); });
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
        className="btn-ghost btn-following inline-flex cursor-default !px-5 !py-2 text-xs"
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
    <span className="inline-flex flex-col items-start gap-1">
    <button
      onClick={toggle}
      disabled={busy}
      className={
        following
          ? "btn-ghost btn-following !px-5 !py-2 text-xs disabled:opacity-50"
          : "btn-primary !px-5 !py-2 text-xs disabled:opacity-50"
      }
    >
      {busy ? "…" : following ? "✓ Following" : "Follow"}
    </button>
    {error && <span role="alert" className="max-w-[16rem] text-[11px] text-crimson">{error}</span>}
    </span>
  );
}
