"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { formatSlot } from "@/lib/booking-time";

type Result = {
  status: string;
  kind: "booking" | "subscription" | "boost" | "gift" | "tier";
  tier?: { tier: string; interval: string };
  boost?: { noteId: string };
  gift?: { username: string; noteSlug?: string };
  booking?: { username: string; date: string; slot: string };
  subscription?: { username: string };
};

function Confirm() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setError("Missing payment reference.");
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Couldn't verify payment");
        setResult(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't verify payment");
      }
    });
  }, [reference]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      {error ? (
        <>
          <p className="font-display text-2xl text-ink">We couldn't confirm that payment</p>
          <p className="mt-3 text-sm text-slate">{error} If you were charged, contact us with reference {reference}.</p>
        </>
      ) : !result ? (
        <p className="text-sm text-slate">Confirming your payment…</p>
      ) : result.status === "paid" && result.kind === "subscription" && result.subscription ? (
        <>
          <p className="font-display text-2xl text-ink">You're subscribed ✓</p>
          <p className="mt-3 text-sm text-slate">Premium entries from @{result.subscription.username} are now unlocked. Renews monthly.</p>
          <Link href={`/u/${result.subscription.username}`} className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Back to journal
          </Link>
        </>
      ) : result.status === "paid" && result.kind === "tier" && result.tier ? (
        <>
          <p className="font-display text-2xl text-ink">Welcome to {result.tier.tier === "pro" ? "Pro" : "Business"} ✓</p>
          <p className="mt-3 text-sm text-slate">Your plan is active and renews {result.tier.interval === "annually" ? "yearly" : "monthly"}. Your lower commission applies from now.</p>
          <Link href="/profile/publishing" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Set up rates &amp; payouts
          </Link>
        </>
      ) : result.status === "paid" && result.kind === "boost" ? (
        <>
          <p className="font-display text-2xl text-ink">Boost is live ✓</p>
          <p className="mt-3 text-sm text-slate">Your post now rotates in the Boosted slots on the home and Journals pages. Impressions are counted once a real visitor has seen it, spread over several days.</p>
          <Link href="/profile/publishing" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            See boost results
          </Link>
        </>
      ) : result.status === "paid" && result.kind === "gift" && result.gift ? (
        <>
          <p className="font-display text-2xl text-ink">Gift sent 🎁</p>
          <p className="mt-3 text-sm text-slate">Thank you — @{result.gift.username} has been notified.</p>
          <Link href={result.gift.noteSlug ? `/journals/${result.gift.noteSlug}` : `/u/${result.gift.username}`} className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Back
          </Link>
        </>
      ) : result.status === "paid" && result.booking ? (
        <>
          <p className="font-display text-2xl text-ink">Session booked ✓</p>
          <p className="mt-3 text-sm text-slate">
            {result.booking.date} at {formatSlot(result.booking.slot)} (Lagos time) with @{result.booking.username}. A confirmation email is on its way.
          </p>
          <Link href={`/u/${result.booking.username}`} className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Back to profile
          </Link>
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-ink">Slot no longer available</p>
          <p className="mt-3 text-sm text-slate">
            Your payment went through but someone booked that time first. We'll refund you — contact us with reference {reference}.
          </p>
        </>
      )}
    </div>
  );
}

export default function BookingConfirmPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-slate">Loading…</p>}>
      <Confirm />
    </Suspense>
  );
}
