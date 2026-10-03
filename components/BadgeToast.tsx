"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { badgeLevel, getUserByUid } from "@/lib/users";
import VerifiedBadge from "@/components/VerifiedBadge";

// A small dismissible nudge to get a badge: the maroon ✔ for people without one, the gold ✔ for
// people who already have the maroon one; nothing for gold holders, suspended accounts or on a
// person's own page. Shown once per browser session, a few seconds after the page loads, and
// stays away for DISMISS_DAYS once closed. Everything it stores is local to the browser.
const DISMISS_DAYS = 3;
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

// `subjectUid`: whose page this is, so nobody is nudged on their own profile.
export default function BadgeToast({ subjectUid }: { subjectUid?: string }) {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (timer) clearTimeout(timer);
      if (u && subjectUid && u.uid === subjectUid) return setVariant(null);
      let v: Variant | null = "verified"; // signed-out visitors see the maroon pitch too
      if (u) {
        const profile = await getUserByUid(u.uid).catch(() => null);
        if (!alive) return;
        if (profile?.suspended) v = null;
        else if (profile) {
          const level = badgeLevel(profile);
          v = level === "gold" ? null : level === "verified" ? "gold" : "verified";
        }
      }
      if (!v) return setVariant(null);
      const dismissedAt = Number(read("local", `na_badge_toast_${v}`) || 0);
      if (read("session", "na_badge_toast_seen") || Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;
      timer = setTimeout(() => {
        write("session", "na_badge_toast_seen", "1");
        if (alive) setVariant(v);
      }, DELAY_MS);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [subjectUid]);

  if (!variant) return null;
  const c = COPY[variant];
  function close() {
    write("local", `na_badge_toast_${variant}`, String(Date.now()));
    setVariant(null);
  }
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-6 sm:w-96">
      <div className="card flex items-start gap-3 border-l-4 border-crimson p-4 shadow-lg">
        <VerifiedBadge size={28} level={variant} />
        <div className="min-w-0 flex-1">
          <p className="font-ui text-sm font-bold text-ink">{c.title}</p>
          <p className="mt-0.5 text-xs text-slate">{c.body}</p>
          <Link href="/badges" onClick={close} className="btn-primary mt-3 inline-block !px-4 !py-2 text-xs">{c.cta}</Link>
        </div>
        <button onClick={close} aria-label="Dismiss" className="-mr-1 -mt-1 px-2 text-lg leading-none text-slate hover:text-crimson">×</button>
      </div>
    </div>
  );
}
