"use client";

import AppLink from "@/components/AppLink";
import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isSubscribed } from "@/lib/subscriptions";
import { startCheckout } from "@/lib/checkout";
import { formatNaira, PublisherSettings } from "@/lib/booking-time";

export default function SubscribeButton({ username, publisherUid }: { username: string; publisherUid?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceKobo, setPriceKobo] = useState<number | null | undefined>(undefined); // null = not offered

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!publisherUid) {
      setPriceKobo(null);
      return;
    }
    getDoc(doc(db, "publisherSettings", publisherUid))
      .then((snap) => {
        const sub = (snap.data() as PublisherSettings | undefined)?.subscription;
        setPriceKobo(sub?.enabled && sub.planCode ? sub.priceKobo : null);
      })
      .catch(() => setPriceKobo(null));
  }, [publisherUid]);

  useEffect(() => {
    if (!user) {
      setSubscribed(null);
      return;
    }
    isSubscribed(user.uid, username).then(setSubscribed);
  }, [user, username]);

  if (user === undefined || priceKobo === undefined || (user && subscribed === null)) {
    return <div className="h-10 w-40 animate-pulse rounded-full bg-rule" />;
  }

  if (priceKobo === null && !subscribed) return null; // publisher hasn't opened subscriptions

  if (!user) {
    return (
      <AppLink href="/signup" className="btn-primary !px-5 !py-2 text-xs">
        Sign up to subscribe
      </AppLink>
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
    setError(null);
    try {
      await startCheckout(user, { kind: "subscription", username });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSubscribe}
        disabled={busy}
        className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50"
      >
        {busy ? "Redirecting…" : `Subscribe · ${formatNaira(priceKobo ?? 0)}/month`}
      </button>
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
    </div>
  );
}
