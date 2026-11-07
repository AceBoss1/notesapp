"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi } from "@/components/community/api";
import { useGoLive } from "./useGoLive";
import { GoLiveNow } from "./ProfileLive";

type Hosted = { id: string; name: string; avatar?: string; memberCount?: number; role: string };
type Mine = { id: string; title: string; status: string; startsAt: string };

// Go live (/lives/start): the ways to go live on #NotesApp today, in one place. A paid live (tickets, /lives/new, and the ones already
// scheduled), or a room in a community you can host in (owner, admin or moderator: opens its Start a room form). A free live from your
// own profile is the next build (owner, 7 Nov 2026: "link now, build next").
export default function GoLive() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [hosted, setHosted] = useState<Hosted[] | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);
  const allowed = useGoLive();
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user || !allowed) return;
    capi<{ communities: Hosted[] }>("/api/community?host=1").then((r) => setHosted(r.communities)).catch(() => setHosted([]));
    capi<{ hosting?: Mine[] }>("/api/lives").then((r) => setMine((r.hosting ?? []).filter((e) => e.status === "scheduled" || e.status === "live"))).catch(() => {});
  }, [user, allowed]);

  if (user === undefined) return <p className="text-sm text-slate">Loading…</p>;
  if (user === null) return <p className="card p-6 text-sm"><Link href="/login?next=/lives/start" className="text-crimson underline">Sign in</Link> to go live.</p>;
  if (allowed === null) return <p className="text-sm text-slate">Loading…</p>;
  // Team accounts only, while the staff test pass is on (Admin → Limits). Paid lives stay open to everyone from Paid lives (/lives).
  if (!allowed) return <div className="card p-6"><h1 className="font-display text-3xl text-ink">🔴 Go live is coming soon</h1><p className="mt-2 text-sm text-slate">Going live from your profile isn&apos;t open yet. You can still <Link href="/lives" className="text-crimson underline">schedule a paid live</Link>, or start a room in a community you run.</p></div>;
  return (
    <div>
      <h1 className="font-display text-4xl text-ink">🔴 Go live</h1>
      <p className="mt-2 text-slate">Choose how you want to go live. Everyone in a live can chat, send gifts and ask to come on stage.</p>

      <GoLiveNow />

      <section className="card mt-4 p-5">
        <h2 className="font-ui text-lg font-bold text-ink">🎟 A paid live</h2>
        <p className="mt-1 text-sm text-slate">Sell tickets (early bird, normal and late prices), pick who can buy, and go live at the time you set. You open it from its page.</p>
        {mine.length > 0 && (
          <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule">
            {mine.map((e) => (
              <li key={e.id}><Link href={`/lives/${e.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-paper">
                <span className="min-w-0 truncate font-semibold text-ink">{e.title}</span>
                <span className="shrink-0 font-ui text-xs font-bold text-crimson">{e.status === "live" ? "● Back to the live" : "Open →"}</span>
              </Link></li>
            ))}
          </ul>
        )}
        <Link href="/lives/new" className="btn-primary mt-4 inline-block">Schedule a paid live</Link>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-ui text-lg font-bold text-ink">👥 A room in your community</h2>
        <p className="mt-1 text-sm text-slate">Free for the community&apos;s members: audio, with video on when you want it. Owners, admins and moderators can start one.</p>
        {hosted === null ? <p className="mt-3 text-sm text-slate">Loading your communities…</p>
          : hosted.length ? (
            <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule">
              {hosted.map((c) => (
                <li key={c.id}><Link href={`/c/${c.id}?start=room`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-paper">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.avatar ? <img src={c.avatar} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-field">👥</span>}
                    <span className="min-w-0"><b className="block truncate text-ink">{c.name}</b><span className="text-xs text-slate">{c.role.charAt(0).toUpperCase() + c.role.slice(1)}{c.memberCount ? ` · ${c.memberCount.toLocaleString("en-GB")} ${c.memberCount === 1 ? "member" : "members"}` : ""}</span></span>
                  </span>
                  <span className="shrink-0 font-ui text-xs font-bold text-crimson">Start a room →</span>
                </Link></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate">You don&apos;t run a community yet. <Link href="/community" className="text-crimson underline">Start or find one</Link>.</p>}
      </section>

    </div>
  );
}
