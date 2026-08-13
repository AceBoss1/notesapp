"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isSubscribed } from "@/lib/subscriptions";
import SubscribeButton from "./SubscribeButton";

export default function PremiumGate({
  premium,
  authorUsername,
  authorName,
  contentHtml,
}: {
  premium: boolean;
  authorUsername: string;
  authorName: string;
  contentHtml: string;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(!premium);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!premium) return;
    if (!user) {
      setUnlocked(false);
      return;
    }
    isSubscribed(user.uid, authorUsername).then(setUnlocked);
  }, [user, premium, authorUsername]);

  const prose =
    "prose prose-lg max-w-none font-body text-ink prose-headings:font-display prose-a:text-crimson-bright";

  if (!premium || unlocked) {
    return <div className={`mt-10 ${prose}`} dangerouslySetInnerHTML={{ __html: contentHtml }} />;
  }

  return (
    <div className="mt-10">
      <div className="relative">
        <div
          className={`${prose} max-h-56 overflow-hidden`}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />
      </div>
      <div className="card mt-2 p-8 text-center">
        <p className="font-display text-xl text-ink">
          🔒 This entry is for {authorName.split(" ")[0]}'s subscribers
        </p>
        <p className="mt-2 text-sm text-slate">
          Subscribe to unlock every premium entry in this journal.
        </p>
        <div className="mt-5 flex justify-center">
          <SubscribeButton username={authorUsername} />
        </div>
      </div>
    </div>
  );
}
