"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";

// Saved coupons ending soon (lib/discounts.ts COUPON_REMIND_DAYS): a bar under the header on the first visit (or app opening) of
// each day, and again after each sign-in. The bell gets one a day too (the cron's couponReminders). Nothing shows when none end soon.
type Ending = { id: string; code: string; label: string; ownerUsername: string; endsIn: string };
const KEY = (uid: string) => `notesapp:coupon-prompt:${uid}`;
const today = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd in the member's own time zone

export default function CouponReminder() {
  const [coupons, setCoupons] = useState<Ending[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const sawSignedOut = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) { sawSignedOut.current = true; setUid(null); setCoupons([]); return; }
    let shownToday = false;
    try { shownToday = localStorage.getItem(KEY(u.uid)) === today(); } catch { /* storage blocked: show it */ }
    const justSignedIn = sawSignedOut.current; // signed out earlier on this page, signed in now
    sawSignedOut.current = false;
    setUid(u.uid);
    if (shownToday && !justSignedIn) return;
    api<{ coupons: Ending[] }>("/api/coupons?ending=1").then((r) => {
      setCoupons(r.coupons ?? []);
      // Shown once for today (on this device); a fresh sign-in shows it again.
      if (r.coupons?.length) { try { localStorage.setItem(KEY(u.uid), today()); } catch { /* fine */ } }
    }).catch(() => {});
  }), []);

  if (!uid || !coupons.length) return null;
  const close = () => setCoupons([]);
  const [first, ...rest] = coupons;
  return (
    <div className="border-b border-rule bg-crimson/5 px-4 py-3 text-sm text-ink" role="region" aria-label="Coupons ending soon">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span>
          🏷️ Your coupon <b className="font-mono text-crimson">{first.code}</b> ({first.label}) at @{first.ownerUsername} <b>{first.endsIn}</b>
          {rest.length ? <span className="text-slate">, and {rest.length} more ending soon</span> : null}.
        </span>
        <span className="flex gap-3 font-ui text-xs font-semibold">
          <Link href={`/u/${first.ownerUsername}/store`} onClick={close} className="rounded-full bg-crimson px-4 py-1.5 text-paper">Shop now</Link>
          <Link href="/profile/coupons" onClick={close} className="text-slate underline">My coupons</Link>
          <button type="button" onClick={close} className="text-slate underline">Not now</button>
        </span>
      </div>
    </div>
  );
}
