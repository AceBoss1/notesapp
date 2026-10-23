"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isKidUid } from "@/lib/kids";
import { kidCall, type KidState } from "@/components/KidGuard";

const TILES = [
  { key: "prep", href: "/exam-prep", emoji: "📚", title: "Naija Exam Prep", sub: "Practise questions and mocks" },
  { key: "academy", href: "/academy", emoji: "🎓", title: "Notes Academy", sub: "Free courses" },
  { key: "reading", href: "/journals", emoji: "📖", title: "Read journals", sub: "Stories and notes" },
  { key: "life", href: "/life", emoji: "🎮", title: "Notes Life", sub: "Kids' Notesville" },
] as const;

// A child profile's home (kids mode): only the areas the parent switched on, and today's Notes Life play time.
export default function KidsHome() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [kid, setKid] = useState<KidState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user && isKidUid(user.uid)) kidCall(user).then((d) => setKid(d.kid)).catch((e) => setError(e.message)); }, [user]);
  if (user === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!user || !isKidUid(user.uid)) return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Kids</h1>
      <p className="mt-2 text-slate">Child profiles are opened by a parent from their own account.</p>
      <Link href="/profile/family" className="mt-4 inline-block font-semibold text-crimson">Go to Family →</Link>
    </div>
  );
  if (!kid) return <div className="px-6 py-24 text-center text-slate">{error || "Loading…"}</div>;
  const on = TILES.filter((t) => kid.allow[t.key]);
  const left = Math.ceil(kid.playLeftMs / 60_000);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl text-ink">Hi, {kid.nickname}! 🌟</h1>
      <p className="mt-1 text-slate">What would you like to do?</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {on.map((t) => (
          <Link key={t.key} href={t.href} className="card flex items-center gap-4 p-5 hover:border-crimson">
            <span className="text-4xl" aria-hidden>{t.emoji}</span>
            <span><span className="block font-display text-2xl text-ink">{t.title}</span><span className="text-sm text-slate">{t.key === "life" ? (left > 0 ? `${left} min of play left today` : "Play time's done for today") : t.sub}</span></span>
          </Link>
        ))}
        {!on.length && <p className="text-slate">Nothing is switched on yet. Ask your parent.</p>}
      </div>
    </div>
  );
}
