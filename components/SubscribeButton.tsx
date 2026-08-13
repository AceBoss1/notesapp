"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isSubscribed, subscribeToJournal } from "@/lib/subscriptions";

export default function SubscribeButton({ username }: { username: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setSubscribed(null);
      return;
    }
    isSubscribed(user.uid, username).then(setSubscribed);
  }, [user, username]);

  if (user === undefined || (user && subscribed === null)) {
    return <div className="h-10 w-40 animate-pulse rounded-full bg-rule" />;
  }

  if (!user) {
    return (
      <Link href="/signup" className="btn-primary !px-5 !py-2 text-xs">
        Sign up to subscribe
      </Link>
    );
  }

  if (subscribed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/10 px-5 py-2 font-ui text-xs font-semibold text-crimson-bright">
        ✓ Subscribed
      </span>
    );
  }

  async function handleSubscribe() {
    if (!user) return;
    setBusy(true);
    try {
      await subscribeToJournal(user.uid, username);
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={busy}
      className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50"
    >
      {busy ? "…" : "Subscribe (demo — no charge)"}
    </button>
  );
}
