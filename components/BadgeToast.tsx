"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { badgeLevel, getUserByUid, type UserProfile } from "@/lib/users";
import { BADGE_PRICE_KOBO, badgeIncluded, getTierConfig } from "@/lib/tiers";
import { formatNaira } from "@/lib/booking-time";
import VerifiedBadge from "@/components/VerifiedBadge";

// A small dismissible nudge to get a badge: the maroon ✔ for people without one, the gold ✔ for
// people who already have the maroon one; nothing for gold holders, suspended accounts or on a
// person's own page. Shown once per browser session, a few seconds after the page loads, and
// stays away for DISMISS_DAYS once closed. Everything it stores is local to the browser.
const DISMISS_DAYS = 3;
const tierLabel = (t: UserProfile["accountTier"]) => getTierConfig(t)?.label ?? "your plan";
const DELAY_MS = 4000;

type Variant = "verified" | "gold";
const COPY: Record<Variant, { title: string; body: string; cta: string }> = {
  verified: {
    title: "Stand out with a verified badge",
    body: "A maroon ✔ next to your name builds trust on every post, comment and profile.",
    cta: "Get verified",
  },
  gold: {
    title: "Take it to gold",
    body: "The gold ✔ marks you as identity-checked or endorsed by #NotesApp, the highest mark of trust here.",
    cta: "Get the gold badge",
  },
};

const read = (store: "local" | "session", key: string) => {
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
};
const write = (store: "local" | "session", key: string, value: string) => {
  try {
    (store === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* private mode etc. — the toast simply may show again */
  }
};

// `subjectUid`: whose page this is, so nobody is nudged on their own profile. What it suggests depends on the member's plan
// and badge (pitchFor below).
export default function BadgeToast({ subjectUid }: { subjectUid?: string }) {
  const [pitch, setPitch] = useState<Pitch | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (timer) clearTimeout(timer);
      if (u && subjectUid && u.uid === subjectUid) return setPitch(null);
      const profile = u ? await getUserByUid(u.uid).catch(() => null) : null;
      if (!alive) return;
      const p = pitchFor(profile, !!u);
      if (!p) return setPitch(null);
      const dismissedAt = Number(read("local", `na_badge_toast_${p.key}`) || 0);
      if (read("session", "na_badge_toast_seen") || Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;
      timer = setTimeout(() => {
        write("session", "na_badge_toast_seen", "1");
        if (alive) setPitch(p);
      }, DELAY_MS);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [subjectUid]);

  if (!pitch) return null;
  function close() {
    if (pitch) write("local", `na_badge_toast_${pitch.key}`, String(Date.now()));
    setPitch(null);
  }
  return (
    // Computers only: on a phone it would cover the page, so phones get the card inside the journal feed instead.
    <div role="status" className="fixed bottom-4 right-6 z-50 hidden w-96 lg:block">
      <div className="card flex items-start gap-3 border-l-4 border-crimson p-4 shadow-lg">
        <VerifiedBadge size={28} level={pitch.key} />
        <div className="min-w-0 flex-1">
          <p className="font-ui text-sm font-bold text-ink">{pitch.title}</p>
          <p className="mt-0.5 text-xs text-slate">{pitch.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link href={pitch.href} onClick={close} className="btn-primary !px-4 !py-2 text-xs">{pitch.cta}</Link>
            {pitch.alt && <Link href={pitch.alt.href} onClick={close} className="whitespace-nowrap text-xs font-semibold text-crimson underline">{pitch.alt.label}</Link>}
          </div>
        </div>
        <button onClick={close} aria-label="Dismiss" className="-mr-1 -mt-1 px-2 text-lg leading-none text-slate hover:text-crimson">×</button>
      </div>
    </div>
  );
}

// What to suggest, read from the member's current plan and badge first (inline card, Moda redesign): visitors are asked to
// join; Business and Enterprise include the ✔, so an organisation there that isn't showing it is sent to confirm its registration;
// other plans get the ₦/month add-on or Business, where it's included; maroon holders get the gold pitch; gold holders nothing.
type Pitch = { key: Variant; title: string; body: string; cta: string; href: string; alt?: { label: string; href: string } };
function pitchFor(profile: UserProfile | null, signedIn: boolean): Pitch | null {
  if (!signedIn) return { key: "verified", title: COPY.verified.title, body: COPY.verified.body, cta: "Create your free account", href: "/signup" };
  if (!profile || profile.suspended) return null;
  const level = badgeLevel(profile);
  if (level === "gold") return null;
  if (level === "verified") return { key: "gold", ...COPY.gold, href: "/badges" };
  const price = formatNaira(BADGE_PRICE_KOBO);
  if (badgeIncluded(profile.accountTier)) {
    return profile.accountKind === "organisation"
      ? { key: "verified", title: "Your ✔ is waiting", body: `Your ${tierLabel(profile.accountTier)} plan includes the badge. Confirm your organisation's registration and it shows beside your name.`, cta: "Confirm registration", href: "/organisation" }
      : { key: "verified", title: COPY.verified.title, body: `Your ${tierLabel(profile.accountTier)} plan includes the badge.`, cta: "Get verified", href: "/badges" };
  }
  return {
    key: "verified", title: COPY.verified.title,
    body: `You're on ${tierLabel(profile.accountTier)}. Add the maroon ✔ for ${price} a month, or move to Business, where it's included.`,
    cta: `Add the badge · ${price}/month`, href: "/badges", alt: { label: "See Business", href: "/pricing" },
  };
}

// The same nudge as a card inside the journal feed (Moda redesign): in the feed on a phone, in the right column on a computer.
// It shows straight away (no delay) and the ✕ hides it for the same DISMISS_DAYS.
export function BadgePitchCard({ className = "" }: { className?: string }) {
  const [pitch, setPitch] = useState<Pitch | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    const profile = u ? await getUserByUid(u.uid).catch(() => null) : null;
    const p = pitchFor(profile, !!u);
    setPitch(p && Date.now() - Number(read("local", `na_badge_toast_${p.key}`) || 0) >= DISMISS_DAYS * 86_400_000 ? p : null);
  }), []);
  if (!pitch) return null;
  const close = () => { write("local", `na_badge_toast_${pitch.key}`, String(Date.now())); setPitch(null); };
  return (
    <div className={`rounded-2xl bg-crimson/[0.06] p-5 ${className}`}>
      <div className="flex items-start gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${pitch.key === "gold" ? "bg-[#C9A227]" : "bg-crimson"}`} aria-hidden>✓</span>
        <div className="min-w-0 flex-1">
          <p className="font-ui text-base font-bold text-ink">{pitch.title}</p>
          <p className="mt-1 text-sm leading-snug text-slate">{pitch.body}</p>
        </div>
        <button onClick={close} aria-label="Dismiss" className="-mr-1 -mt-1 px-1 text-lg leading-none text-slate hover:text-crimson">×</button>
      </div>
      <Link href={pitch.href} onClick={close} className="mt-4 block rounded-full bg-crimson py-3 text-center font-ui text-sm font-bold text-paper hover:bg-crimson-deep">{pitch.cta}</Link>
      {pitch.alt && <Link href={pitch.alt.href} className="mt-2 block text-center font-ui text-sm font-semibold text-crimson hover:underline">{pitch.alt.label}</Link>}
    </div>
  );
}
