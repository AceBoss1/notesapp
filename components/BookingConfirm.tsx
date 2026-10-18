"use client";

import AppLink from "@/components/AppLink";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { formatNaira, formatSlot } from "@/lib/booking-time";
import { forgetReturnHost, rememberedReturnHost } from "@/lib/return-to";

type Result = {
  status: string;
  kind: "booking" | "subscription" | "boost" | "gift" | "tier" | "badge" | "gold" | "gold_deposit" | "merch" | "ad" | "store" | "digital" | "wallet_topup" | "life_naira" | "nana_credit";
  amountKobo?: number;
  payWith?: "wallet";
  topup?: { bonusKobo: number };
  nanaPack?: { packId: string; name: string; creditKobo: number };
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
  // Bought from a member's own domain? Offer the way back to it.
  const [backHost, setBackHost] = useState<string | null>(null);
  useEffect(() => setBackHost(rememberedReturnHost()), []);

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
      ) : result.status === "paid" && result.kind === "life_naira" ? (
        <>
          <p className="font-display text-2xl text-ink">Notesville Naira added ✓</p>
          <p className="mt-3 text-sm text-slate">N$ {(result.amountKobo ?? 0).toLocaleString("en-NG")} is in your Notes Life bank. Game money: it can&apos;t be turned back into naira.</p>
          <AppLink href="/life/play" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">Back to Notes Life</AppLink>
        </>
      ) : result.status === "paid" && result.kind === "nana_credit" ? (
        <>
          <p className="font-display text-2xl text-ink">Nana credit added ✓</p>
          <p className="mt-3 text-sm text-slate">{formatNaira(result.nanaPack?.creditKobo ?? 0)} of Nana AI credit. It never expires, and Nana uses it after your free allowance.</p>
          <AppLink href="/nana#credit" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">Back to Nana</AppLink>
        </>
      ) : result.status === "paid" && result.kind === "wallet_topup" ? (
        <>
          <p className="font-display text-2xl text-ink">Added to your wallet ✓</p>
          <p className="mt-3 text-sm text-slate">
            {formatNaira(result.amountKobo ?? 0)} of NotesApp Credit{result.topup?.bonusKobo ? <>, plus {formatNaira(result.topup.bonusKobo)} in Bonus Credits</> : null}. Use it to pay for boosts, badges, adverts, gifts, shop items and sessions.
          </p>
          <AppLink href="/profile/wallet" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">Open your wallet</AppLink>
        </>
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
          <AppLink href="/profile/publishing" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Set up rates &amp; payouts
          </AppLink>
        </>
      ) : result.status === "paid" && result.kind === "badge" ? (
        <>
          <p className="font-display text-2xl text-ink">Verified badge added ✓</p>
          <p className="mt-3 text-sm text-slate">The ✔ now shows next to your name. It renews monthly; cancel any time under Edit profile.</p>
          <AppLink href="/profile/edit" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Back to profile
          </AppLink>
        </>
      ) : result.status === "paid" && result.kind === "gold" ? (
        <>
          <p className="font-display text-2xl text-ink">Gold badge active ✓</p>
          <p className="mt-3 text-sm text-slate">The gold ✔ now shows next to your name. It renews monthly; cancel any time on the badges page.</p>
          <Link href="/badges" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Back to badges
          </Link>
        </>
      ) : result.status === "paid" && result.kind === "gold_deposit" ? (
        <>
          <p className="font-display text-2xl text-ink">Deposit received ✓</p>
          <p className="mt-3 text-sm text-slate">Next, complete your identity check from the badges page. An admin then reviews the result.</p>
          <Link href="/badges" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Continue on badges page
          </Link>
        </>
      ) : result.status === "paid" && result.kind === "ad" ? (
        <>
          <p className="font-display text-2xl text-ink">Campaign submitted ✓</p>
          <p className="mt-3 text-sm text-slate">We review every ad before it goes live, usually within a day. If we can't run it you get a full refund. A confirmation email is on its way.</p>
          <Link href="/advertise/campaigns" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            See my campaigns
          </Link>
        </>
      ) : result.status === "paid" && result.kind === "store" ? (
        <>
          <p className="font-display text-2xl text-ink">Order placed ✓</p>
          <p className="mt-3 text-sm text-slate">Your money is held by #NotesApp until you confirm the parcel arrived. Follow it and confirm delivery on My orders. A confirmation email is on its way.</p>
          <AppLink href="/orders" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            My orders
          </AppLink>
        </>
      ) : result.status === "paid" && result.kind === "digital" ? (
        <>
          <p className="font-display text-2xl text-ink">Your download is ready ✓</p>
          <p className="mt-3 text-sm text-slate">Download it from My orders → My purchases. Digital downloads are final once downloaded, so there are no refunds after that. A confirmation email is on its way.</p>
          <AppLink href="/orders" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Go to my downloads
          </AppLink>
        </>
      ) : result.status === "paid" && result.kind === "merch" ? (
        <>
          <p className="font-display text-2xl text-ink">Pre-order confirmed ✓</p>
          <p className="mt-3 text-sm text-slate">Thank you! We print after the batch closes and deliver within about 3 weeks. A confirmation email is on its way.</p>
          <Link href="/merchstore" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            Back to the merch store
          </Link>
        </>
      ) : result.status === "paid" && result.kind === "boost" ? (
        <>
          <p className="font-display text-2xl text-ink">Boost is live ✓</p>
          <p className="mt-3 text-sm text-slate">Your post now rotates in the Boosted slots on the home and Journals pages. Impressions are counted once a real visitor has seen it, spread over several days.</p>
          <AppLink href="/profile/boosts" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">
            See boost results
          </AppLink>
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
      ) : result.kind === "store" ? (
        <>
          <p className="font-display text-2xl text-ink">That item sold out</p>
          <p className="mt-3 text-sm text-slate">
            Your payment went through after the last one was taken. {result.payWith === "wallet" ? "We'll put it back in your wallet" : "We'll refund you in full"} — contact us with reference {reference} if it doesn&apos;t arrive.
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-ink">Slot no longer available</p>
          <p className="mt-3 text-sm text-slate">
            Your payment went through but someone booked that time first. {result.payWith === "wallet" ? "We'll put it back in your wallet" : "We'll refund you"} — contact us with reference {reference}.
          </p>
        </>
      )}
      {result?.status === "paid" && result.payWith === "wallet" && <p className="mt-4 text-xs text-slate">Paid from your <AppLink href="/profile/wallet" className="text-crimson underline">wallet</AppLink>.</p>}
      {backHost && (error || result) && (
        <p className="mt-10">
          <a
            href={`https://${backHost}${result && (result.kind === "digital" || result.kind === "store") ? "/shop" : "/"}`}
            onClick={forgetReturnHost}
            className="text-sm font-semibold text-crimson underline"
          >
            ← Back to {backHost}
          </a>
        </p>
      )}
    </div>
  );
}

export default function BookingConfirm() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-slate">Loading…</p>}>
      <Confirm />
    </Suspense>
  );
}
