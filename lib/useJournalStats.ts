"use client";

import { useEffect, useState } from "react";
import { getFollowerCount } from "@/lib/follows";
import { getSubscriberCount } from "@/lib/subscriptions";

export type JournalStats = {
  journalCount: number | null;
  followerCount: number | null;
  subscriberCount: number | null;
  followerUnavailable: boolean;
  subscriberUnavailable: boolean;
};

// journalCount is passed in, not fetched here — it comes from
// getAllNotes(), already loaded once by the page rather than re-queried
// per card. Follower/subscriber counts are each their own aggregation
// query per journal shown.
export function useJournalStats(username: string, journalCount: number): JournalStats {
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [followerUnavailable, setFollowerUnavailable] = useState(false);
  const [subscriberUnavailable, setSubscriberUnavailable] = useState(false);

  useEffect(() => {
    getFollowerCount(username)
      .then(setFollowerCount)
      .catch((err) => {
        console.warn(`Follower count unavailable for @${username}:`, err);
        setFollowerUnavailable(true);
      });
    getSubscriberCount(username)
      .then(setSubscriberCount)
      .catch((err) => {
        console.warn(`Subscriber count unavailable for @${username}:`, err);
        setSubscriberUnavailable(true);
      });
  }, [username]);

  return { journalCount, followerCount, subscriberCount, followerUnavailable, subscriberUnavailable };
}
